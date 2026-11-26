-- ---------------------------------------------------------------------------
-- Dashboard audit follow-ups (D3, D4, S6)
--
--   D4. jh_student_analytics: the weekly chart grouped bars by Asia/Dhaka
--       date but filtered rows with a UTC rolling 7-day window, cutting the
--       first ~6 hours of the oldest Dhaka day. Both now use Dhaka day
--       boundaries, and the opaque `(d at time zone 'utc')::date` join is
--       replaced with a plain date join.
--   S6. jh_my_rank: the leaderboard UI previously found the caller's rank by
--       scanning the top-50 list, so anyone below 50 saw "not on the list".
--       This returns the caller's true rank (and the total participant
--       count) for any scope.
--   D3. jh_course_taxonomy: the practice page fanned out ~8 round-trips
--       (subjects + topics + subtopics per course). One invoker-rights call
--       now returns the whole published-course taxonomy as nested JSON.
-- ---------------------------------------------------------------------------

create or replace function public.jh_student_analytics(p_course_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_summary jsonb;
  v_subjects jsonb;
  v_topics jsonb;
  v_weekly jsonb;
  v_history jsonb;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'attempts', count(*),
    'released', count(*) filter (where r.is_released),
    'avg_score', coalesce(round(avg(r.score) filter (where r.is_released), 2), 0),
    'avg_accuracy', coalesce(round(avg(r.accuracy) filter (where r.is_released), 2), 0),
    'correct', coalesce(sum(r.correct_count) filter (where r.is_released), 0),
    'wrong', coalesce(sum(r.wrong_count) filter (where r.is_released), 0),
    'unanswered', coalesce(sum(r.unanswered_count) filter (where r.is_released), 0),
    'best_score', coalesce(max(r.score) filter (where r.is_released), 0)
  ) into v_summary
  from public.results r
  where r.user_id = v_user and (p_course_id is null or r.course_id = p_course_id);

  select coalesce(jsonb_agg(row order by (row->>'accuracy')::numeric asc), '[]'::jsonb) into v_subjects
  from (
    select jsonb_build_object(
      'subject_id', q.subject_id,
      'title_bn', s.title_bn,
      'title_en', s.title_en,
      'attempted', count(*) filter (where sa.selected_option is not null),
      'correct', count(*) filter (where sa.selected_option = q.correct_option),
      'accuracy', case when count(*) filter (where sa.selected_option is not null) > 0
        then round(count(*) filter (where sa.selected_option = q.correct_option)::numeric * 100
                   / count(*) filter (where sa.selected_option is not null), 2) else 0 end
    ) as row
    from public.results r
    join public.exam_attempts a on a.id = r.attempt_id
    join public.exam_questions eq on eq.paper_id = a.paper_id
    join public.questions q on q.id = eq.question_id
    join public.subjects s on s.id = q.subject_id
    left join public.student_answers sa
      on sa.attempt_id = a.id and sa.question_id = q.id
    where r.user_id = v_user and r.is_released
      and (p_course_id is null or r.course_id = p_course_id)
    group by q.subject_id, s.title_bn, s.title_en
    having count(*) filter (where sa.selected_option is not null) > 0
  ) sub;

  select coalesce(jsonb_agg(row order by (row->>'accuracy')::numeric asc), '[]'::jsonb) into v_topics
  from (
    select jsonb_build_object(
      'topic_id', q.topic_id,
      'title_bn', t.title_bn,
      'title_en', t.title_en,
      'subject_bn', s.title_bn,
      'attempted', count(*) filter (where sa.selected_option is not null),
      'correct', count(*) filter (where sa.selected_option = q.correct_option),
      'accuracy', round(count(*) filter (where sa.selected_option = q.correct_option)::numeric * 100
                 / greatest(count(*) filter (where sa.selected_option is not null), 1), 2)
    ) as row
    from public.results r
    join public.exam_attempts a on a.id = r.attempt_id
    join public.exam_questions eq on eq.paper_id = a.paper_id
    join public.questions q on q.id = eq.question_id
    join public.topics t on t.id = q.topic_id
    join public.subjects s on s.id = q.subject_id
    left join public.student_answers sa
      on sa.attempt_id = a.id and sa.question_id = q.id
    where r.user_id = v_user and r.is_released
      and (p_course_id is null or r.course_id = p_course_id)
    group by q.topic_id, t.title_bn, t.title_en, s.title_bn
    having count(*) filter (where sa.selected_option is not null) >= 1
  ) sub;

  -- Weekly chart: both the series AND the filter use Asia/Dhaka day
  -- boundaries, so edge days are complete (previously the filter was a UTC
  -- rolling window that cut the first 6 hours of the oldest Dhaka day).
  select coalesce(jsonb_agg(jsonb_build_object(
      'date', gs.d::date,
      'score', coalesce(x.avg_score, 0),
      'attempts', coalesce(x.attempts, 0)
    ) order by gs.d), '[]'::jsonb) into v_weekly
  from generate_series(
        (now() at time zone 'Asia/Dhaka')::date - 6,
        (now() at time zone 'Asia/Dhaka')::date,
        interval '1 day'
      ) as gs(d)
  left join (
    select (a.submitted_at at time zone 'Asia/Dhaka')::date as day,
           round(avg(r.score), 2) as avg_score, count(*) as attempts
    from public.results r
    join public.exam_attempts a on a.id = r.attempt_id
    where r.user_id = v_user
      and (p_course_id is null or r.course_id = p_course_id)
      and a.submitted_at >= (((now() at time zone 'Asia/Dhaka')::date - 6)::timestamp at time zone 'Asia/Dhaka')
    group by 1
  ) x on x.day = gs.d::date;

  select coalesce(jsonb_agg(row order by submitted_at desc), '[]'::jsonb) into v_history
  from (
    select jsonb_build_object(
      'attempt_id', a.id,
      'result_id', r.id,
      'score', r.score,
      'total_marks', r.total_marks,
      'accuracy', r.accuracy,
      'correct', r.correct_count,
      'wrong', r.wrong_count,
      'unanswered', r.unanswered_count,
      'mode', a.mode,
      'is_released', r.is_released,
      'submitted_at', a.submitted_at,
      'title_bn', es.title_bn,
      'title_en', es.title_en,
      'course_id', r.course_id
    ) as row, a.submitted_at
    from public.results r
    join public.exam_attempts a on a.id = r.attempt_id
    left join public.exam_schedules es on es.id = r.schedule_id
    where r.user_id = v_user and (p_course_id is null or r.course_id = p_course_id)
    order by a.submitted_at desc
    limit 20
  ) sub;

  return jsonb_build_object(
    'summary', v_summary,
    'subjects', v_subjects,
    'topics', v_topics,
    'weekly', v_weekly,
    'history', v_history
  );
end;
$$;

-- The caller's own rank in a scope, even when they are outside the top-N
-- window the leaderboard page shows. Mirrors jh_leaderboard's scoping and
-- ordering exactly; picks the caller's best (lowest) rank when several of
-- their results fall in scope.
create or replace function public.jh_my_rank(
  p_scope text,
  p_course_id uuid default null,
  p_schedule_id uuid default null
)
returns jsonb
language sql
stable security definer
set search_path = public, pg_temp
as $$
  with scoped as (
    select r.*, a.submitted_at as attempt_submitted_at
    from public.results r
    join public.exam_attempts a on a.id = r.attempt_id
    left join public.exam_schedules es on es.id = r.schedule_id
    where (
        r.is_released
        or (es.result_release_at is not null and now() >= es.result_release_at)
      )
      and (p_scope <> 'course'   or r.course_id = p_course_id)
      and (p_scope <> 'exam'     or r.schedule_id = p_schedule_id)
      and (p_scope <> 'daily'    or (a.submitted_at at time zone 'Asia/Dhaka')::date = (now() at time zone 'Asia/Dhaka')::date)
      and (p_scope <> 'weekly'   or a.submitted_at >= date_trunc('week', now() at time zone 'Asia/Dhaka') at time zone 'Asia/Dhaka')
      and (p_course_id is null or r.course_id = p_course_id)
  ), ranked as (
    select
      rank() over (order by s.score desc, s.accuracy desc, s.attempt_submitted_at asc)::int as rank,
      count(*) over ()::int as total,
      s.user_id, s.score, s.total_marks, s.accuracy, s.attempt_submitted_at
    from scoped s
    join public.profiles p on p.id = s.user_id
    where p.is_active
  )
  select coalesce(
    (select jsonb_build_object(
       'rank', rank, 'total', total, 'score', score, 'total_marks', total_marks,
       'accuracy', accuracy, 'submitted_at', attempt_submitted_at)
     from ranked where user_id = auth.uid()
     order by rank asc limit 1),
    jsonb_build_object('rank', null, 'total', coalesce((select max(total) from ranked), 0))
  );
$$;
revoke all on function public.jh_my_rank(text,uuid,uuid) from public;
grant execute on function public.jh_my_rank(text,uuid,uuid) to authenticated;

-- Full published-course taxonomy (subjects + topics + subtopics) in one
-- round-trip. Invoker rights: the catalogue tables are world-readable under
-- RLS, so no definer escalation is needed.
create or replace function public.jh_course_taxonomy()
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_object_agg(c.id, jsonb_build_object(
    'subjects', coalesce(subj.list, '[]'::jsonb),
    'topics', coalesce(top.list, '[]'::jsonb)
  )), '{}'::jsonb)
  from public.courses c
  left join lateral (
    select jsonb_agg(jsonb_build_object('id', s.id, 'title_bn', s.title_bn, 'title_en', s.title_en)
                     order by s.sort_order) as list
    from public.subjects s
    where s.course_id = c.id and s.is_active
  ) subj on true
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'subject_id', t.subject_id, 'title_bn', t.title_bn, 'title_en', t.title_en,
      'subtopics', coalesce(st.list, '[]'::jsonb)
    ) order by s2.sort_order, t.sort_order) as list
    from public.topics t
    join public.subjects s2 on s2.id = t.subject_id and s2.course_id = c.id and s2.is_active
    left join lateral (
      select jsonb_agg(jsonb_build_object('id', x.id, 'title_bn', x.title_bn) order by x.sort_order) as list
      from public.subtopics x where x.topic_id = t.id and x.is_active
    ) st on true
    where t.is_active
  ) top on true
  where c.status = 'published';
$$;

-- Deliberately NOT granted to `anon`. 20261127000000_function_privilege_lockdown
-- fixes the set of functions an anonymous caller may execute at exactly two
-- (jh_public_question_count, jh_admin_seat_available); tests/db/schema.test.ts
-- asserts it. The only caller is the signed-in /practice page, so `authenticated`
-- is sufficient. Re-adding `anon` here would silently widen the surface the
-- NULL-bypass audit was written to close.
revoke all on function public.jh_course_taxonomy() from public, anon;
grant execute on function public.jh_course_taxonomy() to authenticated;
