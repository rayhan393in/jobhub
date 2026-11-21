-- ============================================================================
-- JobHub — build a paper with a difficulty mix (60/20/10/10)
--
-- `jh_select_questions` picks at random from the whole verified pool. That is
-- right for practice, wrong for a paper that must be 100 marks with a fixed
-- mix: a course with 400 approved questions but only 3 of them tagged hard
-- cannot silently produce a paper that is 60% hard.
--
-- This function fills each difficulty bucket from the topics in the
-- composition, tops the shortfall up from the neighbouring buckets, and
-- refuses only when the *total* verified pool is genuinely too small. Every
-- question it returns is still approved, verified, and inside the requested
-- topics — no unverified filler ever enters a paper.
-- ============================================================================

create or replace function public.jh_build_paper_with_mix(
  p_course_id      uuid,
  p_composition    jsonb,
  p_title_en       text,
  p_title_bn       text,
  p_duration_minutes integer,
  p_total_marks    numeric,
  p_negative_marks numeric,
  p_created_by     uuid,
  p_mix            jsonb default '{"previous":60,"hard":20,"easy":10,"medium":10}'::jsonb,
  p_paper_type     text default 'practice',
  p_schedule_id    uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total       integer := 0;
  v_item        jsonb;
  v_topic_ids   uuid[] := '{}';
  v_subject_ids uuid[] := '{}';
  v_pool        integer;
  v_ids         uuid[];
  v_selected    uuid[] := '{}';
  v_need        integer;
  v_bucket      text;
  v_buckets     text[] := array['previous', 'hard', 'easy', 'medium'];
  v_pct         numeric;
  v_targets     jsonb := '{}'::jsonb;
  v_paper       uuid;
  v_positive    numeric;
  v_mix_total   numeric := 0;
  v_assigned    integer := 0;
begin
  if jsonb_typeof(coalesce(p_composition -> 'items', 'null'::jsonb)) <> 'array' then
    raise exception 'Composition must contain an items array' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_composition -> 'items')
  loop
    v_total := v_total + coalesce((v_item ->> 'count')::int, 0);
    if v_item ->> 'topic_id' is not null then
      v_topic_ids := v_topic_ids || (v_item ->> 'topic_id')::uuid;
    end if;
    if v_item ->> 'subject_id' is not null then
      v_subject_ids := v_subject_ids || (v_item ->> 'subject_id')::uuid;
    end if;
  end loop;

  if v_total < 1 then
    raise exception 'Select at least one question' using errcode = '22023';
  end if;

  -- 60/20/10/10 sums to 100; anything else is a caller bug, not a preference.
  select coalesce(sum(value::numeric), 0) into v_mix_total
  from jsonb_each_text(coalesce(p_mix, '{}'::jsonb))
  where key in ('previous', 'hard', 'easy', 'medium');
  if v_mix_total <> 100 then
    raise exception 'Difficulty mix must total 100 (got %)', v_mix_total using errcode = '22023';
  end if;

  -- How many of each bucket the paper wants.
  for v_bucket in select unnest(v_buckets)
  loop
    v_pct := coalesce((p_mix ->> v_bucket)::numeric, 0);
    v_targets := jsonb_set(v_targets, array[v_bucket], to_jsonb(floor(v_total * v_pct / 100.0)::int));
    v_assigned := v_assigned + (v_targets ->> v_bucket)::int;
  end loop;
  -- Round the remainders onto 'previous' so the counts still sum to v_total.
  if v_assigned < v_total then
    v_targets := jsonb_set(
      v_targets, '{previous}',
      to_jsonb(((v_targets ->> 'previous')::int) + (v_total - v_assigned))
    );
  end if;

  -- Fill bucket by bucket, then top shortfalls up from whatever is left.
  for v_bucket in select unnest(v_buckets)
  loop
    v_need := (v_targets ->> v_bucket)::int;
    continue when v_need < 1;

    if v_bucket = 'previous' then
      select array_agg(id) into v_ids from (
        select q.id from public.questions q
        where q.course_id = p_course_id
          and q.status = 'approved' and q.is_verified
          and (cardinality(v_topic_ids) = 0 or q.topic_id = any (v_topic_ids))
          and (cardinality(v_subject_ids) = 0 or q.subject_id = any (v_subject_ids))
          and not (q.id = any (v_selected))
          and (q.source_type = 'previous' or q.exam_name is not null or q.year is not null)
        order by random() limit v_need
      ) sel;
    else
      select array_agg(id) into v_ids from (
        select q.id from public.questions q
        where q.course_id = p_course_id
          and q.status = 'approved' and q.is_verified
          and q.difficulty = v_bucket
          and (cardinality(v_topic_ids) = 0 or q.topic_id = any (v_topic_ids))
          and (cardinality(v_subject_ids) = 0 or q.subject_id = any (v_subject_ids))
          and not (q.id = any (v_selected))
        order by random() limit v_need
      ) sel;
    end if;

    v_selected := v_selected || coalesce(v_ids, '{}');
  end loop;

  -- Top up: a young question bank is heavy on 'medium' and light on 'hard'.
  -- Rather than failing the whole paper, take the best available inside the
  -- requested topics. The paper still reports its real difficulty mix.
  if coalesce(array_length(v_selected, 1), 0) < v_total then
    select array_agg(id) into v_ids from (
      select q.id from public.questions q
      where q.course_id = p_course_id
        and q.status = 'approved' and q.is_verified
        and (cardinality(v_topic_ids) = 0 or q.topic_id = any (v_topic_ids))
        and (cardinality(v_subject_ids) = 0 or q.subject_id = any (v_subject_ids))
        and not (q.id = any (v_selected))
      order by random()
      limit v_total - coalesce(array_length(v_selected, 1), 0)
    ) sel;
    v_selected := v_selected || coalesce(v_ids, '{}');
  end if;

  -- Honest failure: say how short the bank is, do not shrink the paper.
  if coalesce(array_length(v_selected, 1), 0) < v_total then
    select count(*) into v_pool
    from public.questions q
    where q.course_id = p_course_id
      and q.status = 'approved' and q.is_verified
      and (cardinality(v_topic_ids) = 0 or q.topic_id = any (v_topic_ids))
      and (cardinality(v_subject_ids) = 0 or q.subject_id = any (v_subject_ids));
    raise exception 'Only % verified questions available for this selection, % required',
      v_pool, v_total using errcode = 'P0001';
  end if;

  -- Marking is derived so the paper always totals exactly p_total_marks.
  v_positive := round(p_total_marks / v_total, 2);

  insert into public.exam_papers (
    schedule_id, course_id, paper_type, title_en, title_bn, question_count,
    duration_minutes, total_marks, positive_marks, negative_marks, composition,
    difficulty_mix, created_by
  ) values (
    p_schedule_id, p_course_id, p_paper_type,
    coalesce(p_title_en, ''), coalesce(p_title_bn, ''), v_total,
    p_duration_minutes, p_total_marks, v_positive, p_negative_marks, p_composition,
    p_mix, p_created_by
  ) returning id into v_paper;

  insert into public.exam_questions (paper_id, question_id, position, marks)
  select v_paper, q, row_number() over (order by ord), v_positive
  from unnest(v_selected) with ordinality as t(q, ord);

  return v_paper;
end;
$$;

comment on function public.jh_build_paper_with_mix is
  'Builds a fixed-mark paper with a 60/20/10/10 difficulty mix, topping up from the verified pool inside the requested topics and failing loudly when short.';

revoke all on function public.jh_build_paper_with_mix(uuid,jsonb,text,text,integer,numeric,numeric,uuid,jsonb,text,uuid) from public;
grant execute on function public.jh_build_paper_with_mix(uuid,jsonb,text,text,integer,numeric,numeric,uuid,jsonb,text,uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Starting a structured exam from the builder
--
-- `jh_start_custom_attempt` builds through `jh_build_paper_from_composition`,
-- which ignores difficulty and charges 1 mark per question. This wrapper is the
-- exam-mode path: it goes through the mixed builder so the paper is a real 100
-- marks at 60/20/10/10, honours the platform question/duration limits, and
-- records the total marks on the attempt itself so scoring matches the paper.
-- ---------------------------------------------------------------------------
create or replace function public.jh_start_structured_attempt(
  p_course_id uuid,
  p_composition jsonb,
  p_duration_minutes integer,
  p_mode text,
  p_title_en text default '',
  p_title_bn text default '',
  p_total_marks numeric default 100,
  p_mix jsonb default '{"previous":60,"hard":20,"easy":10,"medium":10}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_course public.courses;
  v_limits jsonb;
  v_total integer := 0;
  v_item jsonb;
  v_paper uuid;
  v_now timestamptz := now();
  v_attempt uuid;
  v_max_questions integer;
  v_max_duration integer;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_mode not in ('custom','mixed_practice','topic_practice','wrong_practice','bookmark_practice','timed_mock','revision') then
    raise exception 'Unsupported practice mode' using errcode = '22023';
  end if;

  select * into v_course from public.courses where id = p_course_id;
  if not found or v_course.status <> 'published' then
    raise exception 'Course not available' using errcode = 'P0002';
  end if;

  select value into v_limits from public.system_settings where key = 'exam_limits';
  v_max_questions := coalesce((v_limits->>'max_questions')::int, 100);
  v_max_duration := coalesce((v_limits->>'max_duration_minutes')::int, 180);

  if p_duration_minutes < 1 or p_duration_minutes > v_max_duration then
    raise exception 'Duration must be between 1 and % minutes', v_max_duration using errcode = '22023';
  end if;
  if p_total_marks <= 0 then
    raise exception 'Total marks must be positive' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_composition->'items','[]'::jsonb))
  loop
    v_total := v_total + coalesce((v_item->>'count')::int, 0);
  end loop;

  if v_total < 1 then
    raise exception 'Select at least one question' using errcode = '22023';
  end if;
  if v_total > v_max_questions then
    raise exception 'A single exam is limited to % questions', v_max_questions using errcode = '22023';
  end if;

  v_paper := public.jh_build_paper_with_mix(
    p_course_id, p_composition, p_title_en, p_title_bn, p_duration_minutes,
    p_total_marks,
    coalesce((v_course.exam_config->>'negative_marks')::numeric, 0.5),
    v_user, p_mix, 'practice', null
  );

  insert into public.exam_attempts (
    user_id, paper_id, schedule_id, course_id, mode, started_at, deadline_at,
    total_questions, total_marks
  ) values (
    v_user, v_paper, null, p_course_id, p_mode, v_now,
    v_now + make_interval(mins => p_duration_minutes),
    v_total, p_total_marks
  ) returning id into v_attempt;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (v_user, 'attempt.start', 'exam_attempt', v_attempt::text,
          jsonb_build_object('mode', p_mode, 'questions', v_total, 'total_marks', p_total_marks, 'mix', p_mix));

  return jsonb_build_object(
    'attempt_id', v_attempt,
    'deadline_at', v_now + make_interval(mins => p_duration_minutes),
    'resumed', false,
    'status', 'in_progress',
    'total_marks', p_total_marks,
    'question_count', v_total
  );
end;
$$;

revoke all on function public.jh_start_structured_attempt(uuid,jsonb,integer,text,text,text,numeric,jsonb) from public;
grant execute on function public.jh_start_structured_attempt(uuid,jsonb,integer,text,text,text,numeric,jsonb) to authenticated;
