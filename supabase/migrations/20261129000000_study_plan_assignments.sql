-- ============================================================================
-- JobHub — Subtopic-level first-study assignments + coverage engine
--
-- Master-prompt Phase 3–4: every subtopic (and every topic that legitimately
-- has no subtopics in the live taxonomy) gets exactly ONE identifiable
-- first-study assignment on a day of the already-published 60-day routine.
-- Revision appearances NEVER create a second first-study row — the unique
-- index below makes that structurally impossible.
--
-- Additive only. The existing routines rows (155 published tasks) are the
-- skeleton; assignments link to them via routine_id and the API mirrors the
-- allocation back into routines.topic_ids / subtopic_ids so the live daily
-- exam's taught-scope filter starts working with zero changes to that engine.
-- ============================================================================

create table if not exists public.study_plan_assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  -- NULL subtopic_id = topic-level assignment, allowed ONLY for topics that
  -- have no subtopics in the real taxonomy (validated by the API + the
  -- integrity check below; the taxonomy itself is never modified).
  subtopic_id uuid references public.subtopics(id) on delete cascade,
  routine_id uuid references public.routines(id) on delete set null,
  plan_day smallint not null check (plan_day between 1 and 60),
  first_study_date date not null,
  minutes smallint not null default 30 check (minutes between 5 and 480),
  objective_bn text,
  priority text not null default 'normal' check (priority in ('high', 'normal', 'low')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Exactly ONE first-study assignment per subtopic (or per no-subtopic topic).
create unique index if not exists study_plan_first_study_unique
  on public.study_plan_assignments (course_id, topic_id, subtopic_id)
  nulls not distinct;

create index if not exists study_plan_assignments_day_idx
  on public.study_plan_assignments (course_id, first_study_date);
create index if not exists study_plan_assignments_subject_idx
  on public.study_plan_assignments (course_id, subject_id);

alter table public.study_plan_assignments enable row level security;
alter table public.study_plan_assignments force row level security;

drop policy if exists "students read study plan" on public.study_plan_assignments;
create policy "students read study plan" on public.study_plan_assignments
  for select to authenticated using (true);

drop policy if exists "staff write study plan" on public.study_plan_assignments;
create policy "staff write study plan" on public.study_plan_assignments
  for all to authenticated
  using (public.jh_has_permission('routine.manage'))
  with check (public.jh_has_permission('routine.manage'));

revoke all on public.study_plan_assignments from anon;
grant select, insert, update, delete on public.study_plan_assignments to authenticated;
grant all on public.study_plan_assignments to service_role;

-- ---------------------------------------------------------------------------
-- Coverage summary: the admin matrix, per subject, straight from live data.
-- "Units" are the real first-study targets: every subtopic, plus every topic
-- that has no subtopics. Nothing is invented and revision rows don't exist
-- in this table at all, so they can never inflate coverage.
-- ---------------------------------------------------------------------------
create or replace function public.jh_coverage_summary(p_course_id uuid)
returns table (
  subject_id uuid,
  title_bn text,
  sort_order integer,
  topics_total bigint,
  subtopics_total bigint,
  units_total bigint,
  units_assigned bigint,
  units_unassigned bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with units as (
    select t.subject_id, t.id as topic_id, st.id as subtopic_id
    from public.topics t
    join public.subjects s on s.id = t.subject_id and s.course_id = p_course_id
    left join public.subtopics st on st.topic_id = t.id
  )
  select
    s.id,
    s.title_bn,
    s.sort_order::integer,
    (select count(distinct u.topic_id) from units u where u.subject_id = s.id),
    (select count(u.subtopic_id) from units u where u.subject_id = s.id),
    (select count(*) from units u where u.subject_id = s.id),
    (select count(*) from units u
      where u.subject_id = s.id
        and exists (
          select 1 from public.study_plan_assignments a
          where a.course_id = p_course_id
            and a.topic_id = u.topic_id
            and a.subtopic_id is not distinct from u.subtopic_id
        )),
    (select count(*) from units u
      where u.subject_id = s.id
        and not exists (
          select 1 from public.study_plan_assignments a
          where a.course_id = p_course_id
            and a.topic_id = u.topic_id
            and a.subtopic_id is not distinct from u.subtopic_id
        ))
  from public.subjects s
  where s.course_id = p_course_id
  order by s.sort_order;
$$;

revoke all on function public.jh_coverage_summary(uuid) from public, anon;
grant execute on function public.jh_coverage_summary(uuid) to authenticated, service_role;

-- The exact missing items ("show the exact missing item and block publication").
create or replace function public.jh_coverage_unassigned(p_course_id uuid)
returns table (
  subject_id uuid,
  subject_bn text,
  topic_id uuid,
  topic_bn text,
  subtopic_id uuid,
  subtopic_bn text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.id, s.title_bn, t.id, t.title_bn, st.id, st.title_bn
  from public.subjects s
  join public.topics t on t.subject_id = s.id
  left join public.subtopics st on st.topic_id = t.id
  where s.course_id = p_course_id
    and not exists (
      select 1 from public.study_plan_assignments a
      where a.course_id = p_course_id
        and a.topic_id = t.id
        and a.subtopic_id is not distinct from st.id
    )
  order by s.sort_order, t.sort_order, st.sort_order nulls first;
$$;

revoke all on function public.jh_coverage_unassigned(uuid) from public, anon;
grant execute on function public.jh_coverage_unassigned(uuid) to authenticated, service_role;

-- Publish-validation integrity: rows whose syllabus references don't line up
-- (wrong subject for the topic, subtopic under a different topic, or a
-- topic-level row for a topic that actually has subtopics). Must be empty.
create or replace function public.jh_coverage_integrity(p_course_id uuid)
returns table (assignment_id uuid, problem text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.id, 'topic belongs to a different subject'
  from public.study_plan_assignments a
  join public.topics t on t.id = a.topic_id
  where a.course_id = p_course_id and t.subject_id <> a.subject_id
  union all
  select a.id, 'subtopic belongs to a different topic'
  from public.study_plan_assignments a
  join public.subtopics st on st.id = a.subtopic_id
  where a.course_id = p_course_id and st.topic_id <> a.topic_id
  union all
  select a.id, 'topic-level assignment but the topic has subtopics'
  from public.study_plan_assignments a
  where a.course_id = p_course_id
    and a.subtopic_id is null
    and exists (select 1 from public.subtopics st where st.topic_id = a.topic_id);
$$;

revoke all on function public.jh_coverage_integrity(uuid) from public, anon;
grant execute on function public.jh_coverage_integrity(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Mirror assignments into routines.topic_ids / subtopic_ids so the EXISTING
-- daily-exam taught-scope filter picks the allocation up unchanged.
-- Only rows named in p_routine_ids (or any routine with assignments when
-- NULL) are touched — other admin-managed routine rows stay untouched.
-- ---------------------------------------------------------------------------
create or replace function public.jh_sync_routine_scope(
  p_course_id uuid,
  p_routine_ids uuid[] default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated integer := 0;
begin
  if auth.role() is distinct from 'service_role'
     and not public.jh_has_permission('routine.manage') then
    raise exception 'routine.manage permission required' using errcode = '42501';
  end if;

  with targets as (
    select r.id
    from public.routines r
    where r.course_id = p_course_id
      and (p_routine_ids is not null and r.id = any (p_routine_ids)
           or p_routine_ids is null and exists (
               select 1 from public.study_plan_assignments a where a.routine_id = r.id))
  ),
  agg as (
    select t.id as routine_id,
           coalesce(array_agg(distinct a.topic_id)
                    filter (where a.topic_id is not null), '{}') as tids,
           coalesce(array_agg(distinct a.subtopic_id)
                    filter (where a.subtopic_id is not null), '{}') as stids
    from targets t
    left join public.study_plan_assignments a on a.routine_id = t.id
    group by t.id
  ),
  upd as (
    update public.routines r
    set topic_ids = agg.tids, subtopic_ids = agg.stids, updated_at = now()
    from agg
    where r.id = agg.routine_id
    returning 1
  )
  select count(*) into v_updated from upd;

  return v_updated;
end;
$$;

revoke all on function public.jh_sync_routine_scope(uuid, uuid[]) from public, anon;
grant execute on function public.jh_sync_routine_scope(uuid, uuid[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The generator: assigns every unassigned unit (subtopic, or no-subtopic
-- topic) of each subject to that subject's published study days, in syllabus
-- order, evenly (slot sizes differ by at most 1). It NEVER invents syllabus
-- items, never touches a unit that already has a first-study assignment
-- (admin edits survive regeneration), and reports subjects that have no
-- study slots instead of guessing a day for them.
-- ---------------------------------------------------------------------------
create or replace function public.jh_generate_study_plan(
  p_course_id uuid,
  p_created_by uuid default null,
  p_default_minutes integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_day0 date;
  v_inserted integer := 0;
  v_no_slots text[];
begin
  if auth.role() is distinct from 'service_role'
     and not public.jh_has_permission('routine.manage') then
    raise exception 'routine.manage permission required' using errcode = '42501';
  end if;

  select min(routine_date) into v_day0
  from public.routines
  where course_id = p_course_id and kind = 'daily' and status = 'published';
  if v_day0 is null then
    raise exception 'এই কোর্সের কোনো প্রকাশিত দৈনিক রুটিন নেই — আগে রুটিন প্রকাশ করুন'
      using errcode = 'P0001';
  end if;

  -- Study slots: one per subject per date, drawn from published study /
  -- practice tasks only (exam, rest and revision days carry no first-study).
  with slots as (
    select subject_id, routine_date, id as routine_id,
           row_number() over (partition by subject_id order by routine_date) as slot_no,
           count(*) over (partition by subject_id) as slot_count
    from (
      select distinct on (r.subject_id, r.routine_date)
             r.subject_id, r.routine_date, r.id
      from public.routines r
      where r.course_id = p_course_id
        and r.kind = 'daily'
        and r.status = 'published'
        and r.subject_id is not null
        and coalesce(r.task_kind, 'study') in ('study', 'practice')
      order by r.subject_id, r.routine_date, r.created_at
    ) d
  ),
  units as (
    select t.subject_id, t.id as topic_id, st.id as subtopic_id,
           row_number() over (
             partition by t.subject_id
             order by t.sort_order, t.id, st.sort_order nulls first, st.id
           ) as unit_no,
           count(*) over (partition by t.subject_id) as unit_count
    from public.topics t
    join public.subjects s on s.id = t.subject_id and s.course_id = p_course_id
    left join public.subtopics st on st.topic_id = t.id
  ),
  placed as (
    select u.subject_id, u.topic_id, u.subtopic_id,
           sl.routine_id, sl.routine_date
    from units u
    join slots sl
      on sl.subject_id = u.subject_id
     and sl.slot_no = floor((u.unit_no - 1)::numeric * sl.slot_count / u.unit_count)::int + 1
  ),
  ins as (
    insert into public.study_plan_assignments
      (course_id, subject_id, topic_id, subtopic_id, routine_id,
       plan_day, first_study_date, minutes, created_by)
    select p_course_id, p.subject_id, p.topic_id, p.subtopic_id, p.routine_id,
           least(60, greatest(1, (p.routine_date - v_day0) + 1)),
           p.routine_date,
           greatest(5, least(480, p_default_minutes)),
           p_created_by
    from placed p
    on conflict (course_id, topic_id, subtopic_id) do nothing
    returning 1
  )
  select count(*) into v_inserted from ins;

  -- Subjects whose units could not be placed because they have no study slot.
  select coalesce(array_agg(distinct s.title_bn), '{}') into v_no_slots
  from public.subjects s
  join public.topics t on t.subject_id = s.id
  left join public.subtopics st on st.topic_id = t.id
  where s.course_id = p_course_id
    and not exists (
      select 1 from public.study_plan_assignments a
      where a.course_id = p_course_id
        and a.topic_id = t.id
        and a.subtopic_id is not distinct from st.id
    );

  perform public.jh_sync_routine_scope(p_course_id, null);

  return jsonb_build_object(
    'inserted', v_inserted,
    'subjects_with_gaps', to_jsonb(v_no_slots)
  );
end;
$$;

comment on function public.jh_generate_study_plan is
  'Distributes every unassigned syllabus unit (subtopic, or topic without subtopics) across the subject''s published study days in syllabus order, evenly. Existing assignments are never overwritten; subjects without study slots are reported, never guessed.';

revoke all on function public.jh_generate_study_plan(uuid, uuid, integer) from public, anon;
grant execute on function public.jh_generate_study_plan(uuid, uuid, integer) to authenticated, service_role;
