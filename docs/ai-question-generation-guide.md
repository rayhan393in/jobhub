> ## ⚠️ এই গাইডটা পুরনো — ব্যবহার করবেন না
>
> নিচের স্ক্রিপ্ট প্রশ্ন `status='approved'`, `is_verified=true`, `source_type='manual'`
> দিয়ে সোজা ইনসার্ট করে — অর্থাৎ রিভিউ বাইপাস করে, AI-কে "মানুষে লেখা" বলে চালিয়ে দেয়,
> আর একটা hardcoded `verified_by` বসায়। ব্যাংকের ৬১০টা AI প্রশ্ন এই ফাঁদেই পড়েছিল।
>
> **বদলে পড়ুন: [`ai-question-import-v2.md`](./ai-question-import-v2.md)** — একই কাজ,
> কিন্তু প্রশ্ন `pending_review` হিসেবে ঢোকে, বিষয়/টপিক না মিললে পুরো ব্যাচ বাতিল হয়,
> আর approve করার ক্ষমতা স্ক্রিপ্টের থাকে না।

---

# 🤖 অন্য AI দিয়ে প্রশ্ন বানিয়ে Supabase-এ ঢোকানোর গাইড

এই গাইড ব্যবহার করে ChatGPT / Gemini / Claude — যেকোনো AI দিয়ে প্রশ্ন বানিয়ে
সরাসরি JobHub-এর ডাটাবেজে ইমপোর্ট করতে পারবেন। ৩টি ধাপ:

1. **ধাপ ১:** নিচের প্রম্পটটি AI-কে দিন → AI আপনাকে JSON দেবে
2. **ধাপ ২:** JSON-টা নিচের SQL টেমপ্লেটের নির্দিষ্ট জায়গায় পেস্ট করুন
3. **ধাপ ৩:** পুরো SQL টা Supabase SQL Editor-এ রান করুন

Supabase SQL Editor: https://supabase.com/dashboard/project/bozmbnelcokhbuumkdry/sql

---

## ধাপ ১: AI-কে দেওয়ার প্রম্পট (কপি করে ব্যবহার করুন)

> নিচের প্রম্পটের `[বিষয়]`, `[টপিক]`, `[সংখ্যা]` বদলে নিন।
> **বিষয় ও টপিকের নাম অবশ্যই নিচের তালিকা থেকে হুবহু কপি করতে হবে** —
> একটা বানানও এদিক-ওদিক হলে ইমপোর্ট ম্যাচ করবে না।

```text
তুমি একজন BCS প্রিলিমিনারি প্রশ্ন প্রণেতা। আমাকে [সংখ্যা]টি MCQ প্রশ্ন বানিয়ে দাও।

বিষয়: [বিষয়ের নাম — নিচের তালিকা থেকে হুবহু]
টপিক: [টপিকের নাম — নিচের তালিকা থেকে হুবহু]

নিয়ম:
1. প্রতিটি প্রশ্নে ঠিক ৪টি অপশন থাকবে, মাত্র ১টি সঠিক উত্তর।
2. correct_option হবে 0, 1, 2 বা 3 (0 = option_a, 1 = option_b, 2 = option_c, 3 = option_d)।
3. প্রতিটি প্রশ্নে ১-২ বাক্যের ব্যাখ্যা (explanation) দেবে।
4. difficulty হবে "easy", "medium" বা "hard" — এর বাইরে কিছু না।
5. প্রশ্ন বাংলায় লিখবে (English বিষয় হলে ইংরেজিতে)।
6. তথ্য ১০০% সঠিক হতে হবে — অনিশ্চিত হলে সেই প্রশ্ন বাদ দাও।
7. প্রশ্নগুলো যেন একটার সাথে আরেকটার পুনরাবৃত্তি না হয়।
8. যদি প্রশ্নটি সত্যিকারের কোনো বিগত BCS পরীক্ষার হুবহু প্রশ্ন হয়, তাহলে
   "exam_label" (যেমন: "৩৫তম বিসিএস প্রিলিমিনারি") ও "exam_year" (যেমন: 2015) দাও।
   নিজের বানানো প্রশ্ন হলে এই দুটি ফিল্ড দিও না।
9. আউটপুট হবে শুধুই একটি JSON array — আগে-পরে কোনো কথা, মার্কডাউন বা ```json ব্লক নয়।

JSON ফরম্যাট (প্রতিটি প্রশ্ন এই গঠনে):
[
  {
    "subject": "বিষয়ের নাম (হুবহু)",
    "topic": "টপিকের নাম (হুবহু)",
    "statement": "প্রশ্ন?",
    "option_a": "অপশন ক",
    "option_b": "অপশন খ",
    "option_c": "অপশন গ",
    "option_d": "অপশন ঘ",
    "correct_option": 0,
    "explanation": "ব্যাখ্যা।",
    "difficulty": "medium",
    "exam_label": "৩৫তম বিসিএস প্রিলিমিনারি",
    "exam_year": 2015
  }
]
```

---

## বৈধ বিষয় ও টপিকের তালিকা (BCS কোর্স)

> AI-কে প্রম্পট দেওয়ার সময় এখান থেকে **হুবহু কপি** করুন।

### বাংলা ভাষা ও সাহিত্য
আধুনিক যুগ | উপসর্গ | কবি ও সাহিত্যিক | কারক ও বিভক্তি | ধ্বনি ও বর্ণ | পদ ও পদপ্রকরণ | প্রত্যয় | প্রাচীন যুগ ও চর্যাপদ | বাক্য | বাগধারা | বিখ্যাত গ্রন্থ ও চরিত্র | মধ্যযুগের সাহিত্য | শুদ্ধ বানান ও প্রয়োগ | সন্ধি | সমার্থক ও বিপরীত শব্দ | সমাস

### English Language & Literature
Articles and determiners | Clauses and phrases | Literary periods | Literary terms | Major authors and works | Narration | Parts of speech | Poetry, drama and fiction | Prepositions | Sentence correction | Subject-verb agreement | Tense and aspect | Vocabulary, idioms and spelling | Voice

### বাংলাদেশ বিষয়াবলি
অর্থনীতি ও বাজেট | কৃষি | জনসংখ্যা ও সংস্কৃতি | জাতীয় প্রতিষ্ঠান ও অর্জন | প্রাচীন ও মধ্যযুগের ইতিহাস | ভাষা আন্দোলন | ভূপ্রকৃতি ও সম্পদ | মুক্তিযুদ্ধ | রাজনৈতিক ও সরকার ব্যবস্থা | শিল্প ও বাণিজ্য | সংবিধান

### আন্তর্জাতিক বিষয়াবলি
আঞ্চলিক ও অর্থনৈতিক সংস্থা | আন্তর্জাতিক চুক্তি | আন্তর্জাতিক নিরাপত্তা | জাতিসংঘ | বিশ্ব ইতিহাস | ভূরাজনীতি | সমসাময়িক ঘটনা

### গাণিতিক যুক্তি
অনুপাত | অংশীদারি কারবার | অসমতা | এলিগেশন | ঐকিক নিয়ম | কেন্দ্রীয় প্রবণতা | গড় | গসাগু ও লসাগু | ট্রেন ও গতিবেগ | ত্রিভুজ | দশমিক সংখ্যা ও ভগ্নাংশ | ধারা | নৌকা ও স্রোত | পরিমিতি | বয়স সংক্রান্ত সমস্যা | বর্গ ও বর্গমূল | বাস্তব সংখ্যা | বিন্যাস ও সমাবেশ | বৃত্ত | ভগ্নাংশ | মিশ্রণ | রেখা ও কোণ | লাভ-ক্ষতি | শতকরা | সময়-কাজ এবং নল-চৌবাচ্চা | সময়-দূরত্ব ও গতিবেগ | সমীকরণ | সম্ভাবনা | সরল ও চক্রবৃদ্ধি সুদ | সরলীকরণ | সূচক ও লগারিদম | সেট

### সাধারণ বিজ্ঞান
উদ্ভিদজগৎ: সালোকসংশ্লেষণ, পরাগায়ন, ফুল ও ফল | এসিড, ক্ষার, লবণ ও সাবানের কাজ | জীববৈচিত্র্য, শ্রেণিবিন্যাস ও নমেনক্লেচার | টিস্যু, অর্গান সিস্টেম ও জেনেটিকস | তরঙ্গ ও শব্দ; আলোর প্রকৃতি ও আলোক যন্ত্রপাতি | ধাতু-অধাতু, জৈব-অজৈব যৌগ ও জারণ-বিজারণ | পদার্থের অবস্থা, এটমের গঠন ও মৌলিক কণা | বারিমণ্ডল ও বায়ুমণ্ডল: টাইড, টেকটোনিক প্লেট, সাইক্লোন, সুনামি | বিবর্তন, সামুদ্রিক জীবন ও জীবপ্রযুক্তি | ভাইরাস, ব্যাকটেরিয়া ও মাইক্রোবায়োলজি | ভৌত রাশি ও পরিমাপ; তাপ ও তাপগতিবিদ্যা | মহাবিশ্ব: পৃথিবী সৃষ্টি, কসমিক রে, ব্ল্যাক হোল, হিগস কণা | মানবদেহ: রক্ত, হৃদপিণ্ড, স্নায়ু; খাদ্য ও পুষ্টি | রোগের কারণ ও প্রতিকার; সংক্রামক রোগ ও টিকা | শক্তির উৎস ও রূপান্তর; তেজস্ক্রিয়তা ও এক্সরে | স্থির-চল তড়িৎ, চৌম্বকত্ব ও ইলেকট্রনিক্স

### কম্পিউটার ও তথ্যপ্রযুক্তি
অপারেটিং সিস্টেম ও এমবেডেড কম্পিউটার | ই-কমার্স ও দৈনন্দিন জীবনে তথ্যপ্রযুক্তি | ইন্টারনেট, ওয়ার্ল্ড ওয়াইড ওয়েব ও ই-মেইল | কম্পিউটার নেটওয়ার্ক: ল্যান, ম্যান, ওয়াই-ফাই, ওয়াইম্যাক্স | কম্পিউটার পেরিফেরালস: কি-বোর্ড, মাউস, ওসিআর | কম্পিউটার ভাইরাস ও সাইবার নিরাপত্তা | কম্পিউটারের অঙ্গসংগঠন: সিপিইউ, মেমরি, হার্ডডিস্ক | কম্পিউটারের ইতিহাস, প্রকারভেদ ও পারঙ্গমতা | ক্লাউড কম্পিউটিং, কৃত্রিম বুদ্ধিমত্তা ও রোবটিক্স | তথ্যপ্রযুক্তির বড় প্রতিষ্ঠান ও সোশ্যাল নেটওয়ার্কিং | প্রোগ্রামিং, সফটওয়্যার ও ডেটাবেজ | সংখ্যা পদ্ধতি ও ডিজিটাল লজিক | সেলুলার ডাটা নেটওয়ার্ক ও স্মার্টফোন: টুজি-ফাইভজি

### ভূগোল, পরিবেশ ও দুর্যোগ
জলবায়ু | জলবায়ু পরিবর্তন | দুর্যোগ ঝুঁকি | দূষণ | প্রস্তুতি ও প্রশমন | প্রাকৃতিক সম্পদ | বাংলাদেশের অবস্থান ও ভূপ্রকৃতি | বাস্তুতন্ত্র | বিশ্ব ভূগোল

### মানসিক দক্ষতা
অক্ষর বিন্যাস, সিরিজ ও কোডিং-ডিকোডিং | আয়না ও পানির প্রতিবিম্ব | গাণিতিক সমস্যা সমাধান: বয়স, অনুপাত, গতি | গিয়ার-ঘূর্ণন, ভারোত্তোলন ও ভারসাম্য | চিত্র গণনা, ঘনক ও পাশা | দিক ও দূরত্ব নির্ণয় | দ্রুত গণনা: শতকরা, গড়, লসাগু-গসাগু | বানান ও ভাষা: বাংলা ও English শুদ্ধি | বুদ্ধিবৃত্তিক সমস্যা: ধাঁধা, বিন্যাস ও সিদ্ধান্ত | রক্ত সম্পর্ক, ভাবার্থ ও অনুধাবন | সংখ্যা সিরিজ ও ধারা | সাদৃশ্য, বৈসাদৃশ্য ও শ্রেণিবিন্যাস

### নৈতিকতা, মূল্যবোধ ও সুশাসন
আইনের শাসন | নৈতিকতার ধারণা | মূল্যবোধ | সততা ও জবাবদিহি | সুশাসন ও উন্নয়ন | স্বচ্ছতা | স্বার্থের সংঘাত

---

## ধাপ ২ ও ৩: ইমপোর্ট SQL টেমপ্লেট

AI-এর দেওয়া JSON-টা নিচের `$json$ ... $json$` এর মাঝখানে পেস্ট করুন,
তারপর **পুরো স্ক্রিপ্টটা একসাথে** Supabase SQL Editor-এ রান করুন।

```sql
-- ============================================================
-- JobHub প্রশ্ন ইমপোর্ট স্ক্রিপ্ট (BCS কোর্স)
-- JSON পেস্ট করুন নিচের $json$ ... $json$ এর ভেতরে
-- ============================================================

create temp table tmp_import on commit drop as
select
  q->>'subject'                         as subject_title,
  q->>'topic'                           as topic_title,
  q->>'statement'                       as st,
  q->>'option_a'                        as a,
  q->>'option_b'                        as b,
  q->>'option_c'                        as c,
  q->>'option_d'                        as d,
  (q->>'correct_option')::smallint      as co,
  q->>'explanation'                     as ex,
  coalesce(q->>'difficulty','medium')   as diff,
  nullif(q->>'exam_label','')           as exam_label,
  nullif(q->>'exam_year','')::smallint  as exam_year
from jsonb_array_elements($json$
[
  >>> এখানে AI-এর দেওয়া JSON array পেস্ট করুন <<<
]
$json$::jsonb) as q;

-- ভুল বিষয়/টপিক নাম ধরা পড়বে এখানে (এই কোয়েরির ফল খালি হওয়া উচিত):
select i.subject_title, i.topic_title, i.st
from tmp_import i
left join subjects s on s.course_id = '599509ae-c4c3-440a-9463-802a4efc7a0c'
                    and s.title_bn = i.subject_title
left join topics  t on t.subject_id = s.id and t.title_bn = i.topic_title
where s.id is null or t.id is null;

-- মূল ইনসার্ট (ডুপ্লিকেট প্রশ্ন নিজে থেকেই বাদ পড়বে):
insert into questions (
  course_id, subject_id, topic_id, statement,
  option_a, option_b, option_c, option_d, correct_option,
  explanation, difficulty, source, source_type, status,
  is_verified, verified_by, verified_at,
  question_type, question_kind, fingerprint, created_by
)
select
  '599509ae-c4c3-440a-9463-802a4efc7a0c',
  s.id, t.id, i.st,
  i.a, i.b, i.c, i.d, i.co,
  i.ex, i.diff,
  case when i.exam_label is not null
       then i.exam_label || ' — বিগত সালের প্রশ্ন'
       else 'AI-সহায়তায় তৈরি, BCS সিলেবাসভিত্তিক অনুশীলন প্রশ্ন' end,
  'manual', 'approved',
  true, 'b0d40cca-e34b-42fe-bc19-dae3627b7a48', now(),
  'mcq', 'practice',
  encode(sha256(convert_to(i.st,'UTF8')),'hex'),
  'b0d40cca-e34b-42fe-bc19-dae3627b7a48'
from tmp_import i
join subjects s on s.course_id = '599509ae-c4c3-440a-9463-802a4efc7a0c'
               and s.title_bn = i.subject_title
join topics  t on t.subject_id = s.id and t.title_bn = i.topic_title
on conflict (course_id, fingerprint) do nothing;

-- PYQ হলে (exam_label দেওয়া থাকলে) প্রমাণ রেকর্ড + লেবেল:
insert into evidence_records (question_id, exam_name, exam_year, match_kind, verified_by)
select q.id, i.exam_label, i.exam_year, 'exact',
       'b0d40cca-e34b-42fe-bc19-dae3627b7a48'
from tmp_import i
join questions q on q.course_id = '599509ae-c4c3-440a-9463-802a4efc7a0c'
                and q.fingerprint = encode(sha256(convert_to(i.st,'UTF8')),'hex')
where i.exam_label is not null
  and not exists (select 1 from evidence_records e where e.question_id = q.id);

update questions q
set source_type = 'previous', question_kind = 'exact_pyq'
where q.course_id = '599509ae-c4c3-440a-9463-802a4efc7a0c'
  and q.fingerprint in (
    select encode(sha256(convert_to(st,'UTF8')),'hex')
    from tmp_import where exam_label is not null)
  and q.question_kind <> 'exact_pyq'
  and exists (select 1 from evidence_records e
              where e.question_id = q.id and e.match_kind = 'exact'
                and e.verified_by is not null);

-- শেষ যাচাই: planned = inserted হলে সব ঠিকঠাক ঢুকেছে
select
  (select count(*) from tmp_import) as planned,
  (select count(*) from questions q
   where q.course_id = '599509ae-c4c3-440a-9463-802a4efc7a0c'
     and q.fingerprint in (select encode(sha256(convert_to(st,'UTF8')),'hex')
                           from tmp_import)) as inserted,
  (select count(*) from questions q
   where q.course_id = '599509ae-c4c3-440a-9463-802a4efc7a0c'
     and q.fingerprint in (select encode(sha256(convert_to(st,'UTF8')),'hex')
                           from tmp_import where exam_label is not null)
     and q.question_kind = 'exact_pyq') as pyq_labeled;
```

---

## ⚠️ জরুরি নিয়ম ও টিপস

| বিষয় | নিয়ম |
|---|---|
| `correct_option` | **0–3** (0 = ক, 1 = খ, 2 = গ, 3 = ঘ)। ১–৪ নয়! |
| `difficulty` | শুধু `easy`, `medium`, `hard` |
| ডুপ্লিকেট | একই প্রশ্ন (statement) দুবার ঢুকবে না — fingerprint দিয়ে আটকানো আছে |
| বিষয়/টপিক নাম | ডাটাবেজের সাথে **হুবহু** মিলতে হবে; না মিললে ২য় কোয়েরিতে সেই সারি দেখাবে |
| `exam_label` | **শুধু সত্যিকারের বিগত BCS প্রশ্নে** দিন; AI-এর নিজের বানানো প্রশ্নে দেবেন না |
| যাচাই | AI মাঝে মাঝে ভুল উত্তর দেয় — ইমপোর্টের আগে নিজে একবার চোখ বুলিয়ে নিন |
| এক ব্যাচে কত | ২৫–৫০টি করে ইমপোর্ট করা সবচেয়ে নিরাপদ |
| পেট্রোবাংলা কোর্সে | স্ক্রিপ্টের সব `599509ae-c4c3-440a-9463-802a4efc7a0c` বদলে `4ab82963-892e-4c69-9a5d-09d289c33c04` দিন (টপিক নামও সেই কোর্সের হতে হবে) |

## রেফারেন্স আইডি

| জিনিস | আইডি |
|---|---|
| BCS কোর্স | `599509ae-c4c3-440a-9463-802a4efc7a0c` |
| পেট্রোবাংলা কোর্স | `4ab82963-892e-4c69-9a5d-09d289c33c04` |
| অ্যাডমিন (verified_by/created_by) | `b0d40cca-e34b-42fe-bc19-dae3627b7a48` |
| Supabase প্রজেক্ট | `bozmbnelcokhbuumkdry` |
