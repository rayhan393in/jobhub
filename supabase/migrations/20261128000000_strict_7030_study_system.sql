-- ============================================================================
-- JobHub — strict 70:30 daily exam engine + study-system foundations
--
-- Master-prompt core rules enforced AT THE DATABASE LAYER:
--   * A daily paper is exactly PYQ + practice with EXACT counts (default
--     70 + 30 = 100). A "publish-ready PYQ" must be approved + verified +
--     source_type='previous' AND carry exam_name, year, question_type and a
--     real source reference. Nothing else ever counts as a PYQ.
--   * A PYQ shortfall NEVER gets silently filled with practice questions —
--     the build fails loudly with the real numbers (P0001).
--   * Practice questions are source_type <> 'previous'. A metadata-less PYQ
--     may not masquerade as practice either.
--   * Cross-exam usage is RECORDED (exam_questions rows are never deleted);
--     selection prefers the least-used question first.
--
-- Additive only: no existing table, column, row or ID is renamed or removed.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Config: the ratio becomes explicit, per-course, and strictly validated.
--    (The legacy 90:10 subject split is untouched — it describes SUBJECT
--    sections; pyq/practice describes SOURCE composition inside the paper.)
-- ---------------------------------------------------------------------------
alter table public.daily_exam_config
  add column if not exists pyq_count integer not null default 70
    check (pyq_count between 0 and 200),
  add column if not exists practice_count integer not null default 30
    check (practice_count between 0 and 200),
  add column if not exists strict_pyq_validation boolean not null default false;

alter table public.daily_exam_config
  drop constraint if exists daily_exam_config_strict_sum;
alter table public.daily_exam_config
  add constraint daily_exam_config_strict_sum
  check (not strict_pyq_validation or pyq_count + practice_count = question_count);

-- User decision (2026-11-21): strict 70:30 is ON for BCS immediately. With the
-- current bank (71 PYQs, 1 publish-ready) every daily publish will be blocked
-- and the admin panel will show the REAL shortfall — that is the intended,
-- honest behaviour until the PYQ bank is built up.
update public.daily_exam_config
set question_count = 100,
    pyq_count = 70,
    practice_count = 30,
    strict_pyq_validation = true,
    updated_at = now()
where course_id in (select id from public.courses where slug = 'bcs');

-- ---------------------------------------------------------------------------
-- 2. PYQ availability — the single source of truth for "how many REAL PYQs
--    exist in this scope". Used by the admin dashboard, the pre-publish
--    checklist and (re-stated) by the builder itself.
-- ---------------------------------------------------------------------------
create or replace function public.jh_pyq_availability(
  p_course_id uuid,
  p_subject_id uuid default null,
  p_topic_ids uuid[] default null
)
returns table (
  pyq_total bigint,          -- all approved+verified source_type='previous'
  pyq_ready bigint,          -- …of those: exam_name + year + question_type + source ref
  pyq_missing_meta bigint,   -- …of those: missing at least one required field
  practice_pool bigint,      -- approved+verified, source_type <> 'previous'
  missing_explanation bigint -- questions in scope without an explanation
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with pool as (
    select q.*
    from public.questions q
    where q.course_id = p_course_id
      and q.status = 'approved'
      and q.is_verified
      and q.archived_at is null
      and (p_subject_id is null or q.subject_id = p_subject_id)
      and (p_topic_ids is null or cardinality(p_topic_ids) = 0
           or q.topic_id = any (p_topic_ids))
  )
  select
    count(*) filter (where source_type = 'previous'),
    count(*) filter (where source_type = 'previous'
                       and exam_name is not null
                       and year is not null
                       and question_type is not null
                       and coalesce(source_url, source_title, source,
                                    source_locator, source_file_id) is not null),
    count(*) filter (where source_type = 'previous'
                       and (exam_name is null or year is null
                            or question_type is null
                            or coalesce(source_url, source_title, source,
                                        source_locator, source_file_id) is null)),
    count(*) filter (where source_type is distinct from 'previous'),
    count(*) filter (where explanation is null or btrim(explanation) = '')
  from pool;
$$;

comment on function public.jh_pyq_availability is
  'Real PYQ/practice pool counts for a course / subject / topic scope. "Ready" requires exam_name, year, question_type and a source reference — the master-prompt definition of a usable PYQ.';

revoke all on function public.jh_pyq_availability(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.jh_pyq_availability(uuid, uuid, uuid[]) to authenticated, service_role;

-- Per-subject readiness board for the admin PYQ-availability dashboard.
create or replace function public.jh_pyq_readiness_by_subject(p_course_id uuid)
returns table (
  subject_id uuid,
  title_bn text,
  sort_order integer,
  pyq_total bigint,
  pyq_ready bigint,
  pyq_missing_meta bigint,
  practice_pool bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    s.id,
    s.title_bn,
    s.sort_order::integer,
    count(q.id) filter (where q.source_type = 'previous'),
    count(q.id) filter (where q.source_type = 'previous'
                          and q.exam_name is not null
                          and q.year is not null
                          and q.question_type is not null
                          and coalesce(q.source_url, q.source_title, q.source,
                                       q.source_locator, q.source_file_id) is not null),
    count(q.id) filter (where q.source_type = 'previous'
                          and (q.exam_name is null or q.year is null
                               or q.question_type is null
                               or coalesce(q.source_url, q.source_title, q.source,
                                           q.source_locator, q.source_file_id) is null)),
    count(q.id) filter (where q.source_type is distinct from 'previous')
  from public.subjects s
  left join public.questions q
    on q.subject_id = s.id
   and q.course_id = p_course_id
   and q.status = 'approved'
   and q.is_verified
   and q.archived_at is null
  where s.course_id = p_course_id
  group by s.id, s.title_bn, s.sort_order
  order by s.sort_order;
$$;

revoke all on function public.jh_pyq_readiness_by_subject(uuid) from public, anon;
grant execute on function public.jh_pyq_readiness_by_subject(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Strict 70:30 paper builder.
--    Sections keep the daily exam's subject split (e.g. 90:10); the PYQ quota
--    is distributed across sections by largest remainder so the paper-level
--    total is EXACTLY p_pyq_total + p_practice_total. Selection prefers the
--    least-used question (recorded usage in exam_questions), then random.
--    Any shortfall anywhere aborts the whole build with the real counts.
-- ---------------------------------------------------------------------------
create or replace function public.jh_build_paper_7030(
  p_course_id        uuid,
  p_sections         jsonb,   -- [{subject_id, count, topic_ids?: uuid[]}, ...]
  p_pyq_total        integer,
  p_practice_total   integer,
  p_title_en         text,
  p_title_bn         text,
  p_duration_minutes integer,
  p_total_marks      numeric,
  p_negative_marks   numeric,
  p_created_by       uuid,
  p_paper_type       text default 'scheduled',
  p_schedule_id      uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n            integer;
  v_i            integer;
  v_total        integer := 0;
  v_counts       integer[] := '{}';
  v_subjects     uuid[] := '{}';
  v_topic_lists  jsonb[] := '{}';
  v_pyq_alloc    integer[] := '{}';
  v_rem          numeric[] := '{}';
  v_share        numeric;
  v_floor_sum    integer := 0;
  v_left         integer;
  v_best         integer;
  v_topic_ids    uuid[];
  v_selected     uuid[] := '{}';
  v_pyq_ids      uuid[] := '{}';
  v_sec_pyq      uuid[];
  v_sec_practice uuid[];
  v_need_pyq     integer;
  v_need_prac    integer;
  v_ready        bigint;
  v_prac_pool    bigint;
  v_paper        uuid;
  v_positive     numeric;
  v_order        uuid[] := '{}';
  v_section      jsonb;
begin
  if jsonb_typeof(coalesce(p_sections, 'null'::jsonb)) <> 'array'
     or jsonb_array_length(p_sections) < 1 then
    raise exception 'Sections must be a non-empty array' using errcode = '22023';
  end if;
  if coalesce(p_pyq_total, -1) < 0 or coalesce(p_practice_total, -1) < 0 then
    raise exception 'PYQ and practice totals must be >= 0' using errcode = '22023';
  end if;

  v_n := jsonb_array_length(p_sections);
  for v_i in 0 .. v_n - 1 loop
    v_section := p_sections -> v_i;
    if (v_section ->> 'subject_id') is null
       or coalesce((v_section ->> 'count')::int, 0) < 1 then
      raise exception 'Every section needs a subject_id and a positive count'
        using errcode = '22023';
    end if;
    v_subjects := v_subjects || (v_section ->> 'subject_id')::uuid;
    v_counts := v_counts || (v_section ->> 'count')::int;
    v_topic_lists := v_topic_lists || coalesce(v_section -> 'topic_ids', 'null'::jsonb);
    v_total := v_total + (v_section ->> 'count')::int;
  end loop;

  if v_total <> p_pyq_total + p_practice_total then
    raise exception
      'Section counts (%) must equal pyq (%) + practice (%)',
      v_total, p_pyq_total, p_practice_total using errcode = '22023';
  end if;

  -- Largest-remainder split of the PYQ quota across sections. For the
  -- standard 90/10 paper at 70%% this is exactly 63 + 7.
  for v_i in 1 .. v_n loop
    v_share := v_counts[v_i]::numeric * p_pyq_total / v_total;
    v_pyq_alloc := v_pyq_alloc || floor(v_share)::int;
    v_rem := v_rem || (v_share - floor(v_share));
    v_floor_sum := v_floor_sum + floor(v_share)::int;
  end loop;
  v_left := p_pyq_total - v_floor_sum;
  while v_left > 0 loop
    v_best := 1;
    for v_i in 2 .. v_n loop
      if v_rem[v_i] > v_rem[v_best] then v_best := v_i; end if;
    end loop;
    v_pyq_alloc[v_best] := v_pyq_alloc[v_best] + 1;
    v_rem[v_best] := -1;
    v_left := v_left - 1;
  end loop;
  -- A section's PYQ share can never exceed the section size.
  for v_i in 1 .. v_n loop
    if v_pyq_alloc[v_i] > v_counts[v_i] then
      raise exception 'PYQ allocation exceeds section size (section %)', v_i
        using errcode = '22023';
    end if;
  end loop;

  for v_i in 1 .. v_n loop
    v_topic_ids := '{}';
    if jsonb_typeof(v_topic_lists[v_i]) = 'array' then
      select coalesce(array_agg(value::uuid), '{}') into v_topic_ids
      from jsonb_array_elements_text(v_topic_lists[v_i]);
    end if;

    v_need_pyq  := v_pyq_alloc[v_i];
    v_need_prac := v_counts[v_i] - v_need_pyq;

    -- ---- PYQ slice: publish-ready PYQs only, least-used first ----
    v_sec_pyq := '{}';
    if v_need_pyq > 0 then
      select coalesce(array_agg(id), '{}') into v_sec_pyq from (
        select q.id
        from public.questions q
        where q.course_id = p_course_id
          and q.subject_id = v_subjects[v_i]
          and q.status = 'approved' and q.is_verified and q.archived_at is null
          and q.source_type = 'previous'
          and q.exam_name is not null
          and q.year is not null
          and q.question_type is not null
          and coalesce(q.source_url, q.source_title, q.source,
                       q.source_locator, q.source_file_id) is not null
          and (cardinality(v_topic_ids) = 0 or q.topic_id = any (v_topic_ids))
          and not (q.id = any (v_selected))
        order by (select count(*) from public.exam_questions eq
                  where eq.question_id = q.id) asc,
                 random()
        limit v_need_pyq
      ) sel;

      if coalesce(array_length(v_sec_pyq, 1), 0) < v_need_pyq then
        select pyq_ready into v_ready
        from public.jh_pyq_availability(
          p_course_id, v_subjects[v_i],
          case when cardinality(v_topic_ids) = 0 then null else v_topic_ids end);
        -- THE core rule: never fill a PYQ gap with practice questions,
        -- never fake the ratio — fail with the real numbers.
        raise exception
          'PYQ ঘাটতি: এই সেকশনে প্রকাশযোগ্য যাচাইকৃত PYQ আছে %টি, প্রয়োজন %টি — practice প্রশ্ন দিয়ে ঘাটতি পূরণ করা হয়নি (subject %)',
          coalesce(v_ready, 0), v_need_pyq, v_subjects[v_i]
          using errcode = 'P0001';
      end if;
    end if;
    v_selected := v_selected || v_sec_pyq;
    v_pyq_ids := v_pyq_ids || v_sec_pyq;

    -- ---- practice slice: real practice questions only ----
    v_sec_practice := '{}';
    if v_need_prac > 0 then
      select coalesce(array_agg(id), '{}') into v_sec_practice from (
        select q.id
        from public.questions q
        where q.course_id = p_course_id
          and q.subject_id = v_subjects[v_i]
          and q.status = 'approved' and q.is_verified and q.archived_at is null
          and q.source_type is distinct from 'previous'
          and (cardinality(v_topic_ids) = 0 or q.topic_id = any (v_topic_ids))
          and not (q.id = any (v_selected))
        order by (select count(*) from public.exam_questions eq
                  where eq.question_id = q.id) asc,
                 random()
        limit v_need_prac
      ) sel;

      if coalesce(array_length(v_sec_practice, 1), 0) < v_need_prac then
        select practice_pool into v_prac_pool
        from public.jh_pyq_availability(
          p_course_id, v_subjects[v_i],
          case when cardinality(v_topic_ids) = 0 then null else v_topic_ids end);
        raise exception
          'Practice ঘাটতি: এই সেকশনে প্রকাশযোগ্য practice প্রশ্ন আছে %টি, প্রয়োজন %টি (subject %)',
          coalesce(v_prac_pool, 0), v_need_prac, v_subjects[v_i]
          using errcode = 'P0001';
      end if;
    end if;
    v_selected := v_selected || v_sec_practice;

    -- Section order: PYQs first, then practice.
    v_order := v_order || v_sec_pyq || v_sec_practice;
  end loop;

  v_positive := round(p_total_marks / v_total, 2);

  insert into public.exam_papers (
    schedule_id, course_id, paper_type, title_en, title_bn, question_count,
    duration_minutes, total_marks, positive_marks, negative_marks, composition,
    difficulty_mix, created_by
  ) values (
    p_schedule_id, p_course_id, p_paper_type,
    coalesce(p_title_en, ''), coalesce(p_title_bn, ''), v_total,
    p_duration_minutes, p_total_marks, v_positive, p_negative_marks,
    jsonb_build_object(
      'mode', '70_30_strict',
      'pyq_total', p_pyq_total,
      'practice_total', p_practice_total,
      'sections', p_sections,
      'pyq_question_ids', to_jsonb(v_pyq_ids)
    ),
    null, p_created_by
  ) returning id into v_paper;

  insert into public.exam_questions (paper_id, question_id, position, marks)
  select v_paper, q, row_number() over (order by ord), v_positive
  from unnest(v_order) with ordinality as t(q, ord);

  return v_paper;
end;
$$;

comment on function public.jh_build_paper_7030 is
  'Strict PYQ:practice paper builder (default 70:30). Exact per-section subject counts, exact paper-level PYQ/practice totals, least-used-first selection, loud P0001 failure with real counts on any shortfall — practice questions NEVER substitute for PYQs.';

revoke all on function public.jh_build_paper_7030(uuid,jsonb,integer,integer,text,text,integer,numeric,numeric,uuid,text,uuid) from public, anon;
grant execute on function public.jh_build_paper_7030(uuid,jsonb,integer,integer,text,text,integer,numeric,numeric,uuid,text,uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Per-question usage history (cross-exam occurrences are recorded, never
--    deleted). Admin-only: before a schedule starts, fresh usage rows would
--    reveal tonight's paper to a curious student.
-- ---------------------------------------------------------------------------
create or replace function public.jh_question_usage(p_course_id uuid)
returns table (question_id uuid, use_count bigint, last_used_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() is distinct from 'service_role'
     and not public.jh_has_permission('exam.publish') then
    raise exception 'exam.publish permission required' using errcode = '42501';
  end if;
  return query
    select eq.question_id, count(*)::bigint, max(ep.created_at)
    from public.exam_questions eq
    join public.exam_papers ep on ep.id = eq.paper_id
    where ep.course_id = p_course_id
    group by eq.question_id;
end;
$$;

revoke all on function public.jh_question_usage(uuid) from public, anon;
grant execute on function public.jh_question_usage(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Revision queue — spaced repetition (same-day / +1 / +3 / +7 / +15).
--    Items are seeded ONLY from real attempt data (incorrect / unattempted);
--    the AI never invents weakness. Students own their queue.
-- ---------------------------------------------------------------------------
create table if not exists public.revision_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  subtopic_id uuid references public.subtopics(id) on delete set null,
  source_attempt_id uuid references public.exam_attempts(id) on delete set null,
  reason text not null check (reason in
    ('incorrect', 'unattempted', 'low_accuracy', 'repeated_mistake', 'weak_subtopic')),
  interval_step smallint not null check (interval_step between 0 and 4),
  due_date date not null,
  status text not null default 'pending'
    check (status in ('pending', 'done', 'skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, question_id, interval_step, reason)
);

create index if not exists revision_items_due_idx
  on public.revision_items (user_id, due_date, status);

alter table public.revision_items enable row level security;
alter table public.revision_items force row level security;

drop policy if exists "students read own revision items" on public.revision_items;
create policy "students read own revision items" on public.revision_items
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "students update own revision items" on public.revision_items;
create policy "students update own revision items" on public.revision_items
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "staff read all revision items" on public.revision_items;
create policy "staff read all revision items" on public.revision_items
  for select to authenticated using (public.jh_is_staff());

revoke all on public.revision_items from anon;
grant select, update on public.revision_items to authenticated;
grant all on public.revision_items to service_role;

-- Seed the queue from a submitted attempt. Owner-only (explicit NULL check —
-- the audited guard anti-pattern is not repeated here) or service role.
create or replace function public.jh_seed_revision_from_attempt(p_attempt_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_attempt record;
  v_inserted integer := 0;
begin
  select a.id, a.user_id, a.course_id, a.paper_id, a.status
    into v_attempt
  from public.exam_attempts a
  where a.id = p_attempt_id;

  if v_attempt.id is null then
    raise exception 'Attempt not found' using errcode = 'P0002';
  end if;
  if auth.role() is distinct from 'service_role' then
    if v_user is null or v_attempt.user_id is distinct from v_user then
      raise exception 'Not your attempt' using errcode = '42501';
    end if;
  end if;
  if v_attempt.status not in ('submitted', 'expired') then
    raise exception 'Attempt is not submitted yet' using errcode = 'P0001';
  end if;

  with wrong as (
    select q.id as question_id, q.subject_id, q.topic_id, q.subtopic_id,
           case
             when sa.selected_option is null then 'unattempted'
             else 'incorrect'
           end as reason
    from public.exam_questions eq
    join public.questions q on q.id = eq.question_id
    left join public.student_answers sa
      on sa.attempt_id = v_attempt.id and sa.question_id = q.id
    where eq.paper_id = v_attempt.paper_id
      and (sa.selected_option is null or sa.selected_option <> q.correct_option)
  ),
  steps(step, offset_days) as (
    values (0, 0), (1, 1), (2, 3), (3, 7), (4, 15)
  ),
  ins as (
    insert into public.revision_items
      (user_id, course_id, question_id, subject_id, topic_id, subtopic_id,
       source_attempt_id, reason, interval_step, due_date)
    select v_attempt.user_id, v_attempt.course_id, w.question_id, w.subject_id,
           w.topic_id, w.subtopic_id, v_attempt.id, w.reason,
           s.step, current_date + s.offset_days
    from wrong w cross join steps s
    on conflict (user_id, question_id, interval_step, reason) do nothing
    returning 1
  )
  select count(*) into v_inserted from ins;

  return v_inserted;
end;
$$;

comment on function public.jh_seed_revision_from_attempt is
  'Builds the spaced-revision queue (0/1/3/7/15 days) from a submitted attempt''s real incorrect + unattempted answers. Owner or service role only.';

revoke all on function public.jh_seed_revision_from_attempt(uuid) from public, anon;
grant execute on function public.jh_seed_revision_from_attempt(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Day-60 full mock pattern. The official BCS Preliminary distribution must
--    be CONFIGURED by an admin with a recorded source URL + version — the
--    system never guesses it, so this table ships EMPTY by design.
-- ---------------------------------------------------------------------------
create table if not exists public.mock_pattern_config (
  course_id uuid primary key references public.courses(id) on delete cascade,
  pattern jsonb not null,            -- [{subject_id, count}, ...] validated in API
  source_url text not null check (btrim(source_url) <> ''),
  source_version text not null check (btrim(source_version) <> ''),
  note_bn text,
  configured_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.mock_pattern_config enable row level security;
alter table public.mock_pattern_config force row level security;
revoke all on public.mock_pattern_config from anon, authenticated;
grant all on public.mock_pattern_config to service_role;

-- ---------------------------------------------------------------------------
-- 7. Honest backfill: 101 approved questions carry topic_id = NULL while a
--    question_topic_links row already maps them. Copy the PRIMARY link back
--    onto the question — only when the linked topic really belongs to the
--    question's own subject (no guessing across subjects).
-- ---------------------------------------------------------------------------
update public.questions q
set topic_id = l.topic_id,
    subtopic_id = coalesce(q.subtopic_id, l.subtopic_id),
    updated_at = now()
from (
  select distinct on (qtl.question_id)
         qtl.question_id, qtl.topic_id, qtl.subtopic_id
  from public.question_topic_links qtl
  where qtl.topic_id is not null
  order by qtl.question_id, qtl.is_primary desc, qtl.created_at asc
) l
join public.topics t on t.id = l.topic_id
where l.question_id = q.id
  and q.topic_id is null
  and t.subject_id = q.subject_id;
