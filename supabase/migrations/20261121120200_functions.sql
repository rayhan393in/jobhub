-- ============================================================================
-- JobHub — 03 Server-side domain functions
-- Every function is SECURITY DEFINER, pins search_path, and derives the caller
-- from auth.uid(). The browser never receives an answer key, a score, or a
-- deadline it can influence.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Availability of verified questions for an exam/practice scope
-- ---------------------------------------------------------------------------
create or replace function public.jh_question_availability(
  p_course_id uuid,
  p_subject_id uuid default null,
  p_topic_id uuid default null,
  p_subtopic_id uuid default null
)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::int
  from public.questions q
  where q.course_id = p_course_id
    and q.status = 'approved'
    and q.is_verified
    and (p_subject_id is null or q.subject_id = p_subject_id)
    and (p_topic_id is null or q.topic_id = p_topic_id)
    and (p_subtopic_id is null or q.subtopic_id = p_subtopic_id);
$$;

-- ---------------------------------------------------------------------------
-- Shared selection helper: picks `p_count` questions for one composition item.
-- Raises instead of silently substituting unverified or short pools.
-- ---------------------------------------------------------------------------
create or replace function public.jh_select_questions(
  p_course_id uuid,
  p_subject_id uuid,
  p_topic_id uuid,
  p_subtopic_id uuid,
  p_count integer,
  p_exclude uuid[] default '{}'
)
returns uuid[]
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_available integer;
  v_ids uuid[];
begin
  if p_count is null or p_count < 1 then
    raise exception 'Question count must be at least 1' using errcode = '22023';
  end if;

  select count(*) into v_available
  from public.questions q
  where q.course_id = p_course_id
    and q.status = 'approved'
    and q.is_verified
    and (p_subject_id is null or q.subject_id = p_subject_id)
    and (p_topic_id is null or q.topic_id = p_topic_id)
    and (p_subtopic_id is null or q.subtopic_id = p_subtopic_id)
    and not (q.id = any (p_exclude));

  if v_available < p_count then
    raise exception 'Only % verified question(s) available for this selection, % requested',
      v_available, p_count using errcode = 'P0001';
  end if;

  select array_agg(id) into v_ids from (
    select q.id
    from public.questions q
    where q.course_id = p_course_id
      and q.status = 'approved'
      and q.is_verified
      and (p_subject_id is null or q.subject_id = p_subject_id)
      and (p_topic_id is null or q.topic_id = p_topic_id)
      and (p_subtopic_id is null or q.subtopic_id = p_subtopic_id)
      and not (q.id = any (p_exclude))
    order by random()
    limit p_count
  ) sel;

  return v_ids;
end;
$$;

-- ---------------------------------------------------------------------------
-- Build a paper from an explicit composition (used for scheduled exams and as
-- a reusable primitive for custom papers).
-- ---------------------------------------------------------------------------
create or replace function public.jh_build_paper_from_composition(
  p_course_id uuid,
  p_composition jsonb,
  p_title_en text,
  p_title_bn text,
  p_duration_minutes integer,
  p_positive numeric,
  p_negative numeric,
  p_created_by uuid,
  p_paper_type text default 'scheduled',
  p_schedule_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item jsonb;
  v_ids uuid[];
  v_selected uuid[] := '{}';
  v_count integer := 0;
  v_paper uuid;
  v_question uuid;
begin
  for v_item in select * from jsonb_array_elements(coalesce(p_composition->'items', '[]'::jsonb))
  loop
    v_ids := public.jh_select_questions(
      p_course_id,
      nullif(v_item->>'subject_id','')::uuid,
      nullif(v_item->>'topic_id','')::uuid,
      nullif(v_item->>'subtopic_id','')::uuid,
      coalesce((v_item->>'count')::int, 0),
      v_selected
    );
    v_selected := v_selected || v_ids;
    v_count := v_count + coalesce(array_length(v_ids, 1), 0);
  end loop;

  if v_count = 0 then
    raise exception 'Paper composition produced no questions' using errcode = '22023';
  end if;

  insert into public.exam_papers (
    schedule_id, course_id, paper_type, title_en, title_bn, question_count,
    duration_minutes, total_marks, positive_marks, negative_marks, composition, created_by
  ) values (
    p_schedule_id, p_course_id, p_paper_type,
    coalesce(p_title_en,''), coalesce(p_title_bn,''), v_count,
    p_duration_minutes, v_count * p_positive, p_positive, p_negative,
    p_composition, p_created_by
  ) returning id into v_paper;

  for v_question in select unnest(v_selected)
  loop
    insert into public.exam_questions (paper_id, question_id, position, marks)
    values (
      v_paper, v_question,
      (select coalesce(max(position), 0) + 1 from public.exam_questions where paper_id = v_paper),
      p_positive
    );
  end loop;

  return v_paper;
end;
$$;

-- ---------------------------------------------------------------------------
-- Start a scheduled exam attempt
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Start a practice / custom attempt from an explicit composition.
-- Students may start these at any time; the pool is always verified+approved.
-- ---------------------------------------------------------------------------
create or replace function public.jh_start_custom_attempt(
  p_course_id uuid,
  p_composition jsonb,
  p_duration_minutes integer,
  p_mode text,
  p_title_en text default '',
  p_title_bn text default ''
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

  v_paper := public.jh_build_paper_from_composition(
    p_course_id, p_composition, p_title_en, p_title_bn, p_duration_minutes,
    coalesce((v_course.exam_config->>'positive_marks')::numeric, 1),
    coalesce((v_course.exam_config->>'negative_marks')::numeric, 0.5),
    v_user, 'practice', null
  );

  insert into public.exam_attempts (
    user_id, paper_id, schedule_id, course_id, mode, started_at, deadline_at,
    total_questions, total_marks
  ) values (
    v_user, v_paper, null, p_course_id, p_mode, v_now,
    v_now + make_interval(mins => p_duration_minutes),
    v_total, v_total * coalesce((v_course.exam_config->>'positive_marks')::numeric, 1)
  ) returning id into v_attempt;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (v_user, 'attempt.start', 'exam_attempt', v_attempt::text,
          jsonb_build_object('mode', p_mode, 'questions', v_total));

  return jsonb_build_object(
    'attempt_id', v_attempt,
    'deadline_at', v_now + make_interval(mins => p_duration_minutes),
    'resumed', false,
    'status', 'in_progress'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Paper for a student attempt — never includes the answer key.
-- ---------------------------------------------------------------------------
create or replace function public.jh_get_attempt_paper(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_attempt public.exam_attempts;
  v_questions jsonb;
  v_answers jsonb;
begin
  select * into v_attempt from public.exam_attempts where id = p_attempt_id;
  if not found then
    raise exception 'Attempt not found' using errcode = 'P0002';
  end if;
  if v_attempt.user_id <> v_user and not public.jh_has_permission('attempt.inspect') then
    raise exception 'Not authorized for this attempt' using errcode = '42501';
  end if;

  select jsonb_agg(qjson order by position) into v_questions from (
    select eq.position,
      jsonb_build_object(
        'question_id', q.id,
        'position', eq.position,
        'statement', q.statement,
        'statement_bn', q.statement_bn,
        'options', jsonb_build_array(q.option_a, q.option_b, q.option_c, q.option_d),
        'difficulty', q.difficulty,
        'subject_id', q.subject_id,
        'topic_id', q.topic_id,
        'subtopic_id', q.subtopic_id,
        'source', q.source,
        'year', q.year
      ) as qjson
    from public.exam_questions eq
    join public.questions q on q.id = eq.question_id
    where eq.paper_id = v_attempt.paper_id
  ) s;

  -- Answers already given, so a refresh or a reconnected phone resumes the paper
  -- exactly where the student left it.
  select jsonb_agg(
           jsonb_build_object(
             'question_id', sa.question_id,
             'selected_option', sa.selected_option,
             'marked_for_review', sa.marked_for_review
           )
         )
    into v_answers
    from public.student_answers sa
   where sa.attempt_id = p_attempt_id;

  return jsonb_build_object(
    'attempt', to_jsonb(v_attempt) - 'ip_hash' - 'user_agent' - 'idempotency_key',
    'server_now', now(),
    'questions', coalesce(v_questions, '[]'::jsonb),
    'saved_answers', coalesce(v_answers, '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Autosave an answer (idempotent, attempt-scoped, deadline enforced)
-- ---------------------------------------------------------------------------
create or replace function public.jh_save_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_selected_option integer,
  p_marked_for_review boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_attempt public.exam_attempts;
  v_exists integer;
  v_now timestamptz := now();
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_selected_option is not null and (p_selected_option < 0 or p_selected_option > 3) then
    raise exception 'Invalid option index' using errcode = '22023';
  end if;

  select * into v_attempt from public.exam_attempts where id = p_attempt_id for update;
  if not found or v_attempt.user_id <> v_user then
    raise exception 'Attempt not found' using errcode = 'P0002';
  end if;
  if v_attempt.status <> 'in_progress' then
    raise exception 'This attempt has already been submitted' using errcode = 'P0001';
  end if;
  if v_now >= v_attempt.deadline_at then
    raise exception 'Time is up for this attempt' using errcode = 'P0001';
  end if;

  select 1 into v_exists from public.exam_questions
   where paper_id = v_attempt.paper_id and question_id = p_question_id;
  if not found then
    raise exception 'Question is not part of this paper' using errcode = '22023';
  end if;

  insert into public.student_answers (attempt_id, question_id, selected_option, marked_for_review, answered_at, updated_at)
  values (p_attempt_id, p_question_id, p_selected_option::smallint, coalesce(p_marked_for_review, false), v_now, v_now)
  on conflict (attempt_id, question_id) do update
    set selected_option = excluded.selected_option,
        marked_for_review = excluded.marked_for_review,
        updated_at = v_now;

  update public.exam_attempts set updated_at = v_now where id = p_attempt_id;

  return jsonb_build_object(
    'saved', true,
    'server_now', v_now,
    'deadline_at', v_attempt.deadline_at,
    'remaining_seconds', greatest(0, floor(extract(epoch from v_attempt.deadline_at - v_now))::int)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Submit + score. Idempotent: repeated calls return the original result and
-- never create a second result row or double-count in the leaderboard.
-- ---------------------------------------------------------------------------
create or replace function public.jh_submit_attempt(
  p_attempt_id uuid,
  p_reason text default 'manual'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_attempt public.exam_attempts;
  v_schedule public.exam_schedules;
  v_correct int := 0;
  v_wrong int := 0;
  v_unanswered int := 0;
  v_score numeric := 0;
  v_positive numeric;
  v_negative numeric;
  v_release timestamptz;
  v_released boolean;
  v_result uuid;
  v_snapshot jsonb;
  v_now timestamptz := now();
  v_elapsed int;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_reason not in ('manual','timeout','admin') then
    raise exception 'Invalid submit reason' using errcode = '22023';
  end if;

  select * into v_attempt from public.exam_attempts where id = p_attempt_id for update;
  if not found then
    raise exception 'Attempt not found' using errcode = 'P0002';
  end if;
  if v_attempt.user_id <> v_user and not public.jh_has_permission('attempt.inspect') then
    raise exception 'Not authorized for this attempt' using errcode = '42501';
  end if;

  -- Already submitted: return the same authoritative result (no duplicates).
  if v_attempt.status <> 'in_progress' then
    select r.id into v_result from public.results r where r.attempt_id = p_attempt_id;
    return jsonb_build_object(
      'already_submitted', true,
      'result_id', v_result,
      'score', v_attempt.score,
      'is_released', v_attempt.is_released,
      'submitted_at', v_attempt.submitted_at
    );
  end if;

  select positive_marks, negative_marks into v_positive, v_negative
  from public.exam_papers where id = v_attempt.paper_id;

  select
    coalesce(count(*) filter (where sa.selected_option = q.correct_option), 0),
    coalesce(count(*) filter (where sa.selected_option is not null and sa.selected_option <> q.correct_option), 0),
    coalesce(count(*) filter (where sa.selected_option is null), 0)
  into v_correct, v_wrong, v_unanswered
  from public.exam_questions eq
  join public.questions q on q.id = eq.question_id
  left join public.student_answers sa
    on sa.attempt_id = p_attempt_id and sa.question_id = eq.question_id
  where eq.paper_id = v_attempt.paper_id;

  v_score := round(v_correct * v_positive - v_wrong * v_negative, 2);

  v_elapsed := greatest(0, floor(extract(epoch from v_now - v_attempt.started_at))::int);

  if v_attempt.schedule_id is not null then
    select * into v_schedule from public.exam_schedules where id = v_attempt.schedule_id;
    v_release := coalesce(v_schedule.result_release_at, v_now);
    v_released := v_now >= v_release;
  else
    v_release := v_now;
    v_released := true;
  end if;

  update public.exam_attempts set
    status = 'submitted',
    submitted_at = v_now,
    submit_reason = p_reason,
    duration_seconds = v_elapsed,
    correct_count = v_correct,
    wrong_count = v_wrong,
    unanswered_count = v_unanswered,
    score = v_score,
    accuracy = case when (v_correct + v_wrong) > 0
                    then round(v_correct::numeric * 100 / (v_correct + v_wrong), 2) else 0 end,
    is_released = v_released,
    released_at = case when v_released then v_now else null end,
    submission_seq = v_attempt.submission_seq + 1,
    updated_at = v_now
  where id = p_attempt_id;

  select jsonb_agg(jsonb_build_object(
      'question_id', q.id,
      'position', eq.position,
      'selected_option', sa.selected_option,
      'correct_option', q.correct_option,
      'is_correct', coalesce(sa.selected_option = q.correct_option, false),
      'marked_for_review', coalesce(sa.marked_for_review, false)
    ) order by eq.position)
  into v_snapshot
  from public.exam_questions eq
  join public.questions q on q.id = eq.question_id
  left join public.student_answers sa
    on sa.attempt_id = p_attempt_id and sa.question_id = eq.question_id
  where eq.paper_id = v_attempt.paper_id;

  insert into public.results (
    attempt_id, user_id, paper_id, schedule_id, course_id, score, total_marks,
    correct_count, wrong_count, unanswered_count, accuracy, is_released, released_at, snapshot
  ) values (
    p_attempt_id, v_attempt.user_id, v_attempt.paper_id, v_attempt.schedule_id,
    v_attempt.course_id, v_score, v_attempt.total_marks, v_correct, v_wrong,
    v_unanswered,
    case when (v_correct + v_wrong) > 0 then round(v_correct::numeric * 100 / (v_correct + v_wrong), 2) else 0 end,
    v_released, case when v_released then v_now else null end, v_snapshot
  )
  on conflict (attempt_id) do nothing
  returning id into v_result;

  if v_result is null then
    select id into v_result from public.results where attempt_id = p_attempt_id;
  end if;

  update public.study_progress sp set
    questions_attempted = sp.questions_attempted + v_correct + v_wrong,
    questions_correct = sp.questions_correct + v_correct,
    last_practiced_at = v_now,
    updated_at = v_now
  from (
    select q.subject_id, q.topic_id, q.subtopic_id,
      count(*) filter (where sa.selected_option is not null) as attempted,
      count(*) filter (where sa.selected_option = q.correct_option) as correct
    from public.exam_questions eq
    join public.questions q on q.id = eq.question_id
    left join public.student_answers sa
      on sa.attempt_id = p_attempt_id and sa.question_id = eq.question_id
    where eq.paper_id = v_attempt.paper_id
    group by q.subject_id, q.topic_id, q.subtopic_id
  ) agg
  where sp.user_id = v_attempt.user_id
    and sp.course_id = v_attempt.course_id
    and sp.subject_id = agg.subject_id
    and sp.topic_id is not distinct from agg.topic_id
    and sp.subtopic_id is not distinct from agg.subtopic_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (v_user, 'attempt.submit', 'exam_attempt', p_attempt_id::text,
          jsonb_build_object('reason', p_reason, 'score', v_score, 'correct', v_correct,
                             'wrong', v_wrong, 'unanswered', v_unanswered, 'released', v_released));

  return jsonb_build_object(
    'already_submitted', false,
    'result_id', v_result,
    'score', v_score,
    'total_marks', v_attempt.total_marks,
    'correct', v_correct,
    'wrong', v_wrong,
    'unanswered', v_unanswered,
    'accuracy', case when (v_correct + v_wrong) > 0 then round(v_correct::numeric*100/(v_correct+v_wrong),2) else 0 end,
    'is_released', v_released,
    'result_release_at', v_release,
    'submitted_at', v_now
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Released answer review (answer key + explanation), embargo enforced
-- ---------------------------------------------------------------------------
create or replace function public.jh_get_attempt_review(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_attempt public.exam_attempts;
  v_released boolean;
  v_release timestamptz;
  v_items jsonb;
begin
  select * into v_attempt from public.exam_attempts where id = p_attempt_id;
  if not found then
    raise exception 'Attempt not found' using errcode = 'P0002';
  end if;
  if v_attempt.user_id <> v_user and not public.jh_has_permission('attempt.inspect') then
    raise exception 'Not authorized for this attempt' using errcode = '42501';
  end if;

  v_released := v_attempt.is_released;
  if v_attempt.schedule_id is not null then
    select result_release_at into v_release from public.exam_schedules where id = v_attempt.schedule_id;
    v_released := v_released or (now() >= coalesce(v_release, now()));
  end if;

  if not v_released then
    return jsonb_build_object(
      'released', false,
      'result_release_at', v_release,
      'score', null,
      'items', '[]'::jsonb
    );
  end if;

  select jsonb_agg(jsonb_build_object(
      'question_id', q.id,
      'position', eq.position,
      'statement', q.statement,
      'statement_bn', q.statement_bn,
      'options', jsonb_build_array(q.option_a, q.option_b, q.option_c, q.option_d),
      'correct_option', q.correct_option,
      'selected_option', sa.selected_option,
      'is_correct', coalesce(sa.selected_option = q.correct_option, false),
      'explanation', q.explanation,
      'subject_id', q.subject_id,
      'topic_id', q.topic_id,
      'difficulty', q.difficulty,
      'source', q.source,
      'year', q.year
    ) order by eq.position)
  into v_items
  from public.exam_questions eq
  join public.questions q on q.id = eq.question_id
  left join public.student_answers sa
    on sa.attempt_id = p_attempt_id and sa.question_id = eq.question_id
  where eq.paper_id = v_attempt.paper_id;

  return jsonb_build_object(
    'released', true,
    'result_release_at', v_release,
    'score', v_attempt.score,
    'total_marks', v_attempt.total_marks,
    'correct', v_attempt.correct_count,
    'wrong', v_attempt.wrong_count,
    'unanswered', v_attempt.unanswered_count,
    'accuracy', v_attempt.accuracy,
    'items', coalesce(v_items, '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Leaderboard — released results only, deterministic tie-break
-- ---------------------------------------------------------------------------
create or replace function public.jh_leaderboard(
  p_scope text,
  p_course_id uuid default null,
  p_schedule_id uuid default null,
  p_limit integer default 20
)
returns table (
  rank integer,
  user_id uuid,
  full_name text,
  avatar_url text,
  score numeric,
  total_marks numeric,
  accuracy numeric,
  duration_seconds integer,
  submitted_at timestamptz,
  course_id uuid
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with scoped as (
    select r.*, a.duration_seconds, a.submitted_at as attempt_submitted_at
    from public.results r
    join public.exam_attempts a on a.id = r.attempt_id
    where r.is_released
      and (p_scope <> 'course'   or r.course_id = p_course_id)
      and (p_scope <> 'exam'     or r.schedule_id = p_schedule_id)
      and (p_scope <> 'daily'    or (a.submitted_at at time zone 'Asia/Dhaka')::date = (now() at time zone 'Asia/Dhaka')::date)
      and (p_scope <> 'weekly'   or a.submitted_at >= date_trunc('week', now() at time zone 'Asia/Dhaka') at time zone 'Asia/Dhaka')
      and (p_course_id is null or r.course_id = p_course_id)
  ), ranked as (
    select
      row_number() over (
        order by s.score desc,
                 s.accuracy desc,
                 s.duration_seconds asc nulls last,
                 s.attempt_submitted_at asc,
                 s.user_id asc
      )::int as rank,
      s.user_id, p.full_name, p.avatar_url, s.score, s.total_marks, s.accuracy,
      s.duration_seconds, s.attempt_submitted_at, s.course_id
    from scoped s
    join public.profiles p on p.id = s.user_id
    where p.is_active
  )
  select rank, user_id, coalesce(full_name, 'শিক্ষার্থী'), avatar_url, score,
         total_marks, accuracy, duration_seconds, attempt_submitted_at, course_id
  from ranked
  where rank <= greatest(1, least(coalesce(p_limit, 20), 100))
  order by rank;
$$;

-- ---------------------------------------------------------------------------
-- Student analytics derived from real submitted results
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

  select coalesce(jsonb_agg(jsonb_build_object(
      'date', d::date,
      'score', coalesce(x.avg_score, 0),
      'attempts', coalesce(x.attempts, 0)
    ) order by d), '[]'::jsonb) into v_weekly
  from generate_series(
        (now() at time zone 'Asia/Dhaka')::date - 6,
        (now() at time zone 'Asia/Dhaka')::date,
        interval '1 day'
      ) d
  left join (
    select (a.submitted_at at time zone 'Asia/Dhaka')::date as day,
           round(avg(r.score), 2) as avg_score, count(*) as attempts
    from public.results r
    join public.exam_attempts a on a.id = r.attempt_id
    where r.user_id = v_user
      and (p_course_id is null or r.course_id = p_course_id)
      and a.submitted_at >= (now() - interval '7 days')
    group by 1
  ) x on x.day = (d at time zone 'utc')::date;

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

-- ---------------------------------------------------------------------------
-- Publish an exam schedule — explicit, validated, transactional.
-- Validates question pool, marks, duration, schedule, duplicate publication.
-- ---------------------------------------------------------------------------
create or replace function public.jh_publish_schedule(p_schedule_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_schedule public.exam_schedules;
  v_composition jsonb;
  v_available integer;
  v_paper uuid;
  v_now timestamptz := now();
begin
  if not public.jh_has_permission('exam.publish') then
    raise exception 'Publishing requires exam.publish permission' using errcode = '42501';
  end if;

  select * into v_schedule from public.exam_schedules where id = p_schedule_id for update;
  if not found then
    raise exception 'Exam schedule not found' using errcode = 'P0002';
  end if;
  if v_schedule.status = 'published' then
    return jsonb_build_object('published', true, 'already_published', true);
  end if;
  if v_schedule.status <> 'draft' then
    raise exception 'Only draft schedules can be published' using errcode = 'P0001';
  end if;
  if v_schedule.starts_at <= v_now then
    raise exception 'Start time must be in the future' using errcode = '22023';
  end if;
  if v_schedule.ends_at <= v_schedule.starts_at then
    raise exception 'End time must be after start time' using errcode = '22023';
  end if;
  if v_schedule.result_release_at < v_schedule.ends_at then
    raise exception 'Results cannot be released before the exam closes' using errcode = '22023';
  end if;
  if not exists (select 1 from public.courses c where c.id = v_schedule.course_id and c.status = 'published') then
    raise exception 'Course is not published' using errcode = '22023';
  end if;

  v_composition := v_schedule.settings->'composition';

  if v_composition is not null and jsonb_array_length(coalesce(v_composition->'items','[]'::jsonb)) > 0 then
    select sum(missing) into v_available from (
      select greatest(0,
        coalesce((i->>'count')::int,0) - public.jh_question_availability(
          v_schedule.course_id,
          nullif(i->>'subject_id','')::uuid,
          nullif(i->>'topic_id','')::uuid,
          nullif(i->>'subtopic_id','')::uuid
        )) as missing
      from jsonb_array_elements(v_composition->'items') i
    ) m;
    if coalesce(v_available, 0) > 0 then
      raise exception 'Insufficient verified questions for this composition (% missing)', v_available using errcode = 'P0001';
    end if;
  else
    select public.jh_question_availability(v_schedule.course_id, null, null, null) into v_available;
    if v_available < v_schedule.question_count then
      raise exception 'Only % verified questions available, % required', v_available, v_schedule.question_count using errcode = 'P0001';
    end if;
    v_composition := jsonb_build_object('items', jsonb_build_array(jsonb_build_object(
      'subject_id', null, 'topic_id', null, 'subtopic_id', null, 'count', v_schedule.question_count
    )));
  end if;

  v_paper := public.jh_build_paper_from_composition(
    v_schedule.course_id, v_composition, v_schedule.title_en, v_schedule.title_bn,
    v_schedule.duration_minutes, v_schedule.positive_marks, v_schedule.negative_marks,
    v_actor, 'scheduled', v_schedule.id
  );

  update public.exam_schedules set
    status = 'published',
    published_at = v_now,
    published_by = v_actor,
    settings = settings || jsonb_build_object('composition', v_composition),
    updated_at = v_now
  where id = p_schedule_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (v_actor, 'exam.publish', 'exam_schedule', p_schedule_id::text,
          jsonb_build_object('paper_id', v_paper, 'questions', v_schedule.question_count));

  return jsonb_build_object('published', true, 'paper_id', v_paper, 'already_published', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- Bulk review — always scoped by explicit ids or explicit filters, never "all
-- questions everywhere".
-- ---------------------------------------------------------------------------
create or replace function public.jh_bulk_review(
  p_action text,
  p_question_ids uuid[] default null,
  p_filters jsonb default '{}'::jsonb,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_count integer := 0;
begin
  if not public.jh_has_permission('question.review') then
    raise exception 'Review requires question.review permission' using errcode = '42501';
  end if;
  if p_action not in ('approve','reject','archive','restore','submit') then
    raise exception 'Unsupported bulk action' using errcode = '22023';
  end if;

  with target as (
    select q.id, q.status
    from public.questions q
    where (
      (p_question_ids is not null and q.id = any (p_question_ids))
      or (
        p_question_ids is null
        and p_filters <> '{}'::jsonb
        and (p_filters->>'course_id' is null or q.course_id = (p_filters->>'course_id')::uuid)
        and (p_filters->>'subject_id' is null or q.subject_id = (p_filters->>'subject_id')::uuid)
        and (p_filters->>'topic_id' is null or q.topic_id = (p_filters->>'topic_id')::uuid)
        and (p_filters->>'status' is null or q.status = p_filters->>'status')
        and (p_filters->>'difficulty' is null or q.difficulty = p_filters->>'difficulty')
        and (p_filters->>'source_type' is null or q.source_type = p_filters->>'source_type')
      )
    )
  ), updated as (
    update public.questions q set
      status = case p_action
        when 'approve' then 'approved'
        when 'reject' then 'rejected'
        when 'archive' then 'archived'
        when 'restore' then 'pending_review'
        else 'pending_review' end,
      is_verified = case when p_action = 'approve' then true else q.is_verified end,
      verified_by = case when p_action = 'approve' then v_actor else q.verified_by end,
      verified_at = case when p_action = 'approve' then now() else q.verified_at end,
      archived_at = case when p_action = 'archive' then now() else null end,
      updated_at = now()
    from target t
    where q.id = t.id
    returning q.id, t.status as previous_status, q.status as new_status
  )
  insert into public.question_reviews (question_id, reviewer_id, action, previous_status, new_status, notes)
  select id, v_actor, p_action, previous_status, new_status, p_notes from updated;

  get diagnostics v_count = row_count;

  insert into public.audit_logs (actor_id, action, entity_type, details)
  values (v_actor, 'question.bulk_review', 'question',
          jsonb_build_object('action', p_action, 'count', v_count, 'filters', p_filters,
                             'explicit_ids', coalesce(array_length(p_question_ids,1), 0)));

  return jsonb_build_object('action', p_action, 'affected', v_count);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: authenticated students may call their own functions; service role
-- (used by route handlers) is unrestricted.
-- ---------------------------------------------------------------------------
revoke all on function public.jh_question_availability(uuid,uuid,uuid,uuid) from public;
revoke all on function public.jh_select_questions(uuid,uuid,uuid,uuid,integer,uuid[]) from public;
revoke all on function public.jh_build_paper_from_composition(uuid,jsonb,text,text,integer,numeric,numeric,uuid,text,uuid) from public;
revoke all on function public.jh_start_scheduled_attempt(uuid) from public;
revoke all on function public.jh_start_custom_attempt(uuid,jsonb,integer,text,text,text) from public;
revoke all on function public.jh_get_attempt_paper(uuid) from public;
revoke all on function public.jh_save_answer(uuid,uuid,integer,boolean) from public;
revoke all on function public.jh_submit_attempt(uuid,text) from public;
revoke all on function public.jh_get_attempt_review(uuid) from public;
revoke all on function public.jh_leaderboard(text,uuid,uuid,integer) from public;
revoke all on function public.jh_student_analytics(uuid) from public;
revoke all on function public.jh_publish_schedule(uuid) from public;
revoke all on function public.jh_bulk_review(text,uuid[],jsonb,text) from public;

grant execute on function public.jh_question_availability(uuid,uuid,uuid,uuid) to authenticated;
grant execute on function public.jh_start_scheduled_attempt(uuid) to authenticated;
grant execute on function public.jh_start_custom_attempt(uuid,jsonb,integer,text,text,text) to authenticated;
grant execute on function public.jh_get_attempt_paper(uuid) to authenticated;
grant execute on function public.jh_save_answer(uuid,uuid,integer,boolean) to authenticated;
grant execute on function public.jh_submit_attempt(uuid,text) to authenticated;
grant execute on function public.jh_get_attempt_review(uuid) to authenticated;
grant execute on function public.jh_leaderboard(text,uuid,uuid,integer) to authenticated, anon;
grant execute on function public.jh_student_analytics(uuid) to authenticated;
grant execute on function public.jh_publish_schedule(uuid) to authenticated;
grant execute on function public.jh_bulk_review(text,uuid[],jsonb,text) to authenticated;

-- ---------------------------------------------------------------------------
-- Public counters: never expose question rows, only aggregate availability.
-- ---------------------------------------------------------------------------
create or replace function public.jh_public_question_count(
  p_course_id uuid default null,
  p_subject_id uuid default null,
  p_topic_id uuid default null,
  p_subtopic_id uuid default null
)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.jh_question_availability(p_course_id, p_subject_id, p_topic_id, p_subtopic_id);
$$;

revoke all on function public.jh_public_question_count(uuid,uuid,uuid,uuid) from public;
grant execute on function public.jh_public_question_count(uuid,uuid,uuid,uuid) to anon, authenticated;
