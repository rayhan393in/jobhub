# AI দিয়ে প্রশ্ন বানিয়ে ডাটাবেজে ঢোকানো — v2 (নিরাপদ)

> এই ফাইলটি `docs/ai-question-generation-guide.md`-এর **প্রতিস্থাপক**।
> পুরনো গাইডটা প্রশ্নগুলো `status='approved'`, `is_verified=true`, `source_type='manual'`
> দিয়ে সোজা ইনসার্ট করত — অর্থাৎ রিভিউ বাইপাস, AI-কে "মানুষে লেখা" বলে চালিয়ে দেওয়া,
> আর একটা hardcoded `verified_by`। আপনার ৬১০টা AI প্রশ্ন ঠিক এভাবেই এক ঘণ্টায় approve হয়েছিল।
>
> **v2 যা বদলায়:**
> 1. প্রশ্ন ঢোকে `status='pending_review'`, `is_verified=false`, `source_type='ai_assisted'` — সত্যি কথা।
> 2. স্ক্রিপ্ট দিয়ে **approve করা সম্ভবই না** — ডাটাবেজের ট্রিগার আটকে দেয় (`jh_has_permission('question.review')` লাগে, SQL Editor-এ সেটা নেই)। অনুমোদন কেবল `/admin/review` থেকে।
> 3. বিষয়/টপিক নাম না মিললে **পুরো ইমপোর্ট বাতিল** — অর্ধেক `topic_id=null` হয়ে ঢোকে না।
> 4. PYQ হলে `exam_name`+`exam_year` দুই-ই লাগবে, নাহলে সারি বাতিল; আর `evidence_records`
>    না বানিয়ে `source_type='previous'` করা যাবে না (ট্রিগার আটকায়)।
> 5. `correct_option` ০–৩ ছাড়া কিছু নিলে বাতিল (১–৪ স্কেলে গুলিয়ে যাওয়া বন্ধ)।

---

## ধাপ ১ — AI-কে দিন এই প্রম্পট

`[...]` গুলো বদলে নিন। **বিষয় ও টপিকের নাম নিচের তালিকা থেকে হুবহু কপি করুন** — এক বানান
আলাদা হলে পুরো ব্যাচ বাতিল হবে (এটাই ইচ্ছাকৃত, যাতে orphan প্রশ্ন তৈরি না হয়)।

```text
তুমি বাংলাদেশের বিসিএস প্রিলিমিনারির একজন অভিজ্ঞ প্রশ্নকর্তা।
আমাকে ঠিক [সংখ্যা]টি MCQ প্রশ্ন তৈরি করে দাও।

বিষয়: [বিষয়ের নাম — নিচের তালিকা থেকে হুবহু]
টপিক: [টপিকের নাম — নিচের তালিকা থেকে হুবহু]

কঠোর নিয়ম:

1. প্রতিটি প্রশ্নে ঠিক ৪টি অপশন, একটাই সঠিক উত্তর। অপশন একটার সাথে আরেকটা
   হুবহু মিলতে পারবে না, খালি থাকতে পারবে না।

2. correct_option হবে শুধু a, b, c বা d।
   ★ সঠিক উত্তর চারটি অক্ষরে প্রায় সমানভাবে ছড়িয়ে দেবে: ২৫% করে।
     একটানা b দিলে ব্যাচ বাতিল হবে। প্রতিটি প্রশ্নে আগে উত্তরটা ঠিক করো,
     তারপর সেটা কোন লেটারে বসবে সেটা বেছে নাও — উল্টোটা নয়।

3. explanation বাধ্যতামূলক, ১–২ বাক্য, এবং কেন উত্তরটা সঠিক সেটা বলবে।
   "সঠিক উত্তর b" এভাবে লিখে দিলে হবে না।

4. difficulty হবে easy / medium / hard — এর বাইরে কিছু না।
   মোটের মধ্যে প্রায় ৪০% easy, ৪০% medium, ২০% hard।

5. প্রশ্ন বাংলায় (বিষয় English হলে ইংরেজিতে)। সংখ্যা বাংলা অঙ্কে লেখা ভালো,
   তবে অপশন ও correct_option লেটার সবসময় ইংরেজি a–d।

6. তথ্য ১০০% নিশ্চিত না হলে প্রশ্নটা বাদ দাও। সংখ্যা/সাল/নাম নিয়ে সন্দেহ থাকলে
   সেই প্রশ্ন লিখবে না। অনুমান করে লিখবে না — এটা কঠোর নিয়ম।

7. আগের প্রশ্নের পুনরাবৃত্তি করবে না। একই তথ্য দুইভাবে ঘুরিয়ে লিখবে না।

8. এই ব্যাচে আগে থেকেই থাকা প্রশ্নের পুনরাবৃত্তি নয় — শুধু নতুন তথ্য/কোণ।

9. exam_name ও exam_year দেবে শুধু তখনই, যখন প্রশ্নটি সত্যিই নিচের তালিকার
   কোনো পরীক্ষার হুবহু প্রশ্ন। নামটা অক্ষরে অক্ষরে তালিকার মতোই হবে।
   নিজের বানানো প্রশ্নে এই দুটি ফিল্ড একেবারে দেবে না (বাদ দেবে, খালি স্ট্রিং নয়)।

10. আউটপুট হবে শুধুই একটি JSON array। আগে-পরে কোনো কথা, শিরোনাম বা
    ```json ব্লক নয়। প্রথম অক্ষর `[`, শেষ অক্ষর `]`।

JSON গঠন (প্রতি প্রশ্নে ঠিক এই কী-গুলো):
[
  {
    "subject": "বিষয়ের নাম (হুবহু)",
    "topic": "টপিকের নাম (হুবহু)",
    "statement": "প্রশ্ন?",
    "option_a": "…",
    "option_b": "…",
    "option_c": "…",
    "option_d": "…",
    "correct_option": "b",
    "explanation": "…",
    "difficulty": "medium",
    "source_title": "AI-সহায়তায় তৈরি, বিসিএস সিলেবাসভিত্তিক",
    "source_locator": null,
    "exam_name": null,
    "exam_year": null
  }
]
```

> **এক ব্যাচে ২০–২৫টি।** ৫০-এর বেশি একসাথে চাইলে AI-এর মনোযোগ কমে, আর
> `correct_option` আবার একদিকে ঝুঁকে পড়ে।

---

## ধাপ ২ — বৈধ বিষয় ও টপিক (ডাটাবেজ থেকে হুবহু)

### বাংলা ভাষা ও সাহিত্য
আধুনিক যুগ, উপসর্গ, কবি ও সাহিত্যিক, কারক ও বিভক্তি, ধ্বনি ও বর্ণ, পদ ও পদপ্রকরণ, প্রত্যয়,
প্রাচীন যুগ ও চর্যাপদ, বাক্য, বাগধারা, বিখ্যাত গ্রন্থ ও চরিত্র, মধ্যযুগের সাহিত্য,
শুদ্ধ বানান ও প্রয়োগ, সন্ধি, সমার্থক ও বিপরীত শব্দ, সমাস

### English Language & Literature
Articles and determiners, Clauses and phrases, Literary periods, Literary terms,
Major authors and works, Narration, Parts of speech, Poetry, drama and fiction,
Prepositions, Sentence correction, Subject-verb agreement, Tense and aspect,
Vocabulary, idioms and spelling, Voice

### বাংলাদেশ বিষয়াবলি
অর্থনীতি ও বাজেট, কৃষি, জনসংখ্যা ও সংস্কৃতি, জাতীয় প্রতিষ্ঠান ও অর্জন,
প্রাচীন ও মধ্যযুগের ইতিহাস, ভাষা আন্দোলন, ভূপ্রকৃতি ও সম্পদ, মুক্তিযুদ্ধ,
রাজনৈতিক ও সরকার ব্যবস্থা, শিল্প ও বাণিজ্য, সংবিধান

### আন্তর্জাতিক বিষয়াবলি
আঞ্চলিক ও অর্থনৈতিক সংস্থা, আন্তর্জাতিক চুক্তি, আন্তর্জাতিক নিরাপত্তা, জাতিসংঘ,
বিশ্ব ইতিহাস, ভূরাজনীতি, সমসাময়িক ঘটনা

### ভূগোল, পরিবেশ ও দুর্যোগ
জলবায়ু, জলবায়ু পরিবর্তন, দুর্যোগ ঝুঁকি, দূষণ, প্রস্তুতি ও প্রশমন, প্রাকৃতিক সম্পদ,
বাংলাদেশের অবস্থান ও ভূপ্রকৃতি, বাস্তুতন্ত্র, বিশ্ব ভূগোল

### সাধারণ বিজ্ঞান
উদ্ভিদজগৎ: সালোকসংশ্লেষণ, পরাগায়ন, ফুল ও ফল · এসিড, ক্ষার, লবণ ও সাবানের কাজ ·
জীববৈচিত্র্য, শ্রেণিবিন্যাস ও নমেনক্লেচার · টিস্যু, অর্গান সিস্টেম ও জেনেটিকস ·
তরঙ্গ ও শব্দ; আলোর প্রকৃতি ও আলোক যন্ত্রপাতি · ধাতু-অধাতু, জৈব-অজৈব যৌগ ও জারণ-বিজারণ ·
পদার্থের অবস্থা, এটমের গঠন ও মৌলিক কণা · বারিমণ্ডল ও বায়ুমণ্ডল: টাইড, টেকটোনিক প্লেট,
সাইক্লোন, সুনামি · বিবর্তন, সামুদ্রিক জীবন ও জীবপ্রযুক্তি · ভাইরাস, ব্যাকটেরিয়া ও
মাইক্রোবায়োলজি · ভৌত রাশি ও পরিমাপ; তাপ ও তাপগতিবিদ্যা · মহাবিশ্ব: পৃথিবী সৃষ্টি,
কসমিক রে, ব্ল্যাক হোল, হিগস কণা · মানবদেহ: রক্ত, হৃদপিণ্ড, স্নায়ু; খাদ্য ও পুষ্টি ·
রোগের কারণ ও প্রতিকার; সংক্রামক রোগ ও টিকা · শক্তির উৎস ও রূপান্তর; তেজস্ক্রিয়তা ও এক্সরে ·
স্থির-চল তড়িৎ, চৌম্বকত্ব ও ইলেকট্রনিক্স

### কম্পিউটার ও তথ্যপ্রযুক্তি
অপারেটিং সিস্টেম ও এমবেডেড কম্পিউটার · ই-কমার্স ও দৈনন্দিন জীবনে তথ্যপ্রযুক্তি ·
ইন্টারনেট, ওয়ার্ল্ড ওয়াইড ওয়েব ও ই-মেইল · কম্পিউটার নেটওয়ার্ক: ল্যান, ম্যান,
ওয়াই-ফাই, ওয়াইম্যাক্স · কম্পিউটার পেরিফেরালস: কি-বোর্ড, মাউস, ওসিআর ·
কম্পিউটার ভাইরাস ও সাইবার নিরাপত্তা · কম্পিউটারের অঙ্গসংগঠন: সিপিইউ, মেমরি, হার্ডডিস্ক ·
কম্পিউটারের ইতিহাস, প্রকারভেদ ও পারঙ্গমতা · ক্লাউড কম্পিউটিং, কৃত্রিম বুদ্ধিমত্তা ও রোবটিক্স ·
তথ্যপ্রযুক্তির বড় প্রতিষ্ঠান ও সোশ্যাল নেটওয়ার্কিং · প্রোগ্রামিং, সফটওয়্যার ও ডেটাবেজ ·
সংখ্যা পদ্ধতি ও ডিজিটাল লজিক · সেলুলার ডাটা নেটওয়ার্ক ও স্মার্টফোন: টুজি-ফাইভজি

### গাণিতিক যুক্তি
অনুপাত, অংশীদারি কারবার, অসমতা, এলিগেশন, ঐকিক নিয়ম, কেন্দ্রীয় প্রবণতা, গড়,
গসাগু ও লসাগু, ট্রেন ও গতিবেগ, ত্রিভুজ, দশমিক সংখ্যা ও ভগ্নাংশ, ধারা, নৌকা ও স্রোত,
পরিমিতি, বয়স সংক্রান্ত সমস্যা, বর্গ ও বর্গমূল, বাস্তব সংখ্যা, বিন্যাস ও সমাবেশ, বৃত্ত,
ভগ্নাংশ, মিশ্রণ, রেখা ও কোণ, লাভ-ক্ষতি, শতকরা, সময়-কাজ এবং নল-চৌবাচ্চা,
সময়-দূরত্ব ও গতিবেগ, সমীকরণ, সম্ভাবনা, সরল ও চক্রবৃদ্ধি সুদ, সরলীকরণ,
সূচক ও লগারিদম, সেট

### মানসিক দক্ষতা
অক্ষর বিন্যাস, সিরিজ ও কোডিং-ডিকোডিং · আয়না ও পানির প্রতিবিম্ব · গাণিতিক সমস্যা সমাধান:
বয়স, অনুপাত, গতি · গিয়ার-ঘূর্ণন, ভারোত্তোলন ও ভারসাম্য · চিত্র গণনা, ঘনক ও পাশা ·
দিক ও দূরত্ব নির্ণয় · দ্রুত গণনা: শতকরা, গড়, লসাগু-গসাগু · বানান ও ভাষা: বাংলা ও
English শুদ্ধি · বুদ্ধিবৃত্তিক সমস্যা: ধাঁধা, বিন্যাস ও সিদ্ধান্ত · রক্ত সম্পর্ক,
ভাবার্থ ও অনুধাবন · সংখ্যা সিরিজ ও ধারা · সাদৃশ্য, বৈসাদৃশ্য ও শ্রেণিবিন্যাস

### নৈতিকতা, মূল্যবোধ ও সুশাসন
আইনের শাসন, নৈতিকতার ধারণা, মূল্যবোধ, সততা ও জবাবদিহি, সুশাসন ও উন্নয়ন, স্বচ্ছতা,
স্বার্থের সংঘাত

> `গণিত`, `বাংলা`, `English`, `কম্পিউটার ও আইসিটি` — এই **চারটি ভুল/ডুপ্লিকেট বিষয়**
> ডাটাবেজে এখনো আছে। ওগুলোর নাম ব্যবহার করবেন না; উপরের পূর্ণ নামগুলোই দিন।

---

## ধাপ ৩ — `exam_name` / `exam_year` (PYQ হলে)

`exam_name` স্ট্রিংটা ডাটাবেজে যেভাবে আছে ঠিক সেভাবেই দিতে হবে। এখনকার মান:

| exam_name (হুবহু) | exam_year | ব্যাংকে প্রশ্ন |
|---|---|---|
| ১০ম বিসিএস প্রিলিমিনারি … ৪৩তম বিসিএস প্রিলিমিনারি | ১৯৮৯–২০২১ | ১৮৪ (evidence-verified) |
| ৫০তম বিসিএস প্রিলিমিনারি ২০২৫ | 2025 | ৮১ |
| প্রাথমিক শিক্ষক নিয়োগ পরীক্ষা ২০০৭ … ২০১৯ | ২০০৭–২০১৯ | ১৫ |

পুরো ৩২ সারির তালিকা:

```sql
select exam_name, exam_year, count(*)
from evidence_records group by 1,2 order by 2 desc, 1;
```

**নতুন যোগ করার সময় এই নিয়ম:**

- ★ **সাল নিজে অনুমান করবেন না।** প্রম্পটে সাল লিখে দেবেন না, AI-কে বলবেন
  "শুধু যদি হুবহু চেনে"। AI প্রায়ই বিসিএস নম্বর আর সাল গুলিয়ে ফেলে।
- প্রশ্নটা যদি সত্যিই ৪৪তম/৪৫তম/৪৭তম বিসিএসের হয় — **প্রশ্নপত্র মিলিয়ে নিজে সালটা
  নিশ্চিত করুন**, তারপর স্ক্রিপ্টে বসান।
- ⚠️ ডাটাবেজে এখন `৪৬তম বিসিএস প্রিলিমিনারি → 2022` লেখা আছে (১টা প্রশ্ন)।
  ৪৬তম বিসিএস প্রিলিমিনারি ২০২২-এ হয়নি — এটা ভুল attribution, দেখে নিন।

---

## ধাপ ৪ — JSON-টা SQL-এ বসান

Supabase SQL Editor: <https://supabase.com/dashboard/project/bozmbnelcokhbuumkdry/sql>

পুরো স্ক্রিপ্ট একসাথে রান করুন। প্রতিটি ধাপের আগে একটা যাচাই-কোয়েরি আছে যেটা
**ফাঁকা আসা উচিত** — কিছু ফিরলে নিচের ইনসার্ট আর হবে না, স্ক্রিপ্ট থেমে যাবে।

```sql
-- ============================================================================
--  JobHub · AI প্রশ্ন ইমপোর্ট v2
--  AI-এর JSON পেস্ট করুন STEP 1-এর $json$ ... $json$ এর ভেতরে।
--  পুরো স্ক্রিপ্ট একসাথে রান করুন। কিছু ভুল থাকলে কিছুই ইনসার্ট হবে না।
-- ============================================================================

drop table if exists jh_ctx, jh_in, jh_rows, jh_batch;

-- ── STEP 0 · কনফিগ ─────────────────────────────────────────────────────────
create temp table jh_ctx as
select
  '599509ae-c4c3-440a-9463-802a4efc7a0c'::uuid as course_id,   -- বিসিএস
  'b0d40cca-e34b-42fe-bc19-dae3627b7a48'::uuid as admin_id,    -- আপনার profile id
  'ai-draft-' || to_char(now(), 'YYYYMMDD-HH24MI') as filename;

-- পেট্রোবাংলা হলে course_id = '4ab82963-892e-4c69-9a5d-09d289c33c04'

-- ── STEP 1 · AI-এর JSON ────────────────────────────────────────────────────
create temp table jh_in as
select
  btrim(q->>'subject')                                    as subject_title,
  btrim(q->>'topic')                                      as topic_title,
  -- অ্যাপের মতোই whitespace collapse করা হচ্ছে, যাতে fingerprint মেলে
  regexp_replace(btrim(q->>'statement'), '\s+', ' ', 'g') as st,
  btrim(q->>'option_a')                                   as a,
  btrim(q->>'option_b')                                   as b,
  btrim(q->>'option_c')                                   as c,
  btrim(q->>'option_d')                                   as d,
  lower(btrim(q->>'correct_option'))                      as co_raw,
  btrim(q->>'explanation')                                as ex,
  coalesce(nullif(lower(btrim(q->>'difficulty')), ''), 'medium') as diff,
  nullif(btrim(q->>'exam_name'), '')                      as exam_name,
  nullif(btrim(q->>'exam_year'), '')::smallint            as exam_year,
  nullif(btrim(q->>'source_title'), '')                   as source_title,
  nullif(btrim(q->>'source_locator'), '')                 as source_locator
from jsonb_array_elements($json$
[
  >>> এখানে AI-এর JSON array পেস্ট করুন <<<
]
$json$::jsonb) as q;

-- correct_option → 0..3
alter table jh_in add column co smallint;
update jh_in set co = case co_raw
  when 'a' then 0 when 'b' then 1 when 'c' then 2 when 'd' then 3
  when 'ক' then 0 when 'খ' then 1 when 'গ' then 2 when 'ঘ' then 3
  when '0' then 0 when '1' then 1 when '2' then 2 when '3' then 3
end;

-- ── STEP 2 · যাচাই (এই ফল ফাঁকা হওয়া উচিত) ─────────────────────────────────
--  ফাঁকা মানে সব সারি ঠিক। একটাও সারি ফিরলে নিচের ইনসার্ট হবে না।
select statement, problems
from (
  select
    left(st, 60) as statement,
    array_remove(array[
      case when st is null or length(st) < 8        then 'statement ছোট/খালি' end,
      case when a = '' or b = '' or c = '' or d = '' then 'অপশন খালি' end,
      case when a = b or a = c or a = d
             or b = c or b = d or c = d             then 'একই অপশন দুইবার' end,
      case when co is null                          then 'correct_option বোঝা যায়নি' end,
      case when co_raw = '4'                        then 'correct_option=4 → ১-৪ স্কেলে দেওয়া হয়েছে' end,
      case when diff not in ('easy','medium','hard') then 'difficulty অবৈধ' end,
      case when ex is null or ex = ''               then 'explanation খালি' end,
      case when (exam_name is null) <> (exam_year is null) then 'exam_name/exam_year জোড়া মেলেনি' end,
      case when exam_year is not null and (exam_year < 1971 or exam_year > 2100)
                                                    then 'exam_year সীমার বাইরে' end
    ], null) as problems
  from jh_in
) checked
where cardinality(problems) > 0;

do $$
declare bad int; dup int;
begin
  select count(*) into bad from jh_in
   where st is null or length(st) < 8
      or a = '' or b = '' or c = '' or d = ''
      or a = b or a = c or a = d or b = c or b = d or c = d
      or co is null or co_raw = '4'
      or diff not in ('easy','medium','hard')
      or ex is null or ex = ''
      or (exam_name is null) <> (exam_year is null)
      or (exam_year is not null and (exam_year < 1971 or exam_year > 2100));
  if bad > 0 then
    raise exception '% সারি অবৈধ — উপরের তালিকা দেখে JSON ঠিক করুন। কিছুই ইনসার্ট হয়নি।', bad;
  end if;

  select count(*) into dup from (
    select st from jh_in group by st having count(*) > 1
  ) d;
  if dup > 0 then
    raise exception 'একই statement % বার এসেছে — JSON থেকে ডুপ্লিকেট বাদ দিন।', dup;
  end if;
end $$;

-- ── STEP 3 · বিষয়/টপিক মেলানো (এই ফল ফাঁকা হওয়া উচিত) ─────────────────────
create temp table jh_rows as
select
  i.*,
  c.course_id,
  c.admin_id as _admin,
  s.id  as subject_id,
  t.id  as topic_id
from jh_in i
cross join jh_ctx c
left join subjects s on s.course_id = c.course_id and s.title_bn = i.subject_title
left join topics   t on t.subject_id = s.id       and t.title_bn = i.topic_title;

select subject_title, topic_title, count(*) as rows
from jh_rows
where subject_id is null or topic_id is null
group by 1, 2 order by 3 desc;

do $$
begin
  if exists (select 1 from jh_rows where subject_id is null or topic_id is null) then
    raise exception 'বিষয়/টপিকের নাম মেলেনি — উপরের তালিকা দেখুন, নাম অক্ষরে অক্ষরে দিতে হবে। কিছুই ইনসার্ট হয়নি।';
  end if;
end $$;

-- ── STEP 4 · ব্যাচ রেকর্ড ──────────────────────────────────────────────────
create temp table jh_batch as select gen_random_uuid() as id;

insert into import_batches (id, created_by, filename, format, mode, total_rows)
select b.id, c.admin_id, c.filename, 'json', 'commit', (select count(*) from jh_rows)
from jh_batch b cross join jh_ctx c;

-- ── STEP 5 · প্রশ্ন ইনসার্ট (pending_review, unverified, ai_assisted) ──────
insert into questions (
  course_id, subject_id, topic_id, statement,
  option_a, option_b, option_c, option_d, correct_option,
  explanation, difficulty, source, source_type, status, is_verified,
  question_type, question_kind, fingerprint,
  exam_name, "year", import_batch_id, created_by
)
select
  r.course_id, r.subject_id, r.topic_id, r.st,
  r.a, r.b, r.c, r.d, r.co,
  r.ex, r.diff,
  coalesce(r.source_title, 'AI draft — মানব যাচাই বাকি'),
  'ai_assisted', 'pending_review', false,
  'mcq', 'practice',
  encode(sha256(convert_to(r.st, 'UTF8')), 'hex'),
  r.exam_name, r.exam_year, b.id, r._admin
from jh_rows r
cross join jh_batch b
on conflict (course_id, fingerprint) do nothing;

-- ── STEP 6 · PYQ হলে প্রমাণ + লেবেল ───────────────────────────────────────
-- exam_name/exam_year দেওয়া সারির জন্য evidence_records বানানো হচ্ছে,
-- তারপর source_type='previous' ও question_kind='exact_pyq' করা হচ্ছে।
-- দুটোই ডাটাবেজের ট্রিগার দিয়ে যাচাই হয়: প্রমাণ ছাড়া লেবেল বসবে না।
insert into evidence_records (question_id, exam_name, exam_year, match_kind, verified_by, source_ref)
select
  q.id, r.exam_name, r.exam_year, 'exact', r._admin, r.source_locator
from jh_rows r
join questions q
  on q.course_id = r.course_id
 and q.fingerprint = encode(sha256(convert_to(r.st, 'UTF8')), 'hex')
where r.exam_name is not null
on conflict (question_id, exam_name, exam_year) do nothing;

update questions q
   set source_type = 'previous',
       question_kind = 'exact_pyq'
from jh_rows r
where r.exam_name is not null
  and q.course_id = r.course_id
  and q.fingerprint = encode(sha256(convert_to(r.st, 'UTF8')), 'hex')
  and q.source_type <> 'previous';

-- ── STEP 7 · ফলাফল ─────────────────────────────────────────────────────────
select
  (select count(*) from jh_rows)  as planned,
  (select count(*) from questions q join jh_rows r
      on q.course_id = r.course_id
     and q.fingerprint = encode(sha256(convert_to(r.st, 'UTF8')), 'hex')) as present_in_db,
  (select count(*) from questions q join jh_rows r
      on q.course_id = r.course_id
     and q.fingerprint = encode(sha256(convert_to(r.st, 'UTF8')), 'hex')
    where q.import_batch_id = (select id from jh_batch))            as inserted_now,
  (select count(*) from jh_rows where exam_name is not null)        as pyq_rows,
  (select count(*) from questions q
    where q.import_batch_id = (select id from jh_batch)
      and q.topic_id is null)                                      as orphan_rows;

-- এই ব্যাচের উত্তর-কী বণ্টন (চারটাই ২৫%±১০% হওয়া উচিত)
select
  case correct_option when 0 then 'a' when 1 then 'b' when 2 then 'c' else 'd' end as answer,
  count(*) as n,
  round(100.0 * count(*) / sum(count(*)) over (), 1) as pct
from questions
where import_batch_id = (select id from jh_batch)
group by correct_option order by correct_option;
```

---

## ধাপ ৫ — অনুমোদন (এটা SQL দিয়ে হবে না, ইচ্ছাকৃতভাবেই)

`source_type='ai_assisted'` প্রশ্ন ডাটাবেজের `guard_question_verification` ট্রিগার
`jh_has_permission('question.review')` ছাড়া approve হতে দেয় না। SQL Editor-এ
`auth.uid()` null, তাই ওই ফাংশন false — অর্থাৎ **স্ক্রিপ্ট দিয়ে approve করা অসম্ভব।**
এটাই সুরক্ষা, বাগ নয়।

1. `https://jobhub-xi-five.vercel.app/admin/questions?source=ai_assisted` — পড়ুন
2. প্রতিটা প্রশ্নে: সত্যি? অপশন ঠিক? ব্যাখ্যা ঠিক? `correct_option` ঠিক?
3. `/admin/review` → **অনুমোদন** / **বাতিল**

> ২৫টা প্রশ্ন পড়তে ১০–১৫ মিনিট লাগে। ৬১০টা এক ঘণ্টায় approve করার চেষ্টা করবেন না —
> সেটাই আগের সমস্যার মূল।

---

## ধাপ ৬ (ঐচ্ছিক) — উত্তর-কী সমান করা

আপনার ব্যাংকে এখন `b` = ৪৫.৫%, `d` = ৬.৮%। নতুন প্রম্পটে এটা ঠিক হবে, কিন্তু
পুরনো ৬১০টা এখনো তির্যক। নিচের ব্লকটা **এই ব্যাচের প্রশ্নগুলোকে** ঘুরিয়ে বণ্টন সমান করে —
অপশনের টেক্সট ও `correct_option` একসাথে ঘোরে, তাই উত্তর কখনো ভুল হবে না।

⚠️ এর আগে STEP 7-এর বণ্টন দেখুন। আর গণিতের প্রশ্নে অপশন ক্রমে (ছোট→বড়) থাকলে
ঘোরানোর পর সেটা ভাঙবে — সেক্ষেত্রে বাদ দিন।

```sql
do $$
declare
  rec record;
  k int;
  nxt text[];
  i int;
begin
  for rec in
    select q.id, q.correct_option,
           array[q.option_a, q.option_b, q.option_c, q.option_d] as opts
    from questions q
    where q.import_batch_id = (select id from jh_batch)
  loop
    -- লক্ষ্য স্লট 0..3 নির্বাচন, তারপর সেটার দিকে ঘোরানো
    k := ((abs(hashtext(rec.id::text)) % 4) - rec.correct_option + 4) % 4;
    if k = 0 then continue; end if;

    nxt := array[]::text[];
    for i in 0..3 loop
      nxt := nxt || rec.opts[((i - k + 4) % 4) + 1];
    end loop;

    update questions
       set option_a = nxt[1],
           option_b = nxt[2],
           option_c = nxt[3],
           option_d = nxt[4],
           correct_option = (rec.correct_option + k) % 4
     where id = rec.id;
  end loop;
end $$;
```

শেষে আবার বণ্টন দেখুন:

```sql
select
  case correct_option when 0 then 'a' when 1 then 'b' when 2 then 'c' else 'd' end as answer,
  count(*),
  round(100.0 * count(*) / sum(count(*)) over (), 1) as pct
from questions where status = 'approved'
group by correct_option order by correct_option;
```

---

## দ্রুত চেকলিস্ট

| # | কাজ | কোথায় |
|---|---|---|
| 1 | প্রম্পট + বিষয়/টপিকের নাম হুবহু | ধাপ ১ ও ২ |
| 2 | ২০–২৫টা প্রতি ব্যাচ | ধাপ ১ |
| 3 | JSON পেস্ট + পুরো SQL রান | ধাপ ৪ |
| 4 | STEP 2 ও STEP 3-এর ফল **ফাঁকা** কিনা | ধাপ ৪ |
| 5 | বণ্টন ২৫%±১০% কিনা (STEP 7) | ধাপ ৪ |
| 6 | প্রতিটা প্রশ্ন পড়ে অনুমোদন | ধাপ ৫ |
| 7 | (ঐচ্ছিক) পুরনো ব্যাংকের skew ঠিক | ধাপ ৬ |

## রেফারেন্স আইডি

| জিনিস | আইডি |
|---|---|
| বিসিএস কোর্স | `599509ae-c4c3-440a-9463-802a4efc7a0c` |
| পেট্রোবাংলা কোর্স | `4ab82963-892e-4c69-9a5d-09d289c33c04` |
| অ্যাডমিন (created_by / verified_by) | `b0d40cca-e34b-42fe-bc19-dae3627b7a48` |
| Supabase প্রজেক্ট | `bozmbnelcokhbuumkdry` |
