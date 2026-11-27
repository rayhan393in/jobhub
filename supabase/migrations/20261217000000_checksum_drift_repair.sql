-- ============================================================================
-- JobHub — Repair the two live checksum drifts
--
-- 20261121120400_seed_content.sql and 20261129000000_study_plan_assignments.sql
-- were edited AFTER being applied to production, so `schema_migrations` holds
-- their pre-edit bytes and a future `npm run db:migrate` would stop on drift.
-- (The checklist comparison runs BEFORE any SQL, so this file itself cannot
-- unblock a runner that is already refusing — an operator must run the
-- checksum UPDATE below once against production, or re-record the two rows.
-- It is kept in the migration set so a database restored from an older backup,
-- or a fresh clone that replays them in the old order, self-heals.)
--
-- This migration therefore does two things, in one transaction:
--   1. re-applies the exact repo behaviour of the edited 20261129 functions
--      (coverage engine counts ACTIVE syllabus units only, and a syllabus-level
--      assignment gets its routine link backfilled instead of duplicated);
--   2. re-syncs both recorded checksums to the repo bytes.
--
-- The 20261121120400 edit is a WHERE-clause identity fix that changes no data
-- on an already-seeded database (its inserts are guarded by fingerprint), so
-- only the checksum needs re-syncing there.
--
-- Order note: this file sorts BEFORE 20261214000000_bcs_preliminary_taxonomy.sql,
-- so on the very first full run the coverage engine is fixed up front and the
-- taxonomy migration then lands the 504 subtopics + their assignments. On every
-- later run both are no-ops.
--
-- Idempotent: any number of runs produces the same state.
-- ROLLBACK: none needed (function bodies + a bookkeeping row).
-- ============================================================================

-- ── ০ক · রিপেয়ার: দুটি আগের ফাইল লাইভে পুরোনো বাইটে রেকর্ড করা ────────────
--  20261121120400_seed_content.sql ও 20261129000000_study_plan_assignments.sql
--  এডিট করার আগেই লাইভে প্রয়োগ হয়ে গিয়েছিল, তাই `schema_migrations`-এ ওদের
--  চেকসাম রিপোর বর্তমান বাইটের সাথে মেলে না এবং `npm run db:migrate` ড্রিফট
--  ধরে থেমে যায়।
--
--  এখানে রিপো-সংস্করণের আসল কাজটুকু (কভারেজ ইঞ্জিন শুধু ACTIVE ইউনিট গোনে +
--  সিলেবাস-স্তরের অ্যাসাইনমেন্টে routine লিংক বসানো) হুবহু আবার প্রয়োগ করা হয়,
--  তারপর দুটি ফাইলের চেকসাম নতুন বাইটে সিঙ্ক করা হয় — ফলে ড্রিফট আর থাকে না।
--  idempotent: যেকোনো সংখ্যকবার চললেও ফল একই।
--
--  ১) কভারেজ ইঞ্জিন: এখন থেকে শুধু ACTIVE সিলেবাস সারিই "ইউনিট"। অবসর নেওয়া
--     (is_active = false) পুরোনো সারি লিংক ধরে রাখে কিন্তু পরিকল্পনায় গোনা হয়
--     না; আর সিলেবাস-স্তরে দেওয়া অ্যাসাইনমেন্টে routine লিংক (প্রথম-পড়ার দিন)
--     জায়গায় বসিয়ে দেওয়া হয় — নতুন সারি বানানো হয় না।
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
    -- Units are the ACTIVE syllabus rows only: retired rows keep their links
    -- but are no longer part of the plan (20261214000000_bcs_preliminary_taxonomy).
    select t.subject_id, t.id as topic_id, st.id as subtopic_id
    from public.topics t
    join public.subjects s on s.id = t.subject_id and s.course_id = p_course_id and s.is_active
    left join public.subtopics st on st.topic_id = t.id and st.is_active
    where t.is_active
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
  join public.topics t on t.subject_id = s.id and t.is_active
  left join public.subtopics st on st.topic_id = t.id and st.is_active
  where s.course_id = p_course_id
    and s.is_active
    and not exists (
      select 1 from public.study_plan_assignments a
      where a.course_id = p_course_id
        and a.topic_id = t.id
        and a.subtopic_id is not distinct from st.id
    )
  order by s.sort_order, t.sort_order, st.sort_order nulls first;
$$;

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
  v_linked integer := 0;
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
    join public.subjects s on s.id = t.subject_id and s.course_id = p_course_id and s.is_active
    left join public.subtopics st on st.topic_id = t.id and st.is_active
    where t.is_active
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

  -- Units that already exist but carry no routine link (a syllabus-level seed
  -- runs before any routine does) get the slot they were placed on, so the
  -- mirrored routine scope and "first study date" stay truthful.  The unit's
  -- own day is kept — only the missing link is filled in.
  with slots2 as (
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
  units2 as (
    select t.subject_id, t.id as topic_id, st.id as subtopic_id,
           row_number() over (
             partition by t.subject_id
             order by t.sort_order, t.id, st.sort_order nulls first, st.id
           ) as unit_no,
           count(*) over (partition by t.subject_id) as unit_count
    from public.topics t
    join public.subjects s on s.id = t.subject_id and s.course_id = p_course_id and s.is_active
    left join public.subtopics st on st.topic_id = t.id and st.is_active
    where t.is_active
  ),
  linked as (
    select u.subject_id, u.topic_id, u.subtopic_id, sl.routine_id, sl.routine_date
    from units2 u
    join slots2 sl
      on sl.subject_id = u.subject_id
     and sl.slot_no = floor((u.unit_no - 1)::numeric * sl.slot_count / u.unit_count)::int + 1
  ),
  upd as (
    update public.study_plan_assignments a
       set routine_id = l.routine_id,
           first_study_date = l.routine_date,
           plan_day = least(60, greatest(1, (l.routine_date - v_day0) + 1)),
           updated_at = now()
      from linked l
     where a.course_id = p_course_id
       and a.topic_id = l.topic_id
       and a.subtopic_id is not distinct from l.subtopic_id
       and a.routine_id is null
    returning 1
  )
  select count(*) into v_linked from upd;

  -- Subjects whose units could not be placed because they have no study slot.
  select coalesce(array_agg(distinct s.title_bn), '{}') into v_no_slots
  from public.subjects s
  join public.topics t on t.subject_id = s.id and t.is_active
  left join public.subtopics st on st.topic_id = t.id and st.is_active
  where s.course_id = p_course_id
    and s.is_active
    and not exists (
      select 1 from public.study_plan_assignments a
      where a.course_id = p_course_id
        and a.topic_id = t.id
        and a.subtopic_id is not distinct from st.id
    );

  perform public.jh_sync_routine_scope(p_course_id, null);

  return jsonb_build_object(
    'inserted', v_inserted,
    'linked', v_linked,
    'subjects_with_gaps', to_jsonb(v_no_slots)
  );
end;
$$;

--  ২) চেকসাম সিঙ্ক।
do $$
begin
  if to_regclass('public.schema_migrations') is null then
    return;
  end if;

  update public.schema_migrations m
     set checksum = v.sum
    from (values
      ('20261121120400_seed_content.sql', '2b8bb20b2cadb4d1e75659723cd57a3c'),
      ('20261129000000_study_plan_assignments.sql', '676dda6249d29b6b5e551777b9735aa0')
    ) as v(filename, sum)
   where m.filename = v.filename
     and m.checksum <> v.sum;
end $$;
