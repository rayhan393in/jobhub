-- ============================================================
-- QUESTION BANK — student-facing browse + PYQ-scoped practice
-- Additive only: no table dropped, no row deleted or rewritten,
-- no existing function removed (jh_build_paper_from_composition is
-- re-created with one extra routing branch). Rollback: drop the new
-- functions and the partial index. Existing IDs and history untouched.
--
-- Verified Previous Year Question (PYQ) definition used everywhere here:
--   source_type = 'previous' AND status = 'approved' AND is_verified
--   AND archived_at IS NULL
-- AI-generated or unverified questions therefore never appear in the
-- previous-year collection, and answers/explanations are never returned
-- by the browse functions (they unlock only through an attempt's review).
-- ============================================================

-- ---------- A. Collection counts (per published course) ----------
create or replace function public.jh_qb_collections()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'course_id', c.id,
    'slug', c.slug,
    'total_verified', counts.total_verified,
    'previous_verified', counts.previous_verified
  ) order by c.sort_order), '[]'::jsonb)
  from public.courses c
  join lateral (
    select
      count(*) filter (where q.status = 'approved' and q.is_verified) as total_verified,
      count(*) filter (where q.status = 'approved' and q.is_verified and q.source_type = 'previous') as previous_verified
    from public.questions q
    where q.course_id = c.id and q.archived_at is null
  ) counts on true
  where c.status = 'published';
$$;

-- ---------- B. Exam-wise PYQ listing (year-wise selection UI) ----------
create or replace function public.jh_qb_exams(p_course_slug text default 'bcs')
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'exam_name', t.exam_name,
    'year', t.year,
    'question_count', t.question_count,
    'subject_count', t.subject_count
  ) order by t.year desc nulls last, t.exam_name nulls last), '[]'::jsonb)
  from (
    -- One bucket per labeled (exam_name, year) pair …
    select q.exam_name, q.year,
           count(*)::int as question_count,
           count(distinct q.subject_id)::int as subject_count
    from public.questions q
    join public.courses c on c.id = q.course_id
    where c.slug = p_course_slug
      and q.source_type = 'previous'
      and q.status = 'approved'
      and q.is_verified
      and q.archived_at is null
      and q.exam_name is not null
      and length(btrim(q.exam_name)) > 0
    group by q.exam_name, q.year
    union all
    -- … plus a single honest bucket for verified PYQs whose exam_name/year was
    -- never recorded (never invented — the UI labels it as unlabeled).
    select null::text as exam_name, null::smallint as year,
           count(*)::int as question_count,
           count(distinct q.subject_id)::int as subject_count
    from public.questions q
    join public.courses c on c.id = q.course_id
    where c.slug = p_course_slug
      and q.source_type = 'previous'
      and q.status = 'approved'
      and q.is_verified
      and q.archived_at is null
      and (q.exam_name is null or length(btrim(q.exam_name)) = 0)
    having count(*) > 0
  ) t;
$$;

-- ---------- C. PYQ browse (filters + search + pagination) ----------
create or replace function public.jh_qb_pyq_list(
  p_course_slug text default 'bcs',
  p_exam_name text default null,
  p_exam_year smallint default null,
  p_subject_id uuid default null,
  p_topic_id uuid default null,
  p_subtopic_id uuid default null,
  p_question_type text default null,
  p_difficulty text default null,
  p_search text default null,
  p_sort text default 'year',
  p_page integer default 1,
  p_page_size integer default 12
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_course uuid;
  v_page int := greatest(coalesce(p_page, 1), 1);
  v_size int := least(greatest(coalesce(p_page_size, 12), 1), 50);
  v_total bigint;
  v_needle text;
  v_rows jsonb;
begin
  select id into v_course from public.courses where slug = p_course_slug and status = 'published';
  if v_course is null then
    return jsonb_build_object('total', 0, 'page', v_page, 'page_size', v_size, 'total_pages', 0, 'rows', '[]'::jsonb);
  end if;

  if p_search is not null and btrim(p_search) <> '' then
    -- Escape ILIKE wildcards so student input can never alter the pattern.
    v_needle := '%' || replace(replace(replace(lower(btrim(p_search)), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  select count(*) into v_total
  from public.questions q
  where q.course_id = v_course
    and q.source_type = 'previous'
    and q.status = 'approved'
    and q.is_verified
    and q.archived_at is null
    and (p_exam_name is null or lower(btrim(q.exam_name)) = lower(btrim(p_exam_name)))
    and (p_exam_year is null or q.year = p_exam_year)
    and (p_subject_id is null or q.subject_id = p_subject_id)
    and (p_topic_id is null or q.topic_id = p_topic_id)
    and (p_subtopic_id is null or q.subtopic_id = p_subtopic_id)
    and (p_question_type is null or q.question_type = p_question_type)
    and (p_difficulty is null or q.difficulty = p_difficulty)
    and (v_needle is null or lower(q.statement) like v_needle escape '\' or lower(coalesce(q.statement_bn, '')) like v_needle escape '\');

  select coalesce(jsonb_agg(payload order by
    case when p_sort = 'difficulty' then difficulty end asc,
    case when p_sort = 'newest' then created_at end desc,
    case when coalesce(p_sort, 'year') = 'year' then year end desc nulls last,
    exam_name, id), '[]'::jsonb)
  into v_rows
  from (
    select q.id,
           q.exam_name,
           q.year,
           q.difficulty,
           q.created_at,
           jsonb_build_object(
             'id', q.id,
             'statement', q.statement,
             'statement_bn', q.statement_bn,
             'options', jsonb_build_array(q.option_a, q.option_b, q.option_c, q.option_d),
             'difficulty', q.difficulty,
             'subject_id', q.subject_id,
             'topic_id', q.topic_id,
             'subtopic_id', q.subtopic_id,
             'subject_title', coalesce(s.title_bn, s.title_en),
             'topic_title', coalesce(t.title_bn, t.title_en),
             'subtopic_title', coalesce(st.title_bn, st.title_en),
             'exam_name', q.exam_name,
             'year', q.year,
             'question_type', q.question_type,
             'source', q.source,
             'source_title', q.source_title,
             'has_explanation', length(btrim(coalesce(q.explanation, ''))) > 0,
             'classification', 'pyq'
           ) as payload
    from public.questions q
    left join public.subjects s on s.id = q.subject_id
    left join public.topics t on t.id = q.topic_id
    left join public.subtopics st on st.id = q.subtopic_id
    where q.course_id = v_course
      and q.source_type = 'previous'
      and q.status = 'approved'
      and q.is_verified
      and q.archived_at is null
      and (p_exam_name is null or lower(btrim(q.exam_name)) = lower(btrim(p_exam_name)))
      and (p_exam_year is null or q.year = p_exam_year)
      and (p_subject_id is null or q.subject_id = p_subject_id)
      and (p_topic_id is null or q.topic_id = p_topic_id)
      and (p_subtopic_id is null or q.subtopic_id = p_subtopic_id)
      and (p_question_type is null or q.question_type = p_question_type)
      and (p_difficulty is null or q.difficulty = p_difficulty)
      and (v_needle is null or lower(q.statement) like v_needle escape '\' or lower(coalesce(q.statement_bn, '')) like v_needle escape '\')
    order by
      case when p_sort = 'difficulty' then q.difficulty end asc,
      case when p_sort = 'newest' then q.created_at end desc,
      case when coalesce(p_sort, 'year') = 'year' then q.year end desc nulls last,
      q.exam_name, q.id
    offset (v_page - 1) * v_size
    limit v_size
  ) page;

  return jsonb_build_object(
    'total', v_total,
    'page', v_page,
    'page_size', v_size,
    'total_pages', case when v_total = 0 then 0 else ceil(v_total::numeric / v_size) end,
    'rows', coalesce(v_rows, '[]'::jsonb)
  );
end;
$$;

-- ---------- D. PYQ-scoped random selection for papers ----------
create or replace function public.jh_select_pyq_questions(
  p_course_id uuid,
  p_exam_name text,
  p_exam_year smallint,
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
    and q.source_type = 'previous'
    and q.status = 'approved'
    and q.is_verified
    and q.archived_at is null
    and (p_exam_name is null or lower(btrim(q.exam_name)) = lower(btrim(p_exam_name)))
    and (p_exam_year is null or q.year = p_exam_year)
    and not (q.id = any (p_exclude));

  if v_available < p_count then
    raise exception 'Only % verified previous-year question(s) available for this selection, % requested',
      v_available, p_count using errcode = 'P0001';
  end if;

  select array_agg(id) into v_ids from (
    select q.id
    from public.questions q
    where q.course_id = p_course_id
      and q.source_type = 'previous'
      and q.status = 'approved'
      and q.is_verified
      and q.archived_at is null
      and (p_exam_name is null or lower(btrim(q.exam_name)) = lower(btrim(p_exam_name)))
      and (p_exam_year is null or q.year = p_exam_year)
      and not (q.id = any (p_exclude))
    order by random()
    limit p_count
  ) sel;

  return v_ids;
end;
$$;

-- ---------- E. Paper builder: route exam-scoped composition items ----------
-- Identical to 20261121120200_functions.sql except for the exam-name/year
-- routing branch inside the composition loop. Existing scheduled-exam and
-- custom-practice callers are unaffected.
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
    if nullif(btrim(coalesce(v_item->>'exam_name', '')), '') is not null
       or nullif(coalesce(v_item->>'exam_year', ''), '') is not null then
      v_ids := public.jh_select_pyq_questions(
        p_course_id,
        nullif(btrim(coalesce(v_item->>'exam_name', '')), ''),
        nullif(coalesce(v_item->>'exam_year', ''), '')::smallint,
        coalesce((v_item->>'count')::int, 0),
        v_selected
      );
    else
      v_ids := public.jh_select_questions(
        p_course_id,
        nullif(v_item->>'subject_id','')::uuid,
        nullif(v_item->>'topic_id','')::uuid,
        nullif(v_item->>'subtopic_id','')::uuid,
        coalesce((v_item->>'count')::int, 0),
        v_selected
      );
    end if;
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

-- ---------- F. Single-question practice ----------
create or replace function public.jh_start_single_question(
  p_question_id uuid,
  p_duration_minutes integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_q public.questions;
  v_course public.courses;
  v_paper uuid;
  v_attempt uuid;
  v_now timestamptz := now();
  v_dur integer := least(greatest(coalesce(p_duration_minutes, 5), 1), 60);
  v_pos numeric;
  v_neg numeric;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_q from public.questions where id = p_question_id;
  if not found or v_q.status <> 'approved' or not v_q.is_verified or v_q.archived_at is not null then
    raise exception 'This question is not available for practice' using errcode = 'P0002';
  end if;

  select * into v_course from public.courses where id = v_q.course_id;
  if not found or v_course.status <> 'published' then
    raise exception 'Course not available' using errcode = 'P0002';
  end if;

  v_pos := coalesce((v_course.exam_config->>'positive_marks')::numeric, 1);
  v_neg := coalesce((v_course.exam_config->>'negative_marks')::numeric, 0.5);

  insert into public.exam_papers (
    schedule_id, course_id, paper_type, title_en, title_bn, question_count,
    duration_minutes, total_marks, positive_marks, negative_marks, composition, created_by
  ) values (
    null, v_q.course_id, 'practice',
    'Single-question practice', 'একক প্রশ্ন অনুশীলন', 1,
    v_dur, v_pos, v_pos, v_neg,
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('question_id', v_q.id, 'count', 1, 'label', 'একক প্রশ্ন')
    )),
    v_user
  ) returning id into v_paper;

  insert into public.exam_questions (paper_id, question_id, position, marks)
  values (v_paper, v_q.id, 1, v_pos);

  insert into public.exam_attempts (
    user_id, paper_id, schedule_id, course_id, mode, started_at, deadline_at,
    total_questions, total_marks
  ) values (
    v_user, v_paper, null, v_q.course_id, 'custom', v_now,
    v_now + make_interval(mins => v_dur), 1, v_pos
  ) returning id into v_attempt;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (v_user, 'attempt.start', 'exam_attempt', v_attempt::text,
          jsonb_build_object('mode', 'single_question', 'question_id', v_q.id));

  return jsonb_build_object(
    'attempt_id', v_attempt,
    'deadline_at', v_now + make_interval(mins => v_dur),
    'resumed', false,
    'status', 'in_progress'
  );
end;
$$;

-- ---------- Indexes ----------
create index if not exists questions_pyq_lookup_idx
  on public.questions (course_id, exam_name, year)
  where source_type = 'previous';

-- ---------- Grants: students may browse/practice, never write ----------
revoke all on function public.jh_qb_collections() from public, anon;
revoke all on function public.jh_qb_exams(text) from public, anon;
revoke all on function public.jh_qb_pyq_list(text,text,smallint,uuid,uuid,uuid,text,text,text,text,integer,integer) from public, anon;
revoke all on function public.jh_select_pyq_questions(uuid,text,smallint,integer,uuid[]) from public, anon;
revoke all on function public.jh_build_paper_from_composition(uuid,jsonb,text,text,integer,numeric,numeric,uuid,text,uuid) from public, anon;
revoke all on function public.jh_start_single_question(uuid,integer) from public, anon;

grant execute on function public.jh_qb_collections() to authenticated;
grant execute on function public.jh_qb_exams(text) to authenticated;
grant execute on function public.jh_qb_pyq_list(text,text,smallint,uuid,uuid,uuid,text,text,text,text,integer,integer) to authenticated;
grant execute on function public.jh_start_single_question(uuid,integer) to authenticated;
-- Internal helpers: executed only inside other security-definer functions.
