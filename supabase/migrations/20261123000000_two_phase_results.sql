-- ============================================================================
-- JobHub — Two-phase exam results
--
-- Phase 1 (instant, on submit): the student always sees their OWN summary —
--   score, total marks, correct/wrong/unanswered, accuracy, time taken —
--   immediately after submitting, even while the exam window is still open.
-- Phase 2 (at result_release_at): the answer key, explanations and the
--   leaderboard become visible to everyone at the admin-set publication time.
--
-- Fixes shipped here:
--   1. jh_get_attempt_review no longer hides the personal summary before
--      release; it only withholds the answer key (items).
--   2. jh_leaderboard treats release dynamically (a result whose schedule's
--      result_release_at has passed counts as released even if the stored
--      flag was written before that moment) — previously results submitted
--      before the release time NEVER appeared on the leaderboard.
--   3. jh_leaderboard ranks with rank() so equal (score, accuracy,
--      submission time) share the same rank, ordered by: score DESC,
--      accuracy DESC, submitted_at ASC.
--   4. jh_release_due_results() — idempotent sweep that flips the persisted
--      is_released flags once a schedule's publication time passes, keeping
--      dashboards and attempt lists consistent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Review: personal summary is always visible after submission
-- ---------------------------------------------------------------------------
create or replace function public.jh_get_attempt_review(p_attempt_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_attempt public.exam_attempts;
  v_released boolean;
  v_release timestamptz;
  v_items jsonb;
  v_summary jsonb;
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

  -- Phase 1: the student's own numbers are theirs the moment they submit.
  -- Only the answer key (correct options + explanations) waits for release.
  if v_attempt.status = 'in_progress' then
    v_summary := jsonb_build_object(
      'score', null, 'total_marks', v_attempt.total_marks,
      'correct', null, 'wrong', null, 'unanswered', null,
      'accuracy', null, 'duration_seconds', null, 'submitted_at', null
    );
  else
    v_summary := jsonb_build_object(
      'score', v_attempt.score,
      'total_marks', v_attempt.total_marks,
      'correct', v_attempt.correct_count,
      'wrong', v_attempt.wrong_count,
      'unanswered', v_attempt.unanswered_count,
      'accuracy', v_attempt.accuracy,
      'duration_seconds', v_attempt.duration_seconds,
      'submitted_at', v_attempt.submitted_at
    );
  end if;

  if not v_released then
    return jsonb_build_object(
      'released', false,
      'result_release_at', v_release,
      'items', '[]'::jsonb
    ) || v_summary;
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
    'items', coalesce(v_items, '[]'::jsonb)
  ) || v_summary;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2 & 3. Leaderboard: dynamic release + shared tie ranks
--    Ranking: score DESC → accuracy DESC → submission time ASC.
--    Equal on all three ⇒ identical rank (rank(), not row_number()).
-- ---------------------------------------------------------------------------
create or replace function public.jh_leaderboard(
  p_scope text,
  p_course_id uuid default null,
  p_schedule_id uuid default null,
  p_limit integer default 20
)
returns table(
  rank integer, user_id uuid, full_name text, avatar_url text,
  score numeric, total_marks numeric, accuracy numeric,
  duration_seconds integer, submitted_at timestamptz, course_id uuid
)
language sql
stable security definer
set search_path = public, pg_temp
as $$
  with scoped as (
    select r.*, a.duration_seconds, a.submitted_at as attempt_submitted_at
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
      rank() over (
        order by s.score desc,
                 s.accuracy desc,
                 s.attempt_submitted_at asc
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
  order by rank, attempt_submitted_at, user_id;
$$;

-- ---------------------------------------------------------------------------
-- 4. Release sweep: persist is_released once the publication time passes.
--    Idempotent; safe under concurrency (simple monotonic flag flip).
-- ---------------------------------------------------------------------------
create or replace function public.jh_release_due_results()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_results int := 0;
  v_attempts int := 0;
begin
  update public.results r
  set is_released = true,
      released_at = coalesce(r.released_at, es.result_release_at, now())
  from public.exam_schedules es
  where es.id = r.schedule_id
    and not r.is_released
    and es.result_release_at is not null
    and es.result_release_at <= now();
  get diagnostics v_results = row_count;

  update public.exam_attempts a
  set is_released = true,
      released_at = coalesce(a.released_at, es.result_release_at, now()),
      updated_at = now()
  from public.exam_schedules es
  where es.id = a.schedule_id
    and a.status <> 'in_progress'
    and not a.is_released
    and es.result_release_at is not null
    and es.result_release_at <= now();
  get diagnostics v_attempts = row_count;

  return v_results + v_attempts;
end;
$$;

revoke all on function public.jh_release_due_results() from public;
grant execute on function public.jh_release_due_results() to authenticated, service_role;
