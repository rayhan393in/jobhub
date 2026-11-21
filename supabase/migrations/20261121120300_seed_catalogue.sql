-- Idempotent: safe to re-run. Inserts are guarded by natural-key conflicts.
-- ============================================================================
-- JobHub — 04 Seed: course catalogue + preserved BCS / EEE taxonomy
-- BCS 10 subjects and EEE 15 subjects are preserved from the JobMaster project.
-- These are editorial study outlines, NOT an official syllabus claim. No
-- questions are seeded here and no exam is published automatically.
-- ============================================================================

insert into public.courses (slug, title_en, title_bn, short_en, short_bn, level, icon, accent, sort_order, status, description_en, description_bn)
values ('bcs', 'BCS Preparation', 'বিসিএস প্রস্তুতি', 'BCS', 'বিসিএস', 'advanced', 'landmark', 'indigo', 1, 'published',
  'Structured preparation for BCS Preparation with verified questions, live exams and analytics.',
  'বিসিএস প্রস্তুতি পরীক্ষার জন্য যাচাইকৃত প্রশ্ন, লাইভ পরীক্ষা ও বিশ্লেষণসহ সুশৃঙ্খল প্রস্তুতি।')
on conflict (slug) do update set title_en=excluded.title_en, title_bn=excluded.title_bn, status=excluded.status;

insert into public.courses (slug, title_en, title_bn, short_en, short_bn, level, icon, accent, sort_order, status, description_en, description_bn)
values ('bank-jobs', 'Bank Jobs', 'ব্যাংক জবস', 'Bank', 'ব্যাংক', 'intermediate', 'banknote', 'violet', 2, 'published',
  'Structured preparation for Bank Jobs with verified questions, live exams and analytics.',
  'ব্যাংক জবস পরীক্ষার জন্য যাচাইকৃত প্রশ্ন, লাইভ পরীক্ষা ও বিশ্লেষণসহ সুশৃঙ্খল প্রস্তুতি।')
on conflict (slug) do update set title_en=excluded.title_en, title_bn=excluded.title_bn, status=excluded.status;

insert into public.courses (slug, title_en, title_bn, short_en, short_bn, level, icon, accent, sort_order, status, description_en, description_bn)
values ('government-jobs', 'Government Jobs', 'সরকারি চাকরি', 'Govt', 'সরকারি', 'intermediate', 'building-2', 'indigo', 3, 'published',
  'Structured preparation for Government Jobs with verified questions, live exams and analytics.',
  'সরকারি চাকরি পরীক্ষার জন্য যাচাইকৃত প্রশ্ন, লাইভ পরীক্ষা ও বিশ্লেষণসহ সুশৃঙ্খল প্রস্তুতি।')
on conflict (slug) do update set title_en=excluded.title_en, title_bn=excluded.title_bn, status=excluded.status;

insert into public.courses (slug, title_en, title_bn, short_en, short_bn, level, icon, accent, sort_order, status, description_en, description_bn)
values ('primary-teacher', 'Primary Teacher', 'প্রাথমিক শিক্ষক', 'Primary', 'প্রাথমিক', 'foundation', 'pencil-ruler', 'violet', 4, 'published',
  'Structured preparation for Primary Teacher with verified questions, live exams and analytics.',
  'প্রাথমিক শিক্ষক পরীক্ষার জন্য যাচাইকৃত প্রশ্ন, লাইভ পরীক্ষা ও বিশ্লেষণসহ সুশৃঙ্খল প্রস্তুতি।')
on conflict (slug) do update set title_en=excluded.title_en, title_bn=excluded.title_bn, status=excluded.status;

insert into public.courses (slug, title_en, title_bn, short_en, short_bn, level, icon, accent, sort_order, status, description_en, description_bn)
values ('ntrca', 'NTRCA', 'এনটিআরসিএ', 'NTRCA', 'এনট্রিআরসিএ', 'intermediate', 'book-open-check', 'indigo', 5, 'published',
  'Structured preparation for NTRCA with verified questions, live exams and analytics.',
  'এনটিআরসিএ পরীক্ষার জন্য যাচাইকৃত প্রশ্ন, লাইভ পরীক্ষা ও বিশ্লেষণসহ সুশৃঙ্খল প্রস্তুতি।')
on conflict (slug) do update set title_en=excluded.title_en, title_bn=excluded.title_bn, status=excluded.status;

insert into public.courses (slug, title_en, title_bn, short_en, short_bn, level, icon, accent, sort_order, status, description_en, description_bn)
values ('private-jobs', 'Private Jobs', 'বেসরকারি চাকরি', 'Private', 'বেসরকারি', 'foundation', 'briefcase', 'violet', 6, 'published',
  'Structured preparation for Private Jobs with verified questions, live exams and analytics.',
  'বেসরকারি চাকরি পরীক্ষার জন্য যাচাইকৃত প্রশ্ন, লাইভ পরীক্ষা ও বিশ্লেষণসহ সুশৃঙ্খল প্রস্তুতি।')
on conflict (slug) do update set title_en=excluded.title_en, title_bn=excluded.title_bn, status=excluded.status;

insert into public.courses (slug, title_en, title_bn, short_en, short_bn, level, icon, accent, sort_order, status, description_en, description_bn)
values ('eee', 'EEE & Engineering', 'ইইই ও ইঞ্জিনিয়ারিং', 'EEE', 'ইইই', 'advanced', 'cpu', 'indigo', 7, 'published',
  'Structured preparation for EEE & Engineering with verified questions, live exams and analytics.',
  'ইইই ও ইঞ্জিনিয়ারিং পরীক্ষার জন্য যাচাইকৃত প্রশ্ন, লাইভ পরীক্ষা ও বিশ্লেষণসহ সুশৃঙ্খল প্রস্তুতি।')
on conflict (slug) do update set title_en=excluded.title_en, title_bn=excluded.title_bn, status=excluded.status;

insert into public.courses (slug, title_en, title_bn, short_en, short_bn, level, icon, accent, sort_order, status, description_en, description_bn)
values ('technical-recruitment', 'Technical Recruitment', 'টেকনিক্যাল নিয়োগ', 'Technical', 'টেকনিক্যাল', 'intermediate', 'wrench', 'violet', 8, 'published',
  'Structured preparation for Technical Recruitment with verified questions, live exams and analytics.',
  'টেকনিক্যাল নিয়োগ পরীক্ষার জন্য যাচাইকৃত প্রশ্ন, লাইভ পরীক্ষা ও বিশ্লেষণসহ সুশৃঙ্খল প্রস্তুতি।')
on conflict (slug) do update set title_en=excluded.title_en, title_bn=excluded.title_bn, status=excluded.status;

-- ---------------------------------------------------------------------------
-- BCS: 10 subjects -> topics -> subtopics
-- ---------------------------------------------------------------------------
insert into public.subjects (course_id, slug, title_en, title_bn, weight, sort_order)
select c.id,'bangla','Bangla Language & Literature','বাংলা ভাষা ও সাহিত্য',10,1 from public.courses c where c.slug='bcs'
on conflict (course_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bangla')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-1','ধ্বনি ও বর্ণ','ধ্বনি ও বর্ণ','ব্যাকরণ',1 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bangla' and t.slug='topic-1')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','ধ্বনিবিজ্ঞান','ধ্বনিবিজ্ঞান',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bangla')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-2','সন্ধি','সন্ধি','ব্যাকরণ',2 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bangla')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-3','সমাস','সমাস','ব্যাকরণ',3 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bangla')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-4','কারক ও বিভক্তি','কারক ও বিভক্তি','ব্যাকরণ',4 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bangla' and t.slug='topic-4')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','কারক','কারক',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bangla')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-5','প্রত্যয়','প্রত্যয়','ব্যাকরণ',5 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bangla')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-6','উপসর্গ','উপসর্গ','ব্যাকরণ',6 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bangla')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-7','পদ ও পদপ্রকরণ','পদ ও পদপ্রকরণ','ব্যাকরণ',7 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bangla')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-8','বাক্য','বাক্য','ব্যাকরণ',8 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bangla')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-9','শুদ্ধ বানান ও প্রয়োগ','শুদ্ধ বানান ও প্রয়োগ','ব্যাকরণ',9 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bangla' and t.slug='topic-9')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','বানান','বানান',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bangla')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-10','বাগধারা','বাগধারা','ব্যাকরণ',10 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bangla')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-11','সমার্থক ও বিপরীত শব্দ','সমার্থক ও বিপরীত শব্দ','ব্যাকরণ',11 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bangla')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-12','প্রাচীন যুগ ও চর্যাপদ','প্রাচীন যুগ ও চর্যাপদ','সাহিত্য',12 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bangla' and t.slug='topic-12')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','প্রাচীন সাহিত্য','প্রাচীন সাহিত্য',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bangla')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-13','মধ্যযুগের সাহিত্য','মধ্যযুগের সাহিত্য','সাহিত্য',13 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bangla')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-14','আধুনিক যুগ','আধুনিক যুগ','সাহিত্য',14 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bangla')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-15','কবি ও সাহিত্যিক','কবি ও সাহিত্যিক','সাহিত্য',15 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bangla' and t.slug='topic-15')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','কবিতা','কবিতা',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bangla')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-16','বিখ্যাত গ্রন্থ ও চরিত্র','বিখ্যাত গ্রন্থ ও চরিত্র','সাহিত্য',16 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bangla' and t.slug='topic-16')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','উপন্যাস','উপন্যাস',1 from t
on conflict (topic_id, slug) do nothing;

insert into public.subjects (course_id, slug, title_en, title_bn, weight, sort_order)
select c.id,'english','English Language & Literature','English Language & Literature',10,2 from public.courses c where c.slug='bcs'
on conflict (course_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'parts-of-speech-1','Parts of speech','Parts of speech','Language',1 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'tense-and-aspect-2','Tense and aspect','Tense and aspect','Language',2 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='tense-and-aspect-2')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'tense-1','Tense','Tense',1 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='tense-and-aspect-2')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'finished-past-time-2','Finished past time','Finished past time',2 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='tense-and-aspect-2')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'inversion-3','Inversion','Inversion',3 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='tense-and-aspect-2')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'paired-conjunctions-4','Paired conjunctions','Paired conjunctions',4 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'subject-verb-agreement-3','Subject-verb agreement','Subject-verb agreement','Language',3 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='subject-verb-agreement-3')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'subjectverb-agreement-1','Subject–verb agreement','Subject–verb agreement',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'articles-and-determiners-4','Articles and determiners','Articles and determiners','Language',4 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='articles-and-determiners-4')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'articles-1','Articles','Articles',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'prepositions-5','Prepositions','Prepositions','Language',5 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='prepositions-5')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'time-expressions-1','Time expressions','Time expressions',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'voice-6','Voice','Voice','Language',6 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'narration-7','Narration','Narration','Language',7 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='narration-7')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'pronouns-1','Pronouns','Pronouns',1 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='narration-7')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'reporting-verbs-2','Reporting verbs','Reporting verbs',2 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='narration-7')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'backshift-3','Backshift','Backshift',3 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='narration-7')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'present-reporting-verb-4','Present reporting verb','Present reporting verb',4 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='narration-7')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'reported-facts-5','Reported facts','Reported facts',5 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='narration-7')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'reported-modals-6','Reported modals','Reported modals',6 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='narration-7')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'time-references-7','Time references','Time references',7 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='narration-7')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'place-references-8','Place references','Place references',8 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='narration-7')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'indirect-questions-9','Indirect questions','Indirect questions',9 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='narration-7')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'word-order-10','Word order','Word order',10 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='narration-7')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'orders-11','Orders','Orders',11 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='narration-7')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'prohibitions-12','Prohibitions','Prohibitions',12 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='narration-7')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'requests-13','Requests','Requests',13 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='narration-7')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'advice-14','Advice','Advice',14 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='narration-7')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'suggestions-15','Suggestions','Suggestions',15 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='narration-7')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'permission-requests-16','Permission requests','Permission requests',16 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='narration-7')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'wishes-17','Wishes','Wishes',17 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='narration-7')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'prayers-18','Prayers','Prayers',18 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='narration-7')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'exclamations-19','Exclamations','Exclamations',19 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='narration-7')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'apologies-20','Apologies','Apologies',20 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='narration-7')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'congratulations-21','Congratulations','Congratulations',21 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'clauses-and-phrases-8','Clauses and phrases','Clauses and phrases','Language',8 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='clauses-and-phrases-8')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'conditionals-1','Conditionals','Conditionals',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'sentence-correction-9','Sentence correction','Sentence correction','Language',9 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='sentence-correction-9')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'modals-1','Modals','Modals',1 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='sentence-correction-9')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'auxiliary-verbs-2','Auxiliary verbs','Auxiliary verbs',2 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='sentence-correction-9')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'infinitives-3','Infinitives','Infinitives',3 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='sentence-correction-9')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'gerunds-4','Gerunds','Gerunds',4 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='sentence-correction-9')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'perfect-forms-5','Perfect forms','Perfect forms',5 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='sentence-correction-9')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'continuous-forms-6','Continuous forms','Continuous forms',6 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='sentence-correction-9')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'passive-forms-7','Passive forms','Passive forms',7 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='sentence-correction-9')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'bare-infinitives-8','Bare infinitives','Bare infinitives',8 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='sentence-correction-9')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'causatives-9','Causatives','Causatives',9 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='sentence-correction-9')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'passive-causatives-10','Passive causatives','Passive causatives',10 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='sentence-correction-9')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'verb-patterns-11','Verb patterns','Verb patterns',11 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='sentence-correction-9')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'preference-clauses-12','Preference clauses','Preference clauses',12 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='sentence-correction-9')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'past-habits-13','Past habits','Past habits',13 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='sentence-correction-9')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'accustomed-actions-14','Accustomed actions','Accustomed actions',14 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='sentence-correction-9')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'prepositional-to-15','Prepositional to','Prepositional to',15 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='sentence-correction-9')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'unreal-past-form-16','Unreal past form','Unreal past form',16 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='sentence-correction-9')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'wishes-17','Wishes','Wishes',17 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'vocabulary-idioms-and-spelling-10','Vocabulary, idioms and spelling','Vocabulary, idioms and spelling','Language',10 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='vocabulary-idioms-and-spelling-10')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'vocabulary-1','Vocabulary','Vocabulary',1 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='vocabulary-idioms-and-spelling-10')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'idioms-2','Idioms','Idioms',2 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'literary-periods-11','Literary periods','Literary periods','Literature',11 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'major-authors-and-works-12','Major authors and works','Major authors and works','Literature',12 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='major-authors-and-works-12')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'drama-1','Drama','Drama',1 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english' and t.slug='major-authors-and-works-12')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'poetry-2','Poetry','Poetry',2 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'literary-terms-13','Literary terms','Literary terms','Literature',13 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='english')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'poetry-drama-and-fiction-14','Poetry, drama and fiction','Poetry, drama and fiction','Literature',14 from s
on conflict (subject_id, slug) do nothing;

insert into public.subjects (course_id, slug, title_en, title_bn, weight, sort_order)
select c.id,'bd','Bangladesh Affairs','বাংলাদেশ বিষয়াবলি',10,3 from public.courses c where c.slug='bcs'
on conflict (course_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bd')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-1','প্রাচীন ও মধ্যযুগের ইতিহাস','প্রাচীন ও মধ্যযুগের ইতিহাস','ইতিহাস ও রাষ্ট্র',1 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bd')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-2','ভাষা আন্দোলন','ভাষা আন্দোলন','ইতিহাস ও রাষ্ট্র',2 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bd')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-3','মুক্তিযুদ্ধ','মুক্তিযুদ্ধ','ইতিহাস ও রাষ্ট্র',3 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bd')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-4','সংবিধান','সংবিধান','ইতিহাস ও রাষ্ট্র',4 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bd' and t.slug='topic-4')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','সংবিধানের ইতিহাস','সংবিধানের ইতিহাস',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bd')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-5','রাজনৈতিক ও সরকার ব্যবস্থা','রাজনৈতিক ও সরকার ব্যবস্থা','ইতিহাস ও রাষ্ট্র',5 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bd' and t.slug='topic-5')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','ছয় দফা','ছয় দফা',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bd')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-6','ভূপ্রকৃতি ও সম্পদ','ভূপ্রকৃতি ও সম্পদ','সমাজ ও অর্থনীতি',6 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bd' and t.slug='topic-6')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','ভৌগোলিক অবস্থান','ভৌগোলিক অবস্থান',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bd')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-7','জনসংখ্যা ও সংস্কৃতি','জনসংখ্যা ও সংস্কৃতি','সমাজ ও অর্থনীতি',7 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bd' and t.slug='topic-7')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','সংস্কৃতি','সংস্কৃতি',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bd')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-8','কৃষি','কৃষি','সমাজ ও অর্থনীতি',8 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bd')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-9','শিল্প ও বাণিজ্য','শিল্প ও বাণিজ্য','সমাজ ও অর্থনীতি',9 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bd')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-10','অর্থনীতি ও বাজেট','অর্থনীতি ও বাজেট','সমাজ ও অর্থনীতি',10 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bd')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-11','জাতীয় প্রতিষ্ঠান ও অর্জন','জাতীয় প্রতিষ্ঠান ও অর্জন','সমাজ ও অর্থনীতি',11 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='bd' and t.slug='topic-11')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','অর্থনীতি','অর্থনীতি',1 from t
on conflict (topic_id, slug) do nothing;

insert into public.subjects (course_id, slug, title_en, title_bn, weight, sort_order)
select c.id,'international','International Affairs','আন্তর্জাতিক বিষয়াবলি',10,4 from public.courses c where c.slug='bcs'
on conflict (course_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='international')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-1','বিশ্ব ইতিহাস','বিশ্ব ইতিহাস','বিশ্ব ও আন্তর্জাতিক সম্পর্ক',1 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='international')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-2','ভূরাজনীতি','ভূরাজনীতি','বিশ্ব ও আন্তর্জাতিক সম্পর্ক',2 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='international' and t.slug='topic-2')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','সমুদ্রপথ','সমুদ্রপথ',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='international')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-3','আন্তর্জাতিক নিরাপত্তা','আন্তর্জাতিক নিরাপত্তা','বিশ্ব ও আন্তর্জাতিক সম্পর্ক',3 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='international')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-4','জাতিসংঘ','জাতিসংঘ','বিশ্ব ও আন্তর্জাতিক সম্পর্ক',4 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='international' and t.slug='topic-4')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','আন্তর্জাতিক বিচারব্যবস্থা','আন্তর্জাতিক বিচারব্যবস্থা',1 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='international' and t.slug='topic-4')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-2','বিশ্ব স্বাস্থ্য','বিশ্ব স্বাস্থ্য',2 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='international' and t.slug='topic-4')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-3','মানবাধিকার','মানবাধিকার',3 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='international' and t.slug='topic-4')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-4','টেকসই উন্নয়ন','টেকসই উন্নয়ন',4 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='international')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-5','আঞ্চলিক ও অর্থনৈতিক সংস্থা','আঞ্চলিক ও অর্থনৈতিক সংস্থা','বিশ্ব ও আন্তর্জাতিক সম্পর্ক',5 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='international' and t.slug='topic-5')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','আঞ্চলিক সংস্থা','আঞ্চলিক সংস্থা',1 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='international' and t.slug='topic-5')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-2','বাণিজ্য','বাণিজ্য',2 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='international')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-6','আন্তর্জাতিক চুক্তি','আন্তর্জাতিক চুক্তি','বিশ্ব ও আন্তর্জাতিক সম্পর্ক',6 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='international' and t.slug='topic-6')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','জলবায়ু কূটনীতি','জলবায়ু কূটনীতি',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='international')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-7','সমসাময়িক ঘটনা','সমসাময়িক ঘটনা','বিশ্ব ও আন্তর্জাতিক সম্পর্ক',7 from s
on conflict (subject_id, slug) do nothing;

insert into public.subjects (course_id, slug, title_en, title_bn, weight, sort_order)
select c.id,'geography','Geography, Environment & Disaster','ভূগোল, পরিবেশ ও দুর্যোগ',10,5 from public.courses c where c.slug='bcs'
on conflict (course_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='geography')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-1','বাংলাদেশের অবস্থান ও ভূপ্রকৃতি','বাংলাদেশের অবস্থান ও ভূপ্রকৃতি','ভূগোল',1 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='geography' and t.slug='topic-1')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','নদীভূমি','নদীভূমি',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='geography')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-2','বিশ্ব ভূগোল','বিশ্ব ভূগোল','ভূগোল',2 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='geography' and t.slug='topic-2')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','স্থানাঙ্ক','স্থানাঙ্ক',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='geography')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-3','জলবায়ু','জলবায়ু','ভূগোল',3 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='geography' and t.slug='topic-3')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','ঋতু','ঋতু',1 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='geography' and t.slug='topic-3')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-2','বায়ুমণ্ডল','বায়ুমণ্ডল',2 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='geography')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-4','প্রাকৃতিক সম্পদ','প্রাকৃতিক সম্পদ','ভূগোল',4 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='geography')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-5','বাস্তুতন্ত্র','বাস্তুতন্ত্র','পরিবেশ ও দুর্যোগ',5 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='geography')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-6','দূষণ','দূষণ','পরিবেশ ও দুর্যোগ',6 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='geography' and t.slug='topic-6')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','পরিবেশ','পরিবেশ',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='geography')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-7','জলবায়ু পরিবর্তন','জলবায়ু পরিবর্তন','পরিবেশ ও দুর্যোগ',7 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='geography')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-8','দুর্যোগ ঝুঁকি','দুর্যোগ ঝুঁকি','পরিবেশ ও দুর্যোগ',8 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='geography' and t.slug='topic-8')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','ভূমিকম্প','ভূমিকম্প',1 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='geography' and t.slug='topic-8')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-2','ঘূর্ণিঝড়','ঘূর্ণিঝড়',2 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='geography')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-9','প্রস্তুতি ও প্রশমন','প্রস্তুতি ও প্রশমন','পরিবেশ ও দুর্যোগ',9 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='geography' and t.slug='topic-9')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','দুর্যোগ প্রস্তুতি','দুর্যোগ প্রস্তুতি',1 from t
on conflict (topic_id, slug) do nothing;

insert into public.subjects (course_id, slug, title_en, title_bn, weight, sort_order)
select c.id,'science','General Science','সাধারণ বিজ্ঞান',10,6 from public.courses c where c.slug='bcs'
on conflict (course_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='science')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-1','ভৌত রাশি ও একক','ভৌত রাশি ও একক','ভৌত বিজ্ঞান',1 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='science' and t.slug='topic-1')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','পরিমাপ','পরিমাপ',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='science')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-2','গতি ও বল','গতি ও বল','ভৌত বিজ্ঞান',2 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='science')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-3','কাজ, শক্তি ও ক্ষমতা','কাজ, শক্তি ও ক্ষমতা','ভৌত বিজ্ঞান',3 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='science' and t.slug='topic-3')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','কাজ ও শক্তি','কাজ ও শক্তি',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='science')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-4','তাপ','তাপ','ভৌত বিজ্ঞান',4 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='science')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-5','আলো ও শব্দ','আলো ও শব্দ','ভৌত বিজ্ঞান',5 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='science' and t.slug='topic-5')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','আলো','আলো',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='science')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-6','বিদ্যুৎ ও চুম্বক','বিদ্যুৎ ও চুম্বক','ভৌত বিজ্ঞান',6 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='science' and t.slug='topic-6')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','বিদ্যুৎ','বিদ্যুৎ',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='science')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-7','পরমাণু ও রাসায়নিক বিক্রিয়া','পরমাণু ও রাসায়নিক বিক্রিয়া','ভৌত বিজ্ঞান',7 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='science' and t.slug='topic-7')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','অম্ল ও ক্ষার','অম্ল ও ক্ষার',1 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='science' and t.slug='topic-7')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-2','পরমাণু','পরমাণু',2 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='science')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-8','কোষ','কোষ','জীব ও আধুনিক বিজ্ঞান',8 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='science')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-9','জীবপ্রক্রিয়া','জীবপ্রক্রিয়া','জীব ও আধুনিক বিজ্ঞান',9 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='science' and t.slug='topic-9')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','উদ্ভিদবিজ্ঞান','উদ্ভিদবিজ্ঞান',1 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='science' and t.slug='topic-9')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-2','মানবদেহ','মানবদেহ',2 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='science')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-10','পুষ্টি','পুষ্টি','জীব ও আধুনিক বিজ্ঞান',10 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='science')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-11','রোগ ও স্বাস্থ্য','রোগ ও স্বাস্থ্য','জীব ও আধুনিক বিজ্ঞান',11 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='science' and t.slug='topic-11')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','সংক্রামক রোগ','সংক্রামক রোগ',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='science')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-12','জিন ও বংশগতি','জিন ও বংশগতি','জীব ও আধুনিক বিজ্ঞান',12 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='science')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-13','আধুনিক প্রযুক্তি','আধুনিক প্রযুক্তি','জীব ও আধুনিক বিজ্ঞান',13 from s
on conflict (subject_id, slug) do nothing;

insert into public.subjects (course_id, slug, title_en, title_bn, weight, sort_order)
select c.id,'ict','Computer & ICT','কম্পিউটার ও তথ্যপ্রযুক্তি',10,7 from public.courses c where c.slug='bcs'
on conflict (course_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='ict')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-1','হার্ডওয়্যার','হার্ডওয়্যার','কম্পিউটার',1 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='ict')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-2','সফটওয়্যার','সফটওয়্যার','কম্পিউটার',2 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='ict' and t.slug='topic-2')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','স্প্রেডশিট','স্প্রেডশিট',1 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='ict' and t.slug='topic-2')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-2','প্রোগ্রামিং','প্রোগ্রামিং',2 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='ict')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-3','সংখ্যা পদ্ধতি','সংখ্যা পদ্ধতি','কম্পিউটার',3 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='ict' and t.slug='topic-3')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','সংখ্যাপদ্ধতি','সংখ্যাপদ্ধতি',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='ict')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-4','ডেটা ও মেমোরি','ডেটা ও মেমোরি','কম্পিউটার',4 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='ict' and t.slug='topic-4')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','মেমরি','মেমরি',1 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='ict' and t.slug='topic-4')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-2','ডেটার একক','ডেটার একক',2 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='ict')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-5','অপারেটিং সিস্টেম','অপারেটিং সিস্টেম','কম্পিউটার',5 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='ict')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-6','ডেটাবেজ','ডেটাবেজ','কম্পিউটার',6 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='ict' and t.slug='topic-6')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','ডেটাবেস','ডেটাবেস',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='ict')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-7','নেটওয়ার্ক','নেটওয়ার্ক','তথ্যপ্রযুক্তি',7 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='ict')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-8','ইন্টারনেট ও ওয়েব','ইন্টারনেট ও ওয়েব','তথ্যপ্রযুক্তি',8 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='ict' and t.slug='topic-8')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','ইন্টারনেট','ইন্টারনেট',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='ict')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-9','সাইবার নিরাপত্তা','সাইবার নিরাপত্তা','তথ্যপ্রযুক্তি',9 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='ict')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-10','ডিজিটাল সেবা','ডিজিটাল সেবা','তথ্যপ্রযুক্তি',10 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='ict')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-11','উদীয়মান প্রযুক্তি','উদীয়মান প্রযুক্তি','তথ্যপ্রযুক্তি',11 from s
on conflict (subject_id, slug) do nothing;

insert into public.subjects (course_id, slug, title_en, title_bn, weight, sort_order)
select c.id,'math','Mathematical Reasoning','গাণিতিক যুক্তি',10,8 from public.courses c where c.slug='bcs'
on conflict (course_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-1','বাস্তব সংখ্যা','বাস্তব সংখ্যা','পাটিগণিত',1 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-1')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','জোড়-বিজোড়','জোড়-বিজোড়',1 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-1')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-2','মৌলিক সংখ্যা','মৌলিক সংখ্যা',2 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-1')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-3','মৌলিকতা পরীক্ষা','মৌলিকতা পরীক্ষা',3 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-1')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-4','সহমৌলিক','সহমৌলিক',4 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-1')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-5','মূলদ সংখ্যা','মূলদ সংখ্যা',5 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-1')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-6','অমূলদ সংখ্যা','অমূলদ সংখ্যা',6 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-1')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-7','আবৃত্ত দশমিক','আবৃত্ত দশমিক',7 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-1')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-8','অমূলদ রাশি','অমূলদ রাশি',8 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-1')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-9','সংখ্যার শ্রেণি','সংখ্যার শ্রেণি',9 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-1')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-10','ক্রমিক পূর্ণসংখ্যা','ক্রমিক পূর্ণসংখ্যা',10 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-1')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-11','অঙ্কবিন্যাস','অঙ্কবিন্যাস',11 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-1')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-12','মৌলিক উৎপাদক','মৌলিক উৎপাদক',12 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-1')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-13','যৌগিক সংখ্যা','যৌগিক সংখ্যা',13 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-1')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-14','মৌলিক সংখ্যার গুণফল','মৌলিক সংখ্যার গুণফল',14 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-1')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-15','সহমৌলিক ও যৌগিক','সহমৌলিক ও যৌগিক',15 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-2','গসাগু ও লসাগু','গসাগু ও লসাগু','পাটিগণিত',2 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-2')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','গসাগু','গসাগু',1 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-2')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-2','লসাগু','লসাগু',2 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-2')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-3','গসাগু-লসাগুর সম্পর্ক','গসাগু-লসাগুর সম্পর্ক',3 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-2')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-4','সাধারণ গুণনীয়ক','সাধারণ গুণনীয়ক',4 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-2')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-5','সাধারণ গুণিতক','সাধারণ গুণিতক',5 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-2')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-6','ভাগশেষ','ভাগশেষ',6 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-2')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-7','সমবণ্টন','সমবণ্টন',7 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-2')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-8','সমাপতন','সমাপতন',8 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-2')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-9','গসাগু ও অনুপাত','গসাগু ও অনুপাত',9 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-2')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-10','লসাগু ও অনুপাত','লসাগু ও অনুপাত',10 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-2')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-11','ইউক্লিডীয় সম্পর্ক','ইউক্লিডীয় সম্পর্ক',11 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-2')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-12','গুণনীয়ক-গুণিতক','গুণনীয়ক-গুণিতক',12 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-2')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-13','সমান টুকরা','সমান টুকরা',13 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-2')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-14','একই ভাগশেষ','একই ভাগশেষ',14 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-2')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-15','সংখ্যাজোড়া','সংখ্যাজোড়া',15 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-3','শতকরা','শতকরা','পাটিগণিত',3 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-4','লাভ-ক্ষতি','লাভ-ক্ষতি','পাটিগণিত',4 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-4')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','লাভ ও ক্ষতি','লাভ ও ক্ষতি',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-5','অনুপাত','অনুপাত','পাটিগণিত',5 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-6','সরল ও চক্রবৃদ্ধি সুদ','সরল ও চক্রবৃদ্ধি সুদ','পাটিগণিত',6 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-6')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','সরল সুদ','সরল সুদ',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-7','সমীকরণ','সমীকরণ','বীজগণিত',7 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-7')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','বীজগণিত','বীজগণিত',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-8','অসমতা','অসমতা','বীজগণিত',8 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-9','সূচক ও লগারিদম','সূচক ও লগারিদম','বীজগণিত',9 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-9')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','সূচক','সূচক',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-10','ধারা','ধারা','বীজগণিত',10 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-11','বিন্যাস ও সমাবেশ','বিন্যাস ও সমাবেশ','বীজগণিত',11 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-12','রেখা ও কোণ','রেখা ও কোণ','জ্যামিতি ও পরিসংখ্যান',12 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-13','ত্রিভুজ','ত্রিভুজ','জ্যামিতি ও পরিসংখ্যান',13 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-13')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','জ্যামিতি','জ্যামিতি',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-14','বৃত্ত','বৃত্ত','জ্যামিতি ও পরিসংখ্যান',14 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-14')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','পরিমিতি','পরিমিতি',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-15','পরিমিতি','পরিমিতি','জ্যামিতি ও পরিসংখ্যান',15 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-16','সেট','সেট','জ্যামিতি ও পরিসংখ্যান',16 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-17','সম্ভাবনা','সম্ভাবনা','জ্যামিতি ও পরিসংখ্যান',17 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-18','কেন্দ্রীয় প্রবণতা','কেন্দ্রীয় প্রবণতা','জ্যামিতি ও পরিসংখ্যান',18 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='math' and t.slug='topic-18')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','গড়','গড়',1 from t
on conflict (topic_id, slug) do nothing;

insert into public.subjects (course_id, slug, title_en, title_bn, weight, sort_order)
select c.id,'mental','Mental Ability','মানসিক দক্ষতা',10,9 from public.courses c where c.slug='bcs'
on conflict (course_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='mental')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-1','ভাষাগত যুক্তি','ভাষাগত যুক্তি','যুক্তি ও বিশ্লেষণ',1 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='mental' and t.slug='topic-1')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','বর্ণধারা','বর্ণধারা',1 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='mental' and t.slug='topic-1')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-2','সাংকেতিক ভাষা','সাংকেতিক ভাষা',2 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='mental' and t.slug='topic-1')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-3','যৌক্তিক সিদ্ধান্ত','যৌক্তিক সিদ্ধান্ত',3 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='mental')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-2','সংখ্যা ধারা','সংখ্যা ধারা','যুক্তি ও বিশ্লেষণ',2 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='mental' and t.slug='topic-2')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','সংখ্যাধারা','সংখ্যাধারা',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='mental')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-3','সাদৃশ্য','সাদৃশ্য','যুক্তি ও বিশ্লেষণ',3 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='mental')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-4','সম্পর্ক ও দিক','সম্পর্ক ও দিক','যুক্তি ও বিশ্লেষণ',4 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='mental' and t.slug='topic-4')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','দিক নির্ণয়','দিক নির্ণয়',1 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='mental' and t.slug='topic-4')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-2','রক্তের সম্পর্ক','রক্তের সম্পর্ক',2 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='mental')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-5','স্থানিক দক্ষতা','স্থানিক দক্ষতা','যুক্তি ও বিশ্লেষণ',5 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='mental')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-6','যান্ত্রিক যুক্তি','যান্ত্রিক যুক্তি','যুক্তি ও বিশ্লেষণ',6 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='mental')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-7','সমস্যা সমাধান','সমস্যা সমাধান','যুক্তি ও বিশ্লেষণ',7 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='mental' and t.slug='topic-7')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','ক্রমবিন্যাস','ক্রমবিন্যাস',1 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='mental' and t.slug='topic-7')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-2','ক্যালেন্ডার','ক্যালেন্ডার',2 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='mental' and t.slug='topic-7')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-3','ঘড়ি','ঘড়ি',3 from t
on conflict (topic_id, slug) do nothing;

insert into public.subjects (course_id, slug, title_en, title_bn, weight, sort_order)
select c.id,'ethics','Ethics, Values & Good Governance','নৈতিকতা, মূল্যবোধ ও সুশাসন',10,10 from public.courses c where c.slug='bcs'
on conflict (course_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='ethics')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-1','নৈতিকতার ধারণা','নৈতিকতার ধারণা','নৈতিকতা ও সুশাসন',1 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='ethics' and t.slug='topic-1')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','তথ্যের দায়িত্বশীল ব্যবহার','তথ্যের দায়িত্বশীল ব্যবহার',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='ethics')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-2','মূল্যবোধ','মূল্যবোধ','নৈতিকতা ও সুশাসন',2 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='ethics' and t.slug='topic-2')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','সমতা ও ন্যায্যতা','সমতা ও ন্যায্যতা',1 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='ethics')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-3','সততা ও জবাবদিহি','সততা ও জবাবদিহি','নৈতিকতা ও সুশাসন',3 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='ethics' and t.slug='topic-3')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','জবাবদিহি','জবাবদিহি',1 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='ethics' and t.slug='topic-3')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-2','সততা','সততা',2 from t
on conflict (topic_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='ethics')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-4','আইনের শাসন','আইনের শাসন','নৈতিকতা ও সুশাসন',4 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='ethics')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-5','স্বচ্ছতা','স্বচ্ছতা','নৈতিকতা ও সুশাসন',5 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='ethics')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-6','স্বার্থের সংঘাত','স্বার্থের সংঘাত','নৈতিকতা ও সুশাসন',6 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='ethics')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'topic-7','সুশাসন ও উন্নয়ন','সুশাসন ও উন্নয়ন','নৈতিকতা ও সুশাসন',7 from s
on conflict (subject_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='ethics' and t.slug='topic-7')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-1','অংশগ্রহণ','অংশগ্রহণ',1 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='ethics' and t.slug='topic-7')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-2','কর্তব্যনিষ্ঠা','কর্তব্যনিষ্ঠা',2 from t
on conflict (topic_id, slug) do nothing;
with t as (select t.id from public.topics t join public.subjects su on su.id=t.subject_id join public.courses c on c.id=su.course_id where c.slug='bcs' and su.slug='ethics' and t.slug='topic-7')
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id,'sub-3','টেকসই নৈতিকতা','টেকসই নৈতিকতা',3 from t
on conflict (topic_id, slug) do nothing;

-- ---------------------------------------------------------------------------
-- EEE: 15 subjects preserved from JobMaster
-- ---------------------------------------------------------------------------
insert into public.subjects (course_id, slug, title_en, title_bn, sort_order)
select c.id,'circuit','Electrical Circuit Analysis','Electrical Circuit Analysis',1 from public.courses c where c.slug='eee'
on conflict (course_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='circuit')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'ohms-law-1','Ohm’s law','Ohm’s law','DC networks',1 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='circuit')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'kcl-and-kvl-2','KCL and KVL','KCL and KVL','DC networks',2 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='circuit')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'nodal-analysis-3','Nodal analysis','Nodal analysis','DC networks',3 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='circuit')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'mesh-analysis-4','Mesh analysis','Mesh analysis','DC networks',4 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='circuit')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'thevenin-and-norton-5','Thevenin and Norton','Thevenin and Norton','DC networks',5 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='circuit')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'superposition-6','Superposition','Superposition','DC networks',6 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='circuit')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'phasors-7','Phasors','Phasors','AC and transients',7 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='circuit')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'impedance-8','Impedance','Impedance','AC and transients',8 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='circuit')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'rlc-resonance-9','RLC resonance','RLC resonance','AC and transients',9 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='circuit')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'first-order-transients-10','First-order transients','First-order transients','AC and transients',10 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='circuit')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'three-phase-circuits-11','Three-phase circuits','Three-phase circuits','AC and transients',11 from s
on conflict (subject_id, slug) do nothing;

insert into public.subjects (course_id, slug, title_en, title_bn, sort_order)
select c.id,'machines','Electrical Machines','Electrical Machines',2 from public.courses c where c.slug='eee'
on conflict (course_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='machines')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'equivalent-circuit-1','Equivalent circuit','Equivalent circuit','Transformers',1 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='machines')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'losses-and-efficiency-2','Losses and efficiency','Losses and efficiency','Transformers',2 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='machines')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'regulation-3','Regulation','Regulation','Transformers',3 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='machines')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'oc-and-sc-tests-4','OC and SC tests','OC and SC tests','Transformers',4 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='machines')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'dc-machines-5','DC machines','DC machines','Rotating machines',5 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='machines')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'induction-motors-6','Induction motors','Induction motors','Rotating machines',6 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='machines')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'synchronous-machines-7','Synchronous machines','Synchronous machines','Rotating machines',7 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='machines')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'starting-and-speed-control-8','Starting and speed control','Starting and speed control','Rotating machines',8 from s
on conflict (subject_id, slug) do nothing;

insert into public.subjects (course_id, slug, title_en, title_bn, sort_order)
select c.id,'power','Power Systems','Power Systems',3 from public.courses c where c.slug='eee'
on conflict (course_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='power')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'per-unit-system-1','Per-unit system','Per-unit system','System analysis',1 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='power')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'load-flow-2','Load flow','Load flow','System analysis',2 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='power')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'fault-analysis-3','Fault analysis','Fault analysis','System analysis',3 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='power')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'symmetrical-components-4','Symmetrical components','Symmetrical components','System analysis',4 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='power')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'stability-5','Stability','Stability','System analysis',5 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='power')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'power-factor-correction-6','Power factor correction','Power factor correction','System analysis',6 from s
on conflict (subject_id, slug) do nothing;

insert into public.subjects (course_id, slug, title_en, title_bn, sort_order)
select c.id,'generation','Power Generation','Power Generation',4 from public.courses c where c.slug='eee'
on conflict (course_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='generation')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'thermal-stations-1','Thermal stations','Thermal stations','Generation fundamentals',1 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='generation')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'hydroelectric-stations-2','Hydroelectric stations','Hydroelectric stations','Generation fundamentals',2 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='generation')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'gas-turbines-3','Gas turbines','Gas turbines','Generation fundamentals',3 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='generation')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'nuclear-basics-4','Nuclear basics','Nuclear basics','Generation fundamentals',4 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='generation')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'load-curves-5','Load curves','Load curves','Generation fundamentals',5 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='generation')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'economic-dispatch-6','Economic dispatch','Economic dispatch','Generation fundamentals',6 from s
on conflict (subject_id, slug) do nothing;

insert into public.subjects (course_id, slug, title_en, title_bn, sort_order)
select c.id,'transmission','Transmission and Distribution','Transmission and Distribution',5 from public.courses c where c.slug='eee'
on conflict (course_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='transmission')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'line-parameters-1','Line parameters','Line parameters','Networks',1 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='transmission')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'short-and-long-lines-2','Short and long lines','Short and long lines','Networks',2 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='transmission')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'corona-3','Corona','Corona','Networks',3 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='transmission')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'insulators-4','Insulators','Insulators','Networks',4 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='transmission')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'cables-5','Cables','Cables','Networks',5 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='transmission')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'distribution-feeders-6','Distribution feeders','Distribution feeders','Networks',6 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='transmission')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'voltage-regulation-7','Voltage regulation','Voltage regulation','Networks',7 from s
on conflict (subject_id, slug) do nothing;

insert into public.subjects (course_id, slug, title_en, title_bn, sort_order)
select c.id,'power-electronics','Power Electronics','Power Electronics',6 from public.courses c where c.slug='eee'
on conflict (course_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='power-electronics')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'diodes-and-scrs-1','Diodes and SCRs','Diodes and SCRs','Devices and converters',1 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='power-electronics')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'mosfet-and-igbt-2','MOSFET and IGBT','MOSFET and IGBT','Devices and converters',2 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='power-electronics')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'rectifiers-3','Rectifiers','Rectifiers','Devices and converters',3 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='power-electronics')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'dc-choppers-4','DC choppers','DC choppers','Devices and converters',4 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='power-electronics')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'inverters-5','Inverters','Inverters','Devices and converters',5 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='power-electronics')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'pwm-6','PWM','PWM','Devices and converters',6 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='power-electronics')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'converter-losses-7','Converter losses','Converter losses','Devices and converters',7 from s
on conflict (subject_id, slug) do nothing;

insert into public.subjects (course_id, slug, title_en, title_bn, sort_order)
select c.id,'control','Control Systems','Control Systems',7 from public.courses c where c.slug='eee'
on conflict (course_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='control')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'transfer-functions-1','Transfer functions','Transfer functions','Modeling and response',1 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='control')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'block-diagrams-2','Block diagrams','Block diagrams','Modeling and response',2 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='control')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'time-response-3','Time response','Time response','Modeling and response',3 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='control')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'steady-state-error-4','Steady-state error','Steady-state error','Modeling and response',4 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='control')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'routh-criterion-5','Routh criterion','Routh criterion','Stability and design',5 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='control')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'root-locus-6','Root locus','Root locus','Stability and design',6 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='control')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'bode-plots-7','Bode plots','Bode plots','Stability and design',7 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='control')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'nyquist-criterion-8','Nyquist criterion','Nyquist criterion','Stability and design',8 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='control')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'pid-9','PID','PID','Stability and design',9 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='control')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'state-space-10','State space','State space','Stability and design',10 from s
on conflict (subject_id, slug) do nothing;

insert into public.subjects (course_id, slug, title_en, title_bn, sort_order)
select c.id,'measurement','Electrical Measurements','Electrical Measurements',8 from public.courses c where c.slug='eee'
on conflict (course_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='measurement')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'measurement-errors-1','Measurement errors','Measurement errors','Instruments',1 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='measurement')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'pmmc-and-mi-2','PMMC and MI','PMMC and MI','Instruments',2 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='measurement')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'bridges-3','Bridges','Bridges','Instruments',3 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='measurement')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'power-measurement-4','Power measurement','Power measurement','Instruments',4 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='measurement')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'energy-meters-5','Energy meters','Energy meters','Instruments',5 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='measurement')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'ct-and-pt-6','CT and PT','CT and PT','Instruments',6 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='measurement')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'oscilloscopes-7','Oscilloscopes','Oscilloscopes','Instruments',7 from s
on conflict (subject_id, slug) do nothing;

insert into public.subjects (course_id, slug, title_en, title_bn, sort_order)
select c.id,'analog','Analog Electronics','Analog Electronics',9 from public.courses c where c.slug='eee'
on conflict (course_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='analog')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'pn-junction-1','PN junction','PN junction','Semiconductors and amplifiers',1 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='analog')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'rectifiers-and-filters-2','Rectifiers and filters','Rectifiers and filters','Semiconductors and amplifiers',2 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='analog')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'bjt-biasing-3','BJT biasing','BJT biasing','Semiconductors and amplifiers',3 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='analog')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'mosfet-4','MOSFET','MOSFET','Semiconductors and amplifiers',4 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='analog')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'small-signal-amplifiers-5','Small-signal amplifiers','Small-signal amplifiers','Semiconductors and amplifiers',5 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='analog')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'op-amps-6','Op-amps','Op-amps','Semiconductors and amplifiers',6 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='analog')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'oscillators-7','Oscillators','Oscillators','Semiconductors and amplifiers',7 from s
on conflict (subject_id, slug) do nothing;

insert into public.subjects (course_id, slug, title_en, title_bn, sort_order)
select c.id,'digital','Digital Electronics','Digital Electronics',10 from public.courses c where c.slug='eee'
on conflict (course_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='digital')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'number-systems-1','Number systems','Number systems','Logic design',1 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='digital')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'boolean-algebra-2','Boolean algebra','Boolean algebra','Logic design',2 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='digital')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'karnaugh-maps-3','Karnaugh maps','Karnaugh maps','Logic design',3 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='digital')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'combinational-logic-4','Combinational logic','Combinational logic','Logic design',4 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='digital')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'flip-flops-5','Flip-flops','Flip-flops','Logic design',5 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='digital')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'counters-6','Counters','Counters','Logic design',6 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='digital')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'registers-7','Registers','Registers','Logic design',7 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='digital')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'adc-and-dac-8','ADC and DAC','ADC and DAC','Logic design',8 from s
on conflict (subject_id, slug) do nothing;

insert into public.subjects (course_id, slug, title_en, title_bn, sort_order)
select c.id,'safety','Electrical Installation and Safety','Electrical Installation and Safety',11 from public.courses c where c.slug='eee'
on conflict (course_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='safety')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'earthing-and-bonding-1','Earthing and bonding','Earthing and bonding','Safe installations',1 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='safety')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'wiring-systems-2','Wiring systems','Wiring systems','Safe installations',2 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='safety')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'cable-sizing-3','Cable sizing','Cable sizing','Safe installations',3 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='safety')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'protective-devices-4','Protective devices','Protective devices','Safe installations',4 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='safety')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'rcd-5','RCD','RCD','Safe installations',5 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='safety')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'isolation-and-lockout-6','Isolation and lockout','Isolation and lockout','Safe installations',6 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='safety')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'electrical-hazards-7','Electrical hazards','Electrical hazards','Safe installations',7 from s
on conflict (subject_id, slug) do nothing;

insert into public.subjects (course_id, slug, title_en, title_bn, sort_order)
select c.id,'protection','Switchgear and Protection','Switchgear and Protection',12 from public.courses c where c.slug='eee'
on conflict (course_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='protection')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'fuse-characteristics-1','Fuse characteristics','Fuse characteristics','Protection systems',1 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='protection')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'circuit-breakers-2','Circuit breakers','Circuit breakers','Protection systems',2 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='protection')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'overcurrent-relays-3','Overcurrent relays','Overcurrent relays','Protection systems',3 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='protection')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'differential-protection-4','Differential protection','Differential protection','Protection systems',4 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='protection')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'distance-protection-5','Distance protection','Distance protection','Protection systems',5 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='protection')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'coordination-6','Coordination','Coordination','Protection systems',6 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='protection')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'surge-protection-7','Surge protection','Surge protection','Protection systems',7 from s
on conflict (subject_id, slug) do nothing;

insert into public.subjects (course_id, slug, title_en, title_bn, sort_order)
select c.id,'renewable','Renewable Energy','Renewable Energy',13 from public.courses c where c.slug='eee'
on conflict (course_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='renewable')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'solar-pv-1','Solar PV','Solar PV','Renewable systems',1 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='renewable')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'mppt-2','MPPT','MPPT','Renewable systems',2 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='renewable')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'wind-conversion-3','Wind conversion','Wind conversion','Renewable systems',3 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='renewable')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'storage-4','Storage','Storage','Renewable systems',4 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='renewable')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'grid-integration-5','Grid integration','Grid integration','Renewable systems',5 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='renewable')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'inverter-control-6','Inverter control','Inverter control','Renewable systems',6 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='renewable')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'energy-yield-7','Energy yield','Energy yield','Renewable systems',7 from s
on conflict (subject_id, slug) do nothing;

insert into public.subjects (course_id, slug, title_en, title_bn, sort_order)
select c.id,'micro','Microprocessors and Microcontrollers','Microprocessors and Microcontrollers',14 from public.courses c where c.slug='eee'
on conflict (course_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='micro')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'architecture-1','Architecture','Architecture','Embedded fundamentals',1 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='micro')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'instruction-cycle-2','Instruction cycle','Instruction cycle','Embedded fundamentals',2 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='micro')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'memory-map-3','Memory map','Memory map','Embedded fundamentals',3 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='micro')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'gpio-4','GPIO','GPIO','Embedded fundamentals',4 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='micro')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'timers-5','Timers','Timers','Embedded fundamentals',5 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='micro')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'interrupts-6','Interrupts','Interrupts','Embedded fundamentals',6 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='micro')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'uart-spi-i2c-7','UART SPI I²C','UART SPI I²C','Embedded fundamentals',7 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='micro')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'adc-interfacing-8','ADC interfacing','ADC interfacing','Embedded fundamentals',8 from s
on conflict (subject_id, slug) do nothing;

insert into public.subjects (course_id, slug, title_en, title_bn, sort_order)
select c.id,'eng-math','Engineering Mathematics','Engineering Mathematics',15 from public.courses c where c.slug='eee'
on conflict (course_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='eng-math')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'complex-numbers-1','Complex numbers','Complex numbers','Mathematical tools',1 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='eng-math')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'matrices-2','Matrices','Matrices','Mathematical tools',2 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='eng-math')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'differentiation-3','Differentiation','Differentiation','Mathematical tools',3 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='eng-math')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'integration-4','Integration','Integration','Mathematical tools',4 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='eng-math')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'differential-equations-5','Differential equations','Differential equations','Mathematical tools',5 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='eng-math')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'laplace-transforms-6','Laplace transforms','Laplace transforms','Mathematical tools',6 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='eng-math')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'fourier-analysis-7','Fourier analysis','Fourier analysis','Mathematical tools',7 from s
on conflict (subject_id, slug) do nothing;
with s as (select su.id from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee' and su.slug='eng-math')
insert into public.topics (subject_id, slug, title_en, title_bn, chapter, sort_order)
select s.id,'probability-8','Probability','Probability','Mathematical tools',8 from s
on conflict (subject_id, slug) do nothing;
