-- ---------------------------------------------------------------------------
-- BCS Preliminary: full subject -> topic -> subtopic taxonomy + priorities
-- ---------------------------------------------------------------------------
-- Replaces the placeholder BCS outline (137 rows such as 'topic-14 / আধুনিক যুগ')
-- with the examined Preliminary syllabus, one database row per subtopic, in the
-- shape the importer and every product surface already expect:
--
--   Course    : BCS
--   Subject 01: বাংলা ভাষা ও সাহিত্য            marks 30  (subjects.weight)
--   Topic 1   : বাংলা ভাষা ও ব্যাকরণ
--   Subtopic  : শব্দ ও পদ                      priority P1 (subtopics.metadata)
--
--   10 subjects / 55 topics / 504 subtopics / 200 marks.
--
-- HOW THE OLD TREE IS CONVERTED WITHOUT LOSING LINKS
--   routines.subject_id|topic_id, questions.subject_id|topic_id|subtopic_id,
--   study_plan_assignments, routine_progress, question_frequency and
--   question_topic_links all reference these rows, and a delete would blank
--   thousands of question links (ON DELETE SET NULL).  So nothing is deleted:
--
--     1. subjects are UPDATEd in place by slug (marks -> weight, order);
--     2. for each syllabus topic ONE legacy row is claimed and renamed into it
--        (uuid unchanged).  The claimant is the legacy row that already holds
--        the subtopic with the matching name, otherwise the first mapped row -
--        see the jh_claim table below;
--     3. the claimed subtopics are renamed in place to the syllabus spelling;
--     4. every remaining legacy topic/subtopic is RETIRED
--        (is_active = false, metadata.retired_by = 'bcs-syllabus-v2');
--     5. questions / routines / progress rows that sat on a retired row are
--        re-pointed onto the new tree through an explicit, reviewable
--        (subject, legacy slug) -> syllabus topic map - no similarity guessing;
--     6. study_plan_assignments for the old tree are regenerated for the new
--        one (they are derived data).
--
--   Net effect: no question loses its topic, no routine row is orphaned, and
--   nothing is destroyed - the old names simply stop being "active".
--
-- RE-RUN BEHAVIOUR
--   Idempotent: a second run finds every claimed row already renamed (so the
--   claim set is empty), re-asserts subjects, order and priority, and finds no
--   retired rows left to re-point.
--
-- OUT OF SCOPE
--   Nothing outside course slug = 'bcs' is touched.
-- ---------------------------------------------------------------------------

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

-- ── ০ · প্রয়োজনীয় কলাম ও সহায়ক ফাংশন ────────────────────────────────────
--  subtopics-এ priority/focus রাখার জন্য metadata (topics-এ আগেই আছে)।
alter table public.subtopics
  add column if not exists metadata jsonb not null default '{}'::jsonb;

--  নাম মেলানোর "লঘু" রূপ: NFC → বাংলা কার/চিহ্ন বাদ → lower → য়/ড়/ঢ় এক করা
--  → স্পেস ও যতিচিহ্ন বাদ। (পুরোনো সাব-টপিকের নাম মেলাতে ব্যবহৃত)
create or replace function public.jh_title_norm(x text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select translate(
           translate(
             lower(regexp_replace(coalesce(x, ''),
               '[' || chr(2433) || '-' || chr(2435) || chr(2492) || '-' || chr(2509)
                   || chr(2519) || chr(2528) || '-' || chr(2531) || ']', '', 'g')),
             chr(2527) || chr(2524) || chr(2525),
             chr(2479) || chr(2465) || chr(2466)),
           ' ' || chr(9) || '.,;:।-–—()/' || chr(8203) || chr(8204) || chr(8205)
             || chr(8206) || chr(8207) || chr(65279),
           '')
$$;

revoke all on function public.jh_title_norm(text) from public, anon, authenticated;

-- ── ১ · কোর্স ───────────────────────────────────────────────────────────────
create temp table jh_tx on commit drop as
select c.id as course_id from public.courses c where c.slug = 'bcs';

do $$
begin
  if not exists (select 1 from jh_tx) then
    raise exception 'BCS কোর্স পাওয়া যায়নি';
  end if;
end $$;

-- ── ২ · বিষয়: ১০টি, নম্বর = weight, ক্রম = sort_order ──────────────────────
update public.subjects s
   set title_en = 'Bangla Language and Literature',
       weight = 30,
       sort_order = 1,
       is_active = true,
       metadata = s.metadata || '{"marks": 30, "syllabus": "bcs-preliminary"}'::jsonb,
       updated_at = now()
  from public.courses c
 where c.id = s.course_id and c.slug = 'bcs' and s.slug = 'bangla';

update public.subjects s
   set title_en = 'English Language and Literature',
       weight = 30,
       sort_order = 2,
       is_active = true,
       metadata = s.metadata || '{"marks": 30, "syllabus": "bcs-preliminary"}'::jsonb,
       updated_at = now()
  from public.courses c
 where c.id = s.course_id and c.slug = 'bcs' and s.slug = 'english';

update public.subjects s
   set title_en = 'Bangladesh Affairs',
       weight = 25,
       sort_order = 3,
       is_active = true,
       metadata = s.metadata || '{"marks": 25, "syllabus": "bcs-preliminary"}'::jsonb,
       updated_at = now()
  from public.courses c
 where c.id = s.course_id and c.slug = 'bcs' and s.slug = 'bd';

update public.subjects s
   set title_en = 'International Affairs',
       weight = 25,
       sort_order = 4,
       is_active = true,
       metadata = s.metadata || '{"marks": 25, "syllabus": "bcs-preliminary"}'::jsonb,
       updated_at = now()
  from public.courses c
 where c.id = s.course_id and c.slug = 'bcs' and s.slug = 'international';

update public.subjects s
   set title_en = 'Geography, Environment and Disaster Management',
       weight = 10,
       sort_order = 5,
       is_active = true,
       metadata = s.metadata || '{"marks": 10, "syllabus": "bcs-preliminary"}'::jsonb,
       updated_at = now()
  from public.courses c
 where c.id = s.course_id and c.slug = 'bcs' and s.slug = 'geography';

update public.subjects s
   set title_en = 'General Science',
       weight = 15,
       sort_order = 6,
       is_active = true,
       metadata = s.metadata || '{"marks": 15, "syllabus": "bcs-preliminary"}'::jsonb,
       updated_at = now()
  from public.courses c
 where c.id = s.course_id and c.slug = 'bcs' and s.slug = 'science';

update public.subjects s
   set title_en = 'Computer and Information Technology',
       weight = 15,
       sort_order = 7,
       is_active = true,
       metadata = s.metadata || '{"marks": 15, "syllabus": "bcs-preliminary"}'::jsonb,
       updated_at = now()
  from public.courses c
 where c.id = s.course_id and c.slug = 'bcs' and s.slug = 'ict';

update public.subjects s
   set title_en = 'Mathematical Reasoning',
       weight = 20,
       sort_order = 8,
       is_active = true,
       metadata = s.metadata || '{"marks": 20, "syllabus": "bcs-preliminary"}'::jsonb,
       updated_at = now()
  from public.courses c
 where c.id = s.course_id and c.slug = 'bcs' and s.slug = 'math';

update public.subjects s
   set title_en = 'Mental Ability',
       weight = 15,
       sort_order = 9,
       is_active = true,
       metadata = s.metadata || '{"marks": 15, "syllabus": "bcs-preliminary"}'::jsonb,
       updated_at = now()
  from public.courses c
 where c.id = s.course_id and c.slug = 'bcs' and s.slug = 'mental';

update public.subjects s
   set title_en = 'Ethics, Values and Good Governance',
       weight = 15,
       sort_order = 10,
       is_active = true,
       metadata = s.metadata || '{"marks": 15, "syllabus": "bcs-preliminary"}'::jsonb,
       updated_at = now()
  from public.courses c
 where c.id = s.course_id and c.slug = 'bcs' and s.slug = 'ethics';

-- ── ৩ · সিলেবাসের বীজ (৫৫ টপিক · ৫০৪ সাব-টপিক) ────────────────────────────
create temp table jh_topic_seed on commit drop as
select v.subject_slug, v.slug, v.title_en, v.title_bn, v.sort_order, v.metadata
from (values

    ('bangla'::text, 'P1-bangla-language-and-grammar-1'::text, 'Bangla Language and Grammar'::text, 'বাংলা ভাষা ও ব্যাকরণ'::text, 1::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('bangla'::text, 'P1-old-and-medieval-bangla-literature-2'::text, 'Old and Medieval Bangla Literature'::text, 'প্রাচীন ও মধ্যযুগের বাংলা সাহিত্য'::text, 2::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('bangla'::text, 'P1-modern-bangla-literature-3'::text, 'Modern Bangla Literature'::text, 'আধুনিক বাংলা সাহিত্য'::text, 3::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('bangla'::text, 'P1-literary-works-and-facts-4'::text, 'Literary Works and Facts'::text, 'সাহিত্যকর্ম ও সাহিত্যবিষয়ক তথ্য'::text, 4::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('english'::text, 'grammar'::text, 'Grammar'::text, 'Grammar'::text, 1::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('english'::text, 'vocabulary'::text, 'Vocabulary'::text, 'Vocabulary'::text, 2::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('english'::text, 'composition'::text, 'Composition'::text, 'Composition'::text, 3::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('english'::text, 'english-literature'::text, 'English Literature'::text, 'English Literature'::text, 4::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('bd'::text, 'P1-history-of-bangladesh-1'::text, 'History of Bangladesh'::text, 'বাংলাদেশের ইতিহাস'::text, 1::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('bd'::text, 'P1-independence-and-the-liberation-war-2'::text, 'Independence and the Liberation War'::text, 'বাংলাদেশের স্বাধীনতা ও মুক্তিযুদ্ধ'::text, 2::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('bd'::text, 'P1-constitution-of-bangladesh-3'::text, 'Constitution of Bangladesh'::text, 'বাংলাদেশের সংবিধান'::text, 3::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('bd'::text, 'P1-political-system-and-government-4'::text, 'Political System and Government'::text, 'রাজনৈতিক ব্যবস্থা ও সরকার'::text, 4::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('bd'::text, 'P1-economy-of-bangladesh-5'::text, 'Economy of Bangladesh'::text, 'বাংলাদেশের অর্থনীতি'::text, 5::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('bd'::text, 'P1-agriculture-industry-and-trade-6'::text, 'Agriculture, Industry and Trade'::text, 'কৃষি, শিল্প ও বাণিজ্য'::text, 6::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('bd'::text, 'P1-population-and-ethnic-groups-7'::text, 'Population and Ethnic Groups'::text, 'জনসংখ্যা ও জাতিগোষ্ঠী'::text, 7::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('bd'::text, 'P1-national-achievements-and-culture-8'::text, 'National Achievements and Culture'::text, 'জাতীয় অর্জন ও সংস্কৃতি'::text, 8::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('international'::text, 'P1-world-history-1'::text, 'World History'::text, 'বিশ্ব ইতিহাস'::text, 1::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('international'::text, 'P1-international-politics-and-relations-2'::text, 'International Politics and Relations'::text, 'আন্তর্জাতিক রাজনীতি ও সম্পর্ক'::text, 2::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('international'::text, 'P1-international-organisations-3'::text, 'International Organisations'::text, 'আন্তর্জাতিক সংস্থা'::text, 3::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('international'::text, 'P1-regional-organisations-and-alliances-4'::text, 'Regional Organisations and Alliances'::text, 'আঞ্চলিক সংস্থা ও জোট'::text, 4::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('international'::text, 'P1-international-treaties-and-conferences-5'::text, 'International Treaties and Conferences'::text, 'আন্তর্জাতিক চুক্তি ও সম্মেলন'::text, 5::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('international'::text, 'P1-country-profiles-and-geopolitics-6'::text, 'Country Profiles and Geopolitics'::text, 'দেশ পরিচিতি ও ভূ-রাজনীতি'::text, 6::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('international'::text, 'P1-contemporary-international-affairs-7'::text, 'Contemporary International Affairs'::text, 'আন্তর্জাতিক সাম্প্রতিক বিষয়'::text, 7::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('geography'::text, 'P1-geography-of-bangladesh-1'::text, 'Geography of Bangladesh'::text, 'বাংলাদেশের ভূগোল'::text, 1::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('geography'::text, 'P1-natural-environment-of-bangladesh-2'::text, 'Natural Environment of Bangladesh'::text, 'বাংলাদেশের প্রাকৃতিক পরিবেশ'::text, 2::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('geography'::text, 'P1-world-geography-3'::text, 'World Geography'::text, 'বিশ্ব ভূগোল'::text, 3::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('geography'::text, 'P1-environment-and-climate-4'::text, 'Environment and Climate'::text, 'পরিবেশ ও জলবায়ু'::text, 4::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('geography'::text, 'P1-disaster-management-5'::text, 'Disaster Management'::text, 'দুর্যোগ ব্যবস্থাপনা'::text, 5::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('science'::text, 'P1-physics-1'::text, 'Physics'::text, 'পদার্থবিজ্ঞান'::text, 1::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('science'::text, 'P1-chemistry-2'::text, 'Chemistry'::text, 'রসায়ন'::text, 2::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('science'::text, 'P1-biology-3'::text, 'Biology'::text, 'জীববিজ্ঞান'::text, 3::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('science'::text, 'P1-human-body-and-health-4'::text, 'Human Body and Health'::text, 'মানবদেহ ও স্বাস্থ্য'::text, 4::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('science'::text, 'P1-modern-and-applied-science-5'::text, 'Modern and Applied Science'::text, 'আধুনিক ও প্রয়োগিক বিজ্ঞান'::text, 5::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('ict'::text, 'P1-computer-fundamentals-1'::text, 'Computer Fundamentals'::text, 'কম্পিউটার মৌলিক ধারণা'::text, 1::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('ict'::text, 'P1-number-system-and-digital-logic-2'::text, 'Number System and Digital Logic'::text, 'Number System ও Digital Logic'::text, 2::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('ict'::text, 'P1-operating-system-and-software-3'::text, 'Operating System and Software'::text, 'Operating System ও Software'::text, 3::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('ict'::text, 'P1-internet-and-networking-4'::text, 'Internet and Networking'::text, 'Internet ও Networking'::text, 4::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('ict'::text, 'cyber-security'::text, 'Cyber Security'::text, 'Cyber Security'::text, 5::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('ict'::text, 'P1-modern-information-technology-6'::text, 'Modern Information Technology'::text, 'আধুনিক তথ্যপ্রযুক্তি'::text, 6::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('math'::text, 'P1-arithmetic-1'::text, 'Arithmetic'::text, 'পাটিগণিত'::text, 1::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('math'::text, 'P1-algebra-2'::text, 'Algebra'::text, 'বীজগণিত'::text, 2::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('math'::text, 'P1-series-and-sets-3'::text, 'Series and Sets'::text, 'ধারা ও সেট'::text, 3::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('math'::text, 'P1-geometry-4'::text, 'Geometry'::text, 'জ্যামিতি'::text, 4::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('math'::text, 'P1-mensuration-5'::text, 'Mensuration'::text, 'পরিমিতি'::text, 5::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('math'::text, 'P1-statistics-and-probability-6'::text, 'Statistics and Probability'::text, 'পরিসংখ্যান ও সম্ভাব্যতা'::text, 6::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('mental'::text, 'verbal-reasoning'::text, 'Verbal Reasoning'::text, 'Verbal Reasoning'::text, 1::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('mental'::text, 'numerical-reasoning'::text, 'Numerical Reasoning'::text, 'Numerical Reasoning'::text, 2::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('mental'::text, 'logical-reasoning'::text, 'Logical Reasoning'::text, 'Logical Reasoning'::text, 3::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('mental'::text, 'spatial-reasoning'::text, 'Spatial Reasoning'::text, 'Spatial Reasoning'::text, 4::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('mental'::text, 'mechanical-reasoning'::text, 'Mechanical Reasoning'::text, 'Mechanical Reasoning'::text, 5::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('ethics'::text, 'P1-ethics-1'::text, 'Ethics'::text, 'নৈতিকতা'::text, 1::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('ethics'::text, 'P1-values-2'::text, 'Values'::text, 'মূল্যবোধ'::text, 2::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('ethics'::text, 'P1-good-governance-3'::text, 'Good Governance'::text, 'সুশাসন'::text, 3::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('ethics'::text, 'P1-democracy-and-human-rights-4'::text, 'Democracy and Human Rights'::text, 'গণতন্ত্র ও মানবাধিকার'::text, 4::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb),
    ('ethics'::text, 'P1-corruption-and-administrative-ethics-5'::text, 'Corruption and Administrative Ethics'::text, 'দুর্নীতি ও প্রশাসনিক নৈতিকতা'::text, 5::smallint, '{"syllabus": "bcs-preliminary"}'::jsonb)

) as v(subject_slug, slug, title_en, title_bn, sort_order, metadata);

create temp table jh_sub_seed on commit drop as
select v.subject_slug, v.topic_slug, v.slug, v.title_en, v.sort_order, v.priority
from (values

    ('bangla'::text, 'P1-bangla-language-and-grammar-1'::text, 'sub-1'::text, 'শব্দ ও পদ'::text, 1::smallint, 'P1'::text),
    ('bangla'::text, 'P1-bangla-language-and-grammar-1'::text, 'sub-2'::text, 'সন্ধি'::text, 2::smallint, 'P1'::text),
    ('bangla'::text, 'P1-bangla-language-and-grammar-1'::text, 'sub-3'::text, 'সমাস'::text, 3::smallint, 'P1'::text),
    ('bangla'::text, 'P1-bangla-language-and-grammar-1'::text, 'sub-4'::text, 'উপসর্গ'::text, 4::smallint, 'P1'::text),
    ('bangla'::text, 'P1-bangla-language-and-grammar-1'::text, 'sub-5'::text, 'প্রত্যয়'::text, 5::smallint, 'P1'::text),
    ('bangla'::text, 'P1-bangla-language-and-grammar-1'::text, 'sub-6'::text, 'কারক ও বিভক্তি'::text, 6::smallint, 'P1'::text),
    ('bangla'::text, 'P1-bangla-language-and-grammar-1'::text, 'sub-7'::text, 'বাক্য ও বাক্যশুদ্ধি'::text, 7::smallint, 'P1'::text),
    ('bangla'::text, 'P1-bangla-language-and-grammar-1'::text, 'sub-8'::text, 'বানান শুদ্ধি'::text, 8::smallint, 'P1'::text),
    ('bangla'::text, 'P1-bangla-language-and-grammar-1'::text, 'sub-9'::text, 'বাগধারা'::text, 9::smallint, 'P1'::text),
    ('bangla'::text, 'P1-bangla-language-and-grammar-1'::text, 'sub-10'::text, 'এক কথায় প্রকাশ'::text, 10::smallint, 'P1'::text),
    ('bangla'::text, 'P1-bangla-language-and-grammar-1'::text, 'sub-11'::text, 'সমার্থক শব্দ'::text, 11::smallint, 'P1'::text),
    ('bangla'::text, 'P1-bangla-language-and-grammar-1'::text, 'sub-12'::text, 'বিপরীতার্থক শব্দ'::text, 12::smallint, 'P1'::text),
    ('bangla'::text, 'P1-bangla-language-and-grammar-1'::text, 'sub-13'::text, 'প্রয়োগ ও অপপ্রয়োগ'::text, 13::smallint, 'P1'::text),
    ('bangla'::text, 'P1-bangla-language-and-grammar-1'::text, 'sub-14'::text, 'ধ্বনি ও বর্ণ'::text, 14::smallint, 'P2'::text),
    ('bangla'::text, 'P1-bangla-language-and-grammar-1'::text, 'sub-15'::text, 'বাংলা ভাষার উৎপত্তি ও বিকাশ'::text, 15::smallint, 'P2'::text),
    ('bangla'::text, 'P1-bangla-language-and-grammar-1'::text, 'sub-16'::text, 'ণত্ব ও ষত্ব বিধান'::text, 16::smallint, 'P2'::text),
    ('bangla'::text, 'P1-bangla-language-and-grammar-1'::text, 'sub-17'::text, 'পারিভাষিক শব্দ'::text, 17::smallint, 'P2'::text),
    ('bangla'::text, 'P1-bangla-language-and-grammar-1'::text, 'sub-18'::text, 'শব্দের শ্রেণিবিভাগ'::text, 18::smallint, 'P2'::text),
    ('bangla'::text, 'P1-bangla-language-and-grammar-1'::text, 'sub-19'::text, 'বাক্যের শ্রেণিবিভাগ'::text, 19::smallint, 'P2'::text),
    ('bangla'::text, 'P1-old-and-medieval-bangla-literature-2'::text, 'sub-1'::text, 'চর্যাপদ'::text, 1::smallint, 'P1'::text),
    ('bangla'::text, 'P1-old-and-medieval-bangla-literature-2'::text, 'sub-2'::text, 'চর্যাপদের কবি'::text, 2::smallint, 'P1'::text),
    ('bangla'::text, 'P1-old-and-medieval-bangla-literature-2'::text, 'sub-3'::text, 'শ্রীকৃষ্ণকীর্তন'::text, 3::smallint, 'P1'::text),
    ('bangla'::text, 'P1-old-and-medieval-bangla-literature-2'::text, 'sub-4'::text, 'মঙ্গলকাব্য'::text, 4::smallint, 'P1'::text),
    ('bangla'::text, 'P1-old-and-medieval-bangla-literature-2'::text, 'sub-5'::text, 'বৈষ্ণব পদাবলি'::text, 5::smallint, 'P1'::text),
    ('bangla'::text, 'P1-old-and-medieval-bangla-literature-2'::text, 'sub-6'::text, 'মুসলিম সাহিত্য'::text, 6::smallint, 'P1'::text),
    ('bangla'::text, 'P1-old-and-medieval-bangla-literature-2'::text, 'sub-7'::text, 'মধ্যযুগের গুরুত্বপূর্ণ কবি'::text, 7::smallint, 'P1'::text),
    ('bangla'::text, 'P1-old-and-medieval-bangla-literature-2'::text, 'sub-8'::text, 'চর্যাপদের ভাষা ও বৈশিষ্ট্য'::text, 8::smallint, 'P2'::text),
    ('bangla'::text, 'P1-old-and-medieval-bangla-literature-2'::text, 'sub-9'::text, 'অনুবাদ সাহিত্য'::text, 9::smallint, 'P2'::text),
    ('bangla'::text, 'P1-old-and-medieval-bangla-literature-2'::text, 'sub-10'::text, 'মধ্যযুগের সাহিত্যকর্ম'::text, 10::smallint, 'P2'::text),
    ('bangla'::text, 'P1-modern-bangla-literature-3'::text, 'sub-1'::text, 'রবীন্দ্রনাথ ঠাকুর'::text, 1::smallint, 'P1'::text),
    ('bangla'::text, 'P1-modern-bangla-literature-3'::text, 'sub-2'::text, 'কাজী নজরুল ইসলাম'::text, 2::smallint, 'P1'::text),
    ('bangla'::text, 'P1-modern-bangla-literature-3'::text, 'sub-3'::text, 'মাইকেল মধুসূদন দত্ত'::text, 3::smallint, 'P1'::text),
    ('bangla'::text, 'P1-modern-bangla-literature-3'::text, 'sub-4'::text, 'বঙ্কিমচন্দ্র চট্টোপাধ্যায়'::text, 4::smallint, 'P1'::text),
    ('bangla'::text, 'P1-modern-bangla-literature-3'::text, 'sub-5'::text, 'শরৎচন্দ্র চট্টোপাধ্যায়'::text, 5::smallint, 'P1'::text),
    ('bangla'::text, 'P1-modern-bangla-literature-3'::text, 'sub-6'::text, 'মীর মশাররফ হোসেন'::text, 6::smallint, 'P1'::text),
    ('bangla'::text, 'P1-modern-bangla-literature-3'::text, 'sub-7'::text, 'বেগম রোকেয়া'::text, 7::smallint, 'P1'::text),
    ('bangla'::text, 'P1-modern-bangla-literature-3'::text, 'sub-8'::text, 'জীবনানন্দ দাশ'::text, 8::smallint, 'P1'::text),
    ('bangla'::text, 'P1-modern-bangla-literature-3'::text, 'sub-9'::text, 'জসীমউদ্‌দীন'::text, 9::smallint, 'P1'::text),
    ('bangla'::text, 'P1-modern-bangla-literature-3'::text, 'sub-10'::text, 'সুকান্ত ভট্টাচার্য'::text, 10::smallint, 'P1'::text),
    ('bangla'::text, 'P1-modern-bangla-literature-3'::text, 'sub-11'::text, 'ফররুখ আহমদ'::text, 11::smallint, 'P2'::text),
    ('bangla'::text, 'P1-modern-bangla-literature-3'::text, 'sub-12'::text, 'শামসুর রাহমান'::text, 12::smallint, 'P2'::text),
    ('bangla'::text, 'P1-modern-bangla-literature-3'::text, 'sub-13'::text, 'ঈশ্বরচন্দ্র বিদ্যাসাগর'::text, 13::smallint, 'P2'::text),
    ('bangla'::text, 'P1-modern-bangla-literature-3'::text, 'sub-14'::text, 'দীনবন্ধু মিত্র'::text, 14::smallint, 'P2'::text),
    ('bangla'::text, 'P1-modern-bangla-literature-3'::text, 'sub-15'::text, 'সৈয়দ শামসুল হক'::text, 15::smallint, 'P2'::text),
    ('bangla'::text, 'P1-modern-bangla-literature-3'::text, 'sub-16'::text, 'অন্যান্য আধুনিক সাহিত্যিক'::text, 16::smallint, 'P3'::text),
    ('bangla'::text, 'P1-literary-works-and-facts-4'::text, 'sub-1'::text, 'বাংলা উপন্যাস'::text, 1::smallint, 'P1'::text),
    ('bangla'::text, 'P1-literary-works-and-facts-4'::text, 'sub-2'::text, 'বাংলা ছোটগল্প'::text, 2::smallint, 'P1'::text),
    ('bangla'::text, 'P1-literary-works-and-facts-4'::text, 'sub-3'::text, 'বাংলা নাটক'::text, 3::smallint, 'P1'::text),
    ('bangla'::text, 'P1-literary-works-and-facts-4'::text, 'sub-4'::text, 'বাংলা কাব্যগ্রন্থ ও কবিতা'::text, 4::smallint, 'P1'::text),
    ('bangla'::text, 'P1-literary-works-and-facts-4'::text, 'sub-5'::text, 'সাহিত্য পত্র-পত্রিকা'::text, 5::smallint, 'P1'::text),
    ('bangla'::text, 'P1-literary-works-and-facts-4'::text, 'sub-6'::text, 'সাহিত্যিকদের ছদ্মনাম ও উপাধি'::text, 6::smallint, 'P1'::text),
    ('bangla'::text, 'P1-literary-works-and-facts-4'::text, 'sub-7'::text, 'বাংলা সাহিত্যের যুগবিভাগ'::text, 7::smallint, 'P1'::text),
    ('bangla'::text, 'P1-literary-works-and-facts-4'::text, 'sub-8'::text, 'বাংলা প্রবন্ধ'::text, 8::smallint, 'P2'::text),
    ('bangla'::text, 'P1-literary-works-and-facts-4'::text, 'sub-9'::text, 'সাহিত্য আন্দোলন'::text, 9::smallint, 'P2'::text),
    ('bangla'::text, 'P1-literary-works-and-facts-4'::text, 'sub-10'::text, 'সাহিত্য পুরস্কার'::text, 10::smallint, 'P2'::text),
    ('bangla'::text, 'P1-literary-works-and-facts-4'::text, 'sub-11'::text, 'বিখ্যাত সাহিত্যিক চরিত্র'::text, 11::smallint, 'P2'::text),
    ('bangla'::text, 'P1-literary-works-and-facts-4'::text, 'sub-12'::text, 'বিখ্যাত সাহিত্যিক উক্তি'::text, 12::smallint, 'P2'::text),
    ('english'::text, 'grammar'::text, 'sub-1'::text, 'Parts of Speech'::text, 1::smallint, 'P1'::text),
    ('english'::text, 'grammar'::text, 'sub-2'::text, 'Noun and Pronoun'::text, 2::smallint, 'P1'::text),
    ('english'::text, 'grammar'::text, 'sub-3'::text, 'Verb'::text, 3::smallint, 'P1'::text),
    ('english'::text, 'grammar'::text, 'sub-4'::text, 'Tense'::text, 4::smallint, 'P1'::text),
    ('english'::text, 'grammar'::text, 'sub-5'::text, 'Subject-Verb Agreement'::text, 5::smallint, 'P1'::text),
    ('english'::text, 'grammar'::text, 'sub-6'::text, 'Article'::text, 6::smallint, 'P1'::text),
    ('english'::text, 'grammar'::text, 'sub-7'::text, 'Preposition'::text, 7::smallint, 'P1'::text),
    ('english'::text, 'grammar'::text, 'sub-8'::text, 'Right Form of Verbs'::text, 8::smallint, 'P1'::text),
    ('english'::text, 'grammar'::text, 'sub-9'::text, 'Voice'::text, 9::smallint, 'P1'::text),
    ('english'::text, 'grammar'::text, 'sub-10'::text, 'Narration'::text, 10::smallint, 'P1'::text),
    ('english'::text, 'grammar'::text, 'sub-11'::text, 'Transformation of Sentences'::text, 11::smallint, 'P1'::text),
    ('english'::text, 'grammar'::text, 'sub-12'::text, 'Sentence Correction'::text, 12::smallint, 'P1'::text),
    ('english'::text, 'grammar'::text, 'sub-13'::text, 'Conjunction'::text, 13::smallint, 'P2'::text),
    ('english'::text, 'grammar'::text, 'sub-14'::text, 'Adjective and Adverb'::text, 14::smallint, 'P2'::text),
    ('english'::text, 'grammar'::text, 'sub-15'::text, 'Degree'::text, 15::smallint, 'P2'::text),
    ('english'::text, 'grammar'::text, 'sub-16'::text, 'Clause'::text, 16::smallint, 'P2'::text),
    ('english'::text, 'grammar'::text, 'sub-17'::text, 'Phrase'::text, 17::smallint, 'P2'::text),
    ('english'::text, 'grammar'::text, 'sub-18'::text, 'Conditional Sentence'::text, 18::smallint, 'P2'::text),
    ('english'::text, 'grammar'::text, 'sub-19'::text, 'Modifiers'::text, 19::smallint, 'P2'::text),
    ('english'::text, 'grammar'::text, 'sub-20'::text, 'Sentence Classification'::text, 20::smallint, 'P2'::text),
    ('english'::text, 'vocabulary'::text, 'sub-1'::text, 'Synonyms'::text, 1::smallint, 'P1'::text),
    ('english'::text, 'vocabulary'::text, 'sub-2'::text, 'Antonyms'::text, 2::smallint, 'P1'::text),
    ('english'::text, 'vocabulary'::text, 'sub-3'::text, 'Idioms and Phrases'::text, 3::smallint, 'P1'::text),
    ('english'::text, 'vocabulary'::text, 'sub-4'::text, 'Appropriate Word'::text, 4::smallint, 'P1'::text),
    ('english'::text, 'vocabulary'::text, 'sub-5'::text, 'Spelling'::text, 5::smallint, 'P1'::text),
    ('english'::text, 'vocabulary'::text, 'sub-6'::text, 'One-word Substitution'::text, 6::smallint, 'P2'::text),
    ('english'::text, 'vocabulary'::text, 'sub-7'::text, 'Phrasal Verbs'::text, 7::smallint, 'P2'::text),
    ('english'::text, 'vocabulary'::text, 'sub-8'::text, 'Proverbs'::text, 8::smallint, 'P2'::text),
    ('english'::text, 'vocabulary'::text, 'sub-9'::text, 'Prefix and Suffix'::text, 9::smallint, 'P2'::text),
    ('english'::text, 'composition'::text, 'sub-1'::text, 'Sentence Completion'::text, 1::smallint, 'P1'::text),
    ('english'::text, 'composition'::text, 'sub-2'::text, 'Correct Usage'::text, 2::smallint, 'P1'::text),
    ('english'::text, 'composition'::text, 'sub-3'::text, 'Sentence Arrangement'::text, 3::smallint, 'P2'::text),
    ('english'::text, 'composition'::text, 'sub-4'::text, 'Paragraph'::text, 4::smallint, 'P2'::text),
    ('english'::text, 'composition'::text, 'sub-5'::text, 'Letter and Application'::text, 5::smallint, 'P3'::text),
    ('english'::text, 'english-literature'::text, 'sub-1'::text, 'William Shakespeare'::text, 1::smallint, 'P1'::text),
    ('english'::text, 'english-literature'::text, 'sub-2'::text, 'Shakespeare''s Plays and Sonnets'::text, 2::smallint, 'P1'::text),
    ('english'::text, 'english-literature'::text, 'sub-3'::text, 'Elizabethan Period'::text, 3::smallint, 'P1'::text),
    ('english'::text, 'english-literature'::text, 'sub-4'::text, 'Romantic Period'::text, 4::smallint, 'P1'::text),
    ('english'::text, 'english-literature'::text, 'sub-5'::text, 'Famous Poets'::text, 5::smallint, 'P1'::text),
    ('english'::text, 'english-literature'::text, 'sub-6'::text, 'Famous Novelists'::text, 6::smallint, 'P1'::text),
    ('english'::text, 'english-literature'::text, 'sub-7'::text, 'Famous Dramatists'::text, 7::smallint, 'P1'::text),
    ('english'::text, 'english-literature'::text, 'sub-8'::text, 'Literary Works and Authors'::text, 8::smallint, 'P1'::text),
    ('english'::text, 'english-literature'::text, 'sub-9'::text, 'Victorian Period'::text, 9::smallint, 'P2'::text),
    ('english'::text, 'english-literature'::text, 'sub-10'::text, 'Modern Period'::text, 10::smallint, 'P2'::text),
    ('english'::text, 'english-literature'::text, 'sub-11'::text, 'Literary Quotations'::text, 11::smallint, 'P2'::text),
    ('english'::text, 'english-literature'::text, 'sub-12'::text, 'Literary Movements'::text, 12::smallint, 'P2'::text),
    ('english'::text, 'english-literature'::text, 'sub-13'::text, 'Literary Characters'::text, 13::smallint, 'P2'::text),
    ('bd'::text, 'P1-history-of-bangladesh-1'::text, 'sub-1'::text, 'ব্রিটিশ শাসন'::text, 1::smallint, 'P1'::text),
    ('bd'::text, 'P1-history-of-bangladesh-1'::text, 'sub-2'::text, 'বঙ্গভঙ্গ'::text, 2::smallint, 'P1'::text),
    ('bd'::text, 'P1-history-of-bangladesh-1'::text, 'sub-3'::text, 'পাকিস্তান আমল'::text, 3::smallint, 'P1'::text),
    ('bd'::text, 'P1-history-of-bangladesh-1'::text, 'sub-4'::text, 'ভাষা আন্দোলন'::text, 4::smallint, 'P1'::text),
    ('bd'::text, 'P1-history-of-bangladesh-1'::text, 'sub-5'::text, 'যুক্তফ্রন্ট নির্বাচন'::text, 5::smallint, 'P1'::text),
    ('bd'::text, 'P1-history-of-bangladesh-1'::text, 'sub-6'::text, 'ছয় দফা আন্দোলন'::text, 6::smallint, 'P1'::text),
    ('bd'::text, 'P1-history-of-bangladesh-1'::text, 'sub-7'::text, 'আগরতলা মামলা'::text, 7::smallint, 'P1'::text),
    ('bd'::text, 'P1-history-of-bangladesh-1'::text, 'sub-8'::text, '১৯৬৯-এর গণঅভ্যুত্থান'::text, 8::smallint, 'P1'::text),
    ('bd'::text, 'P1-history-of-bangladesh-1'::text, 'sub-9'::text, '১৯৭০ সালের নির্বাচন'::text, 9::smallint, 'P1'::text),
    ('bd'::text, 'P1-history-of-bangladesh-1'::text, 'sub-10'::text, 'অসহযোগ আন্দোলন'::text, 10::smallint, 'P1'::text),
    ('bd'::text, 'P1-history-of-bangladesh-1'::text, 'sub-11'::text, 'প্রাচীন বাংলার ইতিহাস'::text, 11::smallint, 'P2'::text),
    ('bd'::text, 'P1-history-of-bangladesh-1'::text, 'sub-12'::text, 'মধ্যযুগের বাংলা'::text, 12::smallint, 'P2'::text),
    ('bd'::text, 'P1-history-of-bangladesh-1'::text, 'sub-13'::text, 'পাকিস্তান আন্দোলন'::text, 13::smallint, 'P2'::text),
    ('bd'::text, 'P1-independence-and-the-liberation-war-2'::text, 'sub-1'::text, '৭ মার্চের ভাষণ'::text, 1::smallint, 'P1'::text),
    ('bd'::text, 'P1-independence-and-the-liberation-war-2'::text, 'sub-2'::text, 'স্বাধীনতার ঘোষণা'::text, 2::smallint, 'P1'::text),
    ('bd'::text, 'P1-independence-and-the-liberation-war-2'::text, 'sub-3'::text, 'মুজিবনগর সরকার'::text, 3::smallint, 'P1'::text),
    ('bd'::text, 'P1-independence-and-the-liberation-war-2'::text, 'sub-4'::text, 'মুক্তিযুদ্ধের সেক্টর'::text, 4::smallint, 'P1'::text),
    ('bd'::text, 'P1-independence-and-the-liberation-war-2'::text, 'sub-5'::text, 'সেক্টর কমান্ডার'::text, 5::smallint, 'P1'::text),
    ('bd'::text, 'P1-independence-and-the-liberation-war-2'::text, 'sub-6'::text, 'মুক্তিযুদ্ধের গুরুত্বপূর্ণ অভিযান'::text, 6::smallint, 'P1'::text),
    ('bd'::text, 'P1-independence-and-the-liberation-war-2'::text, 'sub-7'::text, 'বীরশ্রেষ্ঠ'::text, 7::smallint, 'P1'::text),
    ('bd'::text, 'P1-independence-and-the-liberation-war-2'::text, 'sub-8'::text, 'খেতাবপ্রাপ্ত মুক্তিযোদ্ধা'::text, 8::smallint, 'P1'::text),
    ('bd'::text, 'P1-independence-and-the-liberation-war-2'::text, 'sub-9'::text, 'পাকিস্তানি বাহিনীর আত্মসমর্পণ'::text, 9::smallint, 'P1'::text),
    ('bd'::text, 'P1-independence-and-the-liberation-war-2'::text, 'sub-10'::text, 'স্বাধীন বাংলাদেশের অভ্যুদয়'::text, 10::smallint, 'P1'::text),
    ('bd'::text, 'P1-independence-and-the-liberation-war-2'::text, 'sub-11'::text, 'মুক্তিযুদ্ধের আন্তর্জাতিক প্রতিক্রিয়া'::text, 11::smallint, 'P2'::text),
    ('bd'::text, 'P1-constitution-of-bangladesh-3'::text, 'sub-1'::text, 'সংবিধানের প্রস্তাবনা'::text, 1::smallint, 'P1'::text),
    ('bd'::text, 'P1-constitution-of-bangladesh-3'::text, 'sub-2'::text, 'সংবিধানের বৈশিষ্ট্য'::text, 2::smallint, 'P1'::text),
    ('bd'::text, 'P1-constitution-of-bangladesh-3'::text, 'sub-3'::text, 'রাষ্ট্র পরিচালনার মূলনীতি'::text, 3::smallint, 'P1'::text),
    ('bd'::text, 'P1-constitution-of-bangladesh-3'::text, 'sub-4'::text, 'মৌলিক অধিকার'::text, 4::smallint, 'P1'::text),
    ('bd'::text, 'P1-constitution-of-bangladesh-3'::text, 'sub-5'::text, 'গুরুত্বপূর্ণ অনুচ্ছেদ'::text, 5::smallint, 'P1'::text),
    ('bd'::text, 'P1-constitution-of-bangladesh-3'::text, 'sub-6'::text, 'আইন বিভাগ'::text, 6::smallint, 'P1'::text),
    ('bd'::text, 'P1-constitution-of-bangladesh-3'::text, 'sub-7'::text, 'শাসন বিভাগ'::text, 7::smallint, 'P1'::text),
    ('bd'::text, 'P1-constitution-of-bangladesh-3'::text, 'sub-8'::text, 'বিচার বিভাগ'::text, 8::smallint, 'P1'::text),
    ('bd'::text, 'P1-constitution-of-bangladesh-3'::text, 'sub-9'::text, 'সাংবিধানিক প্রতিষ্ঠান'::text, 9::smallint, 'P1'::text),
    ('bd'::text, 'P1-constitution-of-bangladesh-3'::text, 'sub-10'::text, 'সংবিধান সংশোধনী'::text, 10::smallint, 'P1'::text),
    ('bd'::text, 'P1-political-system-and-government-4'::text, 'sub-1'::text, 'জাতীয় সংসদ'::text, 1::smallint, 'P1'::text),
    ('bd'::text, 'P1-political-system-and-government-4'::text, 'sub-2'::text, 'নির্বাচন ব্যবস্থা'::text, 2::smallint, 'P1'::text),
    ('bd'::text, 'P1-political-system-and-government-4'::text, 'sub-3'::text, 'স্থানীয় সরকার'::text, 3::smallint, 'P1'::text),
    ('bd'::text, 'P1-political-system-and-government-4'::text, 'sub-4'::text, 'প্রশাসনিক কাঠামো'::text, 4::smallint, 'P1'::text),
    ('bd'::text, 'P1-political-system-and-government-4'::text, 'sub-5'::text, 'রাজনৈতিক দল'::text, 5::smallint, 'P2'::text),
    ('bd'::text, 'P1-political-system-and-government-4'::text, 'sub-6'::text, 'রাষ্ট্রপতি'::text, 6::smallint, 'P2'::text),
    ('bd'::text, 'P1-political-system-and-government-4'::text, 'sub-7'::text, 'প্রধানমন্ত্রী'::text, 7::smallint, 'P2'::text),
    ('bd'::text, 'P1-political-system-and-government-4'::text, 'sub-8'::text, 'মন্ত্রিসভা'::text, 8::smallint, 'P2'::text),
    ('bd'::text, 'P1-political-system-and-government-4'::text, 'sub-9'::text, 'বিচারব্যবস্থা'::text, 9::smallint, 'P2'::text),
    ('bd'::text, 'P1-political-system-and-government-4'::text, 'sub-10'::text, 'প্রশাসনিক সংস্কার'::text, 10::smallint, 'P2'::text),
    ('bd'::text, 'P1-economy-of-bangladesh-5'::text, 'sub-1'::text, 'GDP ও GNP'::text, 1::smallint, 'P1'::text),
    ('bd'::text, 'P1-economy-of-bangladesh-5'::text, 'sub-2'::text, 'মাথাপিছু আয়'::text, 2::smallint, 'P1'::text),
    ('bd'::text, 'P1-economy-of-bangladesh-5'::text, 'sub-3'::text, 'জাতীয় বাজেট'::text, 3::smallint, 'P1'::text),
    ('bd'::text, 'P1-economy-of-bangladesh-5'::text, 'sub-4'::text, 'রেমিট্যান্স'::text, 4::smallint, 'P1'::text),
    ('bd'::text, 'P1-economy-of-bangladesh-5'::text, 'sub-5'::text, 'বৈদেশিক মুদ্রা'::text, 5::smallint, 'P1'::text),
    ('bd'::text, 'P1-economy-of-bangladesh-5'::text, 'sub-6'::text, 'আমদানি ও রপ্তানি'::text, 6::smallint, 'P1'::text),
    ('bd'::text, 'P1-economy-of-bangladesh-5'::text, 'sub-7'::text, 'ADP'::text, 7::smallint, 'P2'::text),
    ('bd'::text, 'P1-economy-of-bangladesh-5'::text, 'sub-8'::text, 'পঞ্চবার্ষিকী পরিকল্পনা'::text, 8::smallint, 'P2'::text),
    ('bd'::text, 'P1-economy-of-bangladesh-5'::text, 'sub-9'::text, 'দারিদ্র্য বিমোচন'::text, 9::smallint, 'P2'::text),
    ('bd'::text, 'P1-economy-of-bangladesh-5'::text, 'sub-10'::text, 'ব্যাংকিং ব্যবস্থা'::text, 10::smallint, 'P2'::text),
    ('bd'::text, 'P1-economy-of-bangladesh-5'::text, 'sub-11'::text, 'মুদ্রানীতি ও রাজস্বনীতি'::text, 11::smallint, 'P2'::text),
    ('bd'::text, 'P1-agriculture-industry-and-trade-6'::text, 'sub-1'::text, 'কৃষি উৎপাদন'::text, 1::smallint, 'P1'::text),
    ('bd'::text, 'P1-agriculture-industry-and-trade-6'::text, 'sub-2'::text, 'খাদ্যশস্য'::text, 2::smallint, 'P1'::text),
    ('bd'::text, 'P1-agriculture-industry-and-trade-6'::text, 'sub-3'::text, 'তৈরি পোশাক শিল্প'::text, 3::smallint, 'P1'::text),
    ('bd'::text, 'P1-agriculture-industry-and-trade-6'::text, 'sub-4'::text, 'রপ্তানি পণ্য'::text, 4::smallint, 'P1'::text),
    ('bd'::text, 'P1-agriculture-industry-and-trade-6'::text, 'sub-5'::text, 'আমদানি পণ্য'::text, 5::smallint, 'P1'::text),
    ('bd'::text, 'P1-agriculture-industry-and-trade-6'::text, 'sub-6'::text, 'মৎস্য সম্পদ'::text, 6::smallint, 'P2'::text),
    ('bd'::text, 'P1-agriculture-industry-and-trade-6'::text, 'sub-7'::text, 'প্রাণিসম্পদ'::text, 7::smallint, 'P2'::text),
    ('bd'::text, 'P1-agriculture-industry-and-trade-6'::text, 'sub-8'::text, 'বনজ সম্পদ'::text, 8::smallint, 'P2'::text),
    ('bd'::text, 'P1-agriculture-industry-and-trade-6'::text, 'sub-9'::text, 'শিল্পায়ন'::text, 9::smallint, 'P2'::text),
    ('bd'::text, 'P1-agriculture-industry-and-trade-6'::text, 'sub-10'::text, 'বাণিজ্যিক প্রতিষ্ঠান'::text, 10::smallint, 'P2'::text),
    ('bd'::text, 'P1-population-and-ethnic-groups-7'::text, 'sub-1'::text, 'জনসংখ্যা'::text, 1::smallint, 'P1'::text),
    ('bd'::text, 'P1-population-and-ethnic-groups-7'::text, 'sub-2'::text, 'আদমশুমারি'::text, 2::smallint, 'P1'::text),
    ('bd'::text, 'P1-population-and-ethnic-groups-7'::text, 'sub-3'::text, 'ক্ষুদ্র নৃগোষ্ঠী'::text, 3::smallint, 'P1'::text),
    ('bd'::text, 'P1-population-and-ethnic-groups-7'::text, 'sub-4'::text, 'জনসংখ্যার ঘনত্ব'::text, 4::smallint, 'P2'::text),
    ('bd'::text, 'P1-population-and-ethnic-groups-7'::text, 'sub-5'::text, 'জনসংখ্যা বণ্টন'::text, 5::smallint, 'P2'::text),
    ('bd'::text, 'P1-population-and-ethnic-groups-7'::text, 'sub-6'::text, 'জাতিগোষ্ঠীর সংস্কৃতি'::text, 6::smallint, 'P2'::text),
    ('bd'::text, 'P1-national-achievements-and-culture-8'::text, 'sub-1'::text, 'জাতীয় প্রতীক'::text, 1::smallint, 'P1'::text),
    ('bd'::text, 'P1-national-achievements-and-culture-8'::text, 'sub-2'::text, 'জাতীয় দিবস'::text, 2::smallint, 'P1'::text),
    ('bd'::text, 'P1-national-achievements-and-culture-8'::text, 'sub-3'::text, 'জাতীয় পুরস্কার'::text, 3::smallint, 'P1'::text),
    ('bd'::text, 'P1-national-achievements-and-culture-8'::text, 'sub-4'::text, 'গুরুত্বপূর্ণ ব্যক্তিত্ব'::text, 4::smallint, 'P1'::text),
    ('bd'::text, 'P1-national-achievements-and-culture-8'::text, 'sub-5'::text, 'জাতীয় প্রতিষ্ঠান'::text, 5::smallint, 'P2'::text),
    ('bd'::text, 'P1-national-achievements-and-culture-8'::text, 'sub-6'::text, 'ঐতিহাসিক স্থাপনা'::text, 6::smallint, 'P2'::text),
    ('bd'::text, 'P1-national-achievements-and-culture-8'::text, 'sub-7'::text, 'খেলাধুলা'::text, 7::smallint, 'P2'::text),
    ('bd'::text, 'P1-national-achievements-and-culture-8'::text, 'sub-8'::text, 'শিল্প ও সংস্কৃতি'::text, 8::smallint, 'P2'::text),
    ('bd'::text, 'P1-national-achievements-and-culture-8'::text, 'sub-9'::text, 'চলচ্চিত্র ও গণমাধ্যম'::text, 9::smallint, 'P3'::text),
    ('international'::text, 'P1-world-history-1'::text, 'sub-1'::text, 'ফরাসি বিপ্লব'::text, 1::smallint, 'P1'::text),
    ('international'::text, 'P1-world-history-1'::text, 'sub-2'::text, 'প্রথম বিশ্বযুদ্ধ'::text, 2::smallint, 'P1'::text),
    ('international'::text, 'P1-world-history-1'::text, 'sub-3'::text, 'দ্বিতীয় বিশ্বযুদ্ধ'::text, 3::smallint, 'P1'::text),
    ('international'::text, 'P1-world-history-1'::text, 'sub-4'::text, 'স্নায়ুযুদ্ধ'::text, 4::smallint, 'P1'::text),
    ('international'::text, 'P1-world-history-1'::text, 'sub-5'::text, 'সোভিয়েত ইউনিয়নের পতন'::text, 5::smallint, 'P1'::text),
    ('international'::text, 'P1-world-history-1'::text, 'sub-6'::text, 'প্রাচীন সভ্যতা'::text, 6::smallint, 'P2'::text),
    ('international'::text, 'P1-world-history-1'::text, 'sub-7'::text, 'রেনেসাঁ'::text, 7::smallint, 'P2'::text),
    ('international'::text, 'P1-world-history-1'::text, 'sub-8'::text, 'শিল্পবিপ্লব'::text, 8::smallint, 'P2'::text),
    ('international'::text, 'P1-world-history-1'::text, 'sub-9'::text, 'উপনিবেশবাদ'::text, 9::smallint, 'P2'::text),
    ('international'::text, 'P1-world-history-1'::text, 'sub-10'::text, 'সাম্রাজ্যবাদ'::text, 10::smallint, 'P2'::text),
    ('international'::text, 'P1-international-politics-and-relations-2'::text, 'sub-1'::text, 'ভূ-রাজনীতি'::text, 1::smallint, 'P1'::text),
    ('international'::text, 'P1-international-politics-and-relations-2'::text, 'sub-2'::text, 'পরাশক্তি'::text, 2::smallint, 'P1'::text),
    ('international'::text, 'P1-international-politics-and-relations-2'::text, 'sub-3'::text, 'কূটনীতি'::text, 3::smallint, 'P1'::text),
    ('international'::text, 'P1-international-politics-and-relations-2'::text, 'sub-4'::text, 'সামরিক জোট'::text, 4::smallint, 'P1'::text),
    ('international'::text, 'P1-international-politics-and-relations-2'::text, 'sub-5'::text, 'আন্তর্জাতিক সংঘাত'::text, 5::smallint, 'P1'::text),
    ('international'::text, 'P1-international-politics-and-relations-2'::text, 'sub-6'::text, 'সন্ত্রাসবাদ'::text, 6::smallint, 'P1'::text),
    ('international'::text, 'P1-international-politics-and-relations-2'::text, 'sub-7'::text, 'যুদ্ধ ও শান্তি'::text, 7::smallint, 'P1'::text),
    ('international'::text, 'P1-international-politics-and-relations-2'::text, 'sub-8'::text, 'আন্তর্জাতিক সম্পর্কের ধারণা'::text, 8::smallint, 'P2'::text),
    ('international'::text, 'P1-international-politics-and-relations-2'::text, 'sub-9'::text, 'ক্ষমতার ভারসাম্য'::text, 9::smallint, 'P2'::text),
    ('international'::text, 'P1-international-organisations-3'::text, 'sub-1'::text, 'জাতিসংঘ'::text, 1::smallint, 'P1'::text),
    ('international'::text, 'P1-international-organisations-3'::text, 'sub-2'::text, 'General Assembly'::text, 2::smallint, 'P1'::text),
    ('international'::text, 'P1-international-organisations-3'::text, 'sub-3'::text, 'Security Council'::text, 3::smallint, 'P1'::text),
    ('international'::text, 'P1-international-organisations-3'::text, 'sub-4'::text, 'International Court of Justice'::text, 4::smallint, 'P1'::text),
    ('international'::text, 'P1-international-organisations-3'::text, 'sub-5'::text, 'World Bank'::text, 5::smallint, 'P1'::text),
    ('international'::text, 'P1-international-organisations-3'::text, 'sub-6'::text, 'IMF'::text, 6::smallint, 'P1'::text),
    ('international'::text, 'P1-international-organisations-3'::text, 'sub-7'::text, 'WTO'::text, 7::smallint, 'P1'::text),
    ('international'::text, 'P1-international-organisations-3'::text, 'sub-8'::text, 'WHO'::text, 8::smallint, 'P1'::text),
    ('international'::text, 'P1-international-organisations-3'::text, 'sub-9'::text, 'UNESCO'::text, 9::smallint, 'P1'::text),
    ('international'::text, 'P1-international-organisations-3'::text, 'sub-10'::text, 'UNICEF'::text, 10::smallint, 'P1'::text),
    ('international'::text, 'P1-international-organisations-3'::text, 'sub-11'::text, 'ECOSOC'::text, 11::smallint, 'P2'::text),
    ('international'::text, 'P1-international-organisations-3'::text, 'sub-12'::text, 'UN Secretariat'::text, 12::smallint, 'P2'::text),
    ('international'::text, 'P1-international-organisations-3'::text, 'sub-13'::text, 'ILO'::text, 13::smallint, 'P2'::text),
    ('international'::text, 'P1-international-organisations-3'::text, 'sub-14'::text, 'FAO'::text, 14::smallint, 'P2'::text),
    ('international'::text, 'P1-international-organisations-3'::text, 'sub-15'::text, 'অন্যান্য আন্তর্জাতিক সংস্থা'::text, 15::smallint, 'P2'::text),
    ('international'::text, 'P1-regional-organisations-and-alliances-4'::text, 'sub-1'::text, 'SAARC'::text, 1::smallint, 'P1'::text),
    ('international'::text, 'P1-regional-organisations-and-alliances-4'::text, 'sub-2'::text, 'ASEAN'::text, 2::smallint, 'P1'::text),
    ('international'::text, 'P1-regional-organisations-and-alliances-4'::text, 'sub-3'::text, 'European Union'::text, 3::smallint, 'P1'::text),
    ('international'::text, 'P1-regional-organisations-and-alliances-4'::text, 'sub-4'::text, 'NATO'::text, 4::smallint, 'P1'::text),
    ('international'::text, 'P1-regional-organisations-and-alliances-4'::text, 'sub-5'::text, 'OIC'::text, 5::smallint, 'P1'::text),
    ('international'::text, 'P1-regional-organisations-and-alliances-4'::text, 'sub-6'::text, 'G-20'::text, 6::smallint, 'P1'::text),
    ('international'::text, 'P1-regional-organisations-and-alliances-4'::text, 'sub-7'::text, 'BRICS'::text, 7::smallint, 'P1'::text),
    ('international'::text, 'P1-regional-organisations-and-alliances-4'::text, 'sub-8'::text, 'BIMSTEC'::text, 8::smallint, 'P2'::text),
    ('international'::text, 'P1-regional-organisations-and-alliances-4'::text, 'sub-9'::text, 'G-7'::text, 9::smallint, 'P2'::text),
    ('international'::text, 'P1-regional-organisations-and-alliances-4'::text, 'sub-10'::text, 'Commonwealth'::text, 10::smallint, 'P2'::text),
    ('international'::text, 'P1-international-treaties-and-conferences-5'::text, 'sub-1'::text, 'জলবায়ু চুক্তি'::text, 1::smallint, 'P1'::text),
    ('international'::text, 'P1-international-treaties-and-conferences-5'::text, 'sub-2'::text, 'আন্তর্জাতিক সম্মেলন'::text, 2::smallint, 'P1'::text),
    ('international'::text, 'P1-international-treaties-and-conferences-5'::text, 'sub-3'::text, 'পারমাণবিক চুক্তি'::text, 3::smallint, 'P2'::text),
    ('international'::text, 'P1-international-treaties-and-conferences-5'::text, 'sub-4'::text, 'বাণিজ্য চুক্তি'::text, 4::smallint, 'P2'::text),
    ('international'::text, 'P1-international-treaties-and-conferences-5'::text, 'sub-5'::text, 'শান্তিচুক্তি'::text, 5::smallint, 'P2'::text),
    ('international'::text, 'P1-international-treaties-and-conferences-5'::text, 'sub-6'::text, 'গুরুত্বপূর্ণ ঘোষণাপত্র'::text, 6::smallint, 'P2'::text),
    ('international'::text, 'P1-country-profiles-and-geopolitics-6'::text, 'sub-1'::text, 'দেশ ও রাজধানী'::text, 1::smallint, 'P1'::text),
    ('international'::text, 'P1-country-profiles-and-geopolitics-6'::text, 'sub-2'::text, 'মুদ্রা'::text, 2::smallint, 'P1'::text),
    ('international'::text, 'P1-country-profiles-and-geopolitics-6'::text, 'sub-3'::text, 'ভৌগোলিক অবস্থান'::text, 3::smallint, 'P1'::text),
    ('international'::text, 'P1-country-profiles-and-geopolitics-6'::text, 'sub-4'::text, 'গুরুত্বপূর্ণ প্রণালি'::text, 4::smallint, 'P1'::text),
    ('international'::text, 'P1-country-profiles-and-geopolitics-6'::text, 'sub-5'::text, 'সাগর ও মহাসাগর'::text, 5::smallint, 'P1'::text),
    ('international'::text, 'P1-country-profiles-and-geopolitics-6'::text, 'sub-6'::text, 'সরকারি নাম'::text, 6::smallint, 'P2'::text),
    ('international'::text, 'P1-country-profiles-and-geopolitics-6'::text, 'sub-7'::text, 'আন্তর্জাতিক সীমান্ত'::text, 7::smallint, 'P2'::text),
    ('international'::text, 'P1-country-profiles-and-geopolitics-6'::text, 'sub-8'::text, 'দ্বীপ ও উপদ্বীপ'::text, 8::smallint, 'P2'::text),
    ('international'::text, 'P1-contemporary-international-affairs-7'::text, 'sub-1'::text, 'আন্তর্জাতিক যুদ্ধ ও সংঘাত'::text, 1::smallint, 'P1'::text),
    ('international'::text, 'P1-contemporary-international-affairs-7'::text, 'sub-2'::text, 'রাষ্ট্র ও সরকারপ্রধান'::text, 2::smallint, 'P1'::text),
    ('international'::text, 'P1-contemporary-international-affairs-7'::text, 'sub-3'::text, 'গুরুত্বপূর্ণ বৈশ্বিক ঘটনা'::text, 3::smallint, 'P1'::text),
    ('international'::text, 'P1-contemporary-international-affairs-7'::text, 'sub-4'::text, 'আন্তর্জাতিক পুরস্কার'::text, 4::smallint, 'P2'::text),
    ('international'::text, 'P1-contemporary-international-affairs-7'::text, 'sub-5'::text, 'গুরুত্বপূর্ণ নিয়োগ'::text, 5::smallint, 'P2'::text),
    ('international'::text, 'P1-contemporary-international-affairs-7'::text, 'sub-6'::text, 'আন্তর্জাতিক খেলাধুলা'::text, 6::smallint, 'P2'::text),
    ('geography'::text, 'P1-geography-of-bangladesh-1'::text, 'sub-1'::text, 'ভৌগোলিক অবস্থান'::text, 1::smallint, 'P1'::text),
    ('geography'::text, 'P1-geography-of-bangladesh-1'::text, 'sub-2'::text, 'আয়তন ও সীমানা'::text, 2::smallint, 'P1'::text),
    ('geography'::text, 'P1-geography-of-bangladesh-1'::text, 'sub-3'::text, 'অক্ষাংশ ও দ্রাঘিমাংশ'::text, 3::smallint, 'P1'::text),
    ('geography'::text, 'P1-geography-of-bangladesh-1'::text, 'sub-4'::text, 'নদ-নদী'::text, 4::smallint, 'P1'::text),
    ('geography'::text, 'P1-geography-of-bangladesh-1'::text, 'sub-5'::text, 'প্রশাসনিক অঞ্চল'::text, 5::smallint, 'P2'::text),
    ('geography'::text, 'P1-geography-of-bangladesh-1'::text, 'sub-6'::text, 'পাহাড় ও সমভূমি'::text, 6::smallint, 'P2'::text),
    ('geography'::text, 'P1-geography-of-bangladesh-1'::text, 'sub-7'::text, 'দ্বীপ ও চর'::text, 7::smallint, 'P2'::text),
    ('geography'::text, 'P1-geography-of-bangladesh-1'::text, 'sub-8'::text, 'বাংলাদেশের ভূ-রাজনৈতিক গুরুত্ব'::text, 8::smallint, 'P2'::text),
    ('geography'::text, 'P1-natural-environment-of-bangladesh-2'::text, 'sub-1'::text, 'ভূ-প্রকৃতি'::text, 1::smallint, 'P1'::text),
    ('geography'::text, 'P1-natural-environment-of-bangladesh-2'::text, 'sub-2'::text, 'জলবায়ু'::text, 2::smallint, 'P1'::text),
    ('geography'::text, 'P1-natural-environment-of-bangladesh-2'::text, 'sub-3'::text, 'ঋতু'::text, 3::smallint, 'P1'::text),
    ('geography'::text, 'P1-natural-environment-of-bangladesh-2'::text, 'sub-4'::text, 'বনভূমি'::text, 4::smallint, 'P1'::text),
    ('geography'::text, 'P1-natural-environment-of-bangladesh-2'::text, 'sub-5'::text, 'প্রাকৃতিক সম্পদ'::text, 5::smallint, 'P1'::text),
    ('geography'::text, 'P1-natural-environment-of-bangladesh-2'::text, 'sub-6'::text, 'জীববৈচিত্র্য'::text, 6::smallint, 'P1'::text),
    ('geography'::text, 'P1-natural-environment-of-bangladesh-2'::text, 'sub-7'::text, 'মাটি'::text, 7::smallint, 'P2'::text),
    ('geography'::text, 'P1-natural-environment-of-bangladesh-2'::text, 'sub-8'::text, 'খনিজ সম্পদ'::text, 8::smallint, 'P2'::text),
    ('geography'::text, 'P1-world-geography-3'::text, 'sub-1'::text, 'মহাদেশ'::text, 1::smallint, 'P1'::text),
    ('geography'::text, 'P1-world-geography-3'::text, 'sub-2'::text, 'মহাসাগর'::text, 2::smallint, 'P1'::text),
    ('geography'::text, 'P1-world-geography-3'::text, 'sub-3'::text, 'পর্বতমালা'::text, 3::smallint, 'P1'::text),
    ('geography'::text, 'P1-world-geography-3'::text, 'sub-4'::text, 'নদ-নদী'::text, 4::smallint, 'P1'::text),
    ('geography'::text, 'P1-world-geography-3'::text, 'sub-5'::text, 'প্রণালি'::text, 5::smallint, 'P1'::text),
    ('geography'::text, 'P1-world-geography-3'::text, 'sub-6'::text, 'মরুভূমি'::text, 6::smallint, 'P2'::text),
    ('geography'::text, 'P1-world-geography-3'::text, 'sub-7'::text, 'হ্রদ'::text, 7::smallint, 'P2'::text),
    ('geography'::text, 'P1-world-geography-3'::text, 'sub-8'::text, 'দ্বীপ'::text, 8::smallint, 'P2'::text),
    ('geography'::text, 'P1-world-geography-3'::text, 'sub-9'::text, 'আগ্নেয়গিরি'::text, 9::smallint, 'P2'::text),
    ('geography'::text, 'P1-environment-and-climate-4'::text, 'sub-1'::text, 'পরিবেশ ও বাস্তুতন্ত্র'::text, 1::smallint, 'P1'::text),
    ('geography'::text, 'P1-environment-and-climate-4'::text, 'sub-2'::text, 'পরিবেশ দূষণ'::text, 2::smallint, 'P1'::text),
    ('geography'::text, 'P1-environment-and-climate-4'::text, 'sub-3'::text, 'বৈশ্বিক উষ্ণায়ন'::text, 3::smallint, 'P1'::text),
    ('geography'::text, 'P1-environment-and-climate-4'::text, 'sub-4'::text, 'গ্রিনহাউস প্রভাব'::text, 4::smallint, 'P1'::text),
    ('geography'::text, 'P1-environment-and-climate-4'::text, 'sub-5'::text, 'জলবায়ু পরিবর্তন'::text, 5::smallint, 'P1'::text),
    ('geography'::text, 'P1-environment-and-climate-4'::text, 'sub-6'::text, 'ওজোন স্তর'::text, 6::smallint, 'P1'::text),
    ('geography'::text, 'P1-environment-and-climate-4'::text, 'sub-7'::text, 'জীববৈচিত্র্য সংরক্ষণ'::text, 7::smallint, 'P2'::text),
    ('geography'::text, 'P1-environment-and-climate-4'::text, 'sub-8'::text, 'আন্তর্জাতিক পরিবেশ চুক্তি'::text, 8::smallint, 'P2'::text),
    ('geography'::text, 'P1-disaster-management-5'::text, 'sub-1'::text, 'বন্যা'::text, 1::smallint, 'P1'::text),
    ('geography'::text, 'P1-disaster-management-5'::text, 'sub-2'::text, 'ঘূর্ণিঝড়'::text, 2::smallint, 'P1'::text),
    ('geography'::text, 'P1-disaster-management-5'::text, 'sub-3'::text, 'জলোচ্ছ্বাস'::text, 3::smallint, 'P1'::text),
    ('geography'::text, 'P1-disaster-management-5'::text, 'sub-4'::text, 'ভূমিকম্প'::text, 4::smallint, 'P1'::text),
    ('geography'::text, 'P1-disaster-management-5'::text, 'sub-5'::text, 'খরা'::text, 5::smallint, 'P2'::text),
    ('geography'::text, 'P1-disaster-management-5'::text, 'sub-6'::text, 'ভূমিধস'::text, 6::smallint, 'P2'::text),
    ('geography'::text, 'P1-disaster-management-5'::text, 'sub-7'::text, 'সুনামি'::text, 7::smallint, 'P2'::text),
    ('geography'::text, 'P1-disaster-management-5'::text, 'sub-8'::text, 'দুর্যোগ প্রস্তুতি'::text, 8::smallint, 'P2'::text),
    ('geography'::text, 'P1-disaster-management-5'::text, 'sub-9'::text, 'দুর্যোগ মোকাবিলা'::text, 9::smallint, 'P2'::text),
    ('geography'::text, 'P1-disaster-management-5'::text, 'sub-10'::text, 'পুনর্বাসন'::text, 10::smallint, 'P3'::text),
    ('science'::text, 'P1-physics-1'::text, 'sub-1'::text, 'গতি ও বল'::text, 1::smallint, 'P1'::text),
    ('science'::text, 'P1-physics-1'::text, 'sub-2'::text, 'কাজ, ক্ষমতা ও শক্তি'::text, 2::smallint, 'P1'::text),
    ('science'::text, 'P1-physics-1'::text, 'sub-3'::text, 'তাপ ও তাপমাত্রা'::text, 3::smallint, 'P1'::text),
    ('science'::text, 'P1-physics-1'::text, 'sub-4'::text, 'আলো'::text, 4::smallint, 'P1'::text),
    ('science'::text, 'P1-physics-1'::text, 'sub-5'::text, 'শব্দ'::text, 5::smallint, 'P1'::text),
    ('science'::text, 'P1-physics-1'::text, 'sub-6'::text, 'চৌম্বকত্ব'::text, 6::smallint, 'P1'::text),
    ('science'::text, 'P1-physics-1'::text, 'sub-7'::text, 'চল বিদ্যুৎ'::text, 7::smallint, 'P1'::text),
    ('science'::text, 'P1-physics-1'::text, 'sub-8'::text, 'তেজস্ক্রিয়তা'::text, 8::smallint, 'P1'::text),
    ('science'::text, 'P1-physics-1'::text, 'sub-9'::text, 'ভৌত রাশি ও পরিমাপ'::text, 9::smallint, 'P2'::text),
    ('science'::text, 'P1-physics-1'::text, 'sub-10'::text, 'তরঙ্গ'::text, 10::smallint, 'P2'::text),
    ('science'::text, 'P1-physics-1'::text, 'sub-11'::text, 'স্থির বিদ্যুৎ'::text, 11::smallint, 'P2'::text),
    ('science'::text, 'P1-physics-1'::text, 'sub-12'::text, 'আধুনিক পদার্থবিজ্ঞান'::text, 12::smallint, 'P2'::text),
    ('science'::text, 'P1-physics-1'::text, 'sub-13'::text, 'পারমাণবিক শক্তি'::text, 13::smallint, 'P2'::text),
    ('science'::text, 'P1-chemistry-2'::text, 'sub-1'::text, 'পরমাণুর গঠন'::text, 1::smallint, 'P1'::text),
    ('science'::text, 'P1-chemistry-2'::text, 'sub-2'::text, 'মৌল ও যৌগ'::text, 2::smallint, 'P1'::text),
    ('science'::text, 'P1-chemistry-2'::text, 'sub-3'::text, 'পর্যায় সারণি'::text, 3::smallint, 'P1'::text),
    ('science'::text, 'P1-chemistry-2'::text, 'sub-4'::text, 'রাসায়নিক বিক্রিয়া'::text, 4::smallint, 'P1'::text),
    ('science'::text, 'P1-chemistry-2'::text, 'sub-5'::text, 'এসিড, ক্ষার ও লবণ'::text, 5::smallint, 'P1'::text),
    ('science'::text, 'P1-chemistry-2'::text, 'sub-6'::text, 'ধাতু ও অধাতু'::text, 6::smallint, 'P1'::text),
    ('science'::text, 'P1-chemistry-2'::text, 'sub-7'::text, 'দৈনন্দিন জীবনে রসায়ন'::text, 7::smallint, 'P1'::text),
    ('science'::text, 'P1-chemistry-2'::text, 'sub-8'::text, 'রাসায়নিক বন্ধন'::text, 8::smallint, 'P2'::text),
    ('science'::text, 'P1-chemistry-2'::text, 'sub-9'::text, 'গ্যাস'::text, 9::smallint, 'P2'::text),
    ('science'::text, 'P1-chemistry-2'::text, 'sub-10'::text, 'জৈব রসায়ন'::text, 10::smallint, 'P2'::text),
    ('science'::text, 'P1-biology-3'::text, 'sub-1'::text, 'কোষ ও টিস্যু'::text, 1::smallint, 'P1'::text),
    ('science'::text, 'P1-biology-3'::text, 'sub-2'::text, 'উদ্ভিদবিজ্ঞান'::text, 2::smallint, 'P1'::text),
    ('science'::text, 'P1-biology-3'::text, 'sub-3'::text, 'প্রাণিবিজ্ঞান'::text, 3::smallint, 'P1'::text),
    ('science'::text, 'P1-biology-3'::text, 'sub-4'::text, 'জেনেটিক্স'::text, 4::smallint, 'P1'::text),
    ('science'::text, 'P1-biology-3'::text, 'sub-5'::text, 'জীববৈচিত্র্য'::text, 5::smallint, 'P1'::text),
    ('science'::text, 'P1-biology-3'::text, 'sub-6'::text, 'শ্রেণিবিন্যাস'::text, 6::smallint, 'P1'::text),
    ('science'::text, 'P1-biology-3'::text, 'sub-7'::text, 'সালোকসংশ্লেষণ'::text, 7::smallint, 'P1'::text),
    ('science'::text, 'P1-biology-3'::text, 'sub-8'::text, 'কোষ বিভাজন'::text, 8::smallint, 'P2'::text),
    ('science'::text, 'P1-biology-3'::text, 'sub-9'::text, 'বিবর্তন'::text, 9::smallint, 'P2'::text),
    ('science'::text, 'P1-biology-3'::text, 'sub-10'::text, 'বাস্তুতন্ত্র'::text, 10::smallint, 'P2'::text),
    ('science'::text, 'P1-human-body-and-health-4'::text, 'sub-1'::text, 'মানবদেহের অঙ্গতন্ত্র'::text, 1::smallint, 'P1'::text),
    ('science'::text, 'P1-human-body-and-health-4'::text, 'sub-2'::text, 'রক্ত ও রক্ত সঞ্চালন'::text, 2::smallint, 'P1'::text),
    ('science'::text, 'P1-human-body-and-health-4'::text, 'sub-3'::text, 'হৃদপিণ্ড'::text, 3::smallint, 'P1'::text),
    ('science'::text, 'P1-human-body-and-health-4'::text, 'sub-4'::text, 'পরিপাকতন্ত্র'::text, 4::smallint, 'P1'::text),
    ('science'::text, 'P1-human-body-and-health-4'::text, 'sub-5'::text, 'শ্বাসতন্ত্র'::text, 5::smallint, 'P1'::text),
    ('science'::text, 'P1-human-body-and-health-4'::text, 'sub-6'::text, 'খাদ্য ও পুষ্টি'::text, 6::smallint, 'P1'::text),
    ('science'::text, 'P1-human-body-and-health-4'::text, 'sub-7'::text, 'ভিটামিন'::text, 7::smallint, 'P1'::text),
    ('science'::text, 'P1-human-body-and-health-4'::text, 'sub-8'::text, 'রোগ ও প্রতিকার'::text, 8::smallint, 'P1'::text),
    ('science'::text, 'P1-human-body-and-health-4'::text, 'sub-9'::text, 'টিকা ও রোগ প্রতিরোধ'::text, 9::smallint, 'P1'::text),
    ('science'::text, 'P1-human-body-and-health-4'::text, 'sub-10'::text, 'স্নায়ুতন্ত্র'::text, 10::smallint, 'P2'::text),
    ('science'::text, 'P1-human-body-and-health-4'::text, 'sub-11'::text, 'হরমোন'::text, 11::smallint, 'P2'::text),
    ('science'::text, 'P1-modern-and-applied-science-5'::text, 'sub-1'::text, 'ভাইরাস ও ব্যাকটেরিয়া'::text, 1::smallint, 'P1'::text),
    ('science'::text, 'P1-modern-and-applied-science-5'::text, 'sub-2'::text, 'সৌরজগৎ'::text, 2::smallint, 'P1'::text),
    ('science'::text, 'P1-modern-and-applied-science-5'::text, 'sub-3'::text, 'দৈনন্দিন জীবনের বৈজ্ঞানিক আবিষ্কার'::text, 3::smallint, 'P1'::text),
    ('science'::text, 'P1-modern-and-applied-science-5'::text, 'sub-4'::text, 'জীবপ্রযুক্তি'::text, 4::smallint, 'P2'::text),
    ('science'::text, 'P1-modern-and-applied-science-5'::text, 'sub-5'::text, 'চিকিৎসাবিজ্ঞান'::text, 5::smallint, 'P2'::text),
    ('science'::text, 'P1-modern-and-applied-science-5'::text, 'sub-6'::text, 'কৃষিবিজ্ঞান'::text, 6::smallint, 'P2'::text),
    ('science'::text, 'P1-modern-and-applied-science-5'::text, 'sub-7'::text, 'মহাকাশবিজ্ঞান'::text, 7::smallint, 'P2'::text),
    ('science'::text, 'P1-modern-and-applied-science-5'::text, 'sub-8'::text, 'নবায়নযোগ্য শক্তি'::text, 8::smallint, 'P2'::text),
    ('ict'::text, 'P1-computer-fundamentals-1'::text, 'sub-1'::text, 'Computer Hardware'::text, 1::smallint, 'P1'::text),
    ('ict'::text, 'P1-computer-fundamentals-1'::text, 'sub-2'::text, 'Computer Software'::text, 2::smallint, 'P1'::text),
    ('ict'::text, 'P1-computer-fundamentals-1'::text, 'sub-3'::text, 'Input and Output Devices'::text, 3::smallint, 'P1'::text),
    ('ict'::text, 'P1-computer-fundamentals-1'::text, 'sub-4'::text, 'CPU'::text, 4::smallint, 'P1'::text),
    ('ict'::text, 'P1-computer-fundamentals-1'::text, 'sub-5'::text, 'ALU'::text, 5::smallint, 'P1'::text),
    ('ict'::text, 'P1-computer-fundamentals-1'::text, 'sub-6'::text, 'Memory'::text, 6::smallint, 'P1'::text),
    ('ict'::text, 'P1-computer-fundamentals-1'::text, 'sub-7'::text, 'Storage Devices'::text, 7::smallint, 'P1'::text),
    ('ict'::text, 'P1-computer-fundamentals-1'::text, 'sub-8'::text, 'কম্পিউটারের ইতিহাস'::text, 8::smallint, 'P2'::text),
    ('ict'::text, 'P1-computer-fundamentals-1'::text, 'sub-9'::text, 'কম্পিউটারের প্রজন্ম'::text, 9::smallint, 'P2'::text),
    ('ict'::text, 'P1-computer-fundamentals-1'::text, 'sub-10'::text, 'কম্পিউটারের শ্রেণিবিভাগ'::text, 10::smallint, 'P2'::text),
    ('ict'::text, 'P1-number-system-and-digital-logic-2'::text, 'sub-1'::text, 'Decimal'::text, 1::smallint, 'P1'::text),
    ('ict'::text, 'P1-number-system-and-digital-logic-2'::text, 'sub-2'::text, 'Binary'::text, 2::smallint, 'P1'::text),
    ('ict'::text, 'P1-number-system-and-digital-logic-2'::text, 'sub-3'::text, 'Number Conversion'::text, 3::smallint, 'P1'::text),
    ('ict'::text, 'P1-number-system-and-digital-logic-2'::text, 'sub-4'::text, 'Binary Arithmetic'::text, 4::smallint, 'P1'::text),
    ('ict'::text, 'P1-number-system-and-digital-logic-2'::text, 'sub-5'::text, 'Logic Gates'::text, 5::smallint, 'P1'::text),
    ('ict'::text, 'P1-number-system-and-digital-logic-2'::text, 'sub-6'::text, 'Octal'::text, 6::smallint, 'P2'::text),
    ('ict'::text, 'P1-number-system-and-digital-logic-2'::text, 'sub-7'::text, 'Hexadecimal'::text, 7::smallint, 'P2'::text),
    ('ict'::text, 'P1-number-system-and-digital-logic-2'::text, 'sub-8'::text, 'Boolean Algebra'::text, 8::smallint, 'P2'::text),
    ('ict'::text, 'P1-operating-system-and-software-3'::text, 'sub-1'::text, 'Operating System'::text, 1::smallint, 'P1'::text),
    ('ict'::text, 'P1-operating-system-and-software-3'::text, 'sub-2'::text, 'Application Software'::text, 2::smallint, 'P1'::text),
    ('ict'::text, 'P1-operating-system-and-software-3'::text, 'sub-3'::text, 'Database Management System'::text, 3::smallint, 'P1'::text),
    ('ict'::text, 'P1-operating-system-and-software-3'::text, 'sub-4'::text, 'System Software'::text, 4::smallint, 'P2'::text),
    ('ict'::text, 'P1-operating-system-and-software-3'::text, 'sub-5'::text, 'Programming Language'::text, 5::smallint, 'P2'::text),
    ('ict'::text, 'P1-operating-system-and-software-3'::text, 'sub-6'::text, 'Compiler'::text, 6::smallint, 'P2'::text),
    ('ict'::text, 'P1-operating-system-and-software-3'::text, 'sub-7'::text, 'Interpreter'::text, 7::smallint, 'P2'::text),
    ('ict'::text, 'P1-internet-and-networking-4'::text, 'sub-1'::text, 'Internet'::text, 1::smallint, 'P1'::text),
    ('ict'::text, 'P1-internet-and-networking-4'::text, 'sub-2'::text, 'World Wide Web'::text, 2::smallint, 'P1'::text),
    ('ict'::text, 'P1-internet-and-networking-4'::text, 'sub-3'::text, 'Website and Browser'::text, 3::smallint, 'P1'::text),
    ('ict'::text, 'P1-internet-and-networking-4'::text, 'sub-4'::text, 'Email'::text, 4::smallint, 'P1'::text),
    ('ict'::text, 'P1-internet-and-networking-4'::text, 'sub-5'::text, 'LAN, MAN, WAN'::text, 5::smallint, 'P1'::text),
    ('ict'::text, 'P1-internet-and-networking-4'::text, 'sub-6'::text, 'Wi-Fi'::text, 6::smallint, 'P1'::text),
    ('ict'::text, 'P1-internet-and-networking-4'::text, 'sub-7'::text, 'Network Topology'::text, 7::smallint, 'P2'::text),
    ('ict'::text, 'P1-internet-and-networking-4'::text, 'sub-8'::text, 'IP Address'::text, 8::smallint, 'P2'::text),
    ('ict'::text, 'P1-internet-and-networking-4'::text, 'sub-9'::text, 'Protocol'::text, 9::smallint, 'P2'::text),
    ('ict'::text, 'P1-internet-and-networking-4'::text, 'sub-10'::text, 'Data Communication'::text, 10::smallint, 'P2'::text),
    ('ict'::text, 'cyber-security'::text, 'sub-1'::text, 'Computer Virus'::text, 1::smallint, 'P1'::text),
    ('ict'::text, 'cyber-security'::text, 'sub-2'::text, 'Malware'::text, 2::smallint, 'P1'::text),
    ('ict'::text, 'cyber-security'::text, 'sub-3'::text, 'Antivirus'::text, 3::smallint, 'P1'::text),
    ('ict'::text, 'cyber-security'::text, 'sub-4'::text, 'Firewall'::text, 4::smallint, 'P1'::text),
    ('ict'::text, 'cyber-security'::text, 'sub-5'::text, 'Cyber Crime'::text, 5::smallint, 'P1'::text),
    ('ict'::text, 'cyber-security'::text, 'sub-6'::text, 'Hacking'::text, 6::smallint, 'P2'::text),
    ('ict'::text, 'cyber-security'::text, 'sub-7'::text, 'Phishing'::text, 7::smallint, 'P2'::text),
    ('ict'::text, 'cyber-security'::text, 'sub-8'::text, 'Encryption'::text, 8::smallint, 'P2'::text),
    ('ict'::text, 'cyber-security'::text, 'sub-9'::text, 'Data Privacy'::text, 9::smallint, 'P2'::text),
    ('ict'::text, 'P1-modern-information-technology-6'::text, 'sub-1'::text, 'Artificial Intelligence'::text, 1::smallint, 'P1'::text),
    ('ict'::text, 'P1-modern-information-technology-6'::text, 'sub-2'::text, 'E-commerce'::text, 2::smallint, 'P1'::text),
    ('ict'::text, 'P1-modern-information-technology-6'::text, 'sub-3'::text, 'Mobile Technology'::text, 3::smallint, 'P1'::text),
    ('ict'::text, 'P1-modern-information-technology-6'::text, 'sub-4'::text, '2G, 3G, 4G, 5G'::text, 4::smallint, 'P1'::text),
    ('ict'::text, 'P1-modern-information-technology-6'::text, 'sub-5'::text, 'ICT in Bangladesh'::text, 5::smallint, 'P1'::text),
    ('ict'::text, 'P1-modern-information-technology-6'::text, 'sub-6'::text, 'Robotics'::text, 6::smallint, 'P2'::text),
    ('ict'::text, 'P1-modern-information-technology-6'::text, 'sub-7'::text, 'Cloud Computing'::text, 7::smallint, 'P2'::text),
    ('ict'::text, 'P1-modern-information-technology-6'::text, 'sub-8'::text, 'Social Networking'::text, 8::smallint, 'P2'::text),
    ('ict'::text, 'P1-modern-information-technology-6'::text, 'sub-9'::text, 'Emerging Technologies'::text, 9::smallint, 'P3'::text),
    ('math'::text, 'P1-arithmetic-1'::text, 'sub-1'::text, 'বাস্তব সংখ্যা'::text, 1::smallint, 'P1'::text),
    ('math'::text, 'P1-arithmetic-1'::text, 'sub-2'::text, 'ল.সা.গু ও গ.সা.গু'::text, 2::smallint, 'P1'::text),
    ('math'::text, 'P1-arithmetic-1'::text, 'sub-3'::text, 'শতকরা'::text, 3::smallint, 'P1'::text),
    ('math'::text, 'P1-arithmetic-1'::text, 'sub-4'::text, 'অনুপাত ও সমানুপাত'::text, 4::smallint, 'P1'::text),
    ('math'::text, 'P1-arithmetic-1'::text, 'sub-5'::text, 'লাভ ও ক্ষতি'::text, 5::smallint, 'P1'::text),
    ('math'::text, 'P1-arithmetic-1'::text, 'sub-6'::text, 'সরল মুনাফা'::text, 6::smallint, 'P1'::text),
    ('math'::text, 'P1-arithmetic-1'::text, 'sub-7'::text, 'যৌগিক মুনাফা'::text, 7::smallint, 'P1'::text),
    ('math'::text, 'P1-arithmetic-1'::text, 'sub-8'::text, 'গড়'::text, 8::smallint, 'P1'::text),
    ('math'::text, 'P1-arithmetic-1'::text, 'sub-9'::text, 'ঐকিক নিয়ম'::text, 9::smallint, 'P1'::text),
    ('math'::text, 'P1-arithmetic-1'::text, 'sub-10'::text, 'কাজ ও সময়'::text, 10::smallint, 'P1'::text),
    ('math'::text, 'P1-arithmetic-1'::text, 'sub-11'::text, 'দূরত্ব, সময় ও গতি'::text, 11::smallint, 'P1'::text),
    ('math'::text, 'P1-algebra-2'::text, 'sub-1'::text, 'বীজগাণিতিক সূত্র'::text, 1::smallint, 'P1'::text),
    ('math'::text, 'P1-algebra-2'::text, 'sub-2'::text, 'উৎপাদক বিশ্লেষণ'::text, 2::smallint, 'P1'::text),
    ('math'::text, 'P1-algebra-2'::text, 'sub-3'::text, 'সরল সমীকরণ'::text, 3::smallint, 'P1'::text),
    ('math'::text, 'P1-algebra-2'::text, 'sub-4'::text, 'দ্বিঘাত সমীকরণ'::text, 4::smallint, 'P1'::text),
    ('math'::text, 'P1-algebra-2'::text, 'sub-5'::text, 'সূচক'::text, 5::smallint, 'P1'::text),
    ('math'::text, 'P1-algebra-2'::text, 'sub-6'::text, 'বহুপদী'::text, 6::smallint, 'P2'::text),
    ('math'::text, 'P1-algebra-2'::text, 'sub-7'::text, 'সহসমীকরণ'::text, 7::smallint, 'P2'::text),
    ('math'::text, 'P1-algebra-2'::text, 'sub-8'::text, 'অসমতা'::text, 8::smallint, 'P2'::text),
    ('math'::text, 'P1-algebra-2'::text, 'sub-9'::text, 'লগারিদম'::text, 9::smallint, 'P2'::text),
    ('math'::text, 'P1-series-and-sets-3'::text, 'sub-1'::text, 'সমান্তর ধারা'::text, 1::smallint, 'P2'::text),
    ('math'::text, 'P1-series-and-sets-3'::text, 'sub-2'::text, 'গুণোত্তর ধারা'::text, 2::smallint, 'P2'::text),
    ('math'::text, 'P1-series-and-sets-3'::text, 'sub-3'::text, 'অনুক্রম'::text, 3::smallint, 'P2'::text),
    ('math'::text, 'P1-series-and-sets-3'::text, 'sub-4'::text, 'ধারার যোগফল'::text, 4::smallint, 'P2'::text),
    ('math'::text, 'P1-series-and-sets-3'::text, 'sub-5'::text, 'সেট'::text, 5::smallint, 'P2'::text),
    ('math'::text, 'P1-series-and-sets-3'::text, 'sub-6'::text, 'সেটের অপারেশন'::text, 6::smallint, 'P2'::text),
    ('math'::text, 'P1-geometry-4'::text, 'sub-1'::text, 'রেখা ও কোণ'::text, 1::smallint, 'P1'::text),
    ('math'::text, 'P1-geometry-4'::text, 'sub-2'::text, 'ত্রিভুজ'::text, 2::smallint, 'P1'::text),
    ('math'::text, 'P1-geometry-4'::text, 'sub-3'::text, 'চতুর্ভুজ'::text, 3::smallint, 'P1'::text),
    ('math'::text, 'P1-geometry-4'::text, 'sub-4'::text, 'বৃত্ত'::text, 4::smallint, 'P1'::text),
    ('math'::text, 'P1-geometry-4'::text, 'sub-5'::text, 'পিথাগোরাসের উপপাদ্য'::text, 5::smallint, 'P1'::text),
    ('math'::text, 'P1-geometry-4'::text, 'sub-6'::text, 'বহুভুজ'::text, 6::smallint, 'P2'::text),
    ('math'::text, 'P1-geometry-4'::text, 'sub-7'::text, 'জ্যামিতিক উপপাদ্য'::text, 7::smallint, 'P2'::text),
    ('math'::text, 'P1-mensuration-5'::text, 'sub-1'::text, 'ক্ষেত্রফল'::text, 1::smallint, 'P1'::text),
    ('math'::text, 'P1-mensuration-5'::text, 'sub-2'::text, 'পরিসীমা'::text, 2::smallint, 'P1'::text),
    ('math'::text, 'P1-mensuration-5'::text, 'sub-3'::text, 'আয়তন'::text, 3::smallint, 'P1'::text),
    ('math'::text, 'P1-mensuration-5'::text, 'sub-4'::text, 'ঘনবস্তু'::text, 4::smallint, 'P2'::text),
    ('math'::text, 'P1-mensuration-5'::text, 'sub-5'::text, 'ত্রিমাত্রিক পরিমাপ'::text, 5::smallint, 'P2'::text),
    ('math'::text, 'P1-statistics-and-probability-6'::text, 'sub-1'::text, 'গাণিতিক গড়'::text, 1::smallint, 'P1'::text),
    ('math'::text, 'P1-statistics-and-probability-6'::text, 'sub-2'::text, 'মধ্যক'::text, 2::smallint, 'P2'::text),
    ('math'::text, 'P1-statistics-and-probability-6'::text, 'sub-3'::text, 'প্রচুরক'::text, 3::smallint, 'P2'::text),
    ('math'::text, 'P1-statistics-and-probability-6'::text, 'sub-4'::text, 'বিন্যাস'::text, 4::smallint, 'P2'::text),
    ('math'::text, 'P1-statistics-and-probability-6'::text, 'sub-5'::text, 'সমাবেশ'::text, 5::smallint, 'P2'::text),
    ('math'::text, 'P1-statistics-and-probability-6'::text, 'sub-6'::text, 'সম্ভাব্যতা'::text, 6::smallint, 'P2'::text),
    ('mental'::text, 'verbal-reasoning'::text, 'sub-1'::text, 'Analogy'::text, 1::smallint, 'P1'::text),
    ('mental'::text, 'verbal-reasoning'::text, 'sub-2'::text, 'Classification'::text, 2::smallint, 'P1'::text),
    ('mental'::text, 'verbal-reasoning'::text, 'sub-3'::text, 'Verbal Series'::text, 3::smallint, 'P1'::text),
    ('mental'::text, 'verbal-reasoning'::text, 'sub-4'::text, 'Logical Relationship'::text, 4::smallint, 'P1'::text),
    ('mental'::text, 'verbal-reasoning'::text, 'sub-5'::text, 'Word Arrangement'::text, 5::smallint, 'P2'::text),
    ('mental'::text, 'verbal-reasoning'::text, 'sub-6'::text, 'Spelling'::text, 6::smallint, 'P2'::text),
    ('mental'::text, 'numerical-reasoning'::text, 'sub-1'::text, 'Number Series'::text, 1::smallint, 'P1'::text),
    ('mental'::text, 'numerical-reasoning'::text, 'sub-2'::text, 'Number Pattern'::text, 2::smallint, 'P1'::text),
    ('mental'::text, 'numerical-reasoning'::text, 'sub-3'::text, 'Mathematical Operations'::text, 3::smallint, 'P1'::text),
    ('mental'::text, 'numerical-reasoning'::text, 'sub-4'::text, 'Number Puzzle'::text, 4::smallint, 'P1'::text),
    ('mental'::text, 'numerical-reasoning'::text, 'sub-5'::text, 'Numerical Comparison'::text, 5::smallint, 'P2'::text),
    ('mental'::text, 'logical-reasoning'::text, 'sub-1'::text, 'Coding and Decoding'::text, 1::smallint, 'P1'::text),
    ('mental'::text, 'logical-reasoning'::text, 'sub-2'::text, 'Blood Relation'::text, 2::smallint, 'P1'::text),
    ('mental'::text, 'logical-reasoning'::text, 'sub-3'::text, 'Direction'::text, 3::smallint, 'P1'::text),
    ('mental'::text, 'logical-reasoning'::text, 'sub-4'::text, 'Ranking'::text, 4::smallint, 'P1'::text),
    ('mental'::text, 'logical-reasoning'::text, 'sub-5'::text, 'Statement and Conclusion'::text, 5::smallint, 'P1'::text),
    ('mental'::text, 'logical-reasoning'::text, 'sub-6'::text, 'Logical Puzzle'::text, 6::smallint, 'P1'::text),
    ('mental'::text, 'logical-reasoning'::text, 'sub-7'::text, 'Seating Arrangement'::text, 7::smallint, 'P2'::text),
    ('mental'::text, 'logical-reasoning'::text, 'sub-8'::text, 'Decision Making'::text, 8::smallint, 'P2'::text),
    ('mental'::text, 'spatial-reasoning'::text, 'sub-1'::text, 'Mirror Image'::text, 1::smallint, 'P1'::text),
    ('mental'::text, 'spatial-reasoning'::text, 'sub-2'::text, 'Water Image'::text, 2::smallint, 'P1'::text),
    ('mental'::text, 'spatial-reasoning'::text, 'sub-3'::text, 'Figure Rotation'::text, 3::smallint, 'P1'::text),
    ('mental'::text, 'spatial-reasoning'::text, 'sub-4'::text, 'Pattern Recognition'::text, 4::smallint, 'P1'::text),
    ('mental'::text, 'spatial-reasoning'::text, 'sub-5'::text, 'Figure Completion'::text, 5::smallint, 'P2'::text),
    ('mental'::text, 'spatial-reasoning'::text, 'sub-6'::text, 'Spatial Visualization'::text, 6::smallint, 'P2'::text),
    ('mental'::text, 'mechanical-reasoning'::text, 'sub-1'::text, 'Force and Motion'::text, 1::smallint, 'P2'::text),
    ('mental'::text, 'mechanical-reasoning'::text, 'sub-2'::text, 'Simple Machines'::text, 2::smallint, 'P2'::text),
    ('mental'::text, 'mechanical-reasoning'::text, 'sub-3'::text, 'Mechanical Concepts'::text, 3::smallint, 'P2'::text),
    ('mental'::text, 'mechanical-reasoning'::text, 'sub-4'::text, 'Tools and Equipment'::text, 4::smallint, 'P3'::text),
    ('ethics'::text, 'P1-ethics-1'::text, 'sub-1'::text, 'নৈতিকতার সংজ্ঞা'::text, 1::smallint, 'P1'::text),
    ('ethics'::text, 'P1-ethics-1'::text, 'sub-2'::text, 'নৈতিক আচরণ'::text, 2::smallint, 'P1'::text),
    ('ethics'::text, 'P1-ethics-1'::text, 'sub-3'::text, 'সামাজিক নৈতিকতা'::text, 3::smallint, 'P1'::text),
    ('ethics'::text, 'P1-ethics-1'::text, 'sub-4'::text, 'নৈতিকতার উৎস'::text, 4::smallint, 'P2'::text),
    ('ethics'::text, 'P1-ethics-1'::text, 'sub-5'::text, 'ব্যক্তিগত নৈতিকতা'::text, 5::smallint, 'P2'::text),
    ('ethics'::text, 'P1-ethics-1'::text, 'sub-6'::text, 'নৈতিক দর্শন'::text, 6::smallint, 'P2'::text),
    ('ethics'::text, 'P1-ethics-1'::text, 'sub-7'::text, 'নৈতিক দার্শনিক'::text, 7::smallint, 'P2'::text),
    ('ethics'::text, 'P1-values-2'::text, 'sub-1'::text, 'মূল্যবোধের সংজ্ঞা'::text, 1::smallint, 'P1'::text),
    ('ethics'::text, 'P1-values-2'::text, 'sub-2'::text, 'সামাজিক মূল্যবোধ'::text, 2::smallint, 'P1'::text),
    ('ethics'::text, 'P1-values-2'::text, 'sub-3'::text, 'জাতীয় মূল্যবোধ'::text, 3::smallint, 'P1'::text),
    ('ethics'::text, 'P1-values-2'::text, 'sub-4'::text, 'মানবিক মূল্যবোধ'::text, 4::smallint, 'P1'::text),
    ('ethics'::text, 'P1-values-2'::text, 'sub-5'::text, 'মূল্যবোধের উৎস'::text, 5::smallint, 'P2'::text),
    ('ethics'::text, 'P1-values-2'::text, 'sub-6'::text, 'ব্যক্তিগত মূল্যবোধ'::text, 6::smallint, 'P2'::text),
    ('ethics'::text, 'P1-values-2'::text, 'sub-7'::text, 'মূল্যবোধের অবক্ষয়'::text, 7::smallint, 'P2'::text),
    ('ethics'::text, 'P1-good-governance-3'::text, 'sub-1'::text, 'সুশাসনের সংজ্ঞা'::text, 1::smallint, 'P1'::text),
    ('ethics'::text, 'P1-good-governance-3'::text, 'sub-2'::text, 'সুশাসনের বৈশিষ্ট্য'::text, 2::smallint, 'P1'::text),
    ('ethics'::text, 'P1-good-governance-3'::text, 'sub-3'::text, 'স্বচ্ছতা'::text, 3::smallint, 'P1'::text),
    ('ethics'::text, 'P1-good-governance-3'::text, 'sub-4'::text, 'জবাবদিহিতা'::text, 4::smallint, 'P1'::text),
    ('ethics'::text, 'P1-good-governance-3'::text, 'sub-5'::text, 'আইনের শাসন'::text, 5::smallint, 'P1'::text),
    ('ethics'::text, 'P1-good-governance-3'::text, 'sub-6'::text, 'অংশগ্রহণ'::text, 6::smallint, 'P1'::text),
    ('ethics'::text, 'P1-good-governance-3'::text, 'sub-7'::text, 'ন্যায়বিচার'::text, 7::smallint, 'P1'::text),
    ('ethics'::text, 'P1-good-governance-3'::text, 'sub-8'::text, 'কার্যকারিতা'::text, 8::smallint, 'P2'::text),
    ('ethics'::text, 'P1-good-governance-3'::text, 'sub-9'::text, 'দক্ষতা'::text, 9::smallint, 'P2'::text),
    ('ethics'::text, 'P1-democracy-and-human-rights-4'::text, 'sub-1'::text, 'গণতন্ত্রের ধারণা'::text, 1::smallint, 'P1'::text),
    ('ethics'::text, 'P1-democracy-and-human-rights-4'::text, 'sub-2'::text, 'নাগরিক অধিকার'::text, 2::smallint, 'P1'::text),
    ('ethics'::text, 'P1-democracy-and-human-rights-4'::text, 'sub-3'::text, 'মানবাধিকার'::text, 3::smallint, 'P1'::text),
    ('ethics'::text, 'P1-democracy-and-human-rights-4'::text, 'sub-4'::text, 'নাগরিক দায়িত্ব'::text, 4::smallint, 'P1'::text),
    ('ethics'::text, 'P1-democracy-and-human-rights-4'::text, 'sub-5'::text, 'আইনের সমতা'::text, 5::smallint, 'P2'::text),
    ('ethics'::text, 'P1-democracy-and-human-rights-4'::text, 'sub-6'::text, 'মতপ্রকাশের স্বাধীনতা'::text, 6::smallint, 'P2'::text),
    ('ethics'::text, 'P1-corruption-and-administrative-ethics-5'::text, 'sub-1'::text, 'দুর্নীতির কারণ'::text, 1::smallint, 'P1'::text),
    ('ethics'::text, 'P1-corruption-and-administrative-ethics-5'::text, 'sub-2'::text, 'দুর্নীতি প্রতিরোধ'::text, 2::smallint, 'P1'::text),
    ('ethics'::text, 'P1-corruption-and-administrative-ethics-5'::text, 'sub-3'::text, 'প্রশাসনিক নৈতিকতা'::text, 3::smallint, 'P1'::text),
    ('ethics'::text, 'P1-corruption-and-administrative-ethics-5'::text, 'sub-4'::text, 'জবাবদিহিমূলক প্রশাসন'::text, 4::smallint, 'P1'::text),
    ('ethics'::text, 'P1-corruption-and-administrative-ethics-5'::text, 'sub-5'::text, 'সুশাসন প্রতিষ্ঠার উপায়'::text, 5::smallint, 'P1'::text),
    ('ethics'::text, 'P1-corruption-and-administrative-ethics-5'::text, 'sub-6'::text, 'জনসেবা'::text, 6::smallint, 'P2'::text)

) as v(subject_slug, topic_slug, slug, title_en, sort_order, priority);

-- ── ৪ · দাবিদার (claim): প্রতিটি সিলেবাস টপিকের জন্য একটি পুরোনো সারি ─────
--  পুরোনো গাছের যে সারিতে ইতিমধ্যেই সিলেবাসের নামে সাব-টপিক আছে সেটিই দাবি
--  করে (তাতে সাব-টপিকগুলো সঠিক টপিকের ভেতরে থাকে); না থাকলে ম্যাপের প্রথম
--  সারি। বাকি সব সারি অবসরে যাবে।
create temp table jh_claim on commit drop as
select v.subject_slug, v.old_slug, v.new_topic_slug
from (values

    ('bangla'::text, 'topic-1'::text, 'P1-bangla-language-and-grammar-1'::text),
    ('bangla'::text, 'topic-12'::text, 'P1-old-and-medieval-bangla-literature-2'::text),
    ('bangla'::text, 'topic-14'::text, 'P1-modern-bangla-literature-3'::text),
    ('bangla'::text, 'topic-16'::text, 'P1-literary-works-and-facts-4'::text),
    ('english'::text, 'parts-of-speech-1'::text, 'grammar'::text),
    ('english'::text, 'vocabulary-idioms-and-spelling-10'::text, 'vocabulary'::text),
    ('english'::text, 'literary-periods-11'::text, 'english-literature'::text),
    ('bd'::text, 'topic-1'::text, 'P1-history-of-bangladesh-1'::text),
    ('bd'::text, 'topic-3'::text, 'P1-independence-and-the-liberation-war-2'::text),
    ('bd'::text, 'topic-4'::text, 'P1-constitution-of-bangladesh-3'::text),
    ('bd'::text, 'topic-5'::text, 'P1-political-system-and-government-4'::text),
    ('bd'::text, 'topic-10'::text, 'P1-economy-of-bangladesh-5'::text),
    ('bd'::text, 'topic-6'::text, 'P1-agriculture-industry-and-trade-6'::text),
    ('bd'::text, 'topic-7'::text, 'P1-population-and-ethnic-groups-7'::text),
    ('bd'::text, 'topic-11'::text, 'P1-national-achievements-and-culture-8'::text),
    ('international'::text, 'topic-1'::text, 'P1-world-history-1'::text),
    ('international'::text, 'topic-2'::text, 'P1-international-politics-and-relations-2'::text),
    ('international'::text, 'topic-4'::text, 'P1-international-organisations-3'::text),
    ('international'::text, 'topic-5'::text, 'P1-regional-organisations-and-alliances-4'::text),
    ('international'::text, 'topic-6'::text, 'P1-international-treaties-and-conferences-5'::text),
    ('international'::text, 'topic-7'::text, 'P1-contemporary-international-affairs-7'::text),
    ('geography'::text, 'topic-1'::text, 'P1-geography-of-bangladesh-1'::text),
    ('geography'::text, 'topic-3'::text, 'P1-natural-environment-of-bangladesh-2'::text),
    ('geography'::text, 'topic-2'::text, 'P1-world-geography-3'::text),
    ('geography'::text, 'topic-5'::text, 'P1-environment-and-climate-4'::text),
    ('geography'::text, 'topic-8'::text, 'P1-disaster-management-5'::text),
    ('science'::text, 'topic-4'::text, 'P1-physics-1'::text),
    ('science'::text, 'topic-1'::text, 'P1-chemistry-2'::text),
    ('science'::text, 'topic-8'::text, 'P1-biology-3'::text),
    ('science'::text, 'topic-12'::text, 'P1-human-body-and-health-4'::text),
    ('science'::text, 'topic-11'::text, 'P1-modern-and-applied-science-5'::text),
    ('ict'::text, 'topic-1'::text, 'P1-computer-fundamentals-1'::text),
    ('ict'::text, 'topic-4'::text, 'P1-number-system-and-digital-logic-2'::text),
    ('ict'::text, 'topic-5'::text, 'P1-operating-system-and-software-3'::text),
    ('ict'::text, 'topic-7'::text, 'P1-internet-and-networking-4'::text),
    ('ict'::text, 'topic-9'::text, 'cyber-security'::text),
    ('ict'::text, 'topic-10'::text, 'P1-modern-information-technology-6'::text),
    ('math'::text, 'topic-1'::text, 'P1-arithmetic-1'::text),
    ('math'::text, 'topic-7'::text, 'P1-algebra-2'::text),
    ('math'::text, 'topic-10'::text, 'P1-series-and-sets-3'::text),
    ('math'::text, 'topic-12'::text, 'P1-geometry-4'::text),
    ('math'::text, 'topic-15'::text, 'P1-mensuration-5'::text),
    ('math'::text, 'topic-11'::text, 'P1-statistics-and-probability-6'::text),
    ('mental'::text, 'topic-1'::text, 'verbal-reasoning'::text),
    ('mental'::text, 'topic-2'::text, 'numerical-reasoning'::text),
    ('mental'::text, 'topic-4'::text, 'logical-reasoning'::text),
    ('mental'::text, 'topic-6'::text, 'spatial-reasoning'::text),
    ('mental'::text, 'gears-levers-balance'::text, 'mechanical-reasoning'::text),
    ('ethics'::text, 'topic-1'::text, 'P1-ethics-1'::text),
    ('ethics'::text, 'topic-2'::text, 'P1-values-2'::text),
    ('ethics'::text, 'topic-3'::text, 'P1-good-governance-3'::text),
    ('ethics'::text, 'topic-6'::text, 'P1-corruption-and-administrative-ethics-5'::text)

) as v(subject_slug, old_slug, new_topic_slug);

--  পুরোনো সাব-টপিক → সিলেবাসের নাম (একই বিষয়ে, একই নাম = একই সারি)।
create temp table jh_sub_claim on commit drop as
select c.subject_slug, c.old_slug as old_topic_slug, c.new_topic_slug,
       ns.slug as new_sub_slug, ns.title_en as new_sub_title,
       os.slug as old_sub_slug
from jh_claim c
join jh_tx x on true
join public.subjects su on su.course_id = x.course_id and su.slug = c.subject_slug
join public.topics ot on ot.subject_id = su.id and ot.slug = c.old_slug
join lateral (
  select st.* from public.subtopics st
  where st.topic_id = ot.id
    and exists (select 1 from jh_sub_seed s
                join public.topics nt2 on nt2.slug = s.topic_slug and nt2.subject_id = su.id
                where s.subject_slug = c.subject_slug and s.topic_slug = c.new_topic_slug
                  and public.jh_title_norm(s.title_en) = public.jh_title_norm(st.title_en))
  limit 1
) os on true
join lateral (
  select s.slug, s.title_en from jh_sub_seed s
  where s.subject_slug = c.subject_slug and s.topic_slug = c.new_topic_slug
    and public.jh_title_norm(s.title_en) = public.jh_title_norm(os.title_en)
  limit 1
) ns on true;

-- ── ৫ · সাব-টপিক ও টপিক নতুন নামে (uuid অপরিবর্তিত) ───────────────────────
update public.subtopics st
   set slug = sc.new_sub_slug,
       title_en = sc.new_sub_title,
       title_bn = sc.new_sub_title,
       is_active = true,
       approval_status = 'approved',
       metadata = coalesce(st.metadata, '{}'::jsonb)
                  || jsonb_build_object('priority',
                       (select s.priority from jh_sub_seed s
                         where s.subject_slug = sc.subject_slug
                           and s.topic_slug = sc.new_topic_slug
                           and s.slug = sc.new_sub_slug)),
       updated_at = now()
  from jh_sub_claim sc
  join jh_tx x on true
  join public.subjects su on su.course_id = x.course_id and su.slug = sc.subject_slug
  join public.topics ot on ot.subject_id = su.id and ot.slug = sc.old_topic_slug
 where st.topic_id = ot.id and st.slug = sc.old_sub_slug;

update public.topics t
   set slug = c.new_topic_slug,
       title_en = s.title_en,
       title_bn = s.title_bn,
       sort_order = s.sort_order,
       is_active = true,
       approval_status = 'approved',
       metadata = t.metadata || s.metadata,
       updated_at = now()
  from jh_claim c
  join jh_tx x on true
  join public.subjects su on su.course_id = x.course_id and su.slug = c.subject_slug
  join public.topics ot on ot.subject_id = su.id and ot.slug = c.old_slug
  join jh_topic_seed s on s.subject_slug = c.subject_slug and s.slug = c.new_topic_slug
 where t.id = ot.id
   -- পুনরায় চালালে সিলেবাসের slug আগেই আছে (আগের রানে দাবি করা সারিতে) → ছাড়
   and not exists (select 1 from public.topics t3
                    where t3.subject_id = su.id and t3.slug = c.new_topic_slug);

-- ── ৬ · নতুন গাছে যা এখনো নেই, যোগ করা ─────────────────────────────────────
insert into public.topics (subject_id, slug, title_en, title_bn, sort_order, is_active, approval_status, metadata)
select su.id, s.slug, s.title_en, s.title_bn, s.sort_order, true, 'approved', s.metadata
from jh_topic_seed s
join jh_tx x on true
join public.subjects su on su.course_id = x.course_id and su.slug = s.subject_slug
where not exists (select 1 from public.topics t where t.subject_id = su.id and t.slug = s.slug);

insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order, is_active, approval_status, metadata)
select t.id, s.slug, s.title_en, s.title_en, s.sort_order, true, 'approved',
       jsonb_build_object('priority', s.priority)
from jh_sub_seed s
join jh_tx x on true
join public.subjects su on su.course_id = x.course_id and su.slug = s.subject_slug
join public.topics t on t.subject_id = su.id and t.slug = s.topic_slug
where not exists (select 1 from public.subtopics st where st.topic_id = t.id and st.slug = s.slug);

--  নতুন যোগ হওয়া সারির sort_order/priority এক জায়গায় ঠিক করা
update public.subtopics st
   set sort_order = s.sort_order,
       title_bn = s.title_en,
       metadata = coalesce(st.metadata, '{}'::jsonb) || jsonb_build_object('priority', s.priority),
       updated_at = now()
  from jh_sub_seed s
  join jh_tx x on true
  join public.subjects su on su.course_id = x.course_id and su.slug = s.subject_slug
  join public.topics t on t.subject_id = su.id and t.slug = s.topic_slug
 where st.topic_id = t.id and st.slug = s.slug;

-- ── ৭ · পুরোনো গাছ অবসর (মোছা হয় না) ──────────────────────────────────────
create temp table jh_retired_topic on commit drop as
select t.id
from public.topics t
join public.subjects su on su.id = t.subject_id
join jh_tx x on x.course_id = su.course_id
where not exists (
  select 1 from jh_topic_seed s where s.subject_slug = su.slug and s.slug = t.slug
);

--  সক্রিয় টপিকের ভেতরে থাকা অচেনা সাব-টপিকও অবসরে যায় (নাম মিললেই সেটি
--  ইতিমধ্যে সিলেবাসের নামে বদলে গেছে, তাই আর অবসরে পড়বে না)।
create temp table jh_retired_sub on commit drop as
select st.id, st.topic_id
from public.subtopics st
join public.topics t on t.id = st.topic_id
join public.subjects su on su.id = t.subject_id
join jh_tx x on x.course_id = su.course_id
where not exists (
  select 1 from jh_sub_seed s
  where s.subject_slug = su.slug and s.topic_slug = t.slug and s.slug = st.slug
);

update public.topics t
   set is_active = false,
       metadata = t.metadata || jsonb_build_object('retired_by', 'bcs-syllabus-v2'),
       updated_at = now()
  from jh_retired_topic r
 where t.id = r.id and t.is_active;

update public.subtopics st
   set is_active = false,
       metadata = coalesce(st.metadata, '{}'::jsonb) || jsonb_build_object('retired_by', 'bcs-syllabus-v2'),
       updated_at = now()
  from jh_retired_sub r
 where st.id = r.id and st.is_active;

-- ── ৮ · পুরোনো লিংক নতুন গাছে আনা ─────────────────────────────────────────
--  হাতে যাচাই করা ম্যাপ: (subject, পুরোনো placeholder slug) → সিলেবাস টপিক।
--  পুরোনো নামগুলো এতটাই মোটা ("আধুনিক যুগ", "অপারেটিং সিস্টেম ও অ্যামবেডেড
--  কম্পিউটার") যে similarity দিয়ে অনুমান করা যায় না - তাই স্পষ্ট ম্যাপ।
create temp table jh_link_map on commit drop as
select v.subject_slug, v.old_slug, v.new_topic_slug
from (values

    ('bangla'::text, 'topic-1'::text, 'P1-bangla-language-and-grammar-1'::text),
    ('bangla'::text, 'topic-2'::text, 'P1-bangla-language-and-grammar-1'::text),
    ('bangla'::text, 'topic-3'::text, 'P1-bangla-language-and-grammar-1'::text),
    ('bangla'::text, 'topic-4'::text, 'P1-bangla-language-and-grammar-1'::text),
    ('bangla'::text, 'topic-5'::text, 'P1-bangla-language-and-grammar-1'::text),
    ('bangla'::text, 'topic-6'::text, 'P1-bangla-language-and-grammar-1'::text),
    ('bangla'::text, 'topic-7'::text, 'P1-bangla-language-and-grammar-1'::text),
    ('bangla'::text, 'topic-8'::text, 'P1-bangla-language-and-grammar-1'::text),
    ('bangla'::text, 'topic-9'::text, 'P1-bangla-language-and-grammar-1'::text),
    ('bangla'::text, 'topic-10'::text, 'P1-bangla-language-and-grammar-1'::text),
    ('bangla'::text, 'topic-11'::text, 'P1-bangla-language-and-grammar-1'::text),
    ('bangla'::text, 'topic-12'::text, 'P1-old-and-medieval-bangla-literature-2'::text),
    ('bangla'::text, 'topic-13'::text, 'P1-old-and-medieval-bangla-literature-2'::text),
    ('bangla'::text, 'topic-14'::text, 'P1-modern-bangla-literature-3'::text),
    ('bangla'::text, 'topic-15'::text, 'P1-modern-bangla-literature-3'::text),
    ('bangla'::text, 'topic-16'::text, 'P1-literary-works-and-facts-4'::text),
    ('english'::text, 'parts-of-speech-1'::text, 'grammar'::text),
    ('english'::text, 'tense-and-aspect-2'::text, 'grammar'::text),
    ('english'::text, 'subject-verb-agreement-3'::text, 'grammar'::text),
    ('english'::text, 'articles-and-determiners-4'::text, 'grammar'::text),
    ('english'::text, 'prepositions-5'::text, 'grammar'::text),
    ('english'::text, 'voice-6'::text, 'grammar'::text),
    ('english'::text, 'narration-7'::text, 'grammar'::text),
    ('english'::text, 'clauses-and-phrases-8'::text, 'grammar'::text),
    ('english'::text, 'sentence-correction-9'::text, 'grammar'::text),
    ('english'::text, 'vocabulary-idioms-and-spelling-10'::text, 'vocabulary'::text),
    ('english'::text, 'literary-periods-11'::text, 'english-literature'::text),
    ('english'::text, 'major-authors-and-works-12'::text, 'english-literature'::text),
    ('english'::text, 'literary-terms-13'::text, 'english-literature'::text),
    ('english'::text, 'poetry-drama-and-fiction-14'::text, 'english-literature'::text),
    ('bd'::text, 'topic-1'::text, 'P1-history-of-bangladesh-1'::text),
    ('bd'::text, 'topic-2'::text, 'P1-history-of-bangladesh-1'::text),
    ('bd'::text, 'topic-3'::text, 'P1-independence-and-the-liberation-war-2'::text),
    ('bd'::text, 'topic-4'::text, 'P1-constitution-of-bangladesh-3'::text),
    ('bd'::text, 'topic-5'::text, 'P1-political-system-and-government-4'::text),
    ('bd'::text, 'topic-10'::text, 'P1-economy-of-bangladesh-5'::text),
    ('bd'::text, 'topic-6'::text, 'P1-agriculture-industry-and-trade-6'::text),
    ('bd'::text, 'topic-8'::text, 'P1-agriculture-industry-and-trade-6'::text),
    ('bd'::text, 'topic-9'::text, 'P1-agriculture-industry-and-trade-6'::text),
    ('bd'::text, 'topic-7'::text, 'P1-population-and-ethnic-groups-7'::text),
    ('bd'::text, 'topic-11'::text, 'P1-national-achievements-and-culture-8'::text),
    ('international'::text, 'topic-1'::text, 'P1-world-history-1'::text),
    ('international'::text, 'topic-2'::text, 'P1-international-politics-and-relations-2'::text),
    ('international'::text, 'topic-3'::text, 'P1-international-politics-and-relations-2'::text),
    ('international'::text, 'topic-4'::text, 'P1-international-organisations-3'::text),
    ('international'::text, 'topic-5'::text, 'P1-regional-organisations-and-alliances-4'::text),
    ('international'::text, 'topic-6'::text, 'P1-international-treaties-and-conferences-5'::text),
    ('international'::text, 'topic-7'::text, 'P1-contemporary-international-affairs-7'::text),
    ('geography'::text, 'topic-1'::text, 'P1-geography-of-bangladesh-1'::text),
    ('geography'::text, 'topic-3'::text, 'P1-natural-environment-of-bangladesh-2'::text),
    ('geography'::text, 'topic-4'::text, 'P1-natural-environment-of-bangladesh-2'::text),
    ('geography'::text, 'topic-2'::text, 'P1-world-geography-3'::text),
    ('geography'::text, 'topic-5'::text, 'P1-environment-and-climate-4'::text),
    ('geography'::text, 'topic-6'::text, 'P1-environment-and-climate-4'::text),
    ('geography'::text, 'topic-7'::text, 'P1-environment-and-climate-4'::text),
    ('geography'::text, 'topic-8'::text, 'P1-disaster-management-5'::text),
    ('geography'::text, 'topic-9'::text, 'P1-disaster-management-5'::text),
    ('science'::text, 'topic-4'::text, 'P1-physics-1'::text),
    ('science'::text, 'topic-5'::text, 'P1-physics-1'::text),
    ('science'::text, 'topic-6'::text, 'P1-physics-1'::text),
    ('science'::text, 'topic-7'::text, 'P1-physics-1'::text),
    ('science'::text, 'topic-1'::text, 'P1-chemistry-2'::text),
    ('science'::text, 'topic-2'::text, 'P1-chemistry-2'::text),
    ('science'::text, 'topic-3'::text, 'P1-chemistry-2'::text),
    ('science'::text, 'topic-8'::text, 'P1-biology-3'::text),
    ('science'::text, 'topic-9'::text, 'P1-biology-3'::text),
    ('science'::text, 'topic-10'::text, 'P1-biology-3'::text),
    ('science'::text, 'evolution-biotech'::text, 'P1-biology-3'::text),
    ('science'::text, 'topic-12'::text, 'P1-human-body-and-health-4'::text),
    ('science'::text, 'diseases-vaccines'::text, 'P1-human-body-and-health-4'::text),
    ('science'::text, 'topic-11'::text, 'P1-modern-and-applied-science-5'::text),
    ('science'::text, 'topic-13'::text, 'P1-modern-and-applied-science-5'::text),
    ('science'::text, 'hydrosphere-atmosphere'::text, 'P1-modern-and-applied-science-5'::text),
    ('ict'::text, 'topic-1'::text, 'P1-computer-fundamentals-1'::text),
    ('ict'::text, 'topic-2'::text, 'P1-computer-fundamentals-1'::text),
    ('ict'::text, 'topic-3'::text, 'P1-computer-fundamentals-1'::text),
    ('ict'::text, 'topic-4'::text, 'P1-number-system-and-digital-logic-2'::text),
    ('ict'::text, 'topic-5'::text, 'P1-operating-system-and-software-3'::text),
    ('ict'::text, 'topic-6'::text, 'P1-operating-system-and-software-3'::text),
    ('ict'::text, 'topic-7'::text, 'P1-internet-and-networking-4'::text),
    ('ict'::text, 'topic-8'::text, 'P1-internet-and-networking-4'::text),
    ('ict'::text, 'topic-9'::text, 'cyber-security'::text),
    ('ict'::text, 'topic-10'::text, 'P1-modern-information-technology-6'::text),
    ('ict'::text, 'topic-11'::text, 'P1-modern-information-technology-6'::text),
    ('ict'::text, 'cellular-smartphones'::text, 'P1-modern-information-technology-6'::text),
    ('ict'::text, 'tech-giants-social'::text, 'P1-modern-information-technology-6'::text),
    ('math'::text, 'topic-1'::text, 'P1-arithmetic-1'::text),
    ('math'::text, 'unitary-method'::text, 'P1-arithmetic-1'::text),
    ('math'::text, 'topic-2'::text, 'P1-arithmetic-1'::text),
    ('math'::text, 'fractions'::text, 'P1-arithmetic-1'::text),
    ('math'::text, 'simplification'::text, 'P1-arithmetic-1'::text),
    ('math'::text, 'decimal-fractions'::text, 'P1-arithmetic-1'::text),
    ('math'::text, 'square-square-root'::text, 'P1-arithmetic-1'::text),
    ('math'::text, 'train-speed'::text, 'P1-arithmetic-1'::text),
    ('math'::text, 'time-distance-speed'::text, 'P1-arithmetic-1'::text),
    ('math'::text, 'boat-stream'::text, 'P1-arithmetic-1'::text),
    ('math'::text, 'time-work-pipes'::text, 'P1-arithmetic-1'::text),
    ('math'::text, 'topic-3'::text, 'P1-arithmetic-1'::text),
    ('math'::text, 'topic-4'::text, 'P1-arithmetic-1'::text),
    ('math'::text, 'topic-5'::text, 'P1-arithmetic-1'::text),
    ('math'::text, 'topic-6'::text, 'P1-arithmetic-1'::text),
    ('math'::text, 'average'::text, 'P1-arithmetic-1'::text),
    ('math'::text, 'alligation'::text, 'P1-arithmetic-1'::text),
    ('math'::text, 'mixture'::text, 'P1-arithmetic-1'::text),
    ('math'::text, 'partnership'::text, 'P1-arithmetic-1'::text),
    ('math'::text, 'problem-on-ages'::text, 'P1-arithmetic-1'::text),
    ('math'::text, 'math-problem-solving'::text, 'P1-arithmetic-1'::text),
    ('math'::text, 'topic-7'::text, 'P1-algebra-2'::text),
    ('math'::text, 'topic-8'::text, 'P1-algebra-2'::text),
    ('math'::text, 'topic-9'::text, 'P1-algebra-2'::text),
    ('math'::text, 'topic-10'::text, 'P1-series-and-sets-3'::text),
    ('math'::text, 'topic-16'::text, 'P1-series-and-sets-3'::text),
    ('math'::text, 'topic-12'::text, 'P1-geometry-4'::text),
    ('math'::text, 'topic-13'::text, 'P1-geometry-4'::text),
    ('math'::text, 'topic-14'::text, 'P1-geometry-4'::text),
    ('math'::text, 'topic-15'::text, 'P1-mensuration-5'::text),
    ('math'::text, 'topic-11'::text, 'P1-statistics-and-probability-6'::text),
    ('math'::text, 'topic-17'::text, 'P1-statistics-and-probability-6'::text),
    ('math'::text, 'topic-18'::text, 'P1-statistics-and-probability-6'::text),
    ('mental'::text, 'topic-1'::text, 'verbal-reasoning'::text),
    ('mental'::text, 'topic-3'::text, 'verbal-reasoning'::text),
    ('mental'::text, 'spelling-language'::text, 'verbal-reasoning'::text),
    ('mental'::text, 'topic-2'::text, 'numerical-reasoning'::text),
    ('mental'::text, 'math-problem-solving'::text, 'numerical-reasoning'::text),
    ('mental'::text, 'quick-calculation'::text, 'numerical-reasoning'::text),
    ('mental'::text, 'topic-4'::text, 'logical-reasoning'::text),
    ('mental'::text, 'topic-5'::text, 'logical-reasoning'::text),
    ('mental'::text, 'topic-7'::text, 'logical-reasoning'::text),
    ('mental'::text, 'topic-6'::text, 'spatial-reasoning'::text),
    ('mental'::text, 'figure-counting-dice'::text, 'spatial-reasoning'::text),
    ('mental'::text, 'gears-levers-balance'::text, 'mechanical-reasoning'::text),
    ('ethics'::text, 'topic-1'::text, 'P1-ethics-1'::text),
    ('ethics'::text, 'topic-2'::text, 'P1-values-2'::text),
    ('ethics'::text, 'topic-3'::text, 'P1-good-governance-3'::text),
    ('ethics'::text, 'topic-4'::text, 'P1-good-governance-3'::text),
    ('ethics'::text, 'topic-5'::text, 'P1-good-governance-3'::text),
    ('ethics'::text, 'topic-7'::text, 'P1-good-governance-3'::text),
    ('ethics'::text, 'topic-6'::text, 'P1-corruption-and-administrative-ethics-5'::text)

) as v(subject_slug, old_slug, new_topic_slug);

create temp table jh_link_target on commit drop as
select ot.id as old_topic_id,
       nt.id as new_topic_id,
       (select nst.id from public.subtopics nst
         where nst.topic_id = nt.id and nst.is_active
           and public.jh_title_norm(nst.title_en) = public.jh_title_norm(os.title_en)
         limit 1) as new_subtopic_id
from public.topics ot
join public.subjects su on su.id = ot.subject_id
join jh_tx x on x.course_id = su.course_id
join jh_retired_topic rt on rt.id = ot.id
join jh_link_map m on m.subject_slug = su.slug and m.old_slug = ot.slug
join public.topics nt on nt.subject_id = su.id and nt.slug = m.new_topic_slug and nt.is_active
left join lateral (
  select st.title_en from public.subtopics st where st.topic_id = ot.id order by st.sort_order limit 1
) os on true;

update public.questions q
   set topic_id = t.new_topic_id,
       subtopic_id = null,
       updated_at = now()
  from jh_link_target t
 where q.topic_id = t.old_topic_id;

--  রুটিন: routines_unique_slot_idx = (course, kind, date, subject, topic) — তাই
--  প্রতিটি সারি আলাদাভাবে সরানো হয়, আর সংঘর্ষ হলে (যেমন একই দিনে একই বিষয়ে
--  পুরোনো আর্কাইভ সারি) সেই সারি আগের জায়গাতেই থাকে। শুধু প্রকাশিত রুটিন
--  সরানো হয়; আর্কাইভ করা ইতিহাস অপরিবর্তিত।
do $$
declare
  rec record;
  moved int := 0;
begin
  for rec in
    select r.id, t.new_topic_id, t.new_subtopic_id
    from public.routines r
    join jh_link_target t on t.old_topic_id = r.topic_id
    where r.status = 'published'
  loop
    begin
      update public.routines
         set topic_id = rec.new_topic_id,
             subtopic_id = rec.new_subtopic_id,
             updated_at = now()
       where id = rec.id;
      moved := moved + 1;
    exception when unique_violation then
      raise notice 'রুটিন % সরানো যায়নি (একই দিন/বিষয়ে অন্য সারি), আগের টপিকেই রাখা হলো', rec.id;
    end;
  end loop;
  raise notice 'রুটিন সারি সরানো হয়েছে: %', moved;
end $$;

update public.routine_progress p
   set topic_id = t.new_topic_id,
       subtopic_id = null
  from jh_link_target t
 where p.topic_id = t.old_topic_id;

--  সাব-টপিক: নতুন টপিকের ভেতরে হুবহু/অন্তর্ভুক্ত নামের সিলেবাস সাব-টপিক
--  খুঁজে বসানো হয় (similarity অনুমান নয়); না মিললে null — প্রশ্নটি
--  টপিক-লেভেলে থাকে, হারায় না।
create temp table jh_sub_remap on commit drop as
select os.id as old_sub_id, best.new_sub_id
from jh_retired_sub os
join public.subtopics ost on ost.id = os.id
join jh_link_target t on t.old_topic_id = os.topic_id
join lateral (
  select nst.id as new_sub_id,
         case
           when public.jh_title_norm(nst.title_en) = public.jh_title_norm(ost.title_en) then 1::real
           when length(public.jh_title_norm(nst.title_en)) >= 6
                and position(public.jh_title_norm(nst.title_en) in public.jh_title_norm(ost.title_en)) > 0 then 0.9::real
           when length(public.jh_title_norm(ost.title_en)) >= 6
                and position(public.jh_title_norm(ost.title_en) in public.jh_title_norm(nst.title_en)) > 0 then 0.9::real
           else similarity(public.jh_title_norm(nst.title_en), public.jh_title_norm(ost.title_en))
         end as score
  from public.subtopics nst
  where nst.topic_id = t.new_topic_id and nst.is_active
  order by score desc, nst.sort_order
  limit 1
) best on best.score >= 0.9;

update public.questions q
   set subtopic_id = m.new_sub_id,
       updated_at = now()
  from jh_sub_remap m
 where q.subtopic_id = m.old_sub_id;

update public.routines r
   set subtopic_id = m.new_sub_id,
       updated_at = now()
  from jh_sub_remap m
 where r.subtopic_id = m.old_sub_id;

update public.routine_progress p
   set subtopic_id = m.new_sub_id
  from jh_sub_remap m
 where p.subtopic_id = m.old_sub_id;

--  কোনো পুরোনো সাব-টপিকের নাম মিলল না → লিংকটি টপিক-লেভেলে নামানো হয়
--  (প্রশ্ন/রুটিন হারায় না, শুধু সাব-টপিক থাকে না)।
update public.questions q
   set subtopic_id = null,
       updated_at = now()
  from jh_retired_sub r
 where q.subtopic_id = r.id
   and not exists (select 1 from jh_sub_remap m where m.old_sub_id = r.id);

update public.routines r
   set subtopic_id = null,
       updated_at = now()
  from jh_retired_sub rs
 where r.subtopic_id = rs.id
   and not exists (select 1 from jh_sub_remap m where m.old_sub_id = rs.id);

update public.routine_progress p
   set subtopic_id = null
  from jh_retired_sub rs
 where p.subtopic_id = rs.id
   and not exists (select 1 from jh_sub_remap m where m.old_sub_id = rs.id);

--  অ্যাসাইনমেন্ট জেনারেট করা ডেটা → পুরোনো গাছের সারি বাদ, নতুন গাছে আবার।
delete from public.study_plan_assignments a
using jh_retired_topic r
where a.topic_id = r.id;

delete from public.study_plan_assignments a
using jh_retired_sub r
where a.subtopic_id = r.id;

-- ── ৯ · priority ও টপিকের মিশ্রণ ──────────────────────────────────────────
create temp table jh_detail_seed on commit drop as
select v.subject_slug, v.topic_slug, v.detail
from (values

    ('bangla'::text, 'P1-bangla-language-and-grammar-1'::text, '19 subtopic · P1: 13 · P2: 6'::text),
    ('bangla'::text, 'P1-old-and-medieval-bangla-literature-2'::text, '10 subtopic · P1: 7 · P2: 3'::text),
    ('bangla'::text, 'P1-modern-bangla-literature-3'::text, '16 subtopic · P1: 10 · P2: 5 · P3: 1'::text),
    ('bangla'::text, 'P1-literary-works-and-facts-4'::text, '12 subtopic · P1: 7 · P2: 5'::text),
    ('english'::text, 'grammar'::text, '20 subtopic · P1: 12 · P2: 8'::text),
    ('english'::text, 'vocabulary'::text, '9 subtopic · P1: 5 · P2: 4'::text),
    ('english'::text, 'composition'::text, '5 subtopic · P1: 2 · P2: 2 · P3: 1'::text),
    ('english'::text, 'english-literature'::text, '13 subtopic · P1: 8 · P2: 5'::text),
    ('bd'::text, 'P1-history-of-bangladesh-1'::text, '13 subtopic · P1: 10 · P2: 3'::text),
    ('bd'::text, 'P1-independence-and-the-liberation-war-2'::text, '11 subtopic · P1: 10 · P2: 1'::text),
    ('bd'::text, 'P1-constitution-of-bangladesh-3'::text, '10 subtopic · P1: 10'::text),
    ('bd'::text, 'P1-political-system-and-government-4'::text, '10 subtopic · P1: 4 · P2: 6'::text),
    ('bd'::text, 'P1-economy-of-bangladesh-5'::text, '11 subtopic · P1: 6 · P2: 5'::text),
    ('bd'::text, 'P1-agriculture-industry-and-trade-6'::text, '10 subtopic · P1: 5 · P2: 5'::text),
    ('bd'::text, 'P1-population-and-ethnic-groups-7'::text, '6 subtopic · P1: 3 · P2: 3'::text),
    ('bd'::text, 'P1-national-achievements-and-culture-8'::text, '9 subtopic · P1: 4 · P2: 4 · P3: 1'::text),
    ('international'::text, 'P1-world-history-1'::text, '10 subtopic · P1: 5 · P2: 5'::text),
    ('international'::text, 'P1-international-politics-and-relations-2'::text, '9 subtopic · P1: 7 · P2: 2'::text),
    ('international'::text, 'P1-international-organisations-3'::text, '15 subtopic · P1: 10 · P2: 5'::text),
    ('international'::text, 'P1-regional-organisations-and-alliances-4'::text, '10 subtopic · P1: 7 · P2: 3'::text),
    ('international'::text, 'P1-international-treaties-and-conferences-5'::text, '6 subtopic · P1: 2 · P2: 4'::text),
    ('international'::text, 'P1-country-profiles-and-geopolitics-6'::text, '8 subtopic · P1: 5 · P2: 3'::text),
    ('international'::text, 'P1-contemporary-international-affairs-7'::text, '6 subtopic · P1: 3 · P2: 3'::text),
    ('geography'::text, 'P1-geography-of-bangladesh-1'::text, '8 subtopic · P1: 4 · P2: 4'::text),
    ('geography'::text, 'P1-natural-environment-of-bangladesh-2'::text, '8 subtopic · P1: 6 · P2: 2'::text),
    ('geography'::text, 'P1-world-geography-3'::text, '9 subtopic · P1: 5 · P2: 4'::text),
    ('geography'::text, 'P1-environment-and-climate-4'::text, '8 subtopic · P1: 6 · P2: 2'::text),
    ('geography'::text, 'P1-disaster-management-5'::text, '10 subtopic · P1: 4 · P2: 5 · P3: 1'::text),
    ('science'::text, 'P1-physics-1'::text, '13 subtopic · P1: 8 · P2: 5'::text),
    ('science'::text, 'P1-chemistry-2'::text, '10 subtopic · P1: 7 · P2: 3'::text),
    ('science'::text, 'P1-biology-3'::text, '10 subtopic · P1: 7 · P2: 3'::text),
    ('science'::text, 'P1-human-body-and-health-4'::text, '11 subtopic · P1: 9 · P2: 2'::text),
    ('science'::text, 'P1-modern-and-applied-science-5'::text, '8 subtopic · P1: 3 · P2: 5'::text),
    ('ict'::text, 'P1-computer-fundamentals-1'::text, '10 subtopic · P1: 7 · P2: 3'::text),
    ('ict'::text, 'P1-number-system-and-digital-logic-2'::text, '8 subtopic · P1: 5 · P2: 3'::text),
    ('ict'::text, 'P1-operating-system-and-software-3'::text, '7 subtopic · P1: 3 · P2: 4'::text),
    ('ict'::text, 'P1-internet-and-networking-4'::text, '10 subtopic · P1: 6 · P2: 4'::text),
    ('ict'::text, 'cyber-security'::text, '9 subtopic · P1: 5 · P2: 4'::text),
    ('ict'::text, 'P1-modern-information-technology-6'::text, '9 subtopic · P1: 5 · P2: 3 · P3: 1'::text),
    ('math'::text, 'P1-arithmetic-1'::text, '11 subtopic · P1: 11'::text),
    ('math'::text, 'P1-algebra-2'::text, '9 subtopic · P1: 5 · P2: 4'::text),
    ('math'::text, 'P1-series-and-sets-3'::text, '6 subtopic · P2: 6'::text),
    ('math'::text, 'P1-geometry-4'::text, '7 subtopic · P1: 5 · P2: 2'::text),
    ('math'::text, 'P1-mensuration-5'::text, '5 subtopic · P1: 3 · P2: 2'::text),
    ('math'::text, 'P1-statistics-and-probability-6'::text, '6 subtopic · P1: 1 · P2: 5'::text),
    ('mental'::text, 'verbal-reasoning'::text, '6 subtopic · P1: 4 · P2: 2'::text),
    ('mental'::text, 'numerical-reasoning'::text, '5 subtopic · P1: 4 · P2: 1'::text),
    ('mental'::text, 'logical-reasoning'::text, '8 subtopic · P1: 6 · P2: 2'::text),
    ('mental'::text, 'spatial-reasoning'::text, '6 subtopic · P1: 4 · P2: 2'::text),
    ('mental'::text, 'mechanical-reasoning'::text, '4 subtopic · P2: 3 · P3: 1'::text),
    ('ethics'::text, 'P1-ethics-1'::text, '7 subtopic · P1: 3 · P2: 4'::text),
    ('ethics'::text, 'P1-values-2'::text, '7 subtopic · P1: 4 · P2: 3'::text),
    ('ethics'::text, 'P1-good-governance-3'::text, '9 subtopic · P1: 7 · P2: 2'::text),
    ('ethics'::text, 'P1-democracy-and-human-rights-4'::text, '6 subtopic · P1: 4 · P2: 2'::text),
    ('ethics'::text, 'P1-corruption-and-administrative-ethics-5'::text, '6 subtopic · P1: 5 · P2: 1'::text)

) as v(subject_slug, topic_slug, detail);

update public.topics t
   set metadata = t.metadata || jsonb_build_object(
         'priority', case
           when d.detail like '%P1:%' then 'P1'
           when d.detail like '%P2:%' then 'P2'
           else 'P3' end,
         'priority_mix', d.detail),
       updated_at = now()
  from jh_detail_seed d
  join jh_tx x on true
  join public.subjects su on su.course_id = x.course_id and su.slug = d.subject_slug
  join public.topics t2 on t2.subject_id = su.id and t2.slug = d.topic_slug
 where t.id = t2.id;

-- ── ১০ · প্রথম-পড়ার অ্যাসাইনমেন্ট (কভারেজ ইঞ্জিনের জন্য) ──────────────────
--  P1 আগে, তারপর P2, P3; ৬০ দিনের মধ্যে ঘুরিয়ে বসানো। আগে থেকে থাকলে
--  (unique index) হাত দেওয়া হয় না।
with unit as (
  select su.id as subject_id, t.id as topic_id, st.id as subtopic_id, st.title_en,
         coalesce(st.metadata ->> 'priority', 'P2') as priority,
         row_number() over (
           order by case coalesce(st.metadata ->> 'priority', 'P2')
                      when 'P1' then 1 when 'P2' then 2 else 3 end,
                    su.sort_order, t.sort_order, st.sort_order, st.id) as rn
  from jh_tx x
  join public.subjects su on su.course_id = x.course_id and su.is_active
  join public.topics t on t.subject_id = su.id and t.is_active
  join public.subtopics st on st.topic_id = t.id and st.is_active
)
insert into public.study_plan_assignments
  (course_id, subject_id, topic_id, subtopic_id, plan_day, first_study_date,
   minutes, priority, objective_bn)
select x.course_id, u.subject_id, u.topic_id, u.subtopic_id,
       1 + ((u.rn - 1) % 60)::smallint,
       date '2026-11-28' + (((u.rn - 1) % 60)::int),
       20,
       case u.priority when 'P1' then 'high' when 'P3' then 'low' else 'normal' end,
       'সিলেবাসের সাব-টপিক: ' || u.title_en
from unit u
cross join jh_tx x
where not exists (
  select 1 from public.study_plan_assignments a
  where a.course_id = x.course_id and a.topic_id = u.topic_id
    and a.subtopic_id is not distinct from u.subtopic_id);

-- ── ১১ · যাচাই ─────────────────────────────────────────────────────────────
--  পুরোনো গাছের সাথে সামঞ্জস্যরক্ষার ফাংশন (jh_guard_previous_source,
--  jh_recompute_topic_priorities) এবং ট্রিগার থেকে যায়; এখানে শুধু হিসাব।
do $$
declare bad int;
begin
  select count(*) into bad from jh_tx x
  where (select count(*) from public.subjects su where su.course_id = x.course_id and su.is_active) <> 10;
  if bad > 0 then raise exception 'BCS-এ ১০টি সক্রিয় বিষয় থাকা উচিত, পাওয়া গেল %', bad; end if;

  select count(*) into bad from jh_tx x
  where (select count(*) from public.topics t join public.subjects su on su.id = t.subject_id
          where su.course_id = x.course_id and su.is_active and t.is_active) <> 55;
  if bad > 0 then raise exception 'BCS-এ ৫৫টি সক্রিয় টপিক থাকা উচিত, পাওয়া গেল %', bad; end if;

  select count(*) into bad from jh_tx x
  where (select count(*) from public.subtopics st join public.topics t on t.id = st.topic_id
           join public.subjects su on su.id = t.subject_id
          where su.course_id = x.course_id and su.is_active and t.is_active and st.is_active) <> 504;
  if bad > 0 then raise exception 'BCS-এ ৫০৪টি সক্রিয় সাব-টপিক থাকা উচিত, পাওয়া গেল %', bad; end if;

  select count(*) into bad
  from public.subtopics st
  join public.topics t on t.id = st.topic_id
  join public.subjects su on su.id = t.subject_id
  join jh_tx x on x.course_id = su.course_id
  where st.is_active and t.is_active and (st.metadata ->> 'priority') is null;
  if bad > 0 then raise exception '%টি সক্রিয় সাব-টপিকে priority নেই', bad; end if;
end $$;
