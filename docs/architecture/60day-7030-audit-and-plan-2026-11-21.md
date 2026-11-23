# BCS ৬০-দিন রুটিন + ৭০:৩০ ডেইলি এক্সাম — Phase 1: Existing System Audit & Implementation Plan

তারিখ: 2026-11-21 · ব্রাঞ্চ: `arena/b34c2a23-jobhub` (HEAD `176121f`) · DB: লাইভ Supabase (`bozmbnelcokhbuumkdry`)

> মাস্টার প্রম্পটের Workflow অনুযায়ী **কোনো কোড লেখার আগে** এই অডিট + প্ল্যান তৈরি করা হয়েছে।
> মূলনীতি মেনে: কোনো বানানো সংখ্যা নেই — নিচের প্রতিটি সংখ্যা লাইভ ডাটাবেস কোয়েরি থেকে নেওয়া।

---

## ১. Taxonomy অডিট (প্রম্পটের সাথে মিল যাচাই)

| আইটেম | প্রম্পটের দাবি | লাইভ DB | ফলাফল |
|---|---|---|---|
| Subject | ১০টি | **১০টি** | ✅ হুবহু মিল |
| Topic | ১৩৭টি | **১৩৭টি** | ✅ হুবহু মিল |
| Subtopic | ৩৬৬টি | **৩৬৬টি** | ✅ হুবহু মিল |

- ⚠️ **১৬টি topic-এর অধীনে কোনো subtopic নেই** — Coverage Matrix-এ এগুলো topic-লেভেলে ট্র্যাক করতে হবে (subtopic বানানো নিষেধ, তাই নতুন কিছু যোগ করা হবে না)।
- সিদ্ধান্ত: taxonomy-তে **শূন্য পরিবর্তন** — সব রুটিন-টাস্ক ও প্রশ্ন-ম্যাপিং বিদ্যমান ID-তে লিংক হবে।

## ২. প্রশ্নব্যাংক অডিট — PYQ বাস্তবতা (সবচেয়ে গুরুত্বপূর্ণ ফাইন্ডিং)

Approved + verified প্রশ্ন (BCS কোর্স): মোট **৪৩৭টি** — PYQ (`source_type='previous'`) **৭১টি**, Practice **৩৬৬টি**।

| বিষয় | PYQ | পূর্ণ মেটাডাটাসহ PYQ (exam_name + year) | Practice |
|---|---:|---:|---:|
| বাংলা ভাষা ও সাহিত্য | 10 | **1** | 66 |
| English Language & Literature | 10 | 0 | 57 |
| বাংলাদেশ বিষয়াবলি | 8 | 0 | 52 |
| আন্তর্জাতিক বিষয়াবলি | 8 | 0 | 42 |
| ভূগোল, পরিবেশ ও দুর্যোগ | 3 | 0 | 4 |
| সাধারণ বিজ্ঞান | 7 | 0 | 62 |
| কম্পিউটার ও তথ্যপ্রযুক্তি | 8 | 0 | 7 |
| গাণিতিক যুক্তি | 9 | 0 | 67 |
| মানসিক দক্ষতা | 5 | 0 | 5 |
| নৈতিকতা, মূল্যবোধ ও সুশাসন | 3 | 0 | 7 → মোট 7 |
| **মোট** | **71** | **1** | **366** |

**সৎ উপসংহার (কোনো লুকোচুরি নেই):**
- দৈনিক পরীক্ষায় লাগবে **৭০টি verified PYQ**; পুরো কোর্সে PYQ আছে মাত্র **৭১টি**, তার মধ্যে exam_name + year পূর্ণ মেটাডাটা আছে মাত্র **১টির**।
- অর্থাৎ strict 70:30 ভ্যালিডেশন চালু করলে **আজ প্রতিটি দৈনিক পরীক্ষাই publish-block হবে** — এবং প্রম্পটের নিয়ম অনুযায়ী এটিই সঠিক আচরণ: practice প্রশ্ন দিয়ে ঘাটতি পূরণ করা হবে না, ভুয়া অনুপাত দেখানো হবে না; অ্যাডমিনকে আসল সংখ্যা দেখানো হবে।
- ৭০টি PYQ-র exam_name/year **evidence_records থেকেও backfill করা যায় না** (exact-match evidence-এ exam_year-সহ রেকর্ড: ০টি)। মেটাডাটা অ্যাডমিনকেই উৎসসহ দিতে হবে — আমি বানিয়ে বসাব না।
- আরও: **১০১টি** approved প্রশ্নের `topic_id` NULL। ~~লিংক টেবিল থেকে backfill সম্ভব~~ → **সংশোধন (যাচাই-পরবর্তী):** এই ১০১টির `question_topic_links` সবই subject-স্তরের (link.topic_id-ও NULL), তাই অনুমান ছাড়া topic backfill **অসম্ভব** — মাইগ্রেশনের শর্তাধীন backfill সঠিকভাবেই ০টি সারি বদলেছে। এগুলো অ্যাডমিনকে রিভিউ UI থেকে ম্যাপ করতে হবে (known limitation হিসেবে রিপোর্টে থাকবে)।
- Explanation অনুপস্থিত: **০টি** ✅।

## ৩. বিদ্যমান রুটিন-সিস্টেম অডিট

- `routines` টেবিলে **published ৬০-দিনের রুটিন আগে থেকেই আছে**: 155টি daily টাস্ক (2026-11-23 → 2027-01-21, 60 তারিখ) + 12টি weekly_special; task_kind: study/practice/revision/exam/rest; ১০টি subject-ই আছে।
- ⚠️ কিন্তু **topic/subtopic ম্যাপিং সম্পূর্ণ শূন্য**: 0/137 topic, 0/366 subtopic কোনো টাস্কে লিংকড নয়। Coverage Matrix এখন সত্যিকারের চিত্র দেখাবে: **0% ম্যাপড** — এটাই প্রথম কাজ হবে (Admin Coverage Mapping টুল)।
- Student-side: `student_routines`, `routine_progress` (status সহ), `study_progress` (দুর্বলতা-ডাটা) — বিদ্যমান; নতুন টেবিল বানিয়ে ডুপ্লিকেট করা হবে না।
- `study_plan_days` জাতীয় আলাদা টেবিল নেই — দরকারও নেই, `routines.routine_date + week_index` দিয়েই D1–D60 নির্ণয় হয়।

## ৪. বিদ্যমান এক্সাম-ইঞ্জিন অডিট

- লাইভ দৈনিক সিস্টেম: `daily_exam_config` + `daily_rotation_slots` (১৪ স্লট) + `jh_build_paper_sectioned` — বর্তমান অনুপাত **90:10**, exact-count enforcement সহ (ঘাটতিতে P0001 loud fail — ভালো ভিত্তি)।
- `exam_schedules/exam_papers/exam_questions` + দুই-ফেজ রেজাল্ট + leaderboard + release-policy — সব বিদ্যমান ও টেস্টেড (237/237)।
- **সংঘর্ষ:** প্রম্পট চায় strict **70:30, ১০০ প্রশ্ন**; লাইভ সিস্টেম 90:10। সমাধান: অনুপাত hard-code না রেখে `daily_exam_config`-এ কনফিগার-যোগ্য করা হবে (নিচে সিদ্ধান্ত-প্রশ্ন দেখুন)।
- প্রশ্ন-ব্যবহার ইতিহাস (per-question usage, cross-exam PYQ occurrence) — `exam_questions` থেকে derive করা যায়; আলাদা occurrence-রেকর্ড ভিউ/টেবিল লাগবে।
- Revision engine (same-day/1/3/7/15-day queue) — **নেই**, নতুন বানাতে হবে।
- PDF এক্সপোর্ট (৮ ধরনের, বাংলা ইউনিকোড) — **নেই**।

## ৫. Gap Analysis (প্রম্পট বনাম বিদ্যমান)

| প্রম্পট-চাহিদা | অবস্থা |
|---|---|
| ৬০-দিন রুটিন DB-তে | ✅ আছে (কিন্তু topic/subtopic ম্যাপিং ০%) |
| Coverage Matrix 137/366 | ❌ বানাতে হবে (admin UI + gap রিপোর্ট) |
| Strict 70:30 + 8-point publish validation | ❌ বানাতে হবে (90:10 ইঞ্জিনের উপরে, config-driven) |
| PYQ metadata (exam name/year/type/source) enforcement | ❌ বানাতে হবে; বর্তমান ডাটা 1/71 পূর্ণ |
| Smart selection (PYQ > unattempted > weak > incorrect > spaced) | আংশিক (sectioned builder আছে; priority-ordering নেই) |
| Scope-limit (taught/revision only, cumulative toggle) | আংশিক (`cumulative_revision` ফ্ল্যাগ আছে; topic-scope নেই কারণ ম্যাপিং ০%) |
| Revision queue + weak-topic dashboard | ❌ বানাতে হবে (`study_progress` ডাটা-উৎস) |
| Smart rescheduling (completed কখনো reset নয়) | ❌ বানাতে হবে |
| Weekly Grand (৮টি) + D60 full mock (সোর্স-রেকর্ডেড প্যাটার্ন) | আংশিক (weekly আছে; D60 mock-config + source version নেই) |
| /admin/study-routine প্যানেল (১৭ ফিচার) | আংশিক (/admin/routines, /admin/exams আছে; নতুন স্টাডি-রুটিন হাব লাগবে) |
| ৮ ধরনের PDF (বাংলা ইউনিকোড) | ❌ বানাতে হবে |
| ১৫টি টেস্ট-কেস | ❌ লিখতে হবে (বিদ্যমান 237 টেস্টের উপরে) |

## ৬. Implementation Plan (Phase 2–8)

সব পরিবর্তন **নতুন additive migration** — কোনো টেবিল/কলাম/ID মুছব না; RLS forced থাকবে; server-side allocation; transaction-safe submission অপরিবর্তিত।

1. **Phase 2 — DB ভিত্তি** (১টি migration): `daily_exam_config`-এ `pyq_ratio jsonb` + `strict_pyq_validation boolean`; `questions`-এ PYQ-metadata যাচাই ভিউ `jh_pyq_readiness`; `routine_coverage` ভিউ (137/366 gap); `question_usage` ভিউ (cross-exam occurrence, কখনো delete নয়); revision queue টেবিল `revision_items` (5-step intervals); `mock_pattern_config` (D60-এর অফিসিয়াল প্যাটার্ন — source_url + version বাধ্যতামূলক, অনুমান নিষেধ); topic_id backfill `question_topic_links` থেকে (১০১টি, যাচাইসহ)।
2. **Phase 3 — Allocation ইঞ্জিন**: `jh_build_paper_sectioned`-এর সম্প্রসারণ `jh_build_paper_7030`: ৭০ verified-PYQ (full metadata আবশ্যক) + ৩০ practice; priority: PYQ > unattempted > weak-topic > previously-incorrect > spaced; same-exam dedupe; taught-scope filter (coverage mapping থেকে); ঘাটতিতে **P0001 — কখনো silent substitute নয়**।
3. **Phase 4 — 8-point Publish Validation**: RPC `jh_validate_daily_exam` → প্রতিটি চেকের pass/fail + আসল সংখ্যা (PYQ পাওয়া গেছে X/70) — admin UI-তে রিপোর্ট; fail হলে publish বাটন ব্লক।
4. **Phase 5 — Admin `/admin/study-routine`** (+ calendar/coverage/question-allocation/exam-blueprint/revision/analytics): Coverage Mapping টুল (টাস্কে topic/subtopic assign), Coverage Matrix (লাল=unmapped), PYQ availability ড্যাশবোর্ড (উপরের টেবিলটিই লাইভ), PYQ metadata backfill ফর্ম (উৎস-URL আবশ্যক), validation report, publish/edit।
5. **Phase 6 — Student**: আজকের রুটিন টাস্ক (৫ স্ট্যাটাস + checkbox), smart rescheduling (completed অক্ষত), weak-topic ড্যাশবোর্ড (শুধু বাস্তব attempt-ডাটা থেকে), revision calendar, streak, 60-day progress।
6. **Phase 7 — Results + PDF**: PYQ-vs-practice ব্রেকডাউন, revision recommendation; ৮ PDF টাইপ (বাংলা Unicode ফন্ট embed, ব্র্যান্ডিং, পেজ নম্বর)।
7. **Phase 8 — টেস্ট + রিপোর্ট**: প্রম্পটের ১৫ টেস্ট-কেস (৬৯-PYQ block, dedupe, missing-source reject, concurrent submission, existing-features-intact রিগ্রেশন) + ১১-দফা Implementation Report।

## ৭. সিদ্ধান্ত (ব্যবহারকারী নিশ্চিত করেছেন, 2026-11-21)

**ক) Strict 70:30 এখনই চালু** — সব দৈনিক পরীক্ষা সৎভাবে publish-block থাকবে যতদিন না ৭০+ প্রকাশযোগ্য PYQ (পূর্ণ মেটাডাটাসহ) তৈরি হয়; অ্যাডমিন প্যানেল আসল ঘাটতি দেখাবে।
**খ) বিদ্যমান রুটিন জায়গায় রেখে** Coverage Mapping দিয়ে topic/subtopic যোগ হবে (ID/প্রগ্রেস অক্ষত)।

## ৮. Phase 2–4 বাস্তবায়ন স্ট্যাটাস (সম্পন্ন, লাইভ)

- Migration `20261128000000_strict_7030_study_system.sql` — **লাইভ প্রয়োগ + ledger-নিবন্ধিত (md5 c1fbbf1a6689b1963e0454fc18adf88e, ledger 19/19)**:
  - `daily_exam_config` + `pyq_count / practice_count / strict_pyq_validation` + CHECK (strict হলে যোগফল মিলতেই হবে); BCS = 100Q, 70:30, strict ON।
  - `jh_pyq_availability` / `jh_pyq_readiness_by_subject` — আসল পুল-কাউন্ট (লাইভ: PYQ 71, প্রস্তুত 1, মেটাডাটা-অসম্পূর্ণ 70, practice 366)।
  - `jh_build_paper_7030` — strict builder: সেকশনে exact subject-কাউন্ট, পেপারে exact 70+30, least-used-first নির্বাচন, ডুপ্লিকেট অসম্ভব, ঘাটতিতে P0001 (আসল সংখ্যাসহ)। **লাইভ স্মোক-টেস্ট: প্রত্যাশিতভাবে block, কিছুই তৈরি হয়নি।**
  - `jh_question_usage` — cross-exam ব্যবহার-ইতিহাস (admin-only; আসন্ন পেপার লিক হয় না)।
  - `revision_items` + `jh_seed_revision_from_attempt` — 0/1/3/7/15-দিন spaced রিভিশন কিউ, শুধুই বাস্তব attempt-ডাটা থেকে, owner-only, RLS forced।
  - `mock_pattern_config` — D60 মকের অফিসিয়াল প্যাটার্ন টেবিল, **ইচ্ছাকৃতভাবে খালি** (উৎস-URL+ভার্সন ছাড়া অনুমান নিষেধ)।
- Route fix: `/api/admin/daily-exam` এখন admin client ব্যবহার করে — আগে lockdown-এর পর কনফিগ-টেবিল পড়তে না পেরে সবসময় NO_CONFIG 404 দিত (বাস্তব বাগ, এই ফেজে ধরা পড়ে ঠিক হয়েছে)।
- Admin প্যানেল: ৭০:৩০ ব্যাজ, PYQ/practice কনফিগ + strict টগল, ৮-দফা যাচাই-চেকলিস্ট (আসল সংখ্যাসহ), মেটাডাটা-অসম্পূর্ণ PYQ সতর্কতা।
- টেস্ট: **258/258** (নতুন ২১টি — 69-PYQ block, exact 70:30+ডুপ্লিকেট-শূন্য, মেটাডাটা-হীন PYQ বর্জন, রিভিশন কিউ, RLS, কনফিগ CHECK, largest-remainder স্প্লিট, ৮-দফা চেকলিস্ট); tsc ও production build সবুজ; anon fn-allowlist অপরিবর্তিত (২টি)।

**পরবর্তী ফেজ:** Admin `/admin/study-routine` হাব (Coverage Mapping + Matrix, PYQ availability ড্যাশবোর্ড, মেটাডাটা backfill ফর্ম), student ড্যাশবোর্ড সেকশন, রেজাল্টে PYQ-vs-practice ব্রেকডাউন, PDF এক্সপোর্ট, বাকি টেস্ট-কেস ও ১১-দফা রিপোর্ট।

## ৯. Phase 3–4 বাস্তবায়ন স্ট্যাটাস — কভারেজ ইঞ্জিন ও স্টাডি-রুটিন হাব (সম্পন্ন, লাইভ)

- Migration `20261129000000_study_plan_assignments.sql` — **লাইভ প্রয়োগ + ledger-নিবন্ধিত (md5 27b1dd74cc1d19505cc1c6fd99c383fa, ledger 20/20)**:
  - `study_plan_assignments` — প্রতি সাবটপিকের (বা সাবটপিকবিহীন টপিকের) **একটিমাত্র** first-study সারি; `(course, topic, subtopic) nulls not distinct` unique index-এ ডুপ্লিকেট কাঠামোগতভাবে অসম্ভব — রিভিশন কখনোই first-study গণনায় ঢুকতে পারে না। RLS enabled+forced; students read-only; লেখা শুধু `routine.manage`।
  - `jh_coverage_summary` / `jh_coverage_unassigned` / `jh_coverage_integrity` — কভারেজ ম্যাট্রিক্স, অনুপস্থিত ইউনিটের **সঠিক তালিকা** (publish-block), সিলেবাস-রেফারেন্স যাচাই।
  - `jh_generate_study_plan` — প্রতিটি অবরাদ্দ ইউনিটকে নিজ বিষয়ের **প্রকাশিত অধ্যয়ন-দিনে** (study/practice; revision/exam/rest/draft বাদ) সিলেবাস-ক্রমে সমবণ্টন; বিদ্যমান বরাদ্দ কখনো overwrite হয় না (re-run → inserted 0); slot-হীন বিষয় অনুমান না করে রিপোর্ট হয়।
  - `jh_sync_routine_scope` — বরাদ্দ রুটিন-সারির `topic_ids`/`subtopic_ids`-এ মিরর হয়, তাই বিদ্যমান দৈনিক-পরীক্ষার taught-scope ফিল্টার অপরিবর্তিত কাজ করে (map_in_place সিদ্ধান্ত অনুযায়ী — ১৫৫টি রুটিন-সারির ID/প্রগ্রেস অক্ষত)।
- **লাইভ জেনারেশন ফলাফল (যাচাইকৃত):** 10 বিষয় · 137 টপিক · 366 সাবটপিক · **382 ইউনিট (366 সাবটপিক + 16 সাবটপিকবিহীন টপিক) — 382/382 বরাদ্দ, 0 অবরাদ্দ, 0 integrity সমস্যা, 0 ভুল-স্থাপন, 0 unsynced রুটিন**; first-study বিস্তার 2026-11-23 → 2027-01-06 (39টি অধ্যয়ন-দিন; 78টি subject-day slot থেকে)।
- নতুন রুট: `/admin/study-routine` হাব (কভারেজ ম্যাট্রিক্স + প্রকাশ-চেকলিস্ট, দিনভিত্তিক ম্যাপিং-ক্যালেন্ডার ও এডিটর, বিষয়ভিত্তিক PYQ ৭০:৩০ প্রস্তুতি, PYQ মেটাডেটা ব্যাকফিল ফর্ম); API: `/api/admin/study-plan` (generate/move/edit/delete — তারিখ বদলালে নতুন দিনটি বাস্তব প্রকাশিত অধ্যয়ন-দিন হতেই হবে), `/api/admin/pyq-metadata` (উৎস-রেফারেন্স ছাড়া সংরক্ষণ প্রত্যাখ্যাত; practice→PYQ রূপান্তর নিষিদ্ধ)। সব mutation audit_logs-এ।
- টেস্ট: **271/271** (নতুন ১৩টি — ইউনিট-গণনা taxonomy থেকে, রুটিনহীন অবস্থায় P0001, student-নিষেধ, সম্পূর্ণ বণ্টন+ভুল-দিন-শূন্য, idempotent re-run, ডুপ্লিকেট-অসম্ভবতা, exact-missing-list, integrity-flag, routine-sync, RLS)। tsc/build/lint সবুজ।
- সংশোধন: লাইভ ledger টেবিলটি `public.schema_migrations` (filename/checksum/applied_at) — `supabase_migrations.schema_migrations` নয় (সেটি CLI-র নিজস্ব, পুরোনো)।

**পরবর্তী ফেজ:** student ড্যাশবোর্ড (আজকের first-study ইউনিট + রিভিশন + কভারেজ-ভিত্তিক প্রগ্রেস), রেজাল্টে PYQ-vs-practice ব্রেকডাউন, রিভিশন ক্যালেন্ডার UI, weekly grand exam blueprint UI, PDF এক্সপোর্ট, ১১-দফা রিপোর্ট।
