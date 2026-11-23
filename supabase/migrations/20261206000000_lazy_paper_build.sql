-- ============================================================================
-- JobHub — lazy paper build for scheduled exams
--
-- The 60-day BCS and 30-day Petrobangla plans publish their daily live MCQ
-- schedules for the WHOLE plan up front, while the question bank is still
-- being filled. A paper frozen at publish time would either fail (pool too
-- small today) or ignore every question added later.
--
-- So the paper is now built just-in-time: when the FIRST student enters a
-- scheduled exam that has no paper yet but carries a routine-scoped
-- composition (settings.composition.sections), the sectioned builder runs
-- right there — with whatever approved+verified questions exist at that
-- moment. Later entrants share the same paper (double-build is prevented by
-- a row lock on the schedule). If the pool is still short, the start fails
-- loudly with the builder's own message — never a silently thinner paper.
-- ============================================================================

create or replace function public.jh_start_scheduled_attempt(p_schedule_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_schedule public.exam_schedules;
  v_existing public.exam_attempts;
  v_paper uuid;
  v_now timestamptz := now();
  v_deadline timestamptz;
  v_attempt uuid;
  v_count integer;
  v_sections jsonb;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_schedule from public.exam_schedules where id = p_schedule_id for share;
  if not found then
    raise exception 'Exam not found' using errcode = 'P0002';
  end if;
  if v_schedule.status <> 'published' then
    raise exception 'This exam is not open for participation' using errcode = '42501';
  end if;
  if v_now < v_schedule.starts_at then
    raise exception 'This exam has not started yet' using errcode = 'P0001';
  end if;
  if v_now >= v_schedule.ends_at then
    raise exception 'The entry window for this exam has closed' using errcode = 'P0001';
  end if;

  select * into v_existing from public.exam_attempts
   where user_id = v_user and schedule_id = p_schedule_id;
  if found then
    return jsonb_build_object(
      'attempt_id', v_existing.id,
      'deadline_at', v_existing.deadline_at,
      'resumed', true,
      'status', v_existing.status
    );
  end if;

  select id, question_count into v_paper, v_count
  from public.exam_papers where schedule_id = p_schedule_id
  order by created_at desc limit 1;

  -- Lazy build: no paper yet, but the schedule carries its own routine-scoped
  -- composition. Lock the schedule row so only one entrant builds.
  if v_paper is null then
    v_sections := v_schedule.settings -> 'composition' -> 'sections';
    if jsonb_typeof(v_sections) = 'array' and jsonb_array_length(v_sections) > 0 then
      perform 1 from public.exam_schedules where id = p_schedule_id for update;

      -- Someone else may have built it while we waited for the lock.
      select id, question_count into v_paper, v_count
      from public.exam_papers where schedule_id = p_schedule_id
      order by created_at desc limit 1;

      if v_paper is null then
        begin
          v_paper := public.jh_build_paper_sectioned(
            v_schedule.course_id,
            v_sections,
            coalesce(v_schedule.title_en, ''),
            coalesce(v_schedule.title_bn, ''),
            v_schedule.duration_minutes,
            v_schedule.total_marks,
            v_schedule.negative_marks,
            coalesce(v_schedule.created_by, v_schedule.published_by, v_user),
            coalesce(
              v_schedule.settings -> 'difficulty_mix',
              '{"previous":0,"easy":30,"medium":50,"hard":20}'::jsonb
            ),
            'scheduled',
            p_schedule_id
          );
        exception when others then
          raise exception 'প্রশ্নপত্র তৈরি করা যায়নি — প্রশ্নব্যাংকে এই পরীক্ষার টপিকে যথেষ্ট প্রশ্ন নেই (%)', sqlerrm
            using errcode = 'P0001';
        end;
        select question_count into v_count from public.exam_papers where id = v_paper;
      end if;
    end if;
  end if;

  if v_paper is null then
    raise exception 'No paper has been published for this exam' using errcode = 'P0001';
  end if;

  v_deadline := least(v_now + make_interval(mins => v_schedule.duration_minutes), v_schedule.ends_at);

  insert into public.exam_attempts (
    user_id, paper_id, schedule_id, course_id, mode, started_at, deadline_at,
    total_questions, total_marks
  ) values (
    v_user, v_paper, p_schedule_id, v_schedule.course_id, 'scheduled', v_now, v_deadline,
    v_count, v_count * v_schedule.positive_marks
  ) returning id into v_attempt;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (v_user, 'attempt.start', 'exam_attempt', v_attempt::text,
          jsonb_build_object('schedule_id', p_schedule_id, 'mode', 'scheduled'));

  return jsonb_build_object(
    'attempt_id', v_attempt,
    'deadline_at', v_deadline,
    'resumed', false,
    'status', 'in_progress'
  );
end;
$$;

revoke all on function public.jh_start_scheduled_attempt(uuid) from public;
revoke all on function public.jh_start_scheduled_attempt(uuid) from anon;
grant execute on function public.jh_start_scheduled_attempt(uuid) to authenticated, service_role;
