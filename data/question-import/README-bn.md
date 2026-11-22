# প্রশ্ন যোগ করার গাইড (CSV বনাম SQL)

JobHub-এর `questions` টেবিলে প্রশ্ন ঢোকানোর দুইটা পদ্ধতি আছে। দুটোরই টেমপ্লেট এই ফোল্ডারে:

| ফাইল | কাজ |
|---|---|
| `add-questions-template.sql` | সরাসরি SQL দিয়ে প্রশ্ন INSERT + পরীক্ষার সাথে জুড়ে দেওয়া |
| `questions-template.csv` | Excel/Google Sheets-এ প্রশ্ন লেখার CSV ফরম্যাট |

---

## গুরুত্বপূর্ণ নিয়ম (দুই পদ্ধতিতেই এক)

- **correct_option**: `0`=ক/A, `1`=খ/B, `2`=গ/C, `3`=ঘ/D — সংখ্যা, অক্ষর না।
- **statement**: কমপক্ষে ৮ অক্ষর।
- **difficulty**: `easy` / `medium` / `hard` (ফাঁকা রাখলে `medium`)।
- **fingerprint**: `md5(statement)` — একই কোর্সে একই প্রশ্ন দুইবার ঢুকবে না (UNIQUE)। SQL-এ `ON CONFLICT ... DO NOTHING` দিলে ডুপ্লিকেট চুপচাপ বাদ পড়ে।
- **status**: `approved` দিতে হলে `is_verified = true` দিতেই হবে, নইলে এরর।
- **external_ref**: প্রতিটা পরীক্ষার প্রশ্ন একটা ট্যাগ দিয়ে চিহ্নিত করুন, যেমন `DLE-2026-11-23` (Daily Live Exam তারিখ)। পরে এই ট্যাগ দিয়েই প্রশ্ন বেছে পরীক্ষায় জুড়বেন।
- **created_by**: সবসময় `b0d40cca-e34b-42fe-bc19-dae3627b7a48`।
- **course_id**: `599509ae-c4c3-440a-9463-802a4efc7a0c` (৪৭তম বিসিএস প্রিলি কোর্স)।

বিষয়ের (subject) id-গুলোর পুরো তালিকা `add-questions-template.sql`-এর মাথায় দেওয়া আছে।

---

## পদ্ধতি ১: SQL দিয়ে (সবচেয়ে দ্রুত)

1. [Supabase Dashboard](https://supabase.com/dashboard) → আপনার প্রজেক্ট (`bozmbnelcokhbuumkdry`) → বাম মেনুতে **SQL Editor**।
2. `add-questions-template.sql` খুলে কপি করুন।
3. বদলান:
   - `<SUBJECT_ID>` → যে বিষয়ের প্রশ্ন (ফাইলের মাথার তালিকা থেকে)
   - `sort_order = 1` → টপিক নম্বর (আগে `SELECT id, title_bn, sort_order FROM topics WHERE subject_id='...' ORDER BY sort_order;` চালিয়ে দেখে নিন)
   - `external_ref` → পরীক্ষার ট্যাগ, যেমন `DLE-2026-11-23`
   - `VALUES (...)` তালিকায় নমুনা প্রশ্ন মুছে নিজের প্রশ্ন বসান — প্রতি লাইনে একটা প্রশ্ন, যত খুশি লাইন।
4. **Run** চাপুন। `RETURNING` অংশে কতগুলো ঢুকল দেখাবে।
5. পরীক্ষার সাথে জুড়তে চাইলে ফাইলের **ধাপ ৩** অংশ চালান (তারিখ/টাইটেল বদলে)।

**টিপস:** প্রশ্নের ভেতরে `'` (অ্যাপস্ট্রফি) থাকলে সেটা দুইবার লিখুন: `''` — যেমন `'Shakespeare''s play'`।

---

## পদ্ধতি ২: CSV দিয়ে (Excel/Google Sheets-এ লিখতে চাইলে)

1. `questions-template.csv` খুলুন Google Sheets বা Excel-এ।
2. কলামগুলো পূরণ করুন (হেডার বদলাবেন না):
   - `statement, option_a, option_b, option_c, option_d` — প্রশ্ন ও ৪ অপশন
   - `correct_option` — 0/1/2/3
   - `explanation, difficulty` — ব্যাখ্যা ও কঠিনতা
   - `subject_id` — বিষয়ের uuid
   - `topic_sort_order` — টপিকের ক্রমিক নম্বর
   - `external_ref` — পরীক্ষার ট্যাগ
3. **UTF-8 CSV** হিসেবে সেভ/ডাউনলোড করুন (বাংলা ভাঙবে না)।
4. Supabase Dashboard → **Table Editor** → `questions` টেবিলে সরাসরি CSV ইমপোর্ট করা *যায় না* কারণ `course_id`, `fingerprint`, `created_by` CSV-তে নেই। তাই CSV-কে একটা **staging টেবিলে** তুলে তারপর এক লাইনের SQL দিয়ে মূল টেবিলে ঢালুন:

```sql
-- (ক) একবারই staging টেবিল বানান:
CREATE TABLE IF NOT EXISTS question_csv_staging (
  statement text, option_a text, option_b text, option_c text, option_d text,
  correct_option smallint, explanation text, difficulty text,
  subject_id uuid, topic_sort_order smallint, external_ref text
);

-- (খ) Dashboard → Table Editor → question_csv_staging → Insert → Import data from CSV
--     আপনার CSV ফাইলটা আপলোড করুন।

-- (গ) staging থেকে মূল questions টেবিলে ঢালুন:
INSERT INTO questions (
  course_id, subject_id, topic_id, statement,
  option_a, option_b, option_c, option_d, correct_option,
  explanation, difficulty, source_type, status, is_verified,
  fingerprint, external_ref, created_by
)
SELECT
  '599509ae-c4c3-440a-9463-802a4efc7a0c',
  s.subject_id,
  t.id,
  s.statement, s.option_a, s.option_b, s.option_c, s.option_d, s.correct_option,
  COALESCE(s.explanation, ''), COALESCE(s.difficulty, 'medium'),
  'csv_import', 'approved', true,
  md5(s.statement), s.external_ref,
  'b0d40cca-e34b-42fe-bc19-dae3627b7a48'
FROM question_csv_staging s
JOIN topics t ON t.subject_id = s.subject_id AND t.sort_order = s.topic_sort_order
ON CONFLICT (course_id, fingerprint) DO NOTHING;

-- (ঘ) staging খালি করুন (পরের ব্যাচের জন্য):
TRUNCATE question_csv_staging;
```

---

## পরীক্ষার সাথে প্রশ্ন জুড়ে দেওয়া (যেকোনো পদ্ধতির পরে)

গঠনটা তিন স্তরের:

```
exam_schedules (কখন পরীক্ষা, কত নম্বর, published কি না)
   └── exam_papers (প্রশ্নপত্র)
         └── exam_questions (কোন প্রশ্ন কত নম্বর পজিশনে, কত মার্কস)
```

`add-questions-template.sql`-এর **ধাপ ৩** পুরো চেইনটা এক কোয়েরিতে করে দেয় — শুধু তারিখ, টাইটেল আর `external_ref` ট্যাগ বদলালেই প্রতিদিনের পরীক্ষা বানানো যাবে।

## ২২ নভেম্বরের পরীক্ষা (হয়ে গেছে ✅)

- schedule: `bc462fd4-187b-4701-bbbc-172436124fee` (published, রাত ৮–৯টা BST)
- paper: `d1ccb46c-280b-4871-9d4d-e8a0c4215c21`
- প্রশ্ন: বাংলা (ধ্বনি ও বর্ণ) ৫০ + সাধারণ বিজ্ঞান (পদার্থ ও পরমাণু) ৫০ = ১০০, ট্যাগ `DLE-2026-11-22`
