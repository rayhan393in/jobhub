-- ============================================================================
-- BCS Written (compulsory) — subject -> P1..P4 -> topic -> subtopic
-- ============================================================================
-- 8 compulsory papers / 900 marks / 8 subjects.
--
-- SCOPE: a new course, slug 'bcs-written'. The Preliminary course ('bcs') is
-- not touched: no row of it is renamed, retired or moved. Each Written subject
-- records metadata.canonical_subject_slug (its Preliminary namesake) so shared
-- questions can be joined by slug without copying any row. The FK column
-- subjects.canonical_subject_id is left alone: it points at the central
-- canonical taxonomy, not at a peer subject.
--
-- P1-P4 IS NOT AN OFFICIAL BPSC RANKING. The written syllabus does not rank its
-- topics; P1-P4 here is the user's proposed study order, recorded on every row
-- as metadata.priority_source = 'proposed-study-priority'. The paper marks ARE
-- official.
--
-- General Science & Technology P4 is marked metadata.provisional = true: the
-- Technology part of the official PDF was not fully mapped when this was built.
--
-- SAFE TO RE-RUN: every insert is `on conflict (slug) do update`, so a second
-- run refreshes titles, order and priority and changes no uuid. Nothing is
-- deleted, and no existing question/routine/progress link can be lost.
-- ============================================================================

-- 0. প্রয়োজনীয় কলাম (এই মাইগ্রেশন একা চলতে পারবে)
alter table public.subtopics
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- 1. কোর্স: বিসিএস লিখিত (আলাদা কোর্স, প্রিলিমিনারি অক্ষত)
insert into public.courses
  (slug, title_en, title_bn, short_en, short_bn, summary_bn, description_bn,
   level, icon, accent, status, sort_order, metadata)
values
  ('bcs-written', 'BCS Written', 'বিসিএস লিখিত',
   'BCS Written', 'বিসিএস লিখিত',
   'বিসিএস লিখিত পরীক্ষার ৮টি আবশ্যিক পত্র — ৯০০ নম্বর। P1 → P2 → P3 → P4 অগ্রাধিকারক্রমে সাজানো।',
   'লিখিত পরীক্ষার জন্য মুখস্থ নয় — উত্তর লেখার অনুশীলন, বিশ্লেষণ ও উপসংহার লেখার দক্ষতা।',
   'advanced', 'pen-line', 'emerald', 'published', 2,
   '{"exam": "bcs", "stage": "written", "marks": 900, "papers": 8}'::jsonb)
on conflict (slug) do update
  set title_en = excluded.title_en,
      title_bn = excluded.title_bn,
      short_bn = excluded.short_bn,
      summary_bn = excluded.summary_bn,
      description_bn = excluded.description_bn,
      level = excluded.level,
      status = 'published',
      sort_order = excluded.sort_order,
      metadata = public.courses.metadata || excluded.metadata,
      updated_at = now();

-- 2. আটটি পত্র (subject). weight = পত্রের পূর্ণমান।
--    VALUES-এর ভেতরে CTE ব্যবহার করা যায় না, তাই কোর্স আইডি subquery দিয়ে।
insert into public.subjects
  (course_id, slug, title_en, title_bn, weight, sort_order, is_active, metadata)
values
  ((select id from public.courses where slug = 'bcs-written'), 'bangla-1', 'Bangla First Paper', 'বাংলা ১ম পত্র', 100, 1, true, '{"syllabus": "bcs-written", "marks": 100, "stage": "written", "canonical_subject_slug": "bangla"}'::jsonb),
  ((select id from public.courses where slug = 'bcs-written'), 'bangla-2', 'Bangla Second Paper', 'বাংলা ২য় পত্র', 100, 2, true, '{"syllabus": "bcs-written", "marks": 100, "stage": "written", "canonical_subject_slug": "bangla"}'::jsonb),
  ((select id from public.courses where slug = 'bcs-written'), 'english', 'English', 'English', 100, 3, true, '{"syllabus": "bcs-written", "marks": 200, "stage": "written", "canonical_subject_slug": "english"}'::jsonb),
  ((select id from public.courses where slug = 'bcs-written'), 'bd-affairs', 'Bangladesh Affairs', 'বাংলাদেশ বিষয়াবলি', 100, 4, true, '{"syllabus": "bcs-written", "marks": 200, "stage": "written", "canonical_subject_slug": "bd"}'::jsonb),
  ((select id from public.courses where slug = 'bcs-written'), 'international-affairs', 'International Affairs', 'আন্তর্জাতিক বিষয়াবলি', 100, 5, true, '{"syllabus": "bcs-written", "marks": 100, "stage": "written", "canonical_subject_slug": "international"}'::jsonb),
  ((select id from public.courses where slug = 'bcs-written'), 'math-reasoning', 'Mathematical Reasoning', 'গাণিতিক যুক্তি', 50, 6, true, '{"syllabus": "bcs-written", "marks": 50, "stage": "written", "canonical_subject_slug": "math"}'::jsonb),
  ((select id from public.courses where slug = 'bcs-written'), 'mental-ability', 'Mental Ability', 'মানসিক দক্ষতা', 50, 7, true, '{"syllabus": "bcs-written", "marks": 50, "stage": "written", "canonical_subject_slug": "mental"}'::jsonb),
  ((select id from public.courses where slug = 'bcs-written'), 'general-science', 'General Science and Technology', 'সাধারণ বিজ্ঞান ও প্রযুক্তি', 100, 8, true, '{"syllabus": "bcs-written", "marks": 100, "stage": "written", "canonical_subject_slug": "science"}'::jsonb)
on conflict (course_id, slug) do update
  set title_en = excluded.title_en,
      title_bn = excluded.title_bn,
      weight = excluded.weight,
      sort_order = excluded.sort_order,
      is_active = true,
      metadata = public.subjects.metadata || excluded.metadata,
      updated_at = now();

-- 3. টপিক (P1 → P4 ক্রমে সাজানো)
insert into public.topics (subject_id, slug, title_en, title_bn, sort_order, is_active, approval_status, metadata)
select su.id, v.slug, v.title_en, v.title_bn, v.sort_order, true, 'approved', v.metadata
  from (values
    ('bangla-1', 'bangla-1-t01', 'শব্দগঠন', 'শব্দগঠন', 1, '{"syllabus": "bcs-written", "priority": "P1", "priority_source": "proposed-study-priority", "band_marks": 30}'::jsonb),
    ('bangla-1', 'bangla-1-t02', 'বানান ও বানানের নিয়ম', 'বানান ও বানানের নিয়ম', 2, '{"syllabus": "bcs-written", "priority": "P1", "priority_source": "proposed-study-priority", "band_marks": 30}'::jsonb),
    ('bangla-1', 'bangla-1-t03', 'বাক্যশুদ্ধি ও প্রয়োগ-অপপ্রয়োগ', 'বাক্যশুদ্ধি ও প্রয়োগ-অপপ্রয়োগ', 3, '{"syllabus": "bcs-written", "priority": "P1", "priority_source": "proposed-study-priority", "band_marks": 30}'::jsonb),
    ('bangla-1', 'bangla-1-t04', 'প্রবাদ-প্রবচনের নিহিতার্থ প্রকাশ', 'প্রবাদ-প্রবচনের নিহিতার্থ প্রকাশ', 4, '{"syllabus": "bcs-written", "priority": "P1", "priority_source": "proposed-study-priority", "band_marks": 30}'::jsonb),
    ('bangla-1', 'bangla-1-t05', 'বাক্যগঠন', 'বাক্যগঠন', 5, '{"syllabus": "bcs-written", "priority": "P1", "priority_source": "proposed-study-priority", "band_marks": 30}'::jsonb),
    ('bangla-1', 'bangla-1-t06', 'ভাবসম্প্রসারণ', 'ভাবসম্প্রসারণ', 6, '{"syllabus": "bcs-written", "priority": "P2", "priority_source": "proposed-study-priority", "band_marks": 20}'::jsonb),
    ('bangla-1', 'bangla-1-t07', 'সারমর্ম', 'সারমর্ম', 7, '{"syllabus": "bcs-written", "priority": "P3", "priority_source": "proposed-study-priority", "band_marks": 20}'::jsonb),
    ('bangla-1', 'bangla-1-t08', 'প্রাচীন ও মধ্যযুগের সাহিত্য', 'প্রাচীন ও মধ্যযুগের সাহিত্য', 8, '{"syllabus": "bcs-written", "priority": "P4", "priority_source": "proposed-study-priority", "band_marks": 30}'::jsonb),
    ('bangla-1', 'bangla-1-t09', 'বাংলা গদ্য ও সাহিত্যের বিকাশ', 'বাংলা গদ্য ও সাহিত্যের বিকাশ', 9, '{"syllabus": "bcs-written", "priority": "P4", "priority_source": "proposed-study-priority", "band_marks": 30}'::jsonb),
    ('bangla-1', 'bangla-1-t10', 'আধুনিক বাংলা সাহিত্য', 'আধুনিক বাংলা সাহিত্য', 10, '{"syllabus": "bcs-written", "priority": "P4", "priority_source": "proposed-study-priority", "band_marks": 30}'::jsonb),
    ('bangla-1', 'bangla-1-t11', 'সমকালীন সাহিত্য', 'সমকালীন সাহিত্য', 11, '{"syllabus": "bcs-written", "priority": "P4", "priority_source": "proposed-study-priority", "band_marks": 30}'::jsonb),
    ('bangla-2', 'bangla-2-t01', 'রচনা', 'রচনা', 1, '{"syllabus": "bcs-written", "priority": "P1", "priority_source": "proposed-study-priority", "band_marks": 40}'::jsonb),
    ('bangla-2', 'bangla-2-t02', 'ইংরেজি থেকে বাংলা অনুবাদ', 'ইংরেজি থেকে বাংলা অনুবাদ', 2, '{"syllabus": "bcs-written", "priority": "P2", "priority_source": "proposed-study-priority", "band_marks": 15}'::jsonb),
    ('bangla-2', 'bangla-2-t03', 'পত্রলিখন', 'পত্রলিখন', 3, '{"syllabus": "bcs-written", "priority": "P3", "priority_source": "proposed-study-priority", "band_marks": 15}'::jsonb),
    ('bangla-2', 'bangla-2-t04', 'কাল্পনিক সংলাপ', 'কাল্পনিক সংলাপ', 4, '{"syllabus": "bcs-written", "priority": "P4", "priority_source": "proposed-study-priority", "band_marks": 30}'::jsonb),
    ('bangla-2', 'bangla-2-t05', 'গ্রন্থ-সমালোচনা', 'গ্রন্থ-সমালোচনা', 5, '{"syllabus": "bcs-written", "priority": "P4", "priority_source": "proposed-study-priority", "band_marks": 30}'::jsonb),
    ('english', 'english-t01', 'Reading Comprehension', 'Reading Comprehension', 1, '{"syllabus": "bcs-written", "priority": "P1", "priority_source": "proposed-study-priority", "band_marks": 60}'::jsonb),
    ('english', 'english-t02', 'Grammar and Usage', 'Grammar and Usage', 2, '{"syllabus": "bcs-written", "priority": "P1", "priority_source": "proposed-study-priority", "band_marks": 60}'::jsonb),
    ('english', 'english-t03', 'Summary Writing', 'Summary Writing', 3, '{"syllabus": "bcs-written", "priority": "P2", "priority_source": "proposed-study-priority", "band_marks": 40}'::jsonb),
    ('english', 'english-t04', 'Letter to the Editor', 'Letter to the Editor', 4, '{"syllabus": "bcs-written", "priority": "P2", "priority_source": "proposed-study-priority", "band_marks": 40}'::jsonb),
    ('english', 'english-t05', 'Essay', 'Essay', 5, '{"syllabus": "bcs-written", "priority": "P3", "priority_source": "proposed-study-priority", "band_marks": 50}'::jsonb),
    ('english', 'english-t06', 'Bangla to English Translation', 'Bangla to English Translation', 6, '{"syllabus": "bcs-written", "priority": "P4", "priority_source": "proposed-study-priority", "band_marks": 50}'::jsonb),
    ('english', 'english-t07', 'English to Bangla Translation', 'English to Bangla Translation', 7, '{"syllabus": "bcs-written", "priority": "P4", "priority_source": "proposed-study-priority", "band_marks": 50}'::jsonb),
    ('bd-affairs', 'bd-affairs-t01', 'বাংলাদেশের ইতিহাস ও সংস্কৃতি', 'বাংলাদেশের ইতিহাস ও সংস্কৃতি', 1, '{"syllabus": "bcs-written", "priority": "P1", "priority_source": "proposed-study-priority"}'::jsonb),
    ('bd-affairs', 'bd-affairs-t02', 'বাংলাদেশের সংবিধান', 'বাংলাদেশের সংবিধান', 2, '{"syllabus": "bcs-written", "priority": "P1", "priority_source": "proposed-study-priority"}'::jsonb),
    ('bd-affairs', 'bd-affairs-t03', 'সরকারের অঙ্গসমূহ', 'সরকারের অঙ্গসমূহ', 3, '{"syllabus": "bcs-written", "priority": "P2", "priority_source": "proposed-study-priority"}'::jsonb),
    ('bd-affairs', 'bd-affairs-t04', 'প্রশাসনিক কাঠামো', 'প্রশাসনিক কাঠামো', 4, '{"syllabus": "bcs-written", "priority": "P2", "priority_source": "proposed-study-priority"}'::jsonb),
    ('bd-affairs', 'bd-affairs-t05', 'রাজনৈতিক দল ও নির্বাচন', 'রাজনৈতিক দল ও নির্বাচন', 5, '{"syllabus": "bcs-written", "priority": "P2", "priority_source": "proposed-study-priority"}'::jsonb),
    ('bd-affairs', 'bd-affairs-t06', 'বাংলাদেশের অর্থনীতি', 'বাংলাদেশের অর্থনীতি', 6, '{"syllabus": "bcs-written", "priority": "P3", "priority_source": "proposed-study-priority"}'::jsonb),
    ('bd-affairs', 'bd-affairs-t07', 'বাংলাদেশের সমাজ ও জনসংখ্যা', 'বাংলাদেশের সমাজ ও জনসংখ্যা', 7, '{"syllabus": "bcs-written", "priority": "P3", "priority_source": "proposed-study-priority"}'::jsonb),
    ('bd-affairs', 'bd-affairs-t08', 'ভূগোল ও প্রাকৃতিক সম্পদ', 'ভূগোল ও প্রাকৃতিক সম্পদ', 8, '{"syllabus": "bcs-written", "priority": "P3", "priority_source": "proposed-study-priority"}'::jsonb),
    ('bd-affairs', 'bd-affairs-t09', 'পরিবেশ ও প্রকৃতি', 'পরিবেশ ও প্রকৃতি', 9, '{"syllabus": "bcs-written", "priority": "P3", "priority_source": "proposed-study-priority"}'::jsonb),
    ('bd-affairs', 'bd-affairs-t10', 'বিশ্বায়ন ও বাংলাদেশ', 'বিশ্বায়ন ও বাংলাদেশ', 10, '{"syllabus": "bcs-written", "priority": "P3", "priority_source": "proposed-study-priority"}'::jsonb),
    ('bd-affairs', 'bd-affairs-t11', 'বাংলাদেশের পররাষ্ট্রনীতি', 'বাংলাদেশের পররাষ্ট্রনীতি', 11, '{"syllabus": "bcs-written", "priority": "P4", "priority_source": "proposed-study-priority"}'::jsonb),
    ('bd-affairs', 'bd-affairs-t12', 'আন্তর্জাতিক সংস্থায় বাংলাদেশের অংশগ্রহণ', 'আন্তর্জাতিক সংস্থায় বাংলাদেশের অংশগ্রহণ', 12, '{"syllabus": "bcs-written", "priority": "P4", "priority_source": "proposed-study-priority"}'::jsonb),
    ('bd-affairs', 'bd-affairs-t13', 'ICT ও গণমাধ্যম', 'ICT ও গণমাধ্যম', 13, '{"syllabus": "bcs-written", "priority": "P4", "priority_source": "proposed-study-priority"}'::jsonb),
    ('bd-affairs', 'bd-affairs-t14', 'নাগরিক সমাজ ও বেসরকারি প্রতিষ্ঠান', 'নাগরিক সমাজ ও বেসরকারি প্রতিষ্ঠান', 14, '{"syllabus": "bcs-written", "priority": "P4", "priority_source": "proposed-study-priority"}'::jsonb),
    ('international-affairs', 'international-affairs-t01', 'International Affairs-এর পরিচিতি', 'International Affairs-এর পরিচিতি', 1, '{"syllabus": "bcs-written", "priority": "P1", "priority_source": "proposed-study-priority"}'::jsonb),
    ('international-affairs', 'international-affairs-t02', 'আন্তর্জাতিক ব্যবস্থার Actor', 'আন্তর্জাতিক ব্যবস্থার Actor', 2, '{"syllabus": "bcs-written", "priority": "P1", "priority_source": "proposed-study-priority"}'::jsonb),
    ('international-affairs', 'international-affairs-t03', 'Power and Security', 'Power and Security', 3, '{"syllabus": "bcs-written", "priority": "P1", "priority_source": "proposed-study-priority"}'::jsonb),
    ('international-affairs', 'international-affairs-t04', 'Major Ideas and Ideologies', 'Major Ideas and Ideologies', 4, '{"syllabus": "bcs-written", "priority": "P1", "priority_source": "proposed-study-priority"}'::jsonb),
    ('international-affairs', 'international-affairs-t05', 'Foreign Policy and Diplomacy', 'Foreign Policy and Diplomacy', 5, '{"syllabus": "bcs-written", "priority": "P2", "priority_source": "proposed-study-priority"}'::jsonb),
    ('international-affairs', 'international-affairs-t06', 'International Economic Relations', 'International Economic Relations', 6, '{"syllabus": "bcs-written", "priority": "P2", "priority_source": "proposed-study-priority"}'::jsonb),
    ('international-affairs', 'international-affairs-t07', 'Global Environment', 'Global Environment', 7, '{"syllabus": "bcs-written", "priority": "P2", "priority_source": "proposed-study-priority"}'::jsonb),
    ('international-affairs', 'international-affairs-t08', 'United Nations System', 'United Nations System', 8, '{"syllabus": "bcs-written", "priority": "P3", "priority_source": "proposed-study-priority"}'::jsonb),
    ('international-affairs', 'international-affairs-t09', 'Global Institutions', 'Global Institutions', 9, '{"syllabus": "bcs-written", "priority": "P3", "priority_source": "proposed-study-priority"}'::jsonb),
    ('international-affairs', 'international-affairs-t10', 'Regional Institutions', 'Regional Institutions', 10, '{"syllabus": "bcs-written", "priority": "P3", "priority_source": "proposed-study-priority"}'::jsonb),
    ('international-affairs', 'international-affairs-t11', 'Major Powers', 'Major Powers', 11, '{"syllabus": "bcs-written", "priority": "P4", "priority_source": "proposed-study-priority"}'::jsonb),
    ('international-affairs', 'international-affairs-t12', 'আন্তর্জাতিক সংঘাত ও সমস্যা', 'আন্তর্জাতিক সংঘাত ও সমস্যা', 12, '{"syllabus": "bcs-written", "priority": "P4", "priority_source": "proposed-study-priority"}'::jsonb),
    ('international-affairs', 'international-affairs-t13', 'South Asian Politics', 'South Asian Politics', 13, '{"syllabus": "bcs-written", "priority": "P4", "priority_source": "proposed-study-priority"}'::jsonb),
    ('international-affairs', 'international-affairs-t14', 'Bangladesh in International Affairs', 'Bangladesh in International Affairs', 14, '{"syllabus": "bcs-written", "priority": "P4", "priority_source": "proposed-study-priority"}'::jsonb),
    ('international-affairs', 'international-affairs-t15', 'Problem-solving and Analytical Writing', 'Problem-solving and Analytical Writing', 15, '{"syllabus": "bcs-written", "priority": "P4", "priority_source": "proposed-study-priority"}'::jsonb),
    ('math-reasoning', 'math-reasoning-t01', 'Simplification', 'Simplification', 1, '{"syllabus": "bcs-written", "priority": "P1", "priority_source": "proposed-study-priority"}'::jsonb),
    ('math-reasoning', 'math-reasoning-t02', 'Unitary Method', 'Unitary Method', 2, '{"syllabus": "bcs-written", "priority": "P1", "priority_source": "proposed-study-priority"}'::jsonb),
    ('math-reasoning', 'math-reasoning-t03', 'Average', 'Average', 3, '{"syllabus": "bcs-written", "priority": "P1", "priority_source": "proposed-study-priority"}'::jsonb),
    ('math-reasoning', 'math-reasoning-t04', 'Percentage', 'Percentage', 4, '{"syllabus": "bcs-written", "priority": "P1", "priority_source": "proposed-study-priority"}'::jsonb),
    ('math-reasoning', 'math-reasoning-t05', 'Interest', 'Interest', 5, '{"syllabus": "bcs-written", "priority": "P1", "priority_source": "proposed-study-priority"}'::jsonb),
    ('math-reasoning', 'math-reasoning-t06', 'Ratio and Proportion', 'Ratio and Proportion', 6, '{"syllabus": "bcs-written", "priority": "P1", "priority_source": "proposed-study-priority"}'::jsonb),
    ('math-reasoning', 'math-reasoning-t07', 'Profit and Loss', 'Profit and Loss', 7, '{"syllabus": "bcs-written", "priority": "P1", "priority_source": "proposed-study-priority"}'::jsonb),
    ('math-reasoning', 'math-reasoning-t08', 'LCM and GCD', 'LCM and GCD', 8, '{"syllabus": "bcs-written", "priority": "P1", "priority_source": "proposed-study-priority"}'::jsonb)
  ) as v(subject_slug, slug, title_en, title_bn, sort_order, metadata)
  join public.subjects su on su.slug = v.subject_slug
  join public.courses c on c.id = su.course_id and c.slug = 'bcs-written'
on conflict (subject_id, slug) do update
  set title_en = excluded.title_en,
      title_bn = excluded.title_bn,
      sort_order = excluded.sort_order,
      is_active = true,
      metadata = public.topics.metadata || excluded.metadata,
      updated_at = now();

-- 3. টপিক (P1 → P4 ক্রমে সাজানো)
insert into public.topics (subject_id, slug, title_en, title_bn, sort_order, is_active, approval_status, metadata)
select su.id, v.slug, v.title_en, v.title_bn, v.sort_order, true, 'approved', v.metadata
  from (values
    ('math-reasoning', 'math-reasoning-t09', 'Algebraic Formulas', 'Algebraic Formulas', 9, '{"syllabus": "bcs-written", "priority": "P2", "priority_source": "proposed-study-priority"}'::jsonb),
    ('math-reasoning', 'math-reasoning-t10', 'Factorization', 'Factorization', 10, '{"syllabus": "bcs-written", "priority": "P2", "priority_source": "proposed-study-priority"}'::jsonb),
    ('math-reasoning', 'math-reasoning-t11', 'Equations', 'Equations', 11, '{"syllabus": "bcs-written", "priority": "P2", "priority_source": "proposed-study-priority"}'::jsonb),
    ('math-reasoning', 'math-reasoning-t12', 'Inequalities', 'Inequalities', 12, '{"syllabus": "bcs-written", "priority": "P2", "priority_source": "proposed-study-priority"}'::jsonb),
    ('math-reasoning', 'math-reasoning-t13', 'Exponents and Logarithms', 'Exponents and Logarithms', 13, '{"syllabus": "bcs-written", "priority": "P2", "priority_source": "proposed-study-priority"}'::jsonb),
    ('math-reasoning', 'math-reasoning-t14', 'Line, Angle and Triangle', 'Line, Angle and Triangle', 14, '{"syllabus": "bcs-written", "priority": "P3", "priority_source": "proposed-study-priority"}'::jsonb),
    ('math-reasoning', 'math-reasoning-t15', 'Circle', 'Circle', 15, '{"syllabus": "bcs-written", "priority": "P3", "priority_source": "proposed-study-priority"}'::jsonb),
    ('math-reasoning', 'math-reasoning-t16', 'Area and Mensuration', 'Area and Mensuration', 16, '{"syllabus": "bcs-written", "priority": "P3", "priority_source": "proposed-study-priority"}'::jsonb),
    ('math-reasoning', 'math-reasoning-t17', 'Cartesian Geometry', 'Cartesian Geometry', 17, '{"syllabus": "bcs-written", "priority": "P3", "priority_source": "proposed-study-priority"}'::jsonb),
    ('math-reasoning', 'math-reasoning-t18', 'Sequence and Series', 'Sequence and Series', 18, '{"syllabus": "bcs-written", "priority": "P4", "priority_source": "proposed-study-priority"}'::jsonb),
    ('math-reasoning', 'math-reasoning-t19', 'Trigonometry', 'Trigonometry', 19, '{"syllabus": "bcs-written", "priority": "P4", "priority_source": "proposed-study-priority"}'::jsonb),
    ('math-reasoning', 'math-reasoning-t20', 'Set Theory', 'Set Theory', 20, '{"syllabus": "bcs-written", "priority": "P4", "priority_source": "proposed-study-priority"}'::jsonb),
    ('math-reasoning', 'math-reasoning-t21', 'Counting Principles', 'Counting Principles', 21, '{"syllabus": "bcs-written", "priority": "P4", "priority_source": "proposed-study-priority"}'::jsonb),
    ('mental-ability', 'mental-ability-t01', 'Verbal Reasoning', 'Verbal Reasoning', 1, '{"syllabus": "bcs-written", "priority": "P1", "priority_source": "proposed-study-priority"}'::jsonb),
    ('mental-ability', 'mental-ability-t02', 'Numerical Ability', 'Numerical Ability', 2, '{"syllabus": "bcs-written", "priority": "P2", "priority_source": "proposed-study-priority"}'::jsonb),
    ('mental-ability', 'mental-ability-t03', 'Abstract Reasoning', 'Abstract Reasoning', 3, '{"syllabus": "bcs-written", "priority": "P3", "priority_source": "proposed-study-priority"}'::jsonb),
    ('mental-ability', 'mental-ability-t04', 'Space Relations', 'Space Relations', 4, '{"syllabus": "bcs-written", "priority": "P4", "priority_source": "proposed-study-priority"}'::jsonb),
    ('mental-ability', 'mental-ability-t05', 'Spelling and Language', 'Spelling and Language', 5, '{"syllabus": "bcs-written", "priority": "P4", "priority_source": "proposed-study-priority"}'::jsonb),
    ('mental-ability', 'mental-ability-t06', 'Mechanical Reasoning', 'Mechanical Reasoning', 6, '{"syllabus": "bcs-written", "priority": "P4", "priority_source": "proposed-study-priority"}'::jsonb),
    ('general-science', 'general-science-t01', 'Light', 'Light', 1, '{"syllabus": "bcs-written", "priority": "P1", "priority_source": "proposed-study-priority"}'::jsonb),
    ('general-science', 'general-science-t02', 'Sound', 'Sound', 2, '{"syllabus": "bcs-written", "priority": "P1", "priority_source": "proposed-study-priority"}'::jsonb),
    ('general-science', 'general-science-t03', 'Magnetism', 'Magnetism', 3, '{"syllabus": "bcs-written", "priority": "P1", "priority_source": "proposed-study-priority"}'::jsonb),
    ('general-science', 'general-science-t04', 'Acid, Base and Salt', 'Acid, Base and Salt', 4, '{"syllabus": "bcs-written", "priority": "P1", "priority_source": "proposed-study-priority"}'::jsonb),
    ('general-science', 'general-science-t05', 'Water', 'Water', 5, '{"syllabus": "bcs-written", "priority": "P2", "priority_source": "proposed-study-priority"}'::jsonb),
    ('general-science', 'general-science-t06', 'Natural Resources', 'Natural Resources', 6, '{"syllabus": "bcs-written", "priority": "P2", "priority_source": "proposed-study-priority"}'::jsonb),
    ('general-science', 'general-science-t07', 'Atmosphere', 'Atmosphere', 7, '{"syllabus": "bcs-written", "priority": "P2", "priority_source": "proposed-study-priority"}'::jsonb),
    ('general-science', 'general-science-t08', 'Polymer', 'Polymer', 8, '{"syllabus": "bcs-written", "priority": "P3", "priority_source": "proposed-study-priority"}'::jsonb),
    ('general-science', 'general-science-t09', 'Food and Nutrition', 'Food and Nutrition', 9, '{"syllabus": "bcs-written", "priority": "P3", "priority_source": "proposed-study-priority"}'::jsonb),
    ('general-science', 'general-science-t10', 'প্রযুক্তি ও বিজ্ঞানভিত্তিক প্রয়োগ', 'প্রযুক্তি ও বিজ্ঞানভিত্তিক প্রয়োগ', 10, '{"syllabus": "bcs-written", "priority": "P4", "priority_source": "proposed-study-priority", "provisional": true}'::jsonb)
  ) as v(subject_slug, slug, title_en, title_bn, sort_order, metadata)
  join public.subjects su on su.slug = v.subject_slug
  join public.courses c on c.id = su.course_id and c.slug = 'bcs-written'
on conflict (subject_id, slug) do update
  set title_en = excluded.title_en,
      title_bn = excluded.title_bn,
      sort_order = excluded.sort_order,
      is_active = true,
      metadata = public.topics.metadata || excluded.metadata,
      updated_at = now();

-- 4. সাবটপিক (slug ও priority পেরেন্ট টপিক থেকে নেওয়া)
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order, is_active, approval_status, metadata)
select tp.id,
       tp.slug || '-s' || lpad(v.n::text, 2, '0'),
       v.title_en, v.title_bn, v.n, true, 'approved',
       tp.metadata - 'band_marks' - 'syllabus'
  from (values
    ('bangla-1-t01', 'উপসর্গ, প্রত্যয় ও সমাসের মাধ্যমে শব্দগঠন', 'উপসর্গ, প্রত্যয় ও সমাসের মাধ্যমে শব্দগঠন', 1, 'bangla-1'),
    ('bangla-1-t01', 'শব্দের গঠন ও ব্যবহার', 'শব্দের গঠন ও ব্যবহার', 2, 'bangla-1'),
    ('bangla-1-t02', 'শুদ্ধ বানান', 'শুদ্ধ বানান', 1, 'bangla-1'),
    ('bangla-1-t02', 'বানান সংশোধন', 'বানান সংশোধন', 2, 'bangla-1'),
    ('bangla-1-t03', 'বাক্যের ভুল সংশোধন', 'বাক্যের ভুল সংশোধন', 1, 'bangla-1'),
    ('bangla-1-t03', 'শব্দের যথাযথ প্রয়োগ', 'শব্দের যথাযথ প্রয়োগ', 2, 'bangla-1'),
    ('bangla-1-t04', 'প্রবাদ ও প্রবচনের অর্থ', 'প্রবাদ ও প্রবচনের অর্থ', 1, 'bangla-1'),
    ('bangla-1-t04', 'প্রাসঙ্গিক ব্যাখ্যা', 'প্রাসঙ্গিক ব্যাখ্যা', 2, 'bangla-1'),
    ('bangla-1-t05', 'শুদ্ধ বাক্য রচনা', 'শুদ্ধ বাক্য রচনা', 1, 'bangla-1'),
    ('bangla-1-t05', 'বাক্যের গঠন ও প্রকাশভঙ্গি', 'বাক্যের গঠন ও প্রকাশভঙ্গি', 2, 'bangla-1'),
    ('bangla-1-t06', 'উদ্ধৃতি ও প্রবাদভিত্তিক ভাবসম্প্রসারণ', 'উদ্ধৃতি ও প্রবাদভিত্তিক ভাবসম্প্রসারণ', 1, 'bangla-1'),
    ('bangla-1-t06', 'নৈতিক ও সামাজিক বিষয়', 'নৈতিক ও সামাজিক বিষয়', 2, 'bangla-1'),
    ('bangla-1-t06', 'সাহিত্য ও জীবনবোধ', 'সাহিত্য ও জীবনবোধ', 3, 'bangla-1'),
    ('bangla-1-t06', 'সমসাময়িক বিষয়', 'সমসাময়িক বিষয়', 4, 'bangla-1'),
    ('bangla-1-t07', 'গদ্যাংশের সারমর্ম', 'গদ্যাংশের সারমর্ম', 1, 'bangla-1'),
    ('bangla-1-t07', 'কবিতার সারমর্ম', 'কবিতার সারমর্ম', 2, 'bangla-1'),
    ('bangla-1-t07', 'মূল বক্তব্য শনাক্তকরণ', 'মূল বক্তব্য শনাক্তকরণ', 3, 'bangla-1'),
    ('bangla-1-t07', 'সংক্ষিপ্ত ও যথাযথ ভাষায় উপস্থাপন', 'সংক্ষিপ্ত ও যথাযথ ভাষায় উপস্থাপন', 4, 'bangla-1'),
    ('bangla-1-t08', 'চর্যাপদ', 'চর্যাপদ', 1, 'bangla-1'),
    ('bangla-1-t08', 'মঙ্গলকাব্য', 'মঙ্গলকাব্য', 2, 'bangla-1'),
    ('bangla-1-t08', 'রোমান্টিক কাব্য', 'রোমান্টিক কাব্য', 3, 'bangla-1'),
    ('bangla-1-t09', 'ফোর্ট উইলিয়াম কলেজ', 'ফোর্ট উইলিয়াম কলেজ', 1, 'bangla-1'),
    ('bangla-1-t09', 'ঈশ্বরচন্দ্র বিদ্যাসাগর', 'ঈশ্বরচন্দ্র বিদ্যাসাগর', 2, 'bangla-1'),
    ('bangla-1-t09', 'বঙ্কিমচন্দ্র চট্টোপাধ্যায়', 'বঙ্কিমচন্দ্র চট্টোপাধ্যায়', 3, 'bangla-1'),
    ('bangla-1-t10', 'মাইকেল মধুসূদন দত্ত', 'মাইকেল মধুসূদন দত্ত', 1, 'bangla-1'),
    ('bangla-1-t10', 'মীর মশাররফ হোসেন', 'মীর মশাররফ হোসেন', 2, 'bangla-1'),
    ('bangla-1-t10', 'রবীন্দ্রনাথ ঠাকুর', 'রবীন্দ্রনাথ ঠাকুর', 3, 'bangla-1'),
    ('bangla-1-t10', 'দীনবন্ধু মিত্র', 'দীনবন্ধু মিত্র', 4, 'bangla-1'),
    ('bangla-1-t10', 'কাজী নজরুল ইসলাম', 'কাজী নজরুল ইসলাম', 5, 'bangla-1'),
    ('bangla-1-t10', 'জসীমউদ্দীন', 'জসীমউদ্দীন', 6, 'bangla-1'),
    ('bangla-1-t10', 'বেগম রোকেয়া', 'বেগম রোকেয়া', 7, 'bangla-1'),
    ('bangla-1-t10', 'ফররুখ আহমদ', 'ফররুখ আহমদ', 8, 'bangla-1'),
    ('bangla-1-t10', 'কায়কোবাদ', 'কায়কোবাদ', 9, 'bangla-1'),
    ('bangla-1-t11', 'আধুনিক ও সমকালীন কবি', 'আধুনিক ও সমকালীন কবি', 1, 'bangla-1'),
    ('bangla-1-t11', 'আধুনিক ও সমকালীন লেখক', 'আধুনিক ও সমকালীন লেখক', 2, 'bangla-1'),
    ('bangla-1-t11', 'আধুনিক ও সমকালীন নাট্যকার', 'আধুনিক ও সমকালীন নাট্যকার', 3, 'bangla-1'),
    ('bangla-2-t01', 'বাংলাদেশ বিষয়াবলি', 'বাংলাদেশ বিষয়াবলি', 1, 'bangla-2'),
    ('bangla-2-t01', 'জাতীয় ও আন্তর্জাতিক গুরুত্বপূর্ণ বিষয়', 'জাতীয় ও আন্তর্জাতিক গুরুত্বপূর্ণ বিষয়', 2, 'bangla-2'),
    ('bangla-2-t01', 'শিক্ষা, সমাজ ও সংস্কৃতি', 'শিক্ষা, সমাজ ও সংস্কৃতি', 3, 'bangla-2'),
    ('bangla-2-t01', 'বিজ্ঞান, প্রযুক্তি ও অর্থনীতি', 'বিজ্ঞান, প্রযুক্তি ও অর্থনীতি', 4, 'bangla-2'),
    ('bangla-2-t01', 'পরিবেশ ও উন্নয়ন', 'পরিবেশ ও উন্নয়ন', 5, 'bangla-2'),
    ('bangla-2-t02', 'শব্দ ও বাক্যাংশের যথাযথ অর্থ', 'শব্দ ও বাক্যাংশের যথাযথ অর্থ', 1, 'bangla-2'),
    ('bangla-2-t02', 'বাক্যের ভাব বজায় রাখা', 'বাক্যের ভাব বজায় রাখা', 2, 'bangla-2'),
    ('bangla-2-t02', 'প্রাসঙ্গিক ও প্রাঞ্জল বাংলা', 'প্রাসঙ্গিক ও প্রাঞ্জল বাংলা', 3, 'bangla-2'),
    ('bangla-2-t03', 'আনুষ্ঠানিক পত্র', 'আনুষ্ঠানিক পত্র', 1, 'bangla-2'),
    ('bangla-2-t03', 'আধা-আনুষ্ঠানিক পত্র', 'আধা-আনুষ্ঠানিক পত্র', 2, 'bangla-2'),
    ('bangla-2-t03', 'স্মারকলিপি', 'স্মারকলিপি', 3, 'bangla-2'),
    ('bangla-2-t03', 'ব্যবসায়িক পত্র', 'ব্যবসায়িক পত্র', 4, 'bangla-2'),
    ('bangla-2-t04', 'সামাজিক ও জাতীয় বিষয়', 'সামাজিক ও জাতীয় বিষয়', 1, 'bangla-2'),
    ('bangla-2-t04', 'সমসাময়িক সমস্যা', 'সমসাময়িক সমস্যা', 2, 'bangla-2'),
    ('bangla-2-t04', 'যুক্তিনির্ভর সংলাপ', 'যুক্তিনির্ভর সংলাপ', 3, 'bangla-2'),
    ('bangla-2-t05', 'গ্রন্থ পরিচিতি', 'গ্রন্থ পরিচিতি', 1, 'bangla-2'),
    ('bangla-2-t05', 'মূল বক্তব্য ও বিষয়বস্তু', 'মূল বক্তব্য ও বিষয়বস্তু', 2, 'bangla-2'),
    ('bangla-2-t05', 'সাহিত্যমান ও মূল্যায়ন', 'সাহিত্যমান ও মূল্যায়ন', 3, 'bangla-2'),
    ('english-t01', 'Unseen passage', 'Unseen passage', 1, 'english'),
    ('english-t01', 'Thematic questions', 'Thematic questions', 2, 'english'),
    ('english-t01', 'Main idea and supporting arguments', 'Main idea and supporting arguments', 3, 'english'),
    ('english-t01', 'Inference and interpretation', 'Inference and interpretation', 4, 'english'),
    ('english-t02', 'Parts of speech', 'Parts of speech', 1, 'english'),
    ('english-t02', 'Tense and sequence of tenses', 'Tense and sequence of tenses', 2, 'english'),
    ('english-t02', 'Subject-verb agreement', 'Subject-verb agreement', 3, 'english'),
    ('english-t02', 'Articles and prepositions', 'Articles and prepositions', 4, 'english'),
    ('english-t02', 'Sentence structure', 'Sentence structure', 5, 'english'),
    ('english-t02', 'Clauses and phrases', 'Clauses and phrases', 6, 'english'),
    ('english-t02', 'Voice and narration', 'Voice and narration', 7, 'english'),
    ('english-t02', 'Transformation', 'Transformation', 8, 'english'),
    ('english-t02', 'Appropriate word usage', 'Appropriate word usage', 9, 'english'),
    ('english-t02', 'Error detection and correction', 'Error detection and correction', 10, 'english'),
    ('english-t03', 'Main idea identification', 'Main idea identification', 1, 'english'),
    ('english-t03', 'Concise expression', 'Concise expression', 2, 'english'),
    ('english-t03', 'Writing within 100 words', 'Writing within 100 words', 3, 'english'),
    ('english-t03', 'Avoiding unnecessary details', 'Avoiding unnecessary details', 4, 'english'),
    ('english-t04', 'Formal letter format', 'Formal letter format', 1, 'english'),
    ('english-t04', 'Issue identification', 'Issue identification', 2, 'english'),
    ('english-t04', 'Argument and recommendation', 'Argument and recommendation', 3, 'english'),
    ('english-t04', 'Appropriate tone and language', 'Appropriate tone and language', 4, 'english'),
    ('english-t05', 'Contemporary issues', 'Contemporary issues', 1, 'english'),
    ('english-t05', 'Bangladesh-related issues', 'Bangladesh-related issues', 2, 'english'),
    ('english-t05', 'International affairs', 'International affairs', 3, 'english'),
    ('english-t05', 'Economy and development', 'Economy and development', 4, 'english'),
    ('english-t05', 'Science and technology', 'Science and technology', 5, 'english'),
    ('english-t05', 'Environment and climate change', 'Environment and climate change', 6, 'english'),
    ('english-t05', 'Governance and society', 'Governance and society', 7, 'english'),
    ('english-t05', 'Analytical and argumentative writing', 'Analytical and argumentative writing', 8, 'english'),
    ('english-t06', 'Sentence translation', 'Sentence translation', 1, 'english'),
    ('english-t06', 'Paragraph translation', 'Paragraph translation', 2, 'english'),
    ('english-t06', 'Appropriate vocabulary', 'Appropriate vocabulary', 3, 'english'),
    ('english-t06', 'Grammatical accuracy', 'Grammatical accuracy', 4, 'english'),
    ('english-t07', 'Sentence translation', 'Sentence translation', 1, 'english'),
    ('english-t07', 'Paragraph translation', 'Paragraph translation', 2, 'english'),
    ('english-t07', 'Contextual meaning', 'Contextual meaning', 3, 'english'),
    ('english-t07', 'Natural Bengali expression', 'Natural Bengali expression', 4, 'english'),
    ('bd-affairs-t01', 'প্রাচীন থেকে আধুনিক বাংলাদেশের ইতিহাস', 'প্রাচীন থেকে আধুনিক বাংলাদেশের ইতিহাস', 1, 'bd-affairs'),
    ('bd-affairs-t01', 'ভাষা আন্দোলন ১৯৫২', 'ভাষা আন্দোলন ১৯৫২', 2, 'bd-affairs'),
    ('bd-affairs-t01', '১৯৫৪ সালের নির্বাচন', '১৯৫৪ সালের নির্বাচন', 3, 'bd-affairs'),
    ('bd-affairs-t01', 'ছয় দফা আন্দোলন ১৯৬৬', 'ছয় দফা আন্দোলন ১৯৬৬', 4, 'bd-affairs'),
    ('bd-affairs-t01', 'গণ-অভ্যুত্থান ১৯৬৮–৬৯', 'গণ-অভ্যুত্থান ১৯৬৮–৬৯', 5, 'bd-affairs'),
    ('bd-affairs-t01', '১৯৭০ সালের সাধারণ নির্বাচন', '১৯৭০ সালের সাধারণ নির্বাচন', 6, 'bd-affairs'),
    ('bd-affairs-t01', 'অসহযোগ আন্দোলন ১৯৭১', 'অসহযোগ আন্দোলন ১৯৭১', 7, 'bd-affairs'),
    ('bd-affairs-t01', '৭ মার্চের ঐতিহাসিক ভাষণ', '৭ মার্চের ঐতিহাসিক ভাষণ', 8, 'bd-affairs'),
    ('bd-affairs-t01', 'মুজিবনগর সরকার: গঠন ও কার্যাবলি', 'মুজিবনগর সরকার: গঠন ও কার্যাবলি', 9, 'bd-affairs'),
    ('bd-affairs-t01', 'মুক্তিযুদ্ধে প্রধান শক্তি ও জাতিসংঘের ভূমিকা', 'মুক্তিযুদ্ধে প্রধান শক্তি ও জাতিসংঘের ভূমিকা', 10, 'bd-affairs'),
    ('bd-affairs-t01', 'পাকিস্তানি বাহিনীর আত্মসমর্পণ', 'পাকিস্তানি বাহিনীর আত্মসমর্পণ', 11, 'bd-affairs'),
    ('bd-affairs-t01', 'বঙ্গবন্ধুর স্বদেশ প্রত্যাবর্তন', 'বঙ্গবন্ধুর স্বদেশ প্রত্যাবর্তন', 12, 'bd-affairs'),
    ('bd-affairs-t01', 'বাংলাদেশ থেকে ভারতীয় সশস্ত্র বাহিনীর প্রত্যাহার', 'বাংলাদেশ থেকে ভারতীয় সশস্ত্র বাহিনীর প্রত্যাহার', 13, 'bd-affairs'),
    ('bd-affairs-t02', 'প্রস্তাবনা', 'প্রস্তাবনা', 1, 'bd-affairs'),
    ('bd-affairs-t02', 'সংবিধানের বৈশিষ্ট্য', 'সংবিধানের বৈশিষ্ট্য', 2, 'bd-affairs'),
    ('bd-affairs-t02', 'রাষ্ট্র পরিচালনার মূলনীতি', 'রাষ্ট্র পরিচালনার মূলনীতি', 3, 'bd-affairs'),
    ('bd-affairs-t02', 'সংবিধান সংশোধনী', 'সংবিধান সংশোধনী', 4, 'bd-affairs'),
    ('bd-affairs-t03', 'আইনসভা', 'আইনসভা', 1, 'bd-affairs')
  ) as v(topic_slug, title_en, title_bn, n, subject_slug)
  join public.subjects su on su.slug = v.subject_slug
  join public.courses c on c.id = su.course_id and c.slug = 'bcs-written'
  join public.topics tp on tp.subject_id = su.id and tp.slug = v.topic_slug
on conflict (topic_id, slug) do update
  set title_en = excluded.title_en,
      title_bn = excluded.title_bn,
      sort_order = excluded.sort_order,
      is_active = true,
      metadata = public.subtopics.metadata || excluded.metadata,
      updated_at = now();

-- 4. সাবটপিক (slug ও priority পেরেন্ট টপিক থেকে নেওয়া)
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order, is_active, approval_status, metadata)
select tp.id,
       tp.slug || '-s' || lpad(v.n::text, 2, '0'),
       v.title_en, v.title_bn, v.n, true, 'approved',
       tp.metadata - 'band_marks' - 'syllabus'
  from (values
    ('bd-affairs-t03', 'আইন প্রণয়ন ও আর্থিক কার্যাবলি', 'আইন প্রণয়ন ও আর্থিক কার্যাবলি', 2, 'bd-affairs'),
    ('bd-affairs-t03', 'সংসদের তদারকি কার্যাবলি', 'সংসদের তদারকি কার্যাবলি', 3, 'bd-affairs'),
    ('bd-affairs-t03', 'নির্বাহী বিভাগ', 'নির্বাহী বিভাগ', 4, 'bd-affairs'),
    ('bd-affairs-t03', 'রাষ্ট্রপতি ও প্রধানমন্ত্রীর ক্ষমতা ও কার্যাবলি', 'রাষ্ট্রপতি ও প্রধানমন্ত্রীর ক্ষমতা ও কার্যাবলি', 5, 'bd-affairs'),
    ('bd-affairs-t03', 'মন্ত্রিসভা ও মন্ত্রণালয়', 'মন্ত্রিসভা ও মন্ত্রণালয়', 6, 'bd-affairs'),
    ('bd-affairs-t03', 'আমলাতন্ত্র ও সচিবালয়', 'আমলাতন্ত্র ও সচিবালয়', 7, 'bd-affairs'),
    ('bd-affairs-t03', 'আইনশৃঙ্খলা রক্ষাকারী বাহিনী', 'আইনশৃঙ্খলা রক্ষাকারী বাহিনী', 8, 'bd-affairs'),
    ('bd-affairs-t03', 'বিচার বিভাগ', 'বিচার বিভাগ', 9, 'bd-affairs'),
    ('bd-affairs-t03', 'সুপ্রিম কোর্ট ও অধস্তন আদালত', 'সুপ্রিম কোর্ট ও অধস্তন আদালত', 10, 'bd-affairs'),
    ('bd-affairs-t03', 'বিচার বিভাগের স্বাধীনতা', 'বিচার বিভাগের স্বাধীনতা', 11, 'bd-affairs'),
    ('bd-affairs-t03', 'Judicial Review', 'Judicial Review', 12, 'bd-affairs'),
    ('bd-affairs-t03', 'Alternative Dispute Resolution (ADR)', 'Alternative Dispute Resolution (ADR)', 13, 'bd-affairs'),
    ('bd-affairs-t04', 'জাতীয় ও স্থানীয় সরকার', 'জাতীয় ও স্থানীয় সরকার', 1, 'bd-affairs'),
    ('bd-affairs-t04', 'বিকেন্দ্রীকরণ', 'বিকেন্দ্রীকরণ', 2, 'bd-affairs'),
    ('bd-affairs-t04', 'স্থানীয় পর্যায়ের পরিকল্পনা', 'স্থানীয় পর্যায়ের পরিকল্পনা', 3, 'bd-affairs'),
    ('bd-affairs-t05', 'রাজনৈতিক দলের ঐতিহাসিক বিকাশ', 'রাজনৈতিক দলের ঐতিহাসিক বিকাশ', 1, 'bd-affairs'),
    ('bd-affairs-t05', 'নেতৃত্ব, আদর্শ ও কর্মসূচি', 'নেতৃত্ব, আদর্শ ও কর্মসূচি', 2, 'bd-affairs'),
    ('bd-affairs-t05', 'দলীয় জোট ও দলীয় রাজনীতি', 'দলীয় জোট ও দলীয় রাজনীতি', 3, 'bd-affairs'),
    ('bd-affairs-t05', 'নির্বাচন কমিশন', 'নির্বাচন কমিশন', 4, 'bd-affairs'),
    ('bd-affairs-t05', 'নির্বাচনী আইন', 'নির্বাচনী আইন', 5, 'bd-affairs'),
    ('bd-affairs-t05', 'Representation of People Order (RPO)', 'Representation of People Order (RPO)', 6, 'bd-affairs'),
    ('bd-affairs-t05', 'নির্বাচনী আচরণ ও পর্যবেক্ষণ', 'নির্বাচনী আচরণ ও পর্যবেক্ষণ', 7, 'bd-affairs'),
    ('bd-affairs-t06', 'GDP, GNP ও NNP', 'GDP, GNP ও NNP', 1, 'bd-affairs'),
    ('bd-affairs-t06', 'দারিদ্র্য বিমোচন', 'দারিদ্র্য বিমোচন', 2, 'bd-affairs'),
    ('bd-affairs-t06', 'অর্থনৈতিক উন্নয়ন', 'অর্থনৈতিক উন্নয়ন', 3, 'bd-affairs'),
    ('bd-affairs-t06', 'Vision 2021', 'Vision 2021', 4, 'bd-affairs'),
    ('bd-affairs-t06', 'জাতীয় উন্নয়ন ও অর্থনৈতিক প্রবৃদ্ধি', 'জাতীয় উন্নয়ন ও অর্থনৈতিক প্রবৃদ্ধি', 5, 'bd-affairs'),
    ('bd-affairs-t07', 'জনমিতিক বৈশিষ্ট্য', 'জনমিতিক বৈশিষ্ট্য', 1, 'bd-affairs'),
    ('bd-affairs-t07', 'জাতিগত ও সাংস্কৃতিক বৈচিত্র্য', 'জাতিগত ও সাংস্কৃতিক বৈচিত্র্য', 2, 'bd-affairs'),
    ('bd-affairs-t07', 'নারী ও উন্নয়ন', 'নারী ও উন্নয়ন', 3, 'bd-affairs'),
    ('bd-affairs-t07', 'সামাজিক সমস্যা ও সম্ভাবনা', 'সামাজিক সমস্যা ও সম্ভাবনা', 4, 'bd-affairs'),
    ('bd-affairs-t08', 'বাংলাদেশের ভূপ্রকৃতি', 'বাংলাদেশের ভূপ্রকৃতি', 1, 'bd-affairs'),
    ('bd-affairs-t08', 'বিভিন্ন অঞ্চলের বৈশিষ্ট্য', 'বিভিন্ন অঞ্চলের বৈশিষ্ট্য', 2, 'bd-affairs'),
    ('bd-affairs-t08', 'প্রাকৃতিক সম্পদ', 'প্রাকৃতিক সম্পদ', 3, 'bd-affairs'),
    ('bd-affairs-t08', 'সম্পদের টেকসই ব্যবস্থাপনা', 'সম্পদের টেকসই ব্যবস্থাপনা', 4, 'bd-affairs'),
    ('bd-affairs-t09', 'পরিবেশ সংরক্ষণ', 'পরিবেশ সংরক্ষণ', 1, 'bd-affairs'),
    ('bd-affairs-t09', 'জীববৈচিত্র্য', 'জীববৈচিত্র্য', 2, 'bd-affairs'),
    ('bd-affairs-t09', 'পরিবেশগত চ্যালেঞ্জ', 'পরিবেশগত চ্যালেঞ্জ', 3, 'bd-affairs'),
    ('bd-affairs-t09', 'টেকসই উন্নয়ন', 'টেকসই উন্নয়ন', 4, 'bd-affairs'),
    ('bd-affairs-t10', 'বিশ্বায়নের অর্থনৈতিক ও রাজনৈতিক প্রভাব', 'বিশ্বায়নের অর্থনৈতিক ও রাজনৈতিক প্রভাব', 1, 'bd-affairs'),
    ('bd-affairs-t10', 'WTO', 'WTO', 2, 'bd-affairs'),
    ('bd-affairs-t10', 'World Bank', 'World Bank', 3, 'bd-affairs'),
    ('bd-affairs-t10', 'IMF', 'IMF', 4, 'bd-affairs'),
    ('bd-affairs-t10', 'ADB ও IDB', 'ADB ও IDB', 5, 'bd-affairs'),
    ('bd-affairs-t10', 'বহুজাতিক কোম্পানি', 'বহুজাতিক কোম্পানি', 6, 'bd-affairs'),
    ('bd-affairs-t11', 'পররাষ্ট্রনীতির লক্ষ্য ও নির্ধারক', 'পররাষ্ট্রনীতির লক্ষ্য ও নির্ধারক', 1, 'bd-affairs'),
    ('bd-affairs-t11', 'নীতি প্রণয়ন প্রক্রিয়া', 'নীতি প্রণয়ন প্রক্রিয়া', 2, 'bd-affairs'),
    ('bd-affairs-t11', 'জাতীয় ক্ষমতার উপাদান', 'জাতীয় ক্ষমতার উপাদান', 3, 'bd-affairs'),
    ('bd-affairs-t11', 'নিরাপত্তা কৌশল', 'নিরাপত্তা কৌশল', 4, 'bd-affairs'),
    ('bd-affairs-t11', 'ভূরাজনীতি ও পরিবেশগত বিষয়', 'ভূরাজনীতি ও পরিবেশগত বিষয়', 5, 'bd-affairs'),
    ('bd-affairs-t11', 'অর্থনৈতিক কূটনীতি', 'অর্থনৈতিক কূটনীতি', 6, 'bd-affairs'),
    ('bd-affairs-t11', 'বৈদেশিক সাহায্য ও আন্তর্জাতিক বাণিজ্য', 'বৈদেশিক সাহায্য ও আন্তর্জাতিক বাণিজ্য', 7, 'bd-affairs'),
    ('bd-affairs-t12', 'জাতিসংঘ', 'জাতিসংঘ', 1, 'bd-affairs'),
    ('bd-affairs-t12', 'শান্তিরক্ষা মিশন', 'শান্তিরক্ষা মিশন', 2, 'bd-affairs'),
    ('bd-affairs-t12', 'NAM', 'NAM', 3, 'bd-affairs'),
    ('bd-affairs-t12', 'SAARC', 'SAARC', 4, 'bd-affairs'),
    ('bd-affairs-t12', 'OIC', 'OIC', 5, 'bd-affairs'),
    ('bd-affairs-t12', 'BIMSTEC', 'BIMSTEC', 6, 'bd-affairs'),
    ('bd-affairs-t12', 'D-8', 'D-8', 7, 'bd-affairs'),
    ('bd-affairs-t13', 'সমসাময়িক যোগাযোগব্যবস্থা', 'সমসাময়িক যোগাযোগব্যবস্থা', 1, 'bd-affairs'),
    ('bd-affairs-t13', 'গণমাধ্যমের ভূমিকা', 'গণমাধ্যমের ভূমিকা', 2, 'bd-affairs'),
    ('bd-affairs-t13', 'তথ্য অধিকার আইন (RTI)', 'তথ্য অধিকার আইন (RTI)', 3, 'bd-affairs'),
    ('bd-affairs-t13', 'ই-গভর্ন্যান্স', 'ই-গভর্ন্যান্স', 4, 'bd-affairs'),
    ('bd-affairs-t14', 'Civil Society', 'Civil Society', 1, 'bd-affairs'),
    ('bd-affairs-t14', 'Interest Groups', 'Interest Groups', 2, 'bd-affairs'),
    ('bd-affairs-t14', 'NGOs', 'NGOs', 3, 'bd-affairs'),
    ('bd-affairs-t14', 'Non-formal Institutions', 'Non-formal Institutions', 4, 'bd-affairs'),
    ('international-affairs-t01', 'অর্থ, পরিধি ও গুরুত্ব', 'অর্থ, পরিধি ও গুরুত্ব', 1, 'international-affairs'),
    ('international-affairs-t01', 'International Affairs ও International Politics-এর সম্পর্ক', 'International Affairs ও International Politics-এর সম্পর্ক', 2, 'international-affairs'),
    ('international-affairs-t02', 'Modern State', 'Modern State', 1, 'international-affairs'),
    ('international-affairs-t02', 'Sovereignty', 'Sovereignty', 2, 'international-affairs'),
    ('international-affairs-t02', 'Non-state Actors', 'Non-state Actors', 3, 'international-affairs'),
    ('international-affairs-t02', 'International Institutions', 'International Institutions', 4, 'international-affairs'),
    ('international-affairs-t03', 'Power ও National Power', 'Power ও National Power', 1, 'international-affairs'),
    ('international-affairs-t03', 'Balance of Power', 'Balance of Power', 2, 'international-affairs'),
    ('international-affairs-t03', 'Disarmament', 'Disarmament', 3, 'international-affairs'),
    ('international-affairs-t03', 'Arms Control', 'Arms Control', 4, 'international-affairs'),
    ('international-affairs-t03', 'Geopolitics', 'Geopolitics', 5, 'international-affairs'),
    ('international-affairs-t03', 'Terrorism', 'Terrorism', 6, 'international-affairs'),
    ('international-affairs-t04', 'Nationalism', 'Nationalism', 1, 'international-affairs'),
    ('international-affairs-t04', 'Imperialism', 'Imperialism', 2, 'international-affairs'),
    ('international-affairs-t04', 'Colonialism', 'Colonialism', 3, 'international-affairs'),
    ('international-affairs-t04', 'Neo-colonialism', 'Neo-colonialism', 4, 'international-affairs'),
    ('international-affairs-t04', 'Post-modernism', 'Post-modernism', 5, 'international-affairs'),
    ('international-affairs-t04', 'Globalization', 'Globalization', 6, 'international-affairs'),
    ('international-affairs-t04', 'New World Order', 'New World Order', 7, 'international-affairs'),
    ('international-affairs-t05', 'পররাষ্ট্রনীতির ধারণা', 'পররাষ্ট্রনীতির ধারণা', 1, 'international-affairs'),
    ('international-affairs-t05', 'পররাষ্ট্রনীতি নির্ধারণ', 'পররাষ্ট্রনীতি নির্ধারণ', 2, 'international-affairs'),
    ('international-affairs-t05', 'Decision-making process', 'Decision-making process', 3, 'international-affairs'),
    ('international-affairs-t05', 'কূটনীতির কার্যাবলি', 'কূটনীতির কার্যাবলি', 4, 'international-affairs'),
    ('international-affairs-t05', 'Diplomatic Immunities and Privileges', 'Diplomatic Immunities and Privileges', 5, 'international-affairs'),
    ('international-affairs-t06', 'International Trade', 'International Trade', 1, 'international-affairs'),
    ('international-affairs-t06', 'Free Trade', 'Free Trade', 2, 'international-affairs'),
    ('international-affairs-t06', 'Protectionism', 'Protectionism', 3, 'international-affairs'),
    ('international-affairs-t06', 'Foreign Aid', 'Foreign Aid', 4, 'international-affairs'),
    ('international-affairs-t06', 'Debt Crisis', 'Debt Crisis', 5, 'international-affairs'),
    ('international-affairs-t06', 'Foreign Direct Investment (FDI)', 'Foreign Direct Investment (FDI)', 6, 'international-affairs'),
    ('international-affairs-t06', 'Financial Liberalization', 'Financial Liberalization', 7, 'international-affairs'),
    ('international-affairs-t06', 'Regionalism ও Regionalization', 'Regionalism ও Regionalization', 8, 'international-affairs'),
    ('international-affairs-t06', 'North-South Gap', 'North-South Gap', 9, 'international-affairs'),
    ('international-affairs-t06', 'Global Poverty', 'Global Poverty', 10, 'international-affairs'),
    ('international-affairs-t06', 'MDGs', 'MDGs', 11, 'international-affairs'),
    ('international-affairs-t07', 'Climate Change', 'Climate Change', 1, 'international-affairs'),
    ('international-affairs-t07', 'Global Warming', 'Global Warming', 2, 'international-affairs'),
    ('international-affairs-t07', 'Climate Adaptation', 'Climate Adaptation', 3, 'international-affairs'),
    ('international-affairs-t07', 'Climate Diplomacy', 'Climate Diplomacy', 4, 'international-affairs'),
    ('international-affairs-t08', 'জাতিসংঘের অঙ্গসংস্থা', 'জাতিসংঘের অঙ্গসংস্থা', 1, 'international-affairs'),
    ('international-affairs-t08', 'Security Council', 'Security Council', 2, 'international-affairs'),
    ('international-affairs-t08', 'UN Reforms', 'UN Reforms', 3, 'international-affairs'),
    ('international-affairs-t08', 'Peacekeeping and Peace-building', 'Peacekeeping and Peace-building', 4, 'international-affairs')
  ) as v(topic_slug, title_en, title_bn, n, subject_slug)
  join public.subjects su on su.slug = v.subject_slug
  join public.courses c on c.id = su.course_id and c.slug = 'bcs-written'
  join public.topics tp on tp.subject_id = su.id and tp.slug = v.topic_slug
on conflict (topic_id, slug) do update
  set title_en = excluded.title_en,
      title_bn = excluded.title_bn,
      sort_order = excluded.sort_order,
      is_active = true,
      metadata = public.subtopics.metadata || excluded.metadata,
      updated_at = now();

-- 4. সাবটপিক (slug ও priority পেরেন্ট টপিক থেকে নেওয়া)
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order, is_active, approval_status, metadata)
select tp.id,
       tp.slug || '-s' || lpad(v.n::text, 2, '0'),
       v.title_en, v.title_bn, v.n, true, 'approved',
       tp.metadata - 'band_marks' - 'syllabus'
  from (values
    ('international-affairs-t08', 'Human Rights Agenda', 'Human Rights Agenda', 5, 'international-affairs'),
    ('international-affairs-t08', 'Environmental Agenda', 'Environmental Agenda', 6, 'international-affairs'),
    ('international-affairs-t08', 'International Court of Justice', 'International Court of Justice', 7, 'international-affairs'),
    ('international-affairs-t08', 'Women Empowerment', 'Women Empowerment', 8, 'international-affairs'),
    ('international-affairs-t09', 'World Bank', 'World Bank', 1, 'international-affairs'),
    ('international-affairs-t09', 'IMF', 'IMF', 2, 'international-affairs'),
    ('international-affairs-t09', 'ADB', 'ADB', 3, 'international-affairs'),
    ('international-affairs-t09', 'WTO', 'WTO', 4, 'international-affairs'),
    ('international-affairs-t09', 'G8 ও G-77', 'G8 ও G-77', 5, 'international-affairs'),
    ('international-affairs-t09', 'Kyoto Protocol', 'Kyoto Protocol', 6, 'international-affairs'),
    ('international-affairs-t09', 'COP', 'COP', 7, 'international-affairs'),
    ('international-affairs-t10', 'SAARC', 'SAARC', 1, 'international-affairs'),
    ('international-affairs-t10', 'BIMSTEC', 'BIMSTEC', 2, 'international-affairs'),
    ('international-affairs-t10', 'EU', 'EU', 3, 'international-affairs'),
    ('international-affairs-t10', 'ASEAN', 'ASEAN', 4, 'international-affairs'),
    ('international-affairs-t10', 'NATO', 'NATO', 5, 'international-affairs'),
    ('international-affairs-t10', 'APEC', 'APEC', 6, 'international-affairs'),
    ('international-affairs-t10', 'OIC', 'OIC', 7, 'international-affairs'),
    ('international-affairs-t10', 'AU', 'AU', 8, 'international-affairs'),
    ('international-affairs-t10', 'GCC', 'GCC', 9, 'international-affairs'),
    ('international-affairs-t11', 'USA', 'USA', 1, 'international-affairs'),
    ('international-affairs-t11', 'Russia', 'Russia', 2, 'international-affairs'),
    ('international-affairs-t11', 'UK', 'UK', 3, 'international-affairs'),
    ('international-affairs-t11', 'China', 'China', 4, 'international-affairs'),
    ('international-affairs-t11', 'France', 'France', 5, 'international-affairs'),
    ('international-affairs-t11', 'Germany', 'Germany', 6, 'international-affairs'),
    ('international-affairs-t11', 'India', 'India', 7, 'international-affairs'),
    ('international-affairs-t11', 'Japan', 'Japan', 8, 'international-affairs'),
    ('international-affairs-t12', 'Palestine Problem', 'Palestine Problem', 1, 'international-affairs'),
    ('international-affairs-t12', 'Arab Spring', 'Arab Spring', 2, 'international-affairs'),
    ('international-affairs-t12', 'Kashmir Issue', 'Kashmir Issue', 3, 'international-affairs'),
    ('international-affairs-t12', 'Syrian Crisis', 'Syrian Crisis', 4, 'international-affairs'),
    ('international-affairs-t12', 'Persian Gulf Conflict', 'Persian Gulf Conflict', 5, 'international-affairs'),
    ('international-affairs-t12', 'Iran Nuclear Issue', 'Iran Nuclear Issue', 6, 'international-affairs'),
    ('international-affairs-t12', 'North Korean Issue', 'North Korean Issue', 7, 'international-affairs'),
    ('international-affairs-t12', 'Nuclear Proliferation', 'Nuclear Proliferation', 8, 'international-affairs'),
    ('international-affairs-t12', 'Southeast ও East Asian Territorial Disputes', 'Southeast ও East Asian Territorial Disputes', 9, 'international-affairs'),
    ('international-affairs-t13', 'India-Pakistan Relations', 'India-Pakistan Relations', 1, 'international-affairs'),
    ('international-affairs-t13', 'Bangladesh-India Relations', 'Bangladesh-India Relations', 2, 'international-affairs'),
    ('international-affairs-t13', 'Regional Integration', 'Regional Integration', 3, 'international-affairs'),
    ('international-affairs-t13', 'Water Dispute', 'Water Dispute', 4, 'international-affairs'),
    ('international-affairs-t13', 'Border Problems', 'Border Problems', 5, 'international-affairs'),
    ('international-affairs-t13', 'Terrorism', 'Terrorism', 6, 'international-affairs'),
    ('international-affairs-t14', 'বাংলাদেশের আন্তর্জাতিক অর্জন', 'বাংলাদেশের আন্তর্জাতিক অর্জন', 1, 'international-affairs'),
    ('international-affairs-t14', 'চ্যালেঞ্জ', 'চ্যালেঞ্জ', 2, 'international-affairs'),
    ('international-affairs-t14', 'ভবিষ্যৎ দিকনির্দেশনা', 'ভবিষ্যৎ দিকনির্দেশনা', 3, 'international-affairs'),
    ('international-affairs-t15', 'আন্তর্জাতিক সমস্যা বিশ্লেষণ', 'আন্তর্জাতিক সমস্যা বিশ্লেষণ', 1, 'international-affairs'),
    ('international-affairs-t15', 'কারণ ও প্রভাব', 'কারণ ও প্রভাব', 2, 'international-affairs'),
    ('international-affairs-t15', 'সম্ভাব্য সমাধান', 'সম্ভাব্য সমাধান', 3, 'international-affairs'),
    ('international-affairs-t15', 'বাণিজ্য, জলবায়ু, বৈদেশিক সাহায্য ও নিরাপত্তা সমস্যা', 'বাণিজ্য, জলবায়ু, বৈদেশিক সাহায্য ও নিরাপত্তা সমস্যা', 4, 'international-affairs'),
    ('math-reasoning-t01', 'Arithmetic expressions', 'Arithmetic expressions', 1, 'math-reasoning'),
    ('math-reasoning-t01', 'Algebraic expressions', 'Algebraic expressions', 2, 'math-reasoning'),
    ('math-reasoning-t02', 'ঐকিক নিয়ম', 'ঐকিক নিয়ম', 1, 'math-reasoning'),
    ('math-reasoning-t02', 'বাস্তবভিত্তিক সমস্যা', 'বাস্তবভিত্তিক সমস্যা', 2, 'math-reasoning'),
    ('math-reasoning-t03', 'গড় নির্ণয়', 'গড় নির্ণয়', 1, 'math-reasoning'),
    ('math-reasoning-t03', 'গড়ের প্রয়োগ', 'গড়ের প্রয়োগ', 2, 'math-reasoning'),
    ('math-reasoning-t04', 'শতকরা', 'শতকরা', 1, 'math-reasoning'),
    ('math-reasoning-t04', 'শতকরা পরিবর্তন', 'শতকরা পরিবর্তন', 2, 'math-reasoning'),
    ('math-reasoning-t05', 'Simple Interest', 'Simple Interest', 1, 'math-reasoning'),
    ('math-reasoning-t05', 'Compound Interest', 'Compound Interest', 2, 'math-reasoning'),
    ('math-reasoning-t06', 'অনুপাত', 'অনুপাত', 1, 'math-reasoning'),
    ('math-reasoning-t06', 'সমানুপাত', 'সমানুপাত', 2, 'math-reasoning'),
    ('math-reasoning-t07', 'লাভ-ক্ষতি', 'লাভ-ক্ষতি', 1, 'math-reasoning'),
    ('math-reasoning-t07', 'ক্রয়মূল্য ও বিক্রয়মূল্য', 'ক্রয়মূল্য ও বিক্রয়মূল্য', 2, 'math-reasoning'),
    ('math-reasoning-t08', 'লসাগু', 'লসাগু', 1, 'math-reasoning'),
    ('math-reasoning-t08', 'গসাগু', 'গসাগু', 2, 'math-reasoning'),
    ('math-reasoning-t09', 'বীজগাণিতিক সূত্র', 'বীজগাণিতিক সূত্র', 1, 'math-reasoning'),
    ('math-reasoning-t09', 'সূত্রের প্রয়োগ', 'সূত্রের প্রয়োগ', 2, 'math-reasoning'),
    ('math-reasoning-t10', 'Polynomial factorization', 'Polynomial factorization', 1, 'math-reasoning'),
    ('math-reasoning-t10', 'উৎপাদক নির্ণয়', 'উৎপাদক নির্ণয়', 2, 'math-reasoning'),
    ('math-reasoning-t11', 'Linear Equations', 'Linear Equations', 1, 'math-reasoning'),
    ('math-reasoning-t11', 'Quadratic Equations', 'Quadratic Equations', 2, 'math-reasoning'),
    ('math-reasoning-t11', 'Two/Three Unknowns-এর সমীকরণ', 'Two/Three Unknowns-এর সমীকরণ', 3, 'math-reasoning'),
    ('math-reasoning-t12', 'Linear Inequalities', 'Linear Inequalities', 1, 'math-reasoning'),
    ('math-reasoning-t12', 'Quadratic Inequalities', 'Quadratic Inequalities', 2, 'math-reasoning'),
    ('math-reasoning-t13', 'সূচক', 'সূচক', 1, 'math-reasoning'),
    ('math-reasoning-t13', 'লগারিদম', 'লগারিদম', 2, 'math-reasoning'),
    ('math-reasoning-t13', 'Exponential Functions', 'Exponential Functions', 3, 'math-reasoning'),
    ('math-reasoning-t13', 'Logarithmic Functions', 'Logarithmic Functions', 4, 'math-reasoning'),
    ('math-reasoning-t14', 'রেখা ও কোণ', 'রেখা ও কোণ', 1, 'math-reasoning'),
    ('math-reasoning-t14', 'ত্রিভুজের উপপাদ্য', 'ত্রিভুজের উপপাদ্য', 2, 'math-reasoning'),
    ('math-reasoning-t14', 'Pythagoras Theorem', 'Pythagoras Theorem', 3, 'math-reasoning'),
    ('math-reasoning-t15', 'বৃত্তের উপপাদ্য', 'বৃত্তের উপপাদ্য', 1, 'math-reasoning'),
    ('math-reasoning-t15', 'Corollaries', 'Corollaries', 2, 'math-reasoning'),
    ('math-reasoning-t16', 'ক্ষেত্রফল', 'ক্ষেত্রফল', 1, 'math-reasoning'),
    ('math-reasoning-t16', 'সমতল ক্ষেত্র', 'সমতল ক্ষেত্র', 2, 'math-reasoning'),
    ('math-reasoning-t16', 'ঘনবস্তু', 'ঘনবস্তু', 3, 'math-reasoning'),
    ('math-reasoning-t16', 'পরিমিতি', 'পরিমিতি', 4, 'math-reasoning'),
    ('math-reasoning-t17', 'Distance', 'Distance', 1, 'math-reasoning'),
    ('math-reasoning-t17', 'Equation of a Straight Line', 'Equation of a Straight Line', 2, 'math-reasoning'),
    ('math-reasoning-t18', 'Arithmetic Sequence and Series', 'Arithmetic Sequence and Series', 1, 'math-reasoning'),
    ('math-reasoning-t18', 'Geometric Sequence and Series', 'Geometric Sequence and Series', 2, 'math-reasoning'),
    ('math-reasoning-t19', 'Trigonometric Ratios', 'Trigonometric Ratios', 1, 'math-reasoning'),
    ('math-reasoning-t19', 'Trigonometric Functions', 'Trigonometric Functions', 2, 'math-reasoning'),
    ('math-reasoning-t19', 'Height and Distance', 'Height and Distance', 3, 'math-reasoning'),
    ('math-reasoning-t20', 'Sets', 'Sets', 1, 'math-reasoning'),
    ('math-reasoning-t20', 'Venn Diagram', 'Venn Diagram', 2, 'math-reasoning'),
    ('math-reasoning-t21', 'Permutation', 'Permutation', 1, 'math-reasoning'),
    ('math-reasoning-t21', 'Combination', 'Combination', 2, 'math-reasoning'),
    ('math-reasoning-t21', 'Elementary Probability', 'Elementary Probability', 3, 'math-reasoning'),
    ('mental-ability-t01', 'Word Relationships', 'Word Relationships', 1, 'mental-ability'),
    ('mental-ability-t01', 'Analogy', 'Analogy', 2, 'mental-ability'),
    ('mental-ability-t01', 'শব্দের সম্পর্ক ও ধারণা', 'শব্দের সম্পর্ক ও ধারণা', 3, 'mental-ability'),
    ('mental-ability-t01', 'ভাষাভিত্তিক যুক্তি', 'ভাষাভিত্তিক যুক্তি', 4, 'mental-ability'),
    ('mental-ability-t01', 'শব্দের মাধ্যমে সম্পর্ক নির্ণয়', 'শব্দের মাধ্যমে সম্পর্ক নির্ণয়', 5, 'mental-ability'),
    ('mental-ability-t02', 'Number Series', 'Number Series', 1, 'mental-ability'),
    ('mental-ability-t02', 'Missing Number', 'Missing Number', 2, 'mental-ability'),
    ('mental-ability-t02', 'Numerical Relationships', 'Numerical Relationships', 3, 'mental-ability'),
    ('mental-ability-t02', 'সংখ্যাভিত্তিক যুক্তি', 'সংখ্যাভিত্তিক যুক্তি', 4, 'mental-ability'),
    ('mental-ability-t02', 'গাণিতিক সম্পর্ক নির্ণয়', 'গাণিতিক সম্পর্ক নির্ণয়', 5, 'mental-ability')
  ) as v(topic_slug, title_en, title_bn, n, subject_slug)
  join public.subjects su on su.slug = v.subject_slug
  join public.courses c on c.id = su.course_id and c.slug = 'bcs-written'
  join public.topics tp on tp.subject_id = su.id and tp.slug = v.topic_slug
on conflict (topic_id, slug) do update
  set title_en = excluded.title_en,
      title_bn = excluded.title_bn,
      sort_order = excluded.sort_order,
      is_active = true,
      metadata = public.subtopics.metadata || excluded.metadata,
      updated_at = now();

-- 4. সাবটপিক (slug ও priority পেরেন্ট টপিক থেকে নেওয়া)
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order, is_active, approval_status, metadata)
select tp.id,
       tp.slug || '-s' || lpad(v.n::text, 2, '0'),
       v.title_en, v.title_bn, v.n, true, 'approved',
       tp.metadata - 'band_marks' - 'syllabus'
  from (values
    ('mental-ability-t03', 'Figure Series', 'Figure Series', 1, 'mental-ability'),
    ('mental-ability-t03', 'Pattern Recognition', 'Pattern Recognition', 2, 'mental-ability'),
    ('mental-ability-t03', 'Diagram Analysis', 'Diagram Analysis', 3, 'mental-ability'),
    ('mental-ability-t03', 'পরিবর্তিত চিত্রের নিয়ম শনাক্তকরণ', 'পরিবর্তিত চিত্রের নিয়ম শনাক্তকরণ', 4, 'mental-ability'),
    ('mental-ability-t03', 'Non-verbal reasoning', 'Non-verbal reasoning', 5, 'mental-ability'),
    ('mental-ability-t04', 'Spatial Visualization', 'Spatial Visualization', 1, 'mental-ability'),
    ('mental-ability-t04', 'Object Rotation', 'Object Rotation', 2, 'mental-ability'),
    ('mental-ability-t04', 'Direction and Distance', 'Direction and Distance', 3, 'mental-ability'),
    ('mental-ability-t04', 'Pattern-to-object visualization', 'Pattern-to-object visualization', 4, 'mental-ability'),
    ('mental-ability-t05', 'Grammar Error Detection', 'Grammar Error Detection', 1, 'mental-ability'),
    ('mental-ability-t05', 'Punctuation', 'Punctuation', 2, 'mental-ability'),
    ('mental-ability-t05', 'Capitalization', 'Capitalization', 3, 'mental-ability'),
    ('mental-ability-t05', 'Spelling and Word Formation', 'Spelling and Word Formation', 4, 'mental-ability'),
    ('mental-ability-t06', 'যন্ত্রের কার্যপদ্ধতি', 'যন্ত্রের কার্যপদ্ধতি', 1, 'mental-ability'),
    ('mental-ability-t06', 'মৌলিক যান্ত্রিক নীতি', 'মৌলিক যান্ত্রিক নীতি', 2, 'mental-ability'),
    ('mental-ability-t06', 'যন্ত্রের অংশ ও কার্যকারণ', 'যন্ত্রের অংশ ও কার্যকারণ', 3, 'mental-ability'),
    ('general-science-t01', 'আলোর প্রকৃতি', 'আলোর প্রকৃতি', 1, 'general-science'),
    ('general-science-t01', 'Spectrum', 'Spectrum', 2, 'general-science'),
    ('general-science-t01', 'বিভিন্ন রং ও তরঙ্গদৈর্ঘ্য', 'বিভিন্ন রং ও তরঙ্গদৈর্ঘ্য', 3, 'general-science'),
    ('general-science-t01', 'UV, IR ও LASER', 'UV, IR ও LASER', 4, 'general-science'),
    ('general-science-t01', 'Reflection ও Refraction', 'Reflection ও Refraction', 5, 'general-science'),
    ('general-science-t01', 'Total Internal Reflection', 'Total Internal Reflection', 6, 'general-science'),
    ('general-science-t01', 'Lens ও Thin Converging Lens', 'Lens ও Thin Converging Lens', 7, 'general-science'),
    ('general-science-t01', 'Dispersion', 'Dispersion', 8, 'general-science'),
    ('general-science-t01', 'Particle Nature of Light', 'Particle Nature of Light', 9, 'general-science'),
    ('general-science-t01', 'Photoelectric Equation', 'Photoelectric Equation', 10, 'general-science'),
    ('general-science-t01', 'Photocell', 'Photocell', 11, 'general-science'),
    ('general-science-t02', 'শ্রবণ প্রক্রিয়া', 'শ্রবণ প্রক্রিয়া', 1, 'general-science'),
    ('general-science-t02', 'Decibel ও Frequency', 'Decibel ও Frequency', 2, 'general-science'),
    ('general-science-t02', 'Microphone ও Loudspeaker', 'Microphone ও Loudspeaker', 3, 'general-science'),
    ('general-science-t02', 'Public Address System', 'Public Address System', 4, 'general-science'),
    ('general-science-t02', 'Stationary Waves', 'Stationary Waves', 5, 'general-science'),
    ('general-science-t02', 'Vibrating Strings', 'Vibrating Strings', 6, 'general-science'),
    ('general-science-t02', 'Beats ও Doppler Effect', 'Beats ও Doppler Effect', 7, 'general-science'),
    ('general-science-t02', 'Echo ও Reverberation', 'Echo ও Reverberation', 8, 'general-science'),
    ('general-science-t02', 'Building Acoustics', 'Building Acoustics', 9, 'general-science'),
    ('general-science-t02', 'Sabine''s Formula', 'Sabine''s Formula', 10, 'general-science'),
    ('general-science-t03', 'চৌম্বকত্ব ও বিদ্যুৎ প্রবাহের সম্পর্ক', 'চৌম্বকত্ব ও বিদ্যুৎ প্রবাহের সম্পর্ক', 1, 'general-science'),
    ('general-science-t03', 'Bar Magnet', 'Bar Magnet', 2, 'general-science'),
    ('general-science-t03', 'Magnetic Lines of Force', 'Magnetic Lines of Force', 3, 'general-science'),
    ('general-science-t03', 'Torque on a Bar Magnet', 'Torque on a Bar Magnet', 4, 'general-science'),
    ('general-science-t03', 'Earth''s Magnetic Field', 'Earth''s Magnetic Field', 5, 'general-science'),
    ('general-science-t03', 'Tangent Galvanometer', 'Tangent Galvanometer', 6, 'general-science'),
    ('general-science-t03', 'Vibration Magnetometer', 'Vibration Magnetometer', 7, 'general-science'),
    ('general-science-t03', 'Para, Dia ও Ferromagnetic Substances', 'Para, Dia ও Ferromagnetic Substances', 8, 'general-science'),
    ('general-science-t03', 'Electromagnets ও Permanent Magnets', 'Electromagnets ও Permanent Magnets', 9, 'general-science'),
    ('general-science-t04', 'Acid-base concepts', 'Acid-base concepts', 1, 'general-science'),
    ('general-science-t04', 'Acid ও Base-এর বৈশিষ্ট্য', 'Acid ও Base-এর বৈশিষ্ট্য', 2, 'general-science'),
    ('general-science-t04', 'Indicators', 'Indicators', 3, 'general-science'),
    ('general-science-t04', 'pH', 'pH', 4, 'general-science'),
    ('general-science-t04', 'Salts', 'Salts', 5, 'general-science'),
    ('general-science-t04', 'দৈনন্দিন ও শিল্পক্ষেত্রে ব্যবহার', 'দৈনন্দিন ও শিল্পক্ষেত্রে ব্যবহার', 6, 'general-science'),
    ('general-science-t05', 'পানির বৈশিষ্ট্য', 'পানির বৈশিষ্ট্য', 1, 'general-science'),
    ('general-science-t05', 'গলনাঙ্ক ও স্ফুটনাঙ্ক', 'গলনাঙ্ক ও স্ফুটনাঙ্ক', 2, 'general-science'),
    ('general-science-t05', 'পানির গঠন ও Hydrogen Bonding', 'পানির গঠন ও Hydrogen Bonding', 3, 'general-science'),
    ('general-science-t05', 'বাংলাদেশের মিঠাপানির উৎস', 'বাংলাদেশের মিঠাপানির উৎস', 4, 'general-science'),
    ('general-science-t05', 'Water Quality Parameters', 'Water Quality Parameters', 5, 'general-science'),
    ('general-science-t05', 'Dissolved Oxygen ও Salinity', 'Dissolved Oxygen ও Salinity', 6, 'general-science'),
    ('general-science-t05', 'Water Recycling', 'Water Recycling', 7, 'general-science'),
    ('general-science-t05', 'পানি বিশুদ্ধকরণ', 'পানি বিশুদ্ধকরণ', 8, 'general-science'),
    ('general-science-t05', 'পানি দূষণের কারণ ও প্রভাব', 'পানি দূষণের কারণ ও প্রভাব', 9, 'general-science'),
    ('general-science-t05', 'পানি সংরক্ষণ', 'পানি সংরক্ষণ', 10, 'general-science'),
    ('general-science-t06', 'মাটি ও মাটির ধরন', 'মাটি ও মাটির ধরন', 1, 'general-science'),
    ('general-science-t06', 'Soil pH ও Soil Pollution', 'Soil pH ও Soil Pollution', 2, 'general-science'),
    ('general-science-t06', 'Natural Gas', 'Natural Gas', 3, 'general-science'),
    ('general-science-t06', 'Petroleum ও Coal', 'Petroleum ও Coal', 4, 'general-science'),
    ('general-science-t06', 'প্রাকৃতিক সম্পদের ব্যবহার ও সংরক্ষণ', 'প্রাকৃতিক সম্পদের ব্যবহার ও সংরক্ষণ', 5, 'general-science'),
    ('general-science-t06', 'বনসম্পদ', 'বনসম্পদ', 6, 'general-science'),
    ('general-science-t07', 'Biosphere ও Hydrosphere', 'Biosphere ও Hydrosphere', 1, 'general-science'),
    ('general-science-t07', 'Ionosphere', 'Ionosphere', 2, 'general-science'),
    ('general-science-t07', 'Oxygen, Carbon Dioxide ও Nitrogen', 'Oxygen, Carbon Dioxide ও Nitrogen', 3, 'general-science'),
    ('general-science-t07', 'Potable ও Polluted Water', 'Potable ও Polluted Water', 4, 'general-science'),
    ('general-science-t07', 'Pasteurization', 'Pasteurization', 5, 'general-science'),
    ('general-science-t08', 'Natural ও Synthetic Polymer', 'Natural ও Synthetic Polymer', 1, 'general-science'),
    ('general-science-t08', 'Polymerization', 'Polymerization', 2, 'general-science'),
    ('general-science-t08', 'Polymer-এর উৎস ও ব্যবহার', 'Polymer-এর উৎস ও ব্যবহার', 3, 'general-science'),
    ('general-science-t08', 'Fiber, Silk, Wool, Nylon ও Rayon', 'Fiber, Silk, Wool, Nylon ও Rayon', 4, 'general-science'),
    ('general-science-t08', 'Rubber ও Plastic', 'Rubber ও Plastic', 5, 'general-science'),
    ('general-science-t08', 'পরিবেশে Rubber ও Plastic-এর প্রভাব', 'পরিবেশে Rubber ও Plastic-এর প্রভাব', 6, 'general-science'),
    ('general-science-t09', 'খাদ্যের উপাদান', 'খাদ্যের উপাদান', 1, 'general-science'),
    ('general-science-t09', 'Carbohydrates', 'Carbohydrates', 2, 'general-science'),
    ('general-science-t09', 'Protein', 'Protein', 3, 'general-science'),
    ('general-science-t09', 'Fats and Lipids', 'Fats and Lipids', 4, 'general-science'),
    ('general-science-t09', 'Vitamins', 'Vitamins', 5, 'general-science'),
    ('general-science-t09', 'খাদ্যের উৎস ও পুষ্টিগুণ', 'খাদ্যের উৎস ও পুষ্টিগুণ', 6, 'general-science'),
    ('general-science-t10', 'দৈনন্দিন জীবনে বিজ্ঞান', 'দৈনন্দিন জীবনে বিজ্ঞান', 1, 'general-science'),
    ('general-science-t10', 'শিল্প ও প্রযুক্তিতে বিজ্ঞানের ব্যবহার', 'শিল্প ও প্রযুক্তিতে বিজ্ঞানের ব্যবহার', 2, 'general-science'),
    ('general-science-t10', 'আধুনিক প্রযুক্তির সামাজিক ও অর্থনৈতিক প্রভাব', 'আধুনিক প্রযুক্তির সামাজিক ও অর্থনৈতিক প্রভাব', 3, 'general-science'),
    ('general-science-t10', 'বিজ্ঞান ও প্রযুক্তির সমসাময়িক প্রয়োগ', 'বিজ্ঞান ও প্রযুক্তির সমসাময়িক প্রয়োগ', 4, 'general-science')
  ) as v(topic_slug, title_en, title_bn, n, subject_slug)
  join public.subjects su on su.slug = v.subject_slug
  join public.courses c on c.id = su.course_id and c.slug = 'bcs-written'
  join public.topics tp on tp.subject_id = su.id and tp.slug = v.topic_slug
on conflict (topic_id, slug) do update
  set title_en = excluded.title_en,
      title_bn = excluded.title_bn,
      sort_order = excluded.sort_order,
      is_active = true,
      metadata = public.subtopics.metadata || excluded.metadata,
      updated_at = now();

-- 5. যাচাই — মাইগ্রেশন নিজেই ব্যর্থ হয় যদি সংখ্যা মিলে না যায়।
do $$
declare
  v_course uuid;
  v_subjects int;
  v_topics int;
  v_subtopics int;
  v_marks int;
begin
  select id into v_course from public.courses where slug = 'bcs-written';
  if v_course is null then
    raise exception 'bcs-written course missing';
  end if;

  select count(*), coalesce(sum((metadata->>'marks')::int), 0)
    into v_subjects, v_marks
    from public.subjects where course_id = v_course and is_active;

  select count(*) into v_topics
    from public.topics t join public.subjects s on s.id = t.subject_id
   where s.course_id = v_course and t.is_active;

  select count(*) into v_subtopics
    from public.subtopics st
    join public.topics t on t.id = st.topic_id
    join public.subjects s on s.id = t.subject_id
   where s.course_id = v_course and st.is_active;

  if v_subjects <> 8 then
    raise exception 'expected 8 subjects, found %', v_subjects;
  end if;
  if v_marks <> 900 then
    raise exception 'expected 900 marks, found %', v_marks;
  end if;
  if v_topics <> 89 then
    raise exception 'expected 89 topics, found %', v_topics;
  end if;
  if v_subtopics <> 419 then
    raise exception 'expected 419 subtopics, found %', v_subtopics;
  end if;
end $$;
