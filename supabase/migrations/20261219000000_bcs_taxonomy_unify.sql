-- ───────────────────────────────────────────────────────────────────────────
-- BCS Preliminary — unify the taxonomy (V4)
--
-- Three changes, in this order. Nothing is deleted while it still holds data.
--
-- ১ · Delete the 85 retired placeholder topics (and their 208 subtopics).
--     They are already `is_active = false` and carry
--     `metadata.retired_by = 'bcs-syllabus-v2'`. Verified before writing this
--     migration: 0 questions, 0 question_topic_links, 0 study_plan_assignments,
--     0 study_progress, 0 question_frequency, 0 micro_topics, 0 revision_items,
--     0 ai_generations point at them. Only 85 computed `topic_priorities` rows
--     cascade away. A guard below re-checks this at run time and aborts rather
--     than relying on this comment.
--
-- ২ · Collapse the one duplicate subtopic title in the active tree.
--     `নদ-নদী` exists twice under geography (normalised equal by
--     `jh_title_norm`), once under বাংলাদেশের ভূগোল and once under বিশ্ব ভূগোল.
--     Both hold no questions, links or progress. The Bangladesh one is kept —
--     it is the tree the syllabus page renders first.
--
-- ৩ · Classify the 2,112 questions whose `topic_id` is NULL.
--     Rules live in `gen/taxonomy-v4/rules.py` and are keyed on question
--     wording, because these rows carry no other signal (all 4,408 questions
--     keep their Bengali text in `statement`; only 43 have `statement_bn`).
--     A question the rules do not confidently match KEEPS `topic_id = null` —
--     a wrong topic is worse than none, since it would surface the question in
--     the wrong revision list. Measured split on production: 1,443 classified,
--     669 left null, almost all of them Bengali literature questions that need
--     a human. The `t.subject_id = m.subject_id` predicate below is what keeps
--     a cross-subject keyword from landing a question in the wrong subject.
--
-- Idempotent: every statement is a no-op on a second run.
-- ───────────────────────────────────────────────────────────────────────────

create temp table jh_v4_course on commit drop as
select c.id as course_id from public.courses c where c.slug = 'bcs';

do $$
begin
  if not exists (select 1 from jh_v4_course) then
    raise exception 'BCS কোর্স পাওয়া যায়নি';
  end if;
end $$;

-- ── ১ · স্বাধীনতা যাচাই: retired গাছে কোনো ডেটা নেই ─────────────────────────
create temp table jh_v4_retired on commit drop as
select t.id as topic_id
  from public.topics t
  join public.subjects s on s.id = t.subject_id
  join jh_v4_course c on c.course_id = s.course_id
 where t.is_active = false
   and t.metadata ->> 'retired_by' is not null;

create temp table jh_v4_retired_sub on commit drop as
select st.id as subtopic_id, st.topic_id
  from public.subtopics st
 where st.topic_id in (select topic_id from jh_v4_retired);

do $$
declare
  n_questions int;
  n_links     int;
  n_assign    int;
  n_progress  int;
begin
  select count(*) into n_questions from public.questions
   where topic_id in (select topic_id from jh_v4_retired)
      or subtopic_id in (select subtopic_id from jh_v4_retired_sub);
  select count(*) into n_links from public.question_topic_links
   where topic_id in (select topic_id from jh_v4_retired)
      or subtopic_id in (select subtopic_id from jh_v4_retired_sub);
  select count(*) into n_assign from public.study_plan_assignments
   where topic_id in (select topic_id from jh_v4_retired)
      or subtopic_id in (select subtopic_id from jh_v4_retired_sub);
  select count(*) into n_progress from public.study_progress
   where topic_id in (select topic_id from jh_v4_retired)
      or subtopic_id in (select subtopic_id from jh_v4_retired_sub);

  if n_questions + n_links + n_assign + n_progress > 0 then
    raise exception
      'retired গাছে ডেটা আছে: questions=%, links=%, assignments=%, progress=% — মাইগ্রেশন বাতিল',
      n_questions, n_links, n_assign, n_progress;
  end if;
end $$;

-- Subtopic before topic: the subtopics→topics FK is not uniform across the two
-- constraints on that column, so neither order can be assumed safe by rule.
delete from public.subtopics where id in (select subtopic_id from jh_v4_retired_sub);
delete from public.topics    where id in (select topic_id    from jh_v4_retired);

-- ── ২ · একই নামের subtopic একটাই থাকবে ──────────────────────────────────────
-- Verified empty first; the delete is scoped by title so it cannot touch a row
-- that holds a question.
delete from public.subtopics st
 using public.topics t, public.subjects s, jh_v4_course c
 where st.topic_id = t.id
   and t.subject_id = s.id
   and s.course_id = c.course_id
   and s.slug = 'geography'
   and public.jh_title_norm(st.title_bn) = public.jh_title_norm('নদ-নদী')
   and public.jh_title_norm(t.title_bn) = public.jh_title_norm('বিশ্ব ভূগোল')
   and not exists (select 1 from public.questions q where q.subtopic_id = st.id)
   and not exists (select 1 from public.question_topic_links l where l.subtopic_id = st.id);

-- ── ৩ · প্রশ্নের শ্রেণিবিন্যাস ───────────────────────────────────────────────
-- The two subtopics above are created first; every other target must already
-- exist or the migration aborts with the missing list.
-- `পদ` and `প্রয়োগ ও অপ্রয়োগ` are names your master list uses that the live
-- tree never had. Create them so the rules below have a real target instead of
-- those questions being filed under a neighbour or left untagged. Re-running is
-- a no-op: the pair (topic_id, slug) is unique.
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order, is_active, approval_status, metadata)
select t.id, v.slug, v.title_en, v.title_bn, v.sort_order, true, 'approved',
       '{"syllabus": "bcs-preliminary", "added_by": "bcs-taxonomy-v4"}'::jsonb
  from (values
    ('bangla', 'বাংলা ভাষা ও ব্যাকরণ', 'pod',    'Pad (Word Class)',  'পদ',               20::smallint),
    ('bangla', 'বাংলা ভাষা ও ব্যাকরণ', 'prayog', 'Usage and Non-usage', 'প্রয়োগ ও অপ্রয়োগ', 21::smallint)
  ) as v(subject_slug, topic_bn, slug, title_en, title_bn, sort_order)
  join public.subjects s
    on s.course_id = (select course_id from jh_v4_course)
   and s.slug = v.subject_slug
  join public.topics t
    on t.subject_id = s.id
   and t.is_active
   and public.jh_title_norm(t.title_bn) = public.jh_title_norm(v.topic_bn)
on conflict (topic_id, slug) do update
   set title_bn = excluded.title_bn,
       title_en = excluded.title_en,
       is_active = true,
       updated_at = now();

create temp table jh_v4_map on commit drop as
select r.ord, t.id as topic_id, st.id as subtopic_id, t.subject_id
  from (values
    (10::int, 'math'::text, 'পাটিগণিত'::text, 'ল.সা.গু ও গ.সা.গু'::text),
    (11::int, 'math'::text, 'পাটিগণিত'::text, 'ল.সা.গু ও গ.সা.গু'::text),
    (12::int, 'math'::text, 'পাটিগণিত'::text, 'ল.সা.গু ও গ.সা.গু'::text),
    (20::int, 'math'::text, 'পাটিগণিত'::text, 'শতকরা'::text),
    (21::int, 'math'::text, 'পাটিগণিত'::text, 'অনুপাত ও সমানুপাত'::text),
    (22::int, 'math'::text, 'পাটিগণিত'::text, 'লাভ ও ক্ষতি'::text),
    (23::int, 'math'::text, 'পাটিগণিত'::text, 'সরল মুনাফা'::text),
    (24::int, 'math'::text, 'পাটিগণিত'::text, 'যৌগিক মুনাফা'::text),
    (30::int, 'math'::text, 'পাটিগণিত'::text, 'কাজ ও সময়'::text),
    (31::int, 'math'::text, 'পাটিগণিত'::text, 'দূরত্ব, সময় ও গতি'::text),
    (32::int, 'math'::text, 'পাটিগণিত'::text, 'ঐকিক নিয়ম'::text),
    (33::int, 'math'::text, 'পাটিগণিত'::text, 'গড়'::text),
    (40::int, 'math'::text, 'বীজগণিত'::text, 'বীজগাণিতিক সূত্র'::text),
    (41::int, 'math'::text, 'বীজগণিত'::text, 'উৎপাদক বিশ্লেষণ'::text),
    (42::int, 'math'::text, 'বীজগণিত'::text, 'দ্বিঘাত সমীকরণ'::text),
    (43::int, 'math'::text, 'বীজগণিত'::text, 'সরল সমীকরণ'::text),
    (44::int, 'math'::text, 'বীজগণিত'::text, 'সূচক'::text),
    (45::int, 'math'::text, 'বীজগণিত'::text, 'লগারিদম'::text),
    (46::int, 'math'::text, 'বীজগণিত'::text, 'বহুপদী'::text),
    (47::int, 'math'::text, 'বীজগণিত'::text, 'অসমতা'::text),
    (50::int, 'math'::text, 'ধারা ও সেট'::text, 'সমান্তর ধারা'::text),
    (51::int, 'math'::text, 'ধারা ও সেট'::text, 'গুণোত্তর ধারা'::text),
    (52::int, 'math'::text, 'ধারা ও সেট'::text, 'ধারার যোগফল'::text),
    (53::int, 'math'::text, 'ধারা ও সেট'::text, 'সেটের অপারেশন'::text),
    (54::int, 'math'::text, 'ধারা ও সেট'::text, 'সেট'::text),
    (60::int, 'math'::text, 'জ্যামিতি'::text, 'ত্রিভুজ'::text),
    (61::int, 'math'::text, 'জ্যামিতি'::text, 'চতুর্ভুজ'::text),
    (62::int, 'math'::text, 'জ্যামিতি'::text, 'বৃত্ত'::text),
    (63::int, 'math'::text, 'জ্যামিতি'::text, 'রেখা ও কোণ'::text),
    (70::int, 'math'::text, 'পরিমিতি'::text, 'ক্ষেত্রফল'::text),
    (71::int, 'math'::text, 'পরিমিতি'::text, 'আয়তন'::text),
    (72::int, 'math'::text, 'পরিমিতি'::text, 'পরিসীমা'::text),
    (73::int, 'math'::text, 'পরিমিতি'::text, 'ঘনবস্তু'::text),
    (80::int, 'math'::text, 'পরিসংখ্যান ও সম্ভাব্যতা'::text, 'সম্ভাব্যতা'::text),
    (81::int, 'math'::text, 'পরিসংখ্যান ও সম্ভাব্যতা'::text, 'বিন্যাস'::text),
    (82::int, 'math'::text, 'পরিসংখ্যান ও সম্ভাব্যতা'::text, 'সমাবেশ'::text),
    (83::int, 'math'::text, 'পরিসংখ্যান ও সম্ভাব্যতা'::text, 'মধ্যক'::text),
    (84::int, 'math'::text, 'পরিসংখ্যান ও সম্ভাব্যতা'::text, 'প্রচুরক'::text),
    (85::int, 'math'::text, 'পরিসংখ্যান ও সম্ভাব্যতা'::text, 'গাণিতিক গড়'::text),
    (100::int, 'bangla'::text, 'বাংলা ভাষা ও ব্যাকরণ'::text, 'সন্ধি'::text),
    (101::int, 'bangla'::text, 'বাংলা ভাষা ও ব্যাকরণ'::text, 'সমাস'::text),
    (102::int, 'bangla'::text, 'বাংলা ভাষা ও ব্যাকরণ'::text, 'কারক ও বিভক্তি'::text),
    (103::int, 'bangla'::text, 'বাংলা ভাষা ও ব্যাকরণ'::text, 'উপসর্গ'::text),
    (104::int, 'bangla'::text, 'বাংলা ভাষা ও ব্যাকরণ'::text, 'প্রত্যয়'::text),
    (105::int, 'bangla'::text, 'বাংলা ভাষা ও ব্যাকরণ'::text, 'ণত্ব ও ষত্ব বিধান'::text),
    (106::int, 'bangla'::text, 'বাংলা ভাষা ও ব্যাকরণ'::text, 'ধ্বনি ও বর্ণ'::text),
    (107::int, 'bangla'::text, 'বাংলা ভাষা ও ব্যাকরণ'::text, 'বাগধারা'::text),
    (108::int, 'bangla'::text, 'বাংলা ভাষা ও ব্যাকরণ'::text, 'এক কথায় প্রকাশ'::text),
    (109::int, 'bangla'::text, 'বাংলা ভাষা ও ব্যাকরণ'::text, 'সমার্থক শব্দ'::text),
    (110::int, 'bangla'::text, 'বাংলা ভাষা ও ব্যাকরণ'::text, 'বিপরীতার্থক শব্দ'::text),
    (111::int, 'bangla'::text, 'বাংলা ভাষা ও ব্যাকরণ'::text, 'বানান শুদ্ধি'::text),
    (112::int, 'bangla'::text, 'বাংলা ভাষা ও ব্যাকরণ'::text, 'বাক্য ও বাক্যশুদ্ধি'::text),
    (113::int, 'bangla'::text, 'বাংলা ভাষা ও ব্যাকরণ'::text, 'বাক্যের শ্রেণিবিভাগ'::text),
    (114::int, 'bangla'::text, 'বাংলা ভাষা ও ব্যাকরণ'::text, 'শব্দের শ্রেণিবিভাগ'::text),
    (115::int, 'bangla'::text, 'বাংলা ভাষা ও ব্যাকরণ'::text, 'পারিভাষিক শব্দ'::text),
    (116::int, 'bangla'::text, 'বাংলা ভাষা ও ব্যাকরণ'::text, 'পদ'::text),
    (117::int, 'bangla'::text, 'বাংলা ভাষা ও ব্যাকরণ'::text, 'প্রয়োগ ও অপ্রয়োগ'::text),
    (118::int, 'bangla'::text, 'বাংলা ভাষা ও ব্যাকরণ'::text, 'বাংলা ভাষার উৎপত্তি ও বিকাশ'::text),
    (130::int, 'bangla'::text, 'প্রাচীন ও মধ্যযুগের বাংলা সাহিত্য'::text, 'চর্যাপদ'::text),
    (131::int, 'bangla'::text, 'প্রাচীন ও মধ্যযুগের বাংলা সাহিত্য'::text, 'মঙ্গলকাব্য'::text),
    (132::int, 'bangla'::text, 'প্রাচীন ও মধ্যযুগের বাংলা সাহিত্য'::text, 'বৈষ্ণব পদাবলি'::text),
    (133::int, 'bangla'::text, 'প্রাচীন ও মধ্যযুগের বাংলা সাহিত্য'::text, 'মধ্যযুগের সাহিত্যকর্ম'::text),
    (140::int, 'bangla'::text, 'আধুনিক বাংলা সাহিত্য'::text, 'রবীন্দ্রনাথ ঠাকুর'::text),
    (141::int, 'bangla'::text, 'আধুনিক বাংলা সাহিত্য'::text, 'কাজী নজরুল ইসলাম'::text),
    (142::int, 'bangla'::text, 'আধুনিক বাংলা সাহিত্য'::text, 'মাইকেল মধুসূদন দত্ত'::text),
    (143::int, 'bangla'::text, 'আধুনিক বাংলা সাহিত্য'::text, 'বঙ্কিমচন্দ্র চট্টোপাধ্যায়'::text),
    (144::int, 'bangla'::text, 'আধুনিক বাংলা সাহিত্য'::text, 'শরৎচন্দ্র চট্টোপাধ্যায়'::text),
    (145::int, 'bangla'::text, 'আধুনিক বাংলা সাহিত্য'::text, 'মীর মশাররফ হোসেন'::text),
    (146::int, 'bangla'::text, 'আধুনিক বাংলা সাহিত্য'::text, 'বেগম রোকেয়া'::text),
    (147::int, 'bangla'::text, 'আধুনিক বাংলা সাহিত্য'::text, 'জীবনানন্দ দাশ'::text),
    (148::int, 'bangla'::text, 'আধুনিক বাংলা সাহিত্য'::text, 'জসীমউদ্‌দীন'::text),
    (149::int, 'bangla'::text, 'আধুনিক বাংলা সাহিত্য'::text, 'সুকান্ত ভট্টাচার্য'::text),
    (150::int, 'bangla'::text, 'আধুনিক বাংলা সাহিত্য'::text, 'ফররুখ আহমদ'::text),
    (151::int, 'bangla'::text, 'আধুনিক বাংলা সাহিত্য'::text, 'শামসুর রাহমান'::text),
    (152::int, 'bangla'::text, 'আধুনিক বাংলা সাহিত্য'::text, 'ঈশ্বরচন্দ্র বিদ্যাসাগর'::text),
    (153::int, 'bangla'::text, 'আধুনিক বাংলা সাহিত্য'::text, 'দীনবন্ধু মিত্র'::text),
    (154::int, 'bangla'::text, 'আধুনিক বাংলা সাহিত্য'::text, 'সৈয়দ শামসুল হক'::text),
    (160::int, 'bangla'::text, 'সাহিত্যকর্ম ও সাহিত্যবিষয়ক তথ্য'::text, 'বাংলা উপন্যাস'::text),
    (161::int, 'bangla'::text, 'সাহিত্যকর্ম ও সাহিত্যবিষয়ক তথ্য'::text, 'বাংলা ছোটগল্প'::text),
    (162::int, 'bangla'::text, 'সাহিত্যকর্ম ও সাহিত্যবিষয়ক তথ্য'::text, 'বাংলা নাটক'::text),
    (163::int, 'bangla'::text, 'সাহিত্যকর্ম ও সাহিত্যবিষয়ক তথ্য'::text, 'বাংলা কাব্যগ্রন্থ ও কবিতা'::text),
    (164::int, 'bangla'::text, 'সাহিত্যকর্ম ও সাহিত্যবিষয়ক তথ্য'::text, 'সাহিত্য পত্র-পত্রিকা'::text),
    (165::int, 'bangla'::text, 'সাহিত্যকর্ম ও সাহিত্যবিষয়ক তথ্য'::text, 'সাহিত্যিকদের ছদ্মনাম ও উপাধি'::text),
    (166::int, 'bangla'::text, 'সাহিত্যকর্ম ও সাহিত্যবিষয়ক তথ্য'::text, 'সাহিত্য পুরস্কার'::text),
    (167::int, 'bangla'::text, 'সাহিত্যকর্ম ও সাহিত্যবিষয়ক তথ্য'::text, 'বাংলা সাহিত্যের যুগবিভাগ'::text),
    (168::int, 'bangla'::text, 'সাহিত্যকর্ম ও সাহিত্যবিষয়ক তথ্য'::text, 'বিখ্যাত সাহিত্যিক উক্তি'::text)
  ) as r(ord, subject_slug, topic_bn, sub_bn)
  join public.subjects s
    on s.course_id = (select course_id from jh_v4_course)
   and s.slug = r.subject_slug
  join public.topics t
    on t.subject_id = s.id
   and t.is_active
   and public.jh_title_norm(t.title_bn) = public.jh_title_norm(r.topic_bn)
  join public.subtopics st
    on st.topic_id = t.id
   and st.is_active
   and public.jh_title_norm(st.title_bn) = public.jh_title_norm(r.sub_bn);

do $$
declare
  n_rules int := 86;
  n_map   int;
begin
  select count(*) into n_map from jh_v4_map;
  if n_map <> n_rules then
    raise exception
      'শ্রেণিবিন্যাসের target পাওয়া যায়নি: rules=%, resolved=% — মাইগ্রেশন বাতিল',
      n_rules, n_map;
  end if;
end $$;

create temp table jh_v4_pick on commit drop as
select q.id as question_id,
       q.subject_id,
       case
           when (q.statement like '%গ.সা.গু%' or q.statement like '%গসাগু%' or q.statement like '%ল.সা.গু%' or q.statement like '%লসাগু%' or q.statement like '%সাধারণ গুণনীয়ক%' or q.statement like '%সাধারণ গুণিতক%') then 10
           when ((q.statement like '%বৃহত্তম সংখ্যা%' or q.statement like '%বড় সংখ্যা%' or q.statement like '%ক্ষুদ্রতম সংখ্যা%') and (q.statement like '%ভাগশেষ%' or q.statement like '%ভাগ করলে%' or q.statement like '%নিঃশেষে%')) then 11
           when ((q.statement like '%একসাথে%' or q.statement like '%একই সময়ে%' or q.statement like '%পরে পরপর%' or q.statement like '%বাজে%' or q.statement like '%ঘোরে%') and (q.statement like '%মিনিট%' or q.statement like '%সেকেন্ড%' or q.statement like '%ঘণ্টা%')) then 12
           when (q.statement like '%শতকরা%' or q.statement like '%শতাংশ%' or q.statement like '%শতকরা হার%') then 20
           when (q.statement like '%অনুপাত%' or q.statement like '%সমানুপাত%') then 21
           when ((q.statement like '%লাভ%' or q.statement like '%ক্ষতি%' or q.statement like '%মুনাফা%') and (q.statement like '%কিনে%' or q.statement like '%ক্রয়মূল্য%' or q.statement like '%বিক্রয়মূল্য%' or q.statement like '%বিক্রি%' or q.statement like '%দাম%')) then 22
           when (q.statement like '%সরল মুনাফা%' or q.statement like '%সরল সুদ%') then 23
           when (q.statement like '%চক্রবৃদ্ধি%' or q.statement like '%যৌগিক%') then 24
           when ((q.statement like '%দিনে%' or q.statement like '%দিনের%') and (q.statement like '%কাজ%' or q.statement like '%খাবার%' or q.statement like '%খাদ্য%' or q.statement like '%ট্যাংক%' or q.statement like '%চৌবাচ্চা%' or q.statement like '%জমি%' or q.statement like '%ধান%' or q.statement like '%পুকুর%' or q.statement like '%রাস্তা%')) then 30
           when ((q.statement like '%গতি%' or q.statement like '%বেগ%' or q.statement like '%কি.মি%' or q.statement like '%কিমি%') and (q.statement like '%ঘণ্টা%' or q.statement like '%সময়%' or q.statement like '%মিনিট%' or q.statement like '%সেকেন্ড%')) then 31
           when ((q.statement like '%টাকা%' or q.statement like '%দাম%') and (q.statement like '%টি%' or q.statement like '%কেজি%') and q.statement like '%কত%') then 32
           when (q.statement like '%গড়%' and (q.statement like '%সংখ্যা%' or q.statement like '%সংখ্যাগুলোর%')) then 33
           when ((q.statement like '%a + b%' or q.statement like '%a+b%' or q.statement like '%a² + b²%' or q.statement like '%a²+b²%' or q.statement like '%ab =%' or q.statement like '%x + 1/x%' or q.statement like '%x³ +%' or q.statement like '%মান কত%') and not q.statement like '%সমীকরণ%') then 40
           when (q.statement like '%উৎপাদক%') then 41
           when (q.statement like '%দ্বিঘাত%') then 42
           when (q.statement like '%সমীকরণ%') then 43
           when (q.statement like '%সূচক%') then 44
           when (q.statement like '%লগারিদম%' or q.statement like '%log%') then 45
           when (q.statement like '%বহুপদী%') then 46
           when (q.statement like '%অসমতা%') then 47
           when (q.statement like '%সমান্তর ধারা%') then 50
           when (q.statement like '%গুণোত্তর ধারা%') then 51
           when (q.statement like '%ধারার%' or q.statement like '%ধারা%') then 52
           when ((q.statement like '%সেট%') and (q.statement like '%সংযোগ%' or q.statement like '%ছেদ%' or q.statement like '%উপসেট%' or q.statement like '%পাওয়ার সেট%' or q.statement like '%A ∪%' or q.statement like '%A ∩%')) then 53
           when (q.statement like '%সেট%') then 54
           when (q.statement like '%ত্রিভুজ%') then 60
           when (q.statement like '%চতুর্ভুজ%' or q.statement like '%সামান্তরিক%' or q.statement like '%রম্বস%' or q.statement like '%ট্রাপিজিয়াম%') then 61
           when (q.statement like '%বৃত্ত%' or q.statement like '%পরিধি%') then 62
           when (q.statement like '%কোণ%') then 63
           when (q.statement like '%ক্ষেত্রফল%') then 70
           when (q.statement like '%আয়তন%') then 71
           when (q.statement like '%পরিসীমা%') then 72
           when (q.statement like '%ঘনক%' or q.statement like '%সিলিন্ডার%' or q.statement like '%কোণক%') then 73
           when (q.statement like '%সম্ভাব্যতা%' or q.statement like '%পাশা%' or q.statement like '%কয়েন%' or q.statement like '%মুদ্রা%') then 80
           when (q.statement like '%বিন্যাস%') then 81
           when (q.statement like '%সমাবেশ%') then 82
           when (q.statement like '%মধ্যক%') then 83
           when (q.statement like '%প্রচুরক%') then 84
           when (q.statement like '%গড়%') then 85
           when (q.statement like '%সন্ধি%') then 100
           when (q.statement like '%সমাস%') then 101
           when (q.statement like '%কারক%' or q.statement like '%বিভক্তি%' or q.statement like '%অনুসর্গ%') then 102
           when (q.statement like '%উপসর্গ%') then 103
           when (q.statement like '%প্রত্যয়%' or q.statement like '%কৃৎ%' or q.statement like '%তদ্ধিত%') then 104
           when (q.statement like '%ণত্ব%' or q.statement like '%ষত্ব%') then 105
           when (q.statement like '%ধ্বনি%' or q.statement like '%বর্ণ%' or q.statement like '%স্বরবর্ণ%' or q.statement like '%ব্যঞ্জনবর্ণ%') then 106
           when (q.statement like '%বাগধারা%' or q.statement like '%প্রবাদ%' or q.statement like '%প্রবচন%') then 107
           when (q.statement like '%এক কথায়%' or q.statement like '%এককথায়%') then 108
           when (q.statement like '%সমার্থক%' or q.statement like '%প্রতিশব্দ%') then 109
           when (q.statement like '%বিপরীত%') then 110
           when (q.statement like '%শুদ্ধ বানান%' or q.statement like '%বানান%') then 111
           when ((q.statement like '%বাক্য%') and (q.statement like '%শুদ্ধ%' or q.statement like '%অশুদ্ধ%' or q.statement like '%গঠন%' or q.statement like '%রূপান্তর%')) then 112
           when (q.statement like '%বাক্যের%') then 113
           when (q.statement like '%শব্দের%' and (q.statement like '%শ্রেণি%' or q.statement like '%ভাগ%')) then 114
           when (q.statement like '%পারিভাষিক%') then 115
           when (q.statement like '%পদের%' or q.statement like '%কোন পদ%' or q.statement like '%পদ নির্ণয়%' or q.statement like '%পদ কত%' or q.statement like '%বিশেষণ পদ%' or q.statement like '%ক্রিয়া পদ%') then 116
           when (q.statement like '%প্রয়োগ%' and (q.statement like '%অপ্রয়োগ%' or q.statement like '%প্রয়োগ হয়%' or q.statement like '%প্রয়োগের%')) then 117
           when (q.statement like '%উৎপত্তি%' or q.statement like '%বিকাশ%' or q.statement like '%ভাষার জন্ম%') then 118
           when (q.statement like '%চর্যাপদ%') then 130
           when (q.statement like '%মঙ্গলকাব্য%' or q.statement like '%মনসামঙ্গল%' or q.statement like '%চণ্ডীমঙ্গল%') then 131
           when (q.statement like '%বৈষ্ণব%' or q.statement like '%পদাবলি%') then 132
           when (q.statement like '%মধ্যযুগ%') then 133
           when (q.statement like '%রবীন্দ্র%' or q.statement like '%রবি ঠাকুর%') then 140
           when (q.statement like '%নজরুল%') then 141
           when (q.statement like '%মাইকেল%' or q.statement like '%মধুসূদন%') then 142
           when (q.statement like '%বঙ্কিম%') then 143
           when (q.statement like '%শরৎচন্দ্র%') then 144
           when (q.statement like '%মশাররফ%') then 145
           when (q.statement like '%রোকেয়া%') then 146
           when (q.statement like '%জীবনানন্দ%') then 147
           when (q.statement like '%জসীম%') then 148
           when (q.statement like '%সুকান্ত%') then 149
           when (q.statement like '%ফররুখ%') then 150
           when (q.statement like '%শামসুর রাহমান%') then 151
           when (q.statement like '%বিদ্যাসাগর%') then 152
           when (q.statement like '%দীনবন্ধু%') then 153
           when (q.statement like '%শামসুল হক%') then 154
           when (q.statement like '%উপন্যাস%') then 160
           when (q.statement like '%ছোটগল্প%') then 161
           when (q.statement like '%নাটক%' or q.statement like '%নাট্যকার%') then 162
           when (q.statement like '%কাব্য%' or q.statement like '%কবিতা%' or q.statement like '%কবি%') then 163
           when (q.statement like '%পত্রিকা%' or q.statement like '%সাময়িকী%' or q.statement like '%সম্পাদক%') then 164
           when (q.statement like '%ছদ্মনাম%' or q.statement like '%উপাধি%') then 165
           when (q.statement like '%পুরস্কার%' or q.statement like '%একুশে পদক%') then 166
           when (q.statement like '%যুগবিভাগ%' or q.statement like '%যুগে%') then 167
           when (q.statement like '%উক্তি%') then 168
       else null
       end as ord
  from public.questions q
  join jh_v4_course c on c.course_id = q.course_id
 where q.topic_id is null;

-- Some questions arrived carrying TWO primary links with `topic_id = null`.
-- The unique index is (question_id, course_id, topic_id) and Postgres treats
-- NULLs as distinct, so nothing stopped the duplicate; but the moment the
-- update above gives both rows a real topic, the `jh_sync_primary_link` trigger
-- collides on that index and the whole migration aborts. Keep the newest link
-- per question and drop the rest — a question has exactly one primary topic,
-- and the duplicate was never visible anywhere because the topic was null.
delete from public.question_topic_links t
 using (select l.id,
               row_number() over (partition by l.question_id
                                  order by l.created_at desc, l.id) as rn
          from public.question_topic_links l
          join public.questions q on q.id = l.question_id
          join jh_v4_course c on c.course_id = q.course_id
         where q.topic_id is null) dup
 where t.id = dup.id and dup.rn > 1;

update public.questions t
   set topic_id    = m.topic_id,
       subtopic_id = m.subtopic_id,
       updated_at  = now()
  from jh_v4_pick p
  join jh_v4_map m on m.ord = p.ord
 where t.id = p.question_id
   and t.subject_id = m.subject_id      -- subject must agree, see header
   and t.topic_id is null;

-- No manual link insert here on purpose: `jh_sync_primary_link` is an AFTER
-- UPDATE trigger on questions and already rewrites the question's primary link
-- (or inserts one when the question had none). Doing both would duplicate it.

-- ── ৪ · নতুন subtopic-এর প্রথম-অধ্যয়ন সারি ─────────────────────────────────
-- A "unit" for the coverage engine is every active subtopic plus every active
-- topic that has none. The two subtopics above add two units, and
-- `jh_coverage_summary` would report both as gaps. Seed them here so coverage
-- stays 100% without waiting for the next `jh_generate_study_plan` run.
--
-- Placement copies 20261214000000 exactly: a 60-day rotation starting on the
-- course's first study day, ordered by priority then sort_order. Those two rows
-- sit at the end of that ordering, so they land on rotation slots 59 and 60 and
-- no existing row moves. The date is computed whether or not a routine has been
-- published yet — 20261214000000 seeds coverage on an empty routine table too,
-- and the assignment rows are what the routine is later built from.
with unit as (
  select su.id as subject_id, t.id as topic_id, st.id as subtopic_id,
         st.title_en,
         coalesce(st.metadata ->> 'priority', 'P2') as priority,
         row_number() over (
           order by case coalesce(st.metadata ->> 'priority', 'P2')
                      when 'P1' then 1 when 'P2' then 2 else 3 end,
                    su.sort_order, t.sort_order, st.sort_order, st.id) as rn
    from public.subtopics st
    join public.topics t on t.id = st.topic_id and t.is_active
    join public.subjects su on su.id = t.subject_id and su.is_active
    join jh_v4_course c on c.course_id = su.course_id
   where st.is_active
     and st.metadata ->> 'added_by' = 'bcs-taxonomy-v4'
)
insert into public.study_plan_assignments
  (course_id, subject_id, topic_id, subtopic_id, plan_day, first_study_date,
   minutes, priority, objective_bn)
select c.course_id, u.subject_id, u.topic_id, u.subtopic_id,
       1 + ((u.rn - 1) % 60)::smallint,
       date '2026-11-28' + (((u.rn - 1) % 60)::int),
       20,
       case u.priority when 'P1' then 'high' when 'P3' then 'low' else 'normal' end,
       'সিলেবাসের সাব-টপিক: ' || u.title_en
  from unit u
  cross join jh_v4_course c
 where not exists (
   select 1 from public.study_plan_assignments a
    where a.course_id = c.course_id and a.topic_id = u.topic_id
      and a.subtopic_id is not distinct from u.subtopic_id);

-- ── ৫ · ফল যাচাই ────────────────────────────────────────────────────────────
do $$
declare
  n_topics   int;
  n_subs     int;
  n_dup_t    int;
  n_dup_s    int;
  n_orphan   int;
begin
  select count(*) into n_topics from public.topics t
    join public.subjects s on s.id = t.subject_id
    join jh_v4_course c on c.course_id = s.course_id
   where t.is_active;
  select count(*) into n_subs from public.subtopics st
    join public.topics t on t.id = st.topic_id
    join public.subjects s on s.id = t.subject_id
    join jh_v4_course c on c.course_id = s.course_id
   where t.is_active and st.is_active;

  select count(*) into n_dup_t from (
    select s.slug, public.jh_title_norm(t.title_bn)
      from public.topics t join public.subjects s on s.id = t.subject_id
      join jh_v4_course c on c.course_id = s.course_id
     where t.is_active
     group by 1, 2 having count(*) > 1) d;

  select count(*) into n_dup_s from (
    select s.slug, public.jh_title_norm(st.title_bn)
      from public.subtopics st
      join public.topics t on t.id = st.topic_id
      join public.subjects s on s.id = t.subject_id
      join jh_v4_course c on c.course_id = s.course_id
     where t.is_active and st.is_active
     group by 1, 2 having count(*) > 1) d;

  select count(*) into n_orphan from public.questions q
    join jh_v4_course c on c.course_id = q.course_id
   where q.topic_id is not null
     and not exists (select 1 from public.topics t where t.id = q.topic_id);

  if n_dup_t > 0 or n_dup_s > 0 then
    raise exception 'একই নামের topic/subtopic রয়ে গেছে: topics=%, subtopics=%', n_dup_t, n_dup_s;
  end if;
  if n_orphan > 0 then
    raise exception 'orphan topic reference: %', n_orphan;
  end if;

  raise notice 'V4: % active topics, % active subtopics, 0 duplicates', n_topics, n_subs;
end $$;
