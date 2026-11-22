-- ============================================================
-- JobHub — প্রশ্ন যোগ করার SQL টেমপ্লেট
-- Supabase Dashboard → SQL Editor এ পেস্ট করে চালান
-- ============================================================
-- গুরুত্বপূর্ণ আইডিগুলো (BCS প্রিলি কোর্স):
--   course_id  : 599509ae-c4c3-440a-9463-802a4efc7a0c
--   created_by : b0d40cca-e34b-42fe-bc19-dae3627b7a48
--
-- বিষয়ের (subject) আইডি:
--   বাংলা                  df641c1a-8c23-4650-9071-84b2e78b9db0
--   English                 c71982a7-58d6-4632-9ca5-6922fdfb9485
--   বাংলাদেশ বিষয়াবলি      35fc02d8-4fe4-433c-8d22-72a539618f1f
--   আন্তর্জাতিক বিষয়াবলি   be454138-3852-4af8-921f-081fdeaf5322
--   ভূগোল ও পরিবেশ         2b2235ac-ed39-4e83-a1ff-7c030fbb37d1
--   সাধারণ বিজ্ঞান          3c11a812-5286-41fb-862a-509c2e910b02
--   কম্পিউটার ও তথ্যপ্রযুক্তি 3cdd0317-b895-44f8-89e9-2d11358badc8
--   গাণিতিক যুক্তি          0688ee2a-cca7-47b2-bf85-6249887a9d5a
--   মানসিক দক্ষতা          8ce518d7-b0be-432b-bea2-90318d9985ad
--   নৈতিকতা ও সুশাসন       1350e8fc-3097-4503-8aa3-0b437b5c3ce1
--
-- নিয়মগুলো মনে রাখুন:
--   * correct_option = 0,1,2,3  (0=ক/A, 1=খ/B, 2=গ/C, 3=ঘ/D)
--   * statement কমপক্ষে ৮ অক্ষর হতে হবে
--   * difficulty = 'easy' | 'medium' | 'hard'
--   * status 'approved' দিলে is_verified=true দিতেই হবে
--   * fingerprint = md5(statement) — একই প্রশ্ন দুইবার ঢুকবে না (UNIQUE)
--   * external_ref দিয়ে ট্যাগ করুন, যেমন 'DLE-2026-11-23' — পরে সহজে খুঁজে পাবেন
-- ============================================================

-- ধাপ ১: টপিকের id বের করুন (sort_order দিয়ে, অথবা title_bn দিয়ে)
-- SELECT id, title_bn, sort_order FROM topics
-- WHERE subject_id = '<SUBJECT_ID>' ORDER BY sort_order;

-- ধাপ ২: প্রশ্ন INSERT করুন — VALUES তালিকায় যত খুশি প্রশ্ন দিন
WITH tgt AS (
  SELECT id FROM topics
  WHERE subject_id = '<SUBJECT_ID>'      -- << উপরের তালিকা থেকে বিষয়ের id
    AND sort_order = 1                   -- << টপিক নম্বর (অথবা title_bn='...' দিয়ে খুঁজুন)
)
INSERT INTO questions (
  course_id, subject_id, topic_id,
  statement, option_a, option_b, option_c, option_d,
  correct_option, explanation, difficulty,
  source, source_type, status, is_verified,
  fingerprint, external_ref, created_by
)
SELECT
  '599509ae-c4c3-440a-9463-802a4efc7a0c',
  '<SUBJECT_ID>',
  (SELECT id FROM tgt),
  v.st, v.a, v.b, v.c, v.d,
  v.co, v.ex, v.df,
  'যে বই/উৎস থেকে নিলেন',               -- source
  'manual',                               -- source_type: manual | csv_import | ai_assisted | previous
  'approved', true,                       -- status + is_verified
  md5(v.st),                              -- fingerprint (ডুপ্লিকেট আটকায়)
  'DLE-2026-11-23',                       -- << external_ref: কোন পরীক্ষার জন্য, ট্যাগ বদলান
  'b0d40cca-e34b-42fe-bc19-dae3627b7a48'
FROM (VALUES
  -- ('প্রশ্ন', 'অপশন ক', 'অপশন খ', 'অপশন গ', 'অপশন ঘ', সঠিক(0-3), 'ব্যাখ্যা', 'difficulty'),
  ('নমুনা প্রশ্ন ১ — এখানে আপনার প্রশ্ন লিখুন?', 'অপশন ক', 'অপশন খ', 'অপশন গ', 'অপশন ঘ', 1, 'ব্যাখ্যা লিখুন', 'easy'),
  ('নমুনা প্রশ্ন ২ — এখানে আপনার প্রশ্ন লিখুন?', 'অপশন ক', 'অপশন খ', 'অপশন গ', 'অপশন ঘ', 2, 'ব্যাখ্যা লিখুন', 'medium')
) v(st, a, b, c, d, co, ex, df)
ON CONFLICT (course_id, fingerprint) DO NOTHING   -- ডুপ্লিকেট থাকলে চুপচাপ বাদ দেবে
RETURNING id, statement;


-- ============================================================
-- ধাপ ৩ (ঐচ্ছিক): প্রশ্নগুলোকে একটি লাইভ পরীক্ষার সাথে জুড়ে দিন
-- (exam_schedules → exam_papers → exam_questions)
-- ============================================================
WITH sch AS (
  INSERT INTO exam_schedules (
    course_id, kind, exam_kind, title_en, title_bn,
    starts_at, ends_at, result_release_at,
    duration_minutes, question_count, total_marks,
    positive_marks, negative_marks, status, auto_start,
    created_by, published_by, published_at
  ) VALUES (
    '599509ae-c4c3-440a-9463-802a4efc7a0c', 'daily_live', 'daily',
    'Daily Live Exam - 23 Nov 2026',
    'দৈনিক লাইভ পরীক্ষা — ২৩ নভেম্বর ২০২৬',
    '2026-11-23 11:00:00+00',   -- শুরু: বাংলাদেশ সময় বিকাল ৫টা = 11:00 UTC
    '2026-11-23 16:00:00+00',   -- শেষ: রাত ১০টা = 16:00 UTC (এর মধ্যে যেকোনো সময় দেওয়া যাবে)
    '2026-11-23 16:15:00+00',   -- ফল প্রকাশ
    60, 100, 100, 1, 0.5, 'published', true,
    'b0d40cca-e34b-42fe-bc19-dae3627b7a48',
    'b0d40cca-e34b-42fe-bc19-dae3627b7a48', now()
  ) RETURNING id
),
pap AS (
  INSERT INTO exam_papers (
    schedule_id, course_id, paper_type, title_en, title_bn,
    question_count, duration_minutes, total_marks,
    positive_marks, negative_marks, created_by
  )
  SELECT id, '599509ae-c4c3-440a-9463-802a4efc7a0c', 'scheduled',
    'Daily Live Exam - 23 Nov 2026', 'দৈনিক লাইভ পরীক্ষা — ২৩ নভেম্বর ২০২৬',
    100, 60, 100, 1, 0.5,
    'b0d40cca-e34b-42fe-bc19-dae3627b7a48'
  FROM sch RETURNING id
),
q AS (
  -- external_ref ট্যাগ দিয়ে প্রশ্ন বাছাই; প্রথম বিষয় আগে, তারপর দ্বিতীয় বিষয়
  SELECT id, row_number() OVER (
    ORDER BY (subject_id <> '<প্রথম_SUBJECT_ID>'), created_at, id
  ) AS pos
  FROM questions
  WHERE course_id = '599509ae-c4c3-440a-9463-802a4efc7a0c'
    AND external_ref = 'DLE-2026-11-23'
)
INSERT INTO exam_questions (paper_id, question_id, position, marks)
SELECT (SELECT id FROM pap), q.id, q.pos, 1 FROM q;

-- যাচাই:
-- SELECT s.title_bn, s.status, p.id AS paper_id,
--        (SELECT count(*) FROM exam_questions eq WHERE eq.paper_id = p.id) AS attached
-- FROM exam_schedules s JOIN exam_papers p ON p.schedule_id = s.id
-- WHERE s.starts_at::date = '2026-11-23';
