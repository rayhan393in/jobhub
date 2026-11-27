-- ============================================================================
-- JobHub — BCS Preliminary ৯০ দিনের স্টাডি রুটিন (V3)
-- ============================================================================
-- দিন ১ = 2026-11-28 (শনিবার) · দিন 90 = 2027-02-25
--
-- প্রতিদিন ৪টি স্লট, সময় স্পেসিফিকেশন অনুযায়ী অপরিবর্তিত:
--   পি১ Main        ১৫০ মিনিট  (টপিক + সাবটপিক)
--   পি২ Second       ৭৫ মিনিট
--   পি৩/P4 Third     ৪৫ মিনিট
--   MCQ + ভুল বিশ্লেষণ ৫০ মিনিট  (P1 ৫০ + P2 ২৫ + P3/P4 ১৫ + পূর্বে-পড়া ১০ = ১০০)
--
-- শুধু রুটিনের সারি বদলায় — পুরোনো রুটিন ডিলিট হয় না (পরীক্ষা বা
-- progress থেকে রেফারেন্স থাকলে আর্কাইভ, নাহলে মুছে ফেলা হয়), ঠিক যেমন
-- bcs-routine-60day.sql করে।
--
-- ROLLBACK: পুরোনো রুটিন আর্কাইভ করা আছে (status='archived'); ফেরাতে
--   update public.routines set status='published', archived_at=null
--    where course_id = <bcs> and title_bn like 'দিন % · ফেজ %';
--   delete from public.routines where title_bn like 'দিন %· %P1 Main%' ... (৯০ দিনের সারি)
-- ============================================================================

begin;

-- পুরোনো সক্রিয় BCS রুটিন সরানো। আগে আর্কাইভ, পরে (রেফারেন্সহীন) সারি মুছে
-- ফেলা — ৬০ দিনের ফাইলে অর্ডারটা উল্টো ছিল, ফলে delete-এর guard কখনোই
-- কাজ করত না: update ঠিক তার আগেই সব সারি archived করে দিত।
update public.routines r
   set archived_at = now(), status = 'archived', updated_at = now()
  from public.courses c
 where c.id = r.course_id and c.slug = 'bcs'
   and r.status = 'published';

delete from public.routines r
using public.courses c
where c.id = r.course_id and c.slug = 'bcs'
  and r.status = 'archived'
  and not exists (select 1 from public.exam_schedules es
                   where es.routine_id = r.id
                      or r.id = any (coalesce(es.routine_ids, '{}'::uuid[])))
  and not exists (select 1 from public.study_plan_assignments a where a.routine_id = r.id)
  and not exists (select 1 from public.routine_progress rp where rp.routine_id = r.id);

commit;

-- Scratch table for the day rows. The same DDL is used by the chunked apply
-- script, which stages the days in several small calls because the whole plan
-- is larger than one Supabase SQL-editor request.
create table if not exists public.jh_r90_stage (
  day_no smallint not null,
  band text not null,
  routine_date date not null,
  phase text not null,
  week_index smallint not null,
  subject_id uuid,
  topic_bn text not null,
  subtopic_bns text[] not null default '{}',
  task_kind text not null,
  primary key (day_no, band)
);

-- ── দিন 1–4 ──
with bcs as (select id as course_id from public.courses where slug = 'bcs'),
seed(day_no, band, subject_slug, topic_bn, subtopic_bns, task_kind) as (
  values
  (1, 'p1', 'bangla', 'ধ্বনি ও বর্ণ', array['স্বরধ্বনি', 'ব্যঞ্জনধ্বনি', 'উচ্চারণ']::text[], 'study'),
  (1, 'p2', 'english', 'Voice', array['Active', 'Passive', 'tense অনুযায়ী পরিবর্তন']::text[], 'study'),
  (1, 'p3', 'bangla', 'শব্দার্থ', array['সমার্থক', 'বিপরীতার্থক']::text[], 'study'),
  (1, 'mcq', '', '', array[]::text[], 'practice'),
  (2, 'p1', 'bangla', 'শব্দ ও পদ', array['বিশেষ্য', 'বিশেষণ', 'সর্বনাম', 'ক্রিয়া', 'অব্যয়']::text[], 'study'),
  (2, 'p2', 'bd', 'সংবিধান', array['প্রস্তাবনা', 'মূলনীতি', 'তফসিল']::text[], 'study'),
  (2, 'p3', 'bangla', 'এক কথায় প্রকাশ', array[]::text[], 'study'),
  (2, 'mcq', '', '', array[]::text[], 'practice'),
  (3, 'p1', 'bangla', 'সন্ধি', array['স্বরসন্ধি', 'ব্যঞ্জনসন্ধি', 'বিসর্গসন্ধি']::text[], 'study'),
  (3, 'p2', 'international', 'বিশ্বযুদ্ধ', array['প্রথম বিশ্বযুদ্ধ', 'দ্বিতীয় বিশ্বযুদ্ধ', 'কারণ', 'ফলাফল']::text[], 'study'),
  (3, 'p3', 'bangla', 'বাগধারা ও প্রবাদ-প্রবচন', array[]::text[], 'study'),
  (3, 'mcq', '', '', array[]::text[], 'practice'),
  (4, 'p1', 'bangla', 'সমাস', array['দ্বন্দ্ব', 'দ্বিগু', 'কর্মধারয়']::text[], 'study'),
  (4, 'p2', 'math', 'বীজগণিত', array['রাশি', 'সূত্র', 'উৎপাদক']::text[], 'study'),
  (4, 'p3', 'english', 'Clauses & Phrases', array[]::text[], 'study'),
  (4, 'mcq', '', '', array[]::text[], 'practice')
),
built as (
  select b.course_id,
         s.day_no,
         date '2026-11-28' + (s.day_no - 1) as routine_date,
         ((s.day_no - 1) / 7) + 1 as week_index,
         s.band, s.topic_bn, s.subtopic_bns, s.task_kind,
         case
         when day_no <= 30 then 'ফেজ ১ · বাংলা ও English'
         when day_no <= 60 then 'ফেজ ২ · English ও বাংলাদেশ'
         when day_no <= 90 then 'ফেজ ৩ · বাকি Subject ও সমাপ্তি'
       end as phase,
         (select su.id from public.subjects su
           where su.course_id = b.course_id and su.slug = s.subject_slug limit 1) as subject_id
    from seed s cross join bcs b
)
insert into public.jh_r90_stage
  (day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind)
select day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind
  from built;

-- ── দিন 5–8 ──
with bcs as (select id as course_id from public.courses where slug = 'bcs'),
seed(day_no, band, subject_slug, topic_bn, subtopic_bns, task_kind) as (
  values
  (5, 'p1', 'bangla', 'সমাস', array['তৎপুরুষ', 'বহুব্রীহি', 'অব্যয়ীভাব']::text[], 'study'),
  (5, 'p2', 'science', 'পদার্থের অবস্থা', array['কঠিন', 'তরল', 'গ্যাসীয়']::text[], 'study'),
  (5, 'p3', 'ict', 'Database', array['DBMS', 'table', 'record', 'field']::text[], 'study'),
  (5, 'mcq', '', '', array[]::text[], 'practice'),
  (6, 'p1', 'bangla', 'কারক ও বিভক্তি', array['কর্তৃ', 'কর্ম', 'করণ', 'সম্প্রদান', 'অপাদান', 'অধিকরণ']::text[], 'study'),
  (6, 'p2', 'ict', 'Number System', array['Binary', 'Decimal', 'Octal', 'Hexadecimal']::text[], 'study'),
  (6, 'p3', 'geography', 'জলবায়ু', array['ঋতু', 'বৃষ্টিপাত', 'মৌসুমি বায়ু']::text[], 'study'),
  (6, 'mcq', '', '', array[]::text[], 'practice'),
  (7, 'p1', 'bangla', 'উপসর্গ ও প্রত্যয়', array['বাংলা উপসর্গ', 'সংস্কৃত উপসর্গ', 'কৃৎ প্রত্যয়', 'তদ্ধিত প্রত্যয়']::text[], 'study'),
  (7, 'p2', 'mental', 'Coding-Decoding', array['letter coding', 'number coding', 'symbol coding']::text[], 'study'),
  (7, 'p3', 'ethics', 'মানবাধিকার', array['মৌলিক অধিকার', 'স্বাধীনতা']::text[], 'study'),
  (7, 'mcq', '', '', array[]::text[], 'practice'),
  (8, 'p1', 'bangla', 'বাক্যতত্ত্ব', array['সরল', 'জটিল', 'যৌগিক', 'উদ্দেশ্য ও বিধেয়']::text[], 'study'),
  (8, 'p2', 'ethics', 'আইনের শাসন', array['Rule of Law', 'সমতা', 'ন্যায়বিচার']::text[], 'study'),
  (8, 'p3', 'english', 'Modifiers', array[]::text[], 'study'),
  (8, 'mcq', '', '', array[]::text[], 'practice')
),
built as (
  select b.course_id,
         s.day_no,
         date '2026-11-28' + (s.day_no - 1) as routine_date,
         ((s.day_no - 1) / 7) + 1 as week_index,
         s.band, s.topic_bn, s.subtopic_bns, s.task_kind,
         case
         when day_no <= 30 then 'ফেজ ১ · বাংলা ও English'
         when day_no <= 60 then 'ফেজ ২ · English ও বাংলাদেশ'
         when day_no <= 90 then 'ফেজ ৩ · বাকি Subject ও সমাপ্তি'
       end as phase,
         (select su.id from public.subjects su
           where su.course_id = b.course_id and su.slug = s.subject_slug limit 1) as subject_id
    from seed s cross join bcs b
)
insert into public.jh_r90_stage
  (day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind)
select day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind
  from built;

-- ── দিন 9–12 ──
with bcs as (select id as course_id from public.courses where slug = 'bcs'),
seed(day_no, band, subject_slug, topic_bn, subtopic_bns, task_kind) as (
  values
  (9, 'p1', 'bangla', 'শুদ্ধ বানান ও বাক্য শুদ্ধিকরণ', array['বানান', 'বাক্য সংশোধন']::text[], 'study'),
  (9, 'p2', 'geography', 'বিশ্ব ভূগোল', array['মহাদেশ', 'মহাসাগর', 'দেশ ও রাজধানী']::text[], 'study'),
  (9, 'p3', 'science', 'উদ্ভিদবিজ্ঞান', array['উদ্ভিদ কোষ', 'সালোকসংশ্লেষণ']::text[], 'study'),
  (9, 'mcq', '', '', array[]::text[], 'practice'),
  (10, 'p1', 'bangla', 'লিঙ্গ ও বচন', array['লিঙ্গের শ্রেণি', 'একবচন', 'বহুবচন']::text[], 'study'),
  (10, 'p2', 'international', 'স্নায়ুযুদ্ধ', array['দ্বিমেরু বিশ্ব', 'প্রধান ঘটনা']::text[], 'study'),
  (10, 'p3', 'ict', 'Programming Language', array['ভাষার ধরন', 'compiler', 'interpreter']::text[], 'study'),
  (10, 'mcq', '', '', array[]::text[], 'practice'),
  (11, 'p1', 'bangla', 'প্রাচীন সাহিত্য', array['চর্যাপদ', 'আবিষ্কার', 'কবি', 'ভাষা']::text[], 'study'),
  (11, 'p2', 'math', 'সূচক ও লগারিদম', array['সূচকের সূত্র', 'লগের নিয়ম']::text[], 'study'),
  (11, 'p3', 'mental', 'Statement & Conclusion', array[]::text[], 'study'),
  (11, 'mcq', '', '', array[]::text[], 'practice'),
  (12, 'p1', 'bangla', 'মধ্যযুগ', array['মঙ্গলকাব্য', 'মনসামঙ্গল', 'চণ্ডীমঙ্গল']::text[], 'study'),
  (12, 'p2', 'science', 'পরমাণু ও অণু', array['গঠন', 'ইলেকট্রন', 'প্রোটন', 'নিউট্রন']::text[], 'study'),
  (12, 'p3', 'geography', 'বায়ুমণ্ডল ও বায়ুপ্রবাহ', array[]::text[], 'study'),
  (12, 'mcq', '', '', array[]::text[], 'practice')
),
built as (
  select b.course_id,
         s.day_no,
         date '2026-11-28' + (s.day_no - 1) as routine_date,
         ((s.day_no - 1) / 7) + 1 as week_index,
         s.band, s.topic_bn, s.subtopic_bns, s.task_kind,
         case
         when day_no <= 30 then 'ফেজ ১ · বাংলা ও English'
         when day_no <= 60 then 'ফেজ ২ · English ও বাংলাদেশ'
         when day_no <= 90 then 'ফেজ ৩ · বাকি Subject ও সমাপ্তি'
       end as phase,
         (select su.id from public.subjects su
           where su.course_id = b.course_id and su.slug = s.subject_slug limit 1) as subject_id
    from seed s cross join bcs b
)
insert into public.jh_r90_stage
  (day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind)
select day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind
  from built;

-- ── দিন 13–16 ──
with bcs as (select id as course_id from public.courses where slug = 'bcs'),
seed(day_no, band, subject_slug, topic_bn, subtopic_bns, task_kind) as (
  values
  (13, 'p1', 'bangla', 'মধ্যযুগ', array['বৈষ্ণব পদাবলি', 'মুসলিম সাহিত্য', 'আলাওল']::text[], 'study'),
  (13, 'p2', 'bd', 'ছয় দফা ও গণঅভ্যুত্থান', array['১৯৬৬', '১৯৬৯']::text[], 'study'),
  (13, 'p3', 'ethics', 'সামাজিক ন্যায়বিচার', array[]::text[], 'study'),
  (13, 'mcq', '', '', array[]::text[], 'practice'),
  (14, 'p1', 'bangla', 'যুগবিভাগ', array['প্রাচীন', 'মধ্যযুগ', 'আধুনিক', 'নবজাগরণ']::text[], 'study'),
  (14, 'p2', 'english', 'Narration', array['Direct', 'Indirect', 'tense ও pronoun পরিবর্তন']::text[], 'study'),
  (14, 'p3', 'international', 'আন্তর্জাতিক বাণিজ্য', array['WTO', 'বাণিজ্য চুক্তি']::text[], 'study'),
  (14, 'mcq', '', '', array[]::text[], 'practice'),
  (15, 'p1', 'bangla', 'রবীন্দ্রনাথ', array['জীবনী', 'জন্ম-মৃত্যু', 'নোবেল', 'পরিচিতি']::text[], 'study'),
  (15, 'p2', 'math', 'সরল ও দ্বিঘাত সমীকরণ', array['সমাধান', 'মূল', 'উৎপাদক']::text[], 'study'),
  (15, 'p3', 'ict', 'Algorithm ও Flowchart', array[]::text[], 'study'),
  (15, 'mcq', '', '', array[]::text[], 'practice'),
  (16, 'p1', 'bangla', 'রবীন্দ্রনাথ', array['কাব্যগ্রন্থ', 'কবিতা', 'উপন্যাস', 'নাটক', 'ছোটগল্প']::text[], 'study'),
  (16, 'p2', 'international', 'IMF ও World Bank', array['প্রতিষ্ঠা', 'উদ্দেশ্য', 'কার্যাবলি']::text[], 'study'),
  (16, 'p3', 'geography', 'জীববৈচিত্র্য ও বাস্তুতন্ত্র', array[]::text[], 'study'),
  (16, 'mcq', '', '', array[]::text[], 'practice')
),
built as (
  select b.course_id,
         s.day_no,
         date '2026-11-28' + (s.day_no - 1) as routine_date,
         ((s.day_no - 1) / 7) + 1 as week_index,
         s.band, s.topic_bn, s.subtopic_bns, s.task_kind,
         case
         when day_no <= 30 then 'ফেজ ১ · বাংলা ও English'
         when day_no <= 60 then 'ফেজ ২ · English ও বাংলাদেশ'
         when day_no <= 90 then 'ফেজ ৩ · বাকি Subject ও সমাপ্তি'
       end as phase,
         (select su.id from public.subjects su
           where su.course_id = b.course_id and su.slug = s.subject_slug limit 1) as subject_id
    from seed s cross join bcs b
)
insert into public.jh_r90_stage
  (day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind)
select day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind
  from built;

-- ── দিন 17–20 ──
with bcs as (select id as course_id from public.courses where slug = 'bcs'),
seed(day_no, band, subject_slug, topic_bn, subtopic_bns, task_kind) as (
  values
  (17, 'p1', 'bangla', 'নজরুল', array['জীবনী', 'বিদ্রোহী কবিতা', 'কাব্যগ্রন্থ']::text[], 'study'),
  (17, 'p2', 'math', 'জ্যামিতি', array['ত্রিভুজ', 'চতুর্ভুজ', 'বৃত্ত']::text[], 'study'),
  (17, 'p3', 'english', 'Gerund, Infinitive & Participle', array[]::text[], 'study'),
  (17, 'mcq', '', '', array[]::text[], 'practice'),
  (18, 'p1', 'bangla', 'নজরুল', array['গান', 'গজল', 'নাটক', 'সাহিত্যকর্ম']::text[], 'study'),
  (18, 'p2', 'bd', '১৯৭০ সালের নির্বাচন', array['নির্বাচনের ফল', 'রাজনৈতিক গুরুত্ব']::text[], 'study'),
  (18, 'p3', 'science', 'DNA, RNA ও বংশগতি', array[]::text[], 'study'),
  (18, 'mcq', '', '', array[]::text[], 'practice'),
  (19, 'p1', 'bangla', 'মাইকেল মধুসূদন', array['জীবনী', 'মেঘনাদবধ', 'অমিত্রাক্ষর ছন্দ']::text[], 'study'),
  (19, 'p2', 'ict', 'Operating System', array['Windows', 'Linux', 'functions']::text[], 'study'),
  (19, 'p3', 'mental', 'Syllogism', array[]::text[], 'study'),
  (19, 'mcq', '', '', array[]::text[], 'practice'),
  (20, 'p1', 'bangla', 'বঙ্কিমচন্দ্র', array['জীবনী', 'উপন্যাস', 'আনন্দমঠ', 'বন্দেমাতরম']::text[], 'study'),
  (20, 'p2', 'geography', 'পাহাড়, পর্বত ও মালভূমি', array[]::text[], 'study'),
  (20, 'p3', 'ethics', 'দুর্নীতি', array['কারণ', 'প্রভাব', 'প্রতিরোধ']::text[], 'study'),
  (20, 'mcq', '', '', array[]::text[], 'practice')
),
built as (
  select b.course_id,
         s.day_no,
         date '2026-11-28' + (s.day_no - 1) as routine_date,
         ((s.day_no - 1) / 7) + 1 as week_index,
         s.band, s.topic_bn, s.subtopic_bns, s.task_kind,
         case
         when day_no <= 30 then 'ফেজ ১ · বাংলা ও English'
         when day_no <= 60 then 'ফেজ ২ · English ও বাংলাদেশ'
         when day_no <= 90 then 'ফেজ ৩ · বাকি Subject ও সমাপ্তি'
       end as phase,
         (select su.id from public.subjects su
           where su.course_id = b.course_id and su.slug = s.subject_slug limit 1) as subject_id
    from seed s cross join bcs b
)
insert into public.jh_r90_stage
  (day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind)
select day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind
  from built;

-- ── দিন 21–24 ──
with bcs as (select id as course_id from public.courses where slug = 'bcs'),
seed(day_no, band, subject_slug, topic_bn, subtopic_bns, task_kind) as (
  values
  (21, 'p1', 'bangla', 'শরৎচন্দ্র ও বেগম রোকেয়া', array['জীবনী', 'উপন্যাস', 'নারী জাগরণ']::text[], 'study'),
  (21, 'p2', 'english', 'Transformation', array['affirmative', 'negative', 'interrogative', 'degree']::text[], 'study'),
  (21, 'p3', 'international', 'মানবাধিকার', array['ঘোষণা', 'সংস্থা', 'চুক্তি']::text[], 'study'),
  (21, 'mcq', '', '', array[]::text[], 'practice'),
  (22, 'p1', 'bangla', 'অন্যান্য সাহিত্যিক', array['বিদ্যাসাগর', 'দীনবন্ধু', 'জসীমউদ্দীন', 'জীবনানন্দ']::text[], 'study'),
  (22, 'p2', 'math', 'পরিমিতি', array['ক্ষেত্রফল', 'পরিসীমা', 'আয়তন']::text[], 'study'),
  (22, 'p3', 'ict', 'AI ও Machine Learning', array[]::text[], 'study'),
  (22, 'mcq', '', '', array[]::text[], 'practice'),
  (23, 'p1', 'bangla', 'উপন্যাস', array['ঔপন্যাসিক', 'বিখ্যাত রচনা', 'চরিত্র']::text[], 'study'),
  (23, 'p2', 'science', 'রাসায়নিক বিক্রিয়া', array['অম্ল', 'ক্ষার', 'লবণ', 'pH']::text[], 'study'),
  (23, 'p3', 'geography', 'দুর্যোগ ব্যবস্থাপনা', array['প্রস্তুতি', 'সতর্কীকরণ', 'পুনর্বাসন']::text[], 'study'),
  (23, 'mcq', '', '', array[]::text[], 'practice'),
  (24, 'p1', 'bangla', 'নাটক', array['নাট্যকার', 'বিখ্যাত নাটক', 'বিষয়বস্তু']::text[], 'study'),
  (24, 'p2', 'mental', 'Direction Sense ও Blood Relation', array[]::text[], 'study'),
  (24, 'p3', 'english', 'Sentence Completion', array[]::text[], 'study'),
  (24, 'mcq', '', '', array[]::text[], 'practice')
),
built as (
  select b.course_id,
         s.day_no,
         date '2026-11-28' + (s.day_no - 1) as routine_date,
         ((s.day_no - 1) / 7) + 1 as week_index,
         s.band, s.topic_bn, s.subtopic_bns, s.task_kind,
         case
         when day_no <= 30 then 'ফেজ ১ · বাংলা ও English'
         when day_no <= 60 then 'ফেজ ২ · English ও বাংলাদেশ'
         when day_no <= 90 then 'ফেজ ৩ · বাকি Subject ও সমাপ্তি'
       end as phase,
         (select su.id from public.subjects su
           where su.course_id = b.course_id and su.slug = s.subject_slug limit 1) as subject_id
    from seed s cross join bcs b
)
insert into public.jh_r90_stage
  (day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind)
select day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind
  from built;

-- ── দিন 25–28 ──
with bcs as (select id as course_id from public.courses where slug = 'bcs'),
seed(day_no, band, subject_slug, topic_bn, subtopic_bns, task_kind) as (
  values
  (25, 'p1', 'bangla', 'ছোটগল্প', array['গল্পকার', 'বিখ্যাত গল্প', 'সাহিত্যিক পরিচিতি']::text[], 'study'),
  (25, 'p2', 'bd', 'প্রশাসন ও স্থানীয় সরকার', array['প্রশাসনিক কাঠামো', 'স্থানীয় প্রতিষ্ঠান']::text[], 'study'),
  (25, 'p3', 'ethics', 'নারী-পুরুষ সমতা ও অন্তর্ভুক্তি', array[]::text[], 'study'),
  (25, 'mcq', '', '', array[]::text[], 'practice'),
  (26, 'p1', 'english', 'Parts of Speech', array['Noun', 'Pronoun', 'Adjective', 'Verb', 'Adverb', 'Preposition', 'Conjunction', 'Interjection']::text[], 'study'),
  (26, 'p2', 'math', 'LCM ও GCD', array['গুণনীয়ক', 'গুণিতক', 'প্রয়োগ']::text[], 'study'),
  (26, 'p3', 'ict', 'IoT', array['সেন্সর', 'সংযোগ', 'ব্যবহার']::text[], 'study'),
  (26, 'mcq', '', '', array[]::text[], 'practice'),
  (27, 'p1', 'english', 'Tense', array['১২টি tense', 'structure', 'usage']::text[], 'study'),
  (27, 'p2', 'science', 'মৌল ও পর্যায় সারণি', array['পর্যায়', 'গ্রুপ', 'ধাতু', 'অধাতু']::text[], 'study'),
  (27, 'p3', 'geography', 'ভূমিধস, খরা ও নদীভাঙন', array[]::text[], 'study'),
  (27, 'mcq', '', '', array[]::text[], 'practice'),
  (28, 'p1', 'english', 'Subject-Verb Agreement', array['subject number', 'indefinite pronoun', 'exceptions']::text[], 'study'),
  (28, 'p2', 'international', 'NATO ও সামরিক জোট', array['সদস্য', 'উদ্দেশ্য', 'ভূমিকা']::text[], 'study'),
  (28, 'p3', 'mental', 'Cause & Effect', array[]::text[], 'study'),
  (28, 'mcq', '', '', array[]::text[], 'practice')
),
built as (
  select b.course_id,
         s.day_no,
         date '2026-11-28' + (s.day_no - 1) as routine_date,
         ((s.day_no - 1) / 7) + 1 as week_index,
         s.band, s.topic_bn, s.subtopic_bns, s.task_kind,
         case
         when day_no <= 30 then 'ফেজ ১ · বাংলা ও English'
         when day_no <= 60 then 'ফেজ ২ · English ও বাংলাদেশ'
         when day_no <= 90 then 'ফেজ ৩ · বাকি Subject ও সমাপ্তি'
       end as phase,
         (select su.id from public.subjects su
           where su.course_id = b.course_id and su.slug = s.subject_slug limit 1) as subject_id
    from seed s cross join bcs b
)
insert into public.jh_r90_stage
  (day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind)
select day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind
  from built;

-- ── দিন 29–32 ──
with bcs as (select id as course_id from public.courses where slug = 'bcs'),
seed(day_no, band, subject_slug, topic_bn, subtopic_bns, task_kind) as (
  values
  (29, 'p1', 'english', 'Articles', array['a', 'an', 'the', 'zero article', 'special uses']::text[], 'study'),
  (29, 'p2', 'bd', 'নির্বাচন ব্যবস্থা ও সাংবিধানিক প্রতিষ্ঠান', array[]::text[], 'study'),
  (29, 'p3', 'science', 'ধাতু, অধাতু ও সংকর ধাতু', array[]::text[], 'study'),
  (29, 'mcq', '', '', array[]::text[], 'practice'),
  (30, 'p1', 'english', 'Prepositions', array['time', 'place', 'direction', 'phrase preposition']::text[], 'study'),
  (30, 'p2', 'math', 'মিশ্রণ ও ঐকিক নিয়ম', array['অনুপাত', 'একক নিয়ম', 'প্রয়োগ']::text[], 'study'),
  (30, 'p3', 'ethics', 'সরকারি নীতি ও প্রশাসন', array[]::text[], 'study'),
  (30, 'mcq', '', '', array[]::text[], 'practice'),
  (31, 'p1', 'english', 'Right Form of Verbs', array['tense', 'conditional', 'subject agreement']::text[], 'study'),
  (31, 'p2', 'international', 'বিপ্লব ও রাজনৈতিক পরিবর্তন', array[]::text[], 'study'),
  (31, 'p3', 'bangla', 'সাহিত্যিক পরিচিতি', array['ছদ্মনাম', 'উপাধি', 'পুরস্কার']::text[], 'study'),
  (31, 'mcq', '', '', array[]::text[], 'practice'),
  (32, 'p1', 'english', 'Voice', array['active-passive', 'modal', 'imperative']::text[], 'study'),
  (32, 'p2', 'science', 'বল ও গতি', array['নিউটনের সূত্র', 'ত্বরণ', 'ভরবেগ']::text[], 'study'),
  (32, 'p3', 'english', 'Pronoun Reference', array[]::text[], 'study'),
  (32, 'mcq', '', '', array[]::text[], 'practice')
),
built as (
  select b.course_id,
         s.day_no,
         date '2026-11-28' + (s.day_no - 1) as routine_date,
         ((s.day_no - 1) / 7) + 1 as week_index,
         s.band, s.topic_bn, s.subtopic_bns, s.task_kind,
         case
         when day_no <= 30 then 'ফেজ ১ · বাংলা ও English'
         when day_no <= 60 then 'ফেজ ২ · English ও বাংলাদেশ'
         when day_no <= 90 then 'ফেজ ৩ · বাকি Subject ও সমাপ্তি'
       end as phase,
         (select su.id from public.subjects su
           where su.course_id = b.course_id and su.slug = s.subject_slug limit 1) as subject_id
    from seed s cross join bcs b
)
insert into public.jh_r90_stage
  (day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind)
select day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind
  from built;

-- ── দিন 33–36 ──
with bcs as (select id as course_id from public.courses where slug = 'bcs'),
seed(day_no, band, subject_slug, topic_bn, subtopic_bns, task_kind) as (
  values
  (33, 'p1', 'english', 'Narration', array['assertive', 'interrogative', 'imperative', 'exclamatory']::text[], 'study'),
  (33, 'p2', 'mental', 'Ranking & Arrangement', array[]::text[], 'study'),
  (33, 'p3', 'bd', 'অর্থনীতি', array['GDP', 'GNI', 'মাথাপিছু আয়', 'প্রবৃদ্ধি']::text[], 'study'),
  (33, 'mcq', '', '', array[]::text[], 'practice'),
  (34, 'p1', 'english', 'Transformation', array['degree', 'voice', 'sentence type']::text[], 'study'),
  (34, 'p2', 'international', 'বিশ্ব ভূরাজনীতি ও সংঘাত', array[]::text[], 'study'),
  (34, 'p3', 'geography', 'পরিবেশ সংরক্ষণ আইন', array[]::text[], 'study'),
  (34, 'mcq', '', '', array[]::text[], 'practice'),
  (35, 'p1', 'english', 'Synonyms & Antonyms', array['common words', 'contextual meaning']::text[], 'study'),
  (35, 'p2', 'science', 'কাজ, শক্তি ও ক্ষমতা', array[]::text[], 'study'),
  (35, 'p3', 'ict', 'Cloud Computing', array[]::text[], 'study'),
  (35, 'mcq', '', '', array[]::text[], 'practice'),
  (36, 'p1', 'english', 'Idioms & Phrases', array['common idioms', 'phrasal expressions']::text[], 'study'),
  (36, 'p2', 'math', 'সেট ও ফাংশন', array['set operations', 'domain', 'range']::text[], 'study'),
  (36, 'p3', 'ethics', 'টেকসই উন্নয়ন', array[]::text[], 'study'),
  (36, 'mcq', '', '', array[]::text[], 'practice')
),
built as (
  select b.course_id,
         s.day_no,
         date '2026-11-28' + (s.day_no - 1) as routine_date,
         ((s.day_no - 1) / 7) + 1 as week_index,
         s.band, s.topic_bn, s.subtopic_bns, s.task_kind,
         case
         when day_no <= 30 then 'ফেজ ১ · বাংলা ও English'
         when day_no <= 60 then 'ফেজ ২ · English ও বাংলাদেশ'
         when day_no <= 90 then 'ফেজ ৩ · বাকি Subject ও সমাপ্তি'
       end as phase,
         (select su.id from public.subjects su
           where su.course_id = b.course_id and su.slug = s.subject_slug limit 1) as subject_id
    from seed s cross join bcs b
)
insert into public.jh_r90_stage
  (day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind)
select day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind
  from built;

-- ── দিন 37–40 ──
with bcs as (select id as course_id from public.courses where slug = 'bcs'),
seed(day_no, band, subject_slug, topic_bn, subtopic_bns, task_kind) as (
  values
  (37, 'p1', 'english', 'Spelling', array['commonly confused', 'correct spelling']::text[], 'study'),
  (37, 'p2', 'bd', 'বাজেট ও রাজস্ব', array['জাতীয় বাজেট', 'কর', 'উন্নয়ন ব্যয়']::text[], 'study'),
  (37, 'p3', 'international', 'শরণার্থী ও অভিবাসন', array[]::text[], 'study'),
  (37, 'mcq', '', '', array[]::text[], 'practice'),
  (38, 'p1', 'english', 'Error Correction', array['grammar', 'usage', 'sentence errors']::text[], 'study'),
  (38, 'p2', 'geography', 'বাংলাদেশের বন ও প্রাকৃতিক সম্পদ', array[]::text[], 'study'),
  (38, 'p3', 'science', 'তাপ ও তাপগতিবিদ্যা', array[]::text[], 'study'),
  (38, 'mcq', '', '', array[]::text[], 'practice'),
  (39, 'p1', 'english', 'Analogy', array['word relationship', 'logical analogy']::text[], 'study'),
  (39, 'p2', 'ict', 'Input ও Output Devices', array['keyboard', 'mouse', 'printer', 'monitor']::text[], 'study'),
  (39, 'p3', 'mental', 'Statement & Assumption', array[]::text[], 'study'),
  (39, 'mcq', '', '', array[]::text[], 'practice'),
  (40, 'p1', 'english', 'Clauses & Phrases', array['noun clause', 'adjective clause', 'adverb clause', 'phrase types']::text[], 'study'),
  (40, 'p2', 'math', 'ধারার যোগফল', array['sequence', 'arithmetic', 'geometric series']::text[], 'study'),
  (40, 'p3', 'bd', 'কৃষি ও খাদ্য নিরাপত্তা', array[]::text[], 'study'),
  (40, 'mcq', '', '', array[]::text[], 'practice')
),
built as (
  select b.course_id,
         s.day_no,
         date '2026-11-28' + (s.day_no - 1) as routine_date,
         ((s.day_no - 1) / 7) + 1 as week_index,
         s.band, s.topic_bn, s.subtopic_bns, s.task_kind,
         case
         when day_no <= 30 then 'ফেজ ১ · বাংলা ও English'
         when day_no <= 60 then 'ফেজ ২ · English ও বাংলাদেশ'
         when day_no <= 90 then 'ফেজ ৩ · বাকি Subject ও সমাপ্তি'
       end as phase,
         (select su.id from public.subjects su
           where su.course_id = b.course_id and su.slug = s.subject_slug limit 1) as subject_id
    from seed s cross join bcs b
)
insert into public.jh_r90_stage
  (day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind)
select day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind
  from built;

-- ── দিন 41–44 ──
with bcs as (select id as course_id from public.courses where slug = 'bcs'),
seed(day_no, band, subject_slug, topic_bn, subtopic_bns, task_kind) as (
  values
  (41, 'p1', 'english', 'Modifiers', array['misplaced', 'dangling', 'adjective', 'adverb']::text[], 'study'),
  (41, 'p2', 'international', 'নিরস্ত্রীকরণ ও পারমাণবিক চুক্তি', array[]::text[], 'study'),
  (41, 'p3', 'geography', 'মানচিত্র ও সময় অঞ্চল', array[]::text[], 'study'),
  (41, 'mcq', '', '', array[]::text[], 'practice'),
  (42, 'p1', 'english', 'Gerund, Infinitive & Participle', array['forms', 'usage', 'differences']::text[], 'study'),
  (42, 'p2', 'science', 'উদ্ভিদবিজ্ঞান', array['উদ্ভিদ টিস্যু', 'প্রজনন', 'সালোকসংশ্লেষণ']::text[], 'study'),
  (42, 'p3', 'ict', 'Blockchain', array[]::text[], 'study'),
  (42, 'mcq', '', '', array[]::text[], 'practice'),
  (43, 'p1', 'english', 'Sentence Completion', array['context', 'grammar', 'vocabulary']::text[], 'study'),
  (43, 'p2', 'math', 'পরিসংখ্যান', array['গড়', 'মধ্যক', 'প্রচুরক', 'range']::text[], 'study'),
  (43, 'p3', 'ethics', 'আন্তর্জাতিক নৈতিক মানদণ্ড', array[]::text[], 'study'),
  (43, 'mcq', '', '', array[]::text[], 'practice'),
  (44, 'p1', 'english', 'Pronoun Reference & Conjunctions', array['reference', 'agreement', 'connectors']::text[], 'study'),
  (44, 'p2', 'bd', 'শিল্প ও রপ্তানি', array['RMG', 'শিল্পনীতি', 'রপ্তানি']::text[], 'study'),
  (44, 'p3', 'geography', 'অক্ষাংশ ও দ্রাঘিমাংশ', array[]::text[], 'study'),
  (44, 'mcq', '', '', array[]::text[], 'practice')
),
built as (
  select b.course_id,
         s.day_no,
         date '2026-11-28' + (s.day_no - 1) as routine_date,
         ((s.day_no - 1) / 7) + 1 as week_index,
         s.band, s.topic_bn, s.subtopic_bns, s.task_kind,
         case
         when day_no <= 30 then 'ফেজ ১ · বাংলা ও English'
         when day_no <= 60 then 'ফেজ ২ · English ও বাংলাদেশ'
         when day_no <= 90 then 'ফেজ ৩ · বাকি Subject ও সমাপ্তি'
       end as phase,
         (select su.id from public.subjects su
           where su.course_id = b.course_id and su.slug = s.subject_slug limit 1) as subject_id
    from seed s cross join bcs b
)
insert into public.jh_r90_stage
  (day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind)
select day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind
  from built;

-- ── দিন 45–48 ──
with bcs as (select id as course_id from public.courses where slug = 'bcs'),
seed(day_no, band, subject_slug, topic_bn, subtopic_bns, task_kind) as (
  values
  (45, 'p1', 'english', 'Literary Periods', array['Renaissance', 'Romantic', 'Victorian', 'Modern']::text[], 'study'),
  (45, 'p2', 'international', 'আন্তর্জাতিক সম্মেলন ও সামিট', array[]::text[], 'study'),
  (45, 'p3', 'science', 'পরিবেশবিজ্ঞান ও বাস্তুতন্ত্র', array[]::text[], 'study'),
  (45, 'mcq', '', '', array[]::text[], 'practice'),
  (46, 'p1', 'english', 'Major Authors', array['Shakespeare', 'Milton', 'Wordsworth', 'Dickens']::text[], 'study'),
  (46, 'p2', 'math', 'সম্ভাবনা', array['ঘটনা', 'sample space', 'probability']::text[], 'study'),
  (46, 'p3', 'ict', 'Big Data', array[]::text[], 'study'),
  (46, 'mcq', '', '', array[]::text[], 'practice'),
  (47, 'p1', 'english', 'Major Literary Works', array['author', 'title', 'genre']::text[], 'study'),
  (47, 'p2', 'bd', 'ব্যাংকিং ও আর্থিক ব্যবস্থা', array['বাংলাদেশ ব্যাংক', 'বাণিজ্যিক ব্যাংক']::text[], 'study'),
  (47, 'p3', 'mental', 'Logical Deduction', array[]::text[], 'study'),
  (47, 'mcq', '', '', array[]::text[], 'practice'),
  (48, 'p1', 'english', 'Poetry & Poets', array['poet', 'poem', 'literary period']::text[], 'study'),
  (48, 'p2', 'international', 'আফ্রিকান ইউনিয়ন ও অন্যান্য সংস্থা', array[]::text[], 'study'),
  (48, 'p3', 'geography', 'সমুদ্র, প্রণালি ও দ্বীপ', array[]::text[], 'study'),
  (48, 'mcq', '', '', array[]::text[], 'practice')
),
built as (
  select b.course_id,
         s.day_no,
         date '2026-11-28' + (s.day_no - 1) as routine_date,
         ((s.day_no - 1) / 7) + 1 as week_index,
         s.band, s.topic_bn, s.subtopic_bns, s.task_kind,
         case
         when day_no <= 30 then 'ফেজ ১ · বাংলা ও English'
         when day_no <= 60 then 'ফেজ ২ · English ও বাংলাদেশ'
         when day_no <= 90 then 'ফেজ ৩ · বাকি Subject ও সমাপ্তি'
       end as phase,
         (select su.id from public.subjects su
           where su.course_id = b.course_id and su.slug = s.subject_slug limit 1) as subject_id
    from seed s cross join bcs b
)
insert into public.jh_r90_stage
  (day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind)
select day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind
  from built;

-- ── দিন 49–52 ──
with bcs as (select id as course_id from public.courses where slug = 'bcs'),
seed(day_no, band, subject_slug, topic_bn, subtopic_bns, task_kind) as (
  values
  (49, 'p1', 'english', 'Drama & Dramatists', array['plays', 'playwrights', 'characters']::text[], 'study'),
  (49, 'p2', 'science', 'জেনেটিক্স', array['DNA', 'RNA', 'বংশগতি', 'জিন']::text[], 'study'),
  (49, 'p3', 'ethics', 'সামাজিক দায়িত্ব', array[]::text[], 'study'),
  (49, 'mcq', '', '', array[]::text[], 'practice'),
  (50, 'p1', 'english', 'Novelists & Novels', array['novelist', 'novel', 'characters']::text[], 'study'),
  (50, 'p2', 'bd', 'জনসংখ্যা, শিক্ষা ও স্বাস্থ্য', array[]::text[], 'study'),
  (50, 'p3', 'ict', 'Robotics', array[]::text[], 'study'),
  (50, 'mcq', '', '', array[]::text[], 'practice'),
  (51, 'p1', 'english', 'Literary Movements', array['Romanticism', 'Realism', 'Modernism']::text[], 'study'),
  (51, 'p2', 'math', 'করণী', array['surds', 'simplification']::text[], 'study'),
  (51, 'p3', 'mental', 'Course of Action', array[]::text[], 'study'),
  (51, 'mcq', '', '', array[]::text[], 'practice'),
  (52, 'p1', 'english', 'Literary Terms', array['metaphor', 'simile', 'irony', 'sonnet']::text[], 'study'),
  (52, 'p2', 'bd', 'জ্বালানি ও প্রাকৃতিক সম্পদ', array[]::text[], 'study'),
  (52, 'p3', 'geography', 'মরুভূমি ও তৃণভূমি', array[]::text[], 'study'),
  (52, 'mcq', '', '', array[]::text[], 'practice')
),
built as (
  select b.course_id,
         s.day_no,
         date '2026-11-28' + (s.day_no - 1) as routine_date,
         ((s.day_no - 1) / 7) + 1 as week_index,
         s.band, s.topic_bn, s.subtopic_bns, s.task_kind,
         case
         when day_no <= 30 then 'ফেজ ১ · বাংলা ও English'
         when day_no <= 60 then 'ফেজ ২ · English ও বাংলাদেশ'
         when day_no <= 90 then 'ফেজ ৩ · বাকি Subject ও সমাপ্তি'
       end as phase,
         (select su.id from public.subjects su
           where su.course_id = b.course_id and su.slug = s.subject_slug limit 1) as subject_id
    from seed s cross join bcs b
)
insert into public.jh_r90_stage
  (day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind)
select day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind
  from built;

-- ── দিন 53–56 ──
with bcs as (select id as course_id from public.courses where slug = 'bcs'),
seed(day_no, band, subject_slug, topic_bn, subtopic_bns, task_kind) as (
  values
  (53, 'p1', 'english', 'Literary Quotations & Awards', array['famous quotations', 'Nobel', 'awards']::text[], 'study'),
  (53, 'p2', 'math', 'স্থানাঙ্ক জ্যামিতি', array['coordinates', 'distance', 'graph']::text[], 'study'),
  (53, 'p3', 'ict', 'বাংলাদেশের ICT নীতি', array[]::text[], 'study'),
  (53, 'mcq', '', '', array[]::text[], 'practice'),
  (54, 'p1', 'bd', 'English P1 Revision', array['grammar rules', 'vocabulary', 'error correction']::text[], 'study'),
  (54, 'p2', 'bd', 'বৈদেশিক সম্পর্ক ও উন্নয়ন পরিকল্পনা', array[]::text[], 'study'),
  (54, 'p3', 'mental', 'Word Formation', array[]::text[], 'study'),
  (54, 'mcq', '', '', array[]::text[], 'practice'),
  (55, 'p1', 'bd', 'English Literature Revision', array['authors', 'works', 'periods', 'movements']::text[], 'study'),
  (55, 'p2', 'bd', 'মেগা প্রকল্প', array['প্রকল্প', 'অবস্থান', 'উদ্দেশ্য']::text[], 'study'),
  (55, 'p3', 'geography', 'আন্তর্জাতিক পরিবেশ সংস্থা', array[]::text[], 'study'),
  (55, 'mcq', '', '', array[]::text[], 'practice'),
  (56, 'p1', 'bd', 'ভাষা আন্দোলন', array['১৯৫২', 'রাষ্ট্রভাষা', 'শহিদ', 'ঘটনাপ্রবাহ']::text[], 'study'),
  (56, 'p2', 'math', 'অসমতা', array['linear inequality', 'solution']::text[], 'study'),
  (56, 'p3', 'science', 'বিবর্তন', array[]::text[], 'study'),
  (56, 'mcq', '', '', array[]::text[], 'practice')
),
built as (
  select b.course_id,
         s.day_no,
         date '2026-11-28' + (s.day_no - 1) as routine_date,
         ((s.day_no - 1) / 7) + 1 as week_index,
         s.band, s.topic_bn, s.subtopic_bns, s.task_kind,
         case
         when day_no <= 30 then 'ফেজ ১ · বাংলা ও English'
         when day_no <= 60 then 'ফেজ ২ · English ও বাংলাদেশ'
         when day_no <= 90 then 'ফেজ ৩ · বাকি Subject ও সমাপ্তি'
       end as phase,
         (select su.id from public.subjects su
           where su.course_id = b.course_id and su.slug = s.subject_slug limit 1) as subject_id
    from seed s cross join bcs b
)
insert into public.jh_r90_stage
  (day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind)
select day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind
  from built;

-- ── দিন 57–60 ──
with bcs as (select id as course_id from public.courses where slug = 'bcs'),
seed(day_no, band, subject_slug, topic_bn, subtopic_bns, task_kind) as (
  values
  (57, 'p1', 'bd', 'মুক্তিযুদ্ধ', array['পটভূমি', 'সেক্টর', 'কমান্ডার', 'মুজিবনগর সরকার', 'অভিযান', 'বিজয়']::text[], 'study'),
  (57, 'p2', 'international', 'উপনিবেশবাদ ও স্বাধীনতা আন্দোলন', array[]::text[], 'study'),
  (57, 'p3', 'ict', 'Cyber Law', array[]::text[], 'study'),
  (57, 'mcq', '', '', array[]::text[], 'practice'),
  (58, 'p1', 'bd', 'বঙ্গবন্ধু ও স্বাধীনতা', array['স্বাধীনতার ঘোষণা', 'ঐতিহাসিক ভাষণ']::text[], 'study'),
  (58, 'p2', 'bd', 'প্রাচীন ও মধ্যযুগের বাংলা', array['রাজবংশ', 'শাসনব্যবস্থা']::text[], 'study'),
  (58, 'p3', 'mental', 'Paper Folding & Cutting', array[]::text[], 'study'),
  (58, 'mcq', '', '', array[]::text[], 'practice'),
  (59, 'p1', 'bd', 'সংবিধান ও রাষ্ট্রব্যবস্থা', array['রাষ্ট্রপতি', 'প্রধানমন্ত্রী', 'সংসদ', 'বিচার বিভাগ']::text[], 'study'),
  (59, 'p2', 'bd', 'ব্রিটিশ শাসন', array['পলাশীর যুদ্ধ', 'স্থায়ী বন্দোবস্ত']::text[], 'study'),
  (59, 'p3', 'geography', 'SDGs ও পরিবেশ', array[]::text[], 'study'),
  (59, 'mcq', '', '', array[]::text[], 'practice'),
  (60, 'p1', 'bd', 'মুক্তিযুদ্ধের আন্তর্জাতিক প্রেক্ষাপট', array['বিশ্বশক্তি', 'স্বীকৃতি', 'আন্তর্জাতিক সহায়তা']::text[], 'study'),
  (60, 'p2', 'bd', 'বঙ্গভঙ্গ ও নবজাগরণ', array[]::text[], 'study'),
  (60, 'p3', 'science', 'জৈবপ্রযুক্তি', array[]::text[], 'study'),
  (60, 'mcq', '', '', array[]::text[], 'practice')
),
built as (
  select b.course_id,
         s.day_no,
         date '2026-11-28' + (s.day_no - 1) as routine_date,
         ((s.day_no - 1) / 7) + 1 as week_index,
         s.band, s.topic_bn, s.subtopic_bns, s.task_kind,
         case
         when day_no <= 30 then 'ফেজ ১ · বাংলা ও English'
         when day_no <= 60 then 'ফেজ ২ · English ও বাংলাদেশ'
         when day_no <= 90 then 'ফেজ ৩ · বাকি Subject ও সমাপ্তি'
       end as phase,
         (select su.id from public.subjects su
           where su.course_id = b.course_id and su.slug = s.subject_slug limit 1) as subject_id
    from seed s cross join bcs b
)
insert into public.jh_r90_stage
  (day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind)
select day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind
  from built;

-- ── দিন 61–64 ──
with bcs as (select id as course_id from public.courses where slug = 'bcs'),
seed(day_no, band, subject_slug, topic_bn, subtopic_bns, task_kind) as (
  values
  (61, 'p1', 'international', 'জাতিসংঘ', array['UNGA', 'Security Council', 'ICJ', 'Secretariat']::text[], 'study'),
  (61, 'p2', 'bd', 'জাতীয় প্রতীক ও দিবস', array[]::text[], 'study'),
  (61, 'p3', 'mental', 'Mirror & Water Image', array[]::text[], 'study'),
  (61, 'mcq', '', '', array[]::text[], 'practice'),
  (62, 'p1', 'international', 'আন্তর্জাতিক সংস্থা', array['WHO', 'UNESCO', 'UNICEF', 'ILO', 'FAO']::text[], 'study'),
  (62, 'p2', 'bd', 'সংস্কৃতি ও ঐতিহ্য', array[]::text[], 'study'),
  (62, 'p3', 'science', 'শিল্প রসায়ন', array[]::text[], 'study'),
  (62, 'mcq', '', '', array[]::text[], 'practice'),
  (63, 'p1', 'international', 'আঞ্চলিক সংস্থা', array['SAARC', 'ASEAN', 'EU', 'OIC']::text[], 'study'),
  (63, 'p2', 'bd', 'পরিবহন ও যোগাযোগ', array[]::text[], 'study'),
  (63, 'p3', 'mental', 'Embedded Figures', array[]::text[], 'study'),
  (63, 'mcq', '', '', array[]::text[], 'practice'),
  (64, 'p1', 'international', 'আন্তর্জাতিক চুক্তি', array['Paris Agreement', 'জলবায়ু চুক্তি']::text[], 'study'),
  (64, 'p2', 'geography', 'উপকূলীয় অঞ্চল ও সুন্দরবন', array[]::text[], 'study'),
  (64, 'p3', 'science', 'পলিমার ও দৈনন্দিন রসায়ন', array[]::text[], 'study'),
  (64, 'mcq', '', '', array[]::text[], 'practice')
),
built as (
  select b.course_id,
         s.day_no,
         date '2026-11-28' + (s.day_no - 1) as routine_date,
         ((s.day_no - 1) / 7) + 1 as week_index,
         s.band, s.topic_bn, s.subtopic_bns, s.task_kind,
         case
         when day_no <= 30 then 'ফেজ ১ · বাংলা ও English'
         when day_no <= 60 then 'ফেজ ২ · English ও বাংলাদেশ'
         when day_no <= 90 then 'ফেজ ৩ · বাকি Subject ও সমাপ্তি'
       end as phase,
         (select su.id from public.subjects su
           where su.course_id = b.course_id and su.slug = s.subject_slug limit 1) as subject_id
    from seed s cross join bcs b
)
insert into public.jh_r90_stage
  (day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind)
select day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind
  from built;

-- ── দিন 65–68 ──
with bcs as (select id as course_id from public.courses where slug = 'bcs'),
seed(day_no, band, subject_slug, topic_bn, subtopic_bns, task_kind) as (
  values
  (65, 'p1', 'geography', 'বাংলাদেশের ভূগোল', array['অবস্থান', 'সীমানা', 'আয়তন', 'বিভাগ', 'জেলা']::text[], 'study'),
  (65, 'p2', 'geography', 'সমুদ্র, প্রণালি ও দ্বীপ', array[]::text[], 'study'),
  (65, 'p3', 'mental', 'Cube & Dice', array[]::text[], 'study'),
  (65, 'mcq', '', '', array[]::text[], 'practice'),
  (66, 'p1', 'geography', 'বাংলাদেশের নদ-নদী', array['প্রধান নদী', 'উপনদী', 'শাখানদী']::text[], 'study'),
  (66, 'p2', 'geography', 'মরুভূমি ও তৃণভূমি', array[]::text[], 'study'),
  (66, 'p3', 'science', 'পারমাণবিক শক্তি', array[]::text[], 'study'),
  (66, 'mcq', '', '', array[]::text[], 'practice'),
  (67, 'p1', 'geography', 'পরিবেশ দূষণ', array['বায়ু', 'পানি', 'মাটি', 'শব্দ']::text[], 'study'),
  (67, 'p2', 'international', 'বিশ্ব ভূরাজনীতি (Geopolitics)', array[]::text[], 'study'),
  (67, 'p3', 'mental', 'Figure Rotation', array[]::text[], 'study'),
  (67, 'mcq', '', '', array[]::text[], 'practice'),
  (68, 'p1', 'geography', 'জলবায়ু পরিবর্তন', array['Global Warming', 'Greenhouse Effect']::text[], 'study'),
  (68, 'p2', 'international', 'সমুদ্রপথ ও কৌশলগত অঞ্চল', array[]::text[], 'study'),
  (68, 'p3', 'science', 'জ্বালানি ও পেট্রোকেমিক্যাল', array[]::text[], 'study'),
  (68, 'mcq', '', '', array[]::text[], 'practice')
),
built as (
  select b.course_id,
         s.day_no,
         date '2026-11-28' + (s.day_no - 1) as routine_date,
         ((s.day_no - 1) / 7) + 1 as week_index,
         s.band, s.topic_bn, s.subtopic_bns, s.task_kind,
         case
         when day_no <= 30 then 'ফেজ ১ · বাংলা ও English'
         when day_no <= 60 then 'ফেজ ২ · English ও বাংলাদেশ'
         when day_no <= 90 then 'ফেজ ৩ · বাকি Subject ও সমাপ্তি'
       end as phase,
         (select su.id from public.subjects su
           where su.course_id = b.course_id and su.slug = s.subject_slug limit 1) as subject_id
    from seed s cross join bcs b
)
insert into public.jh_r90_stage
  (day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind)
select day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind
  from built;

-- ── দিন 69–72 ──
with bcs as (select id as course_id from public.courses where slug = 'bcs'),
seed(day_no, band, subject_slug, topic_bn, subtopic_bns, task_kind) as (
  values
  (69, 'p1', 'geography', 'প্রাকৃতিক দুর্যোগ', array['বন্যা', 'ঘূর্ণিঝড়', 'জলোচ্ছ্বাস', 'ভূমিকম্প']::text[], 'study'),
  (69, 'p2', 'ict', 'Computer Software', array['System', 'Application', 'Utility']::text[], 'study'),
  (69, 'p3', 'mental', 'Spatial Reasoning', array[]::text[], 'study'),
  (69, 'mcq', '', '', array[]::text[], 'practice'),
  (70, 'p1', 'science', 'মানবদেহ', array['রক্ত', 'হৃদপিণ্ড', 'শ্বাসতন্ত্র', 'পরিপাকতন্ত্র']::text[], 'study'),
  (70, 'p2', 'math', 'বিন্যাস ও সমাবেশ', array[]::text[], 'study'),
  (70, 'p3', 'ethics', 'নৈতিক দর্শন', array[]::text[], 'study'),
  (70, 'mcq', '', '', array[]::text[], 'practice'),
  (71, 'p1', 'science', 'রোগ ও স্বাস্থ্য', array['রোগজীবাণু', 'সংক্রামক রোগ', 'টিকা', 'রোগ প্রতিরোধ']::text[], 'study'),
  (71, 'p2', 'math', 'তথ্য বিশ্লেষণ', array['table', 'graph', 'data interpretation']::text[], 'study'),
  (71, 'p3', 'ethics', 'আন্তর্জাতিক নৈতিক মানদণ্ড', array[]::text[], 'study'),
  (71, 'mcq', '', '', array[]::text[], 'practice'),
  (72, 'p1', 'science', 'ভিটামিন ও পুষ্টি', array['ভিটামিন', 'খনিজ', 'অভাবজনিত রোগ']::text[], 'study'),
  (72, 'p2', 'international', 'আন্তর্জাতিক মানবাধিকার ও অভিবাসন', array[]::text[], 'study'),
  (72, 'p3', 'geography', 'পরিবেশ সংরক্ষণ আইন', array[]::text[], 'study'),
  (72, 'mcq', '', '', array[]::text[], 'practice')
),
built as (
  select b.course_id,
         s.day_no,
         date '2026-11-28' + (s.day_no - 1) as routine_date,
         ((s.day_no - 1) / 7) + 1 as week_index,
         s.band, s.topic_bn, s.subtopic_bns, s.task_kind,
         case
         when day_no <= 30 then 'ফেজ ১ · বাংলা ও English'
         when day_no <= 60 then 'ফেজ ২ · English ও বাংলাদেশ'
         when day_no <= 90 then 'ফেজ ৩ · বাকি Subject ও সমাপ্তি'
       end as phase,
         (select su.id from public.subjects su
           where su.course_id = b.course_id and su.slug = s.subject_slug limit 1) as subject_id
    from seed s cross join bcs b
)
insert into public.jh_r90_stage
  (day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind)
select day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind
  from built;

-- ── দিন 73–76 ──
with bcs as (select id as course_id from public.courses where slug = 'bcs'),
seed(day_no, band, subject_slug, topic_bn, subtopic_bns, task_kind) as (
  values
  (73, 'p1', 'science', 'বিদ্যুৎ ও চুম্বকত্ব', array['কারেন্ট', 'ভোল্টেজ', 'রোধ', 'চৌম্বকত্ব']::text[], 'study'),
  (73, 'p2', 'bd', 'বৈদেশিক সম্পর্ক ও উন্নয়ন পরিকল্পনা — পুনরালোচনা', array[]::text[], 'study'),
  (73, 'p3', 'ict', 'Cyber Law ও বাংলাদেশের ICT নীতি', array[]::text[], 'study'),
  (73, 'mcq', '', '', array[]::text[], 'practice'),
  (74, 'p1', 'science', 'আলো ও শব্দ', array['প্রতিফলন', 'প্রতিসরণ', 'তরঙ্গ']::text[], 'study'),
  (74, 'p2', 'math', 'সব P2 সূত্র ও সমস্যা অনুশীলন', array[]::text[], 'study'),
  (74, 'p3', 'ethics', 'টেকসই উন্নয়ন ও সামাজিক দায়িত্ব', array[]::text[], 'study'),
  (74, 'mcq', '', '', array[]::text[], 'practice'),
  (75, 'p1', 'ict', 'কম্পিউটার মৌলিক ধারণা', array['Hardware', 'Software', 'CPU', 'ALU']::text[], 'study'),
  (75, 'p2', 'international', 'বিশ্বযুদ্ধ, স্নায়ুযুদ্ধ ও আন্তর্জাতিক সংস্থা Revision', array[]::text[], 'study'),
  (75, 'p3', 'science', 'জৈবপ্রযুক্তি ও বিবর্তন Revision', array[]::text[], 'revision'),
  (75, 'mcq', '', '', array[]::text[], 'practice'),
  (76, 'p1', 'ict', 'কম্পিউটার মেমোরি', array['RAM', 'ROM', 'Cache', 'Storage']::text[], 'study'),
  (76, 'p2', 'geography', 'বাংলাদেশের ভূগোল ও বিশ্ব ভূগোল Revision', array[]::text[], 'study'),
  (76, 'p3', 'mental', 'Verbal Reasoning Revision', array[]::text[], 'revision'),
  (76, 'mcq', '', '', array[]::text[], 'practice')
),
built as (
  select b.course_id,
         s.day_no,
         date '2026-11-28' + (s.day_no - 1) as routine_date,
         ((s.day_no - 1) / 7) + 1 as week_index,
         s.band, s.topic_bn, s.subtopic_bns, s.task_kind,
         case
         when day_no <= 30 then 'ফেজ ১ · বাংলা ও English'
         when day_no <= 60 then 'ফেজ ২ · English ও বাংলাদেশ'
         when day_no <= 90 then 'ফেজ ৩ · বাকি Subject ও সমাপ্তি'
       end as phase,
         (select su.id from public.subjects su
           where su.course_id = b.course_id and su.slug = s.subject_slug limit 1) as subject_id
    from seed s cross join bcs b
)
insert into public.jh_r90_stage
  (day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind)
select day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind
  from built;

-- ── দিন 77–80 ──
with bcs as (select id as course_id from public.courses where slug = 'bcs'),
seed(day_no, band, subject_slug, topic_bn, subtopic_bns, task_kind) as (
  values
  (77, 'p1', 'ict', 'Internet ও Networking', array['LAN', 'MAN', 'WAN', 'IP', 'DNS']::text[], 'study'),
  (77, 'p2', 'math', 'Arithmetic Revision', array['শতকরা', 'অনুপাত', 'লাভ-ক্ষতি', 'গড়']::text[], 'study'),
  (77, 'p3', 'mental', 'Numerical Reasoning Revision', array[]::text[], 'revision'),
  (77, 'mcq', '', '', array[]::text[], 'practice'),
  (78, 'p1', 'ict', 'Cyber Security', array['Virus', 'Malware', 'Phishing', 'Encryption']::text[], 'study'),
  (78, 'p2', 'bd', 'অর্থনীতি ও প্রশাসন Revision', array[]::text[], 'study'),
  (78, 'p3', 'mental', 'Non-verbal Reasoning Revision', array[]::text[], 'revision'),
  (78, 'mcq', '', '', array[]::text[], 'practice'),
  (79, 'p1', 'ict', 'Web Technology', array['WWW', 'Browser', 'Search Engine', 'URL']::text[], 'study'),
  (79, 'p2', 'english', 'Grammar ও Literature Previous BCS Questions', array[]::text[], 'study'),
  (79, 'p3', 'ethics', 'সুশাসন ও নৈতিকতা Revision', array[]::text[], 'revision'),
  (79, 'mcq', '', '', array[]::text[], 'practice'),
  (80, 'p1', 'math', 'শতকরা', array['শতকরা নির্ণয়', 'বৃদ্ধি', 'হ্রাস']::text[], 'study'),
  (80, 'p2', 'bangla', 'P1 Grammar Previous BCS Questions', array[]::text[], 'study'),
  (80, 'p3', 'geography', 'মানচিত্র, সময় অঞ্চল, অক্ষাংশ ও দ্রাঘিমাংশ', array[]::text[], 'study'),
  (80, 'mcq', '', '', array[]::text[], 'practice')
),
built as (
  select b.course_id,
         s.day_no,
         date '2026-11-28' + (s.day_no - 1) as routine_date,
         ((s.day_no - 1) / 7) + 1 as week_index,
         s.band, s.topic_bn, s.subtopic_bns, s.task_kind,
         case
         when day_no <= 30 then 'ফেজ ১ · বাংলা ও English'
         when day_no <= 60 then 'ফেজ ২ · English ও বাংলাদেশ'
         when day_no <= 90 then 'ফেজ ৩ · বাকি Subject ও সমাপ্তি'
       end as phase,
         (select su.id from public.subjects su
           where su.course_id = b.course_id and su.slug = s.subject_slug limit 1) as subject_id
    from seed s cross join bcs b
)
insert into public.jh_r90_stage
  (day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind)
select day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind
  from built;

-- ── দিন 81–84 ──
with bcs as (select id as course_id from public.courses where slug = 'bcs'),
seed(day_no, band, subject_slug, topic_bn, subtopic_bns, task_kind) as (
  values
  (81, 'p1', 'math', 'অনুপাত ও সমানুপাত', array['অনুপাত', 'সমানুপাত']::text[], 'study'),
  (81, 'p2', 'bangla', 'P1 Literature Previous BCS Questions', array[]::text[], 'study'),
  (81, 'p3', 'ict', 'Cloud, Blockchain ও Big Data Revision', array[]::text[], 'revision'),
  (81, 'mcq', '', '', array[]::text[], 'practice'),
  (82, 'p1', 'math', 'লাভ-ক্ষতি ও ছাড়', array['লাভ-ক্ষতি', 'ছাড়']::text[], 'study'),
  (82, 'p2', 'bd', 'P1 History Previous BCS Questions', array[]::text[], 'study'),
  (82, 'p3', 'science', 'Physics Previous BCS Questions', array[]::text[], 'revision'),
  (82, 'mcq', '', '', array[]::text[], 'practice'),
  (83, 'p1', 'math', 'গড় ও বয়স', array['গড়', 'বয়স সংক্রান্ত সমস্যা']::text[], 'study'),
  (83, 'p2', 'bd', 'P1 Constitution Previous BCS Questions', array[]::text[], 'study'),
  (83, 'p3', 'science', 'Chemistry Previous BCS Questions', array[]::text[], 'revision'),
  (83, 'mcq', '', '', array[]::text[], 'practice'),
  (84, 'p1', 'math', 'সময় ও কাজ', array['সময় ও কাজ']::text[], 'study'),
  (84, 'p2', 'international', 'P1 Previous BCS Questions', array[]::text[], 'study'),
  (84, 'p3', 'science', 'Biology Previous BCS Questions', array[]::text[], 'revision'),
  (84, 'mcq', '', '', array[]::text[], 'practice')
),
built as (
  select b.course_id,
         s.day_no,
         date '2026-11-28' + (s.day_no - 1) as routine_date,
         ((s.day_no - 1) / 7) + 1 as week_index,
         s.band, s.topic_bn, s.subtopic_bns, s.task_kind,
         case
         when day_no <= 30 then 'ফেজ ১ · বাংলা ও English'
         when day_no <= 60 then 'ফেজ ২ · English ও বাংলাদেশ'
         when day_no <= 90 then 'ফেজ ৩ · বাকি Subject ও সমাপ্তি'
       end as phase,
         (select su.id from public.subjects su
           where su.course_id = b.course_id and su.slug = s.subject_slug limit 1) as subject_id
    from seed s cross join bcs b
)
insert into public.jh_r90_stage
  (day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind)
select day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind
  from built;

-- ── দিন 85–88 ──
with bcs as (select id as course_id from public.courses where slug = 'bcs'),
seed(day_no, band, subject_slug, topic_bn, subtopic_bns, task_kind) as (
  values
  (85, 'p1', 'math', 'সময়, দূরত্ব ও গতি', array['সময়, দূরত্ব ও গতি']::text[], 'study'),
  (85, 'p2', 'geography', 'P1 Previous BCS Questions', array[]::text[], 'study'),
  (85, 'p3', 'ict', 'P1 Previous BCS Questions', array[]::text[], 'revision'),
  (85, 'mcq', '', '', array[]::text[], 'practice'),
  (86, 'p1', 'math', 'ভগ্নাংশ ও সরলীকরণ', array['ভগ্নাংশ', 'সরলীকরণ']::text[], 'study'),
  (86, 'p2', 'math', 'P1 Previous BCS Questions', array[]::text[], 'study'),
  (86, 'p3', 'mental', 'P1 Previous BCS Questions', array[]::text[], 'revision'),
  (86, 'mcq', '', '', array[]::text[], 'practice'),
  (87, 'p1', 'mental', 'Number Series', array['সংখ্যা ধারা', 'missing number']::text[], 'study'),
  (87, 'p2', 'english', 'Full Grammar Mock & Error Analysis', array[]::text[], 'study'),
  (87, 'p3', 'ethics', 'P1 Previous BCS Questions', array[]::text[], 'revision'),
  (87, 'mcq', '', '', array[]::text[], 'practice'),
  (88, 'p1', 'mental', 'Analogy', array['শব্দ', 'সংখ্যা', 'সম্পর্ক']::text[], 'study'),
  (88, 'p2', 'bangla', 'Full Language & Literature Mock & Error Analysis', array[]::text[], 'study'),
  (88, 'p3', '', 'দুর্বল Topic Revision', array[]::text[], 'revision'),
  (88, 'mcq', '', '', array[]::text[], 'practice')
),
built as (
  select b.course_id,
         s.day_no,
         date '2026-11-28' + (s.day_no - 1) as routine_date,
         ((s.day_no - 1) / 7) + 1 as week_index,
         s.band, s.topic_bn, s.subtopic_bns, s.task_kind,
         case
         when day_no <= 30 then 'ফেজ ১ · বাংলা ও English'
         when day_no <= 60 then 'ফেজ ২ · English ও বাংলাদেশ'
         when day_no <= 90 then 'ফেজ ৩ · বাকি Subject ও সমাপ্তি'
       end as phase,
         (select su.id from public.subjects su
           where su.course_id = b.course_id and su.slug = s.subject_slug limit 1) as subject_id
    from seed s cross join bcs b
)
insert into public.jh_r90_stage
  (day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind)
select day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind
  from built;

-- ── দিন 89–90 ──
with bcs as (select id as course_id from public.courses where slug = 'bcs'),
seed(day_no, band, subject_slug, topic_bn, subtopic_bns, task_kind) as (
  values
  (89, 'p1', 'mental', 'Classification', array['odd one out', 'শ্রেণিবিভাগ']::text[], 'study'),
  (89, 'p2', 'bd', 'Full Subject Mock & Error Analysis', array[]::text[], 'study'),
  (89, 'p3', '', 'Previous Questions Practice', array[]::text[], 'revision'),
  (89, 'mcq', '', '', array[]::text[], 'practice'),
  (90, 'p1', 'ethics', 'সুশাসন, নৈতিকতা, সততা ও নিরপেক্ষতা', array['সংজ্ঞা', 'বৈশিষ্ট্য', 'মূলনীতি', 'জনসেবা']::text[], 'study'),
  (90, 'p2', '', '১০টি Subject-এর P1/P2 Mixed Mock', array[]::text[], 'study'),
  (90, 'p3', '', '১০টি Subject-এর P3/P4 Mixed Revision', array[]::text[], 'revision'),
  (90, 'mcq', '', '', array[]::text[], 'practice')
),
built as (
  select b.course_id,
         s.day_no,
         date '2026-11-28' + (s.day_no - 1) as routine_date,
         ((s.day_no - 1) / 7) + 1 as week_index,
         s.band, s.topic_bn, s.subtopic_bns, s.task_kind,
         case
         when day_no <= 30 then 'ফেজ ১ · বাংলা ও English'
         when day_no <= 60 then 'ফেজ ২ · English ও বাংলাদেশ'
         when day_no <= 90 then 'ফেজ ৩ · বাকি Subject ও সমাপ্তি'
       end as phase,
         (select su.id from public.subjects su
           where su.course_id = b.course_id and su.slug = s.subject_slug limit 1) as subject_id
    from seed s cross join bcs b
)
insert into public.jh_r90_stage
  (day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind)
select day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind
  from built;

with bcs as (select id as course_id from public.courses where slug = 'bcs'),
slot(band, slot_label, minutes, target_bn) as (
  values
  ('p1', 'P1 Main · সকাল ৭:০০–৯:৩০', 150, '50টি MCQ (P1 Main)'),
  ('p2', 'P2 Second · সকাল ১০:০০–১১:১৫', 75, '25টি MCQ (P2 Second)'),
  ('p3', 'P3/P4 Third · বিকাল ৫:০০–৫:৪৫', 45, '15টি MCQ (P3/P4 Third)'),
  ('mcq', 'MCQ ও ভুল বিশ্লেষণ · রাত ৮:০০–৮:৫০', 50, '১০০টি MCQ (মোট ১০০ নম্বর)')
),
r as (
  select g.*, sl.slot_label, sl.minutes, sl.target_bn,
         case g.band
           when 'p1' then 'P1 Main'
           when 'p2' then 'P2 Second'
           when 'p3' then 'P3/P4 Third'
           else 'MCQ পরীক্ষা ও ভুল বিশ্লেষণ'
         end as slot_name,
         case when g.band = 'mcq'
              then 'দিন ' || g.day_no || ' · ' || g.phase || ' · MCQ পরীক্ষা ও ভুল বিশ্লেষণ'
              else 'দিন ' || g.day_no || ' · ' || g.phase || ' · ' ||
                   case g.band when 'p1' then 'P1 Main' when 'p2' then 'P2 Second'
                               else 'P3/P4 Third' end ||
                   ' — ' || g.topic_bn
         end as title_bn
    from public.jh_r90_stage g join slot sl on sl.band = g.band
)
insert into public.routines
  (course_id, kind, routine_date, title_en, title_bn, subject_id, minutes,
   focus_note_bn, slot_label, target_bn, task_kind, week_index, status, created_by)
select b.course_id, 'daily', r.routine_date,
       r.title_bn, r.title_bn, r.subject_id, r.minutes,
       case when r.band = 'mcq' then 'P1 50 + P2 25 + P3/P4 15 + পূর্বে-পড়া 10 = ১০০ প্রশ্ন · ৫০ মিনিট · সঠিক +১ · ভুল −০.৫০ · উত্তর না দিলে ০। শেষে ভুল প্রশ্ন Error Notebook-এ লিখুন।'
            when array_length(r.subtopic_bns, 1) is not null
              then r.topic_bn || ' — ' || array_to_string(r.subtopic_bns, ', ')
            else r.topic_bn
       end,
       r.slot_label, r.target_bn, r.task_kind, r.week_index, 'published', null
  from r cross join bcs b
on conflict (course_id, kind, routine_date, subject_id, topic_id, slot_label) do update
  set title_bn = excluded.title_bn,
      title_en = excluded.title_en,
      minutes = excluded.minutes,
      focus_note_bn = excluded.focus_note_bn,
      target_bn = excluded.target_bn,
      task_kind = excluded.task_kind,
      week_index = excluded.week_index,
      status = 'published',
      archived_at = null,
      updated_at = now();

drop table if exists public.jh_r90_stage;
