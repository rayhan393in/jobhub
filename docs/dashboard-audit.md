# Student Dashboard Audit — JobHub

**তারিখ:** ২১ নভেম্বর ২০২৬ · **Scope:** `src/app/(dashboard)/*` (১১টি পেজ), `src/lib/queries.ts`, `src/lib/auth.ts`, `jh_student_analytics` RPC, `dashboard-shell.tsx` · **ধরন:** Read-only audit (কোনো কোড বদলানো হয়নি)

---

## ✅ Health check (automated)

| Check | Result |
| --- | --- |
| `tsc --noEmit` | **PASS** — ০টি টাইপ এরর |
| `next build` (production) | **PASS** — সব route কম্পাইল |
| `npm run lint` | ০ error, **১৬ warning** (সবগুলো `react-hooks/*`) |

---

## Part 1 — ছাত্রের চোখে (Student UX)

### যা খুব ভালো হয়েছে 👍

1. **সততা** — "বাস্তব ডেটা" ব্যাজ, কোনো fake সংখ্যা নেই; ডেটা না থাকলে ভদ্র empty state + পরের করণীয় বাটন। এটা বিরল এবং trust তৈরি করে।
2. **Resume banner** — চলমান পরীক্ষা থাকলে সবার ওপরে "পরীক্ষা চালু আছে" ব্যানার। পরীক্ষার্থীর সবচেয়ে বড় ভয় (অসমাপ্ত attempt হারানো) এটা ধরে।
3. **আজকের রুটিন hero-তে** — লগইন করেই আজ কী পড়তে হবে দেখা যায়; লাইভ পরীক্ষা থাকলে সরাসরি CTA।
4. **দুর্বল টপিক → এক ক্লিকে কাস্টম পরীক্ষা** (`/custom-exam?topic=`) — analysis থেকে action-এ যাওয়ার লুপটা পূর্ণ।
5. পূর্ণাঙ্গ বাংলা মাইক্রোকপি, `aria-label`, `tabular-nums`, মোবাইল bottom-nav — পরিণত UI।

### ছাত্র হিসেবে যেখানে হোঁচট খাবো 👎

| # | Severity | সমস্যা | বিস্তারিত |
| --- | --- | --- | --- |
| S1 | **High** | **"রিভিশন প্রস্তাব" n=1 নয়েজ** | `jh_student_analytics` টপিক accuracy ascending সাজায় (ঠিক আছে), কিন্তু dashboard নেয় `attempted >= 1`। মাত্র ১টা প্রশ্ন ভুল করলেই সেই টপিক 0% হয়ে "দুর্বল টপিক"-এর শীর্ষে। ১টা স্যাম্পল দিয়ে দুর্বলতা বলা ছাত্রকে ভুল পথে পাঠায়। **ফিক্স:** `attempted >= 3` (বা ৫) থ্রেশহোল্ড + কার্ডে "৮টির মধ্যে ৩ সঠিক" দেখানো। |
| S2 | **High** | **Dashboard-এ লাইভ পরীক্ষা মিস হতে পারে** | dashboard `listPublishedSchedules({limit: 20})` (starts_at ascending), কিন্তু `/exams` পেজে limit 250। সিজনের শেষ দিকে পুরোনো ২০টা schedule-ই কোটা খেয়ে ফেললে আজকের লাইভ পরীক্ষা hero-তে দেখাবে না — অথচ /exams-এ ঠিকই আছে। **ফিক্স:** কুয়েরিতে `starts_at >= today` (বা `ends_at >= now`) ফিল্টার সার্ভার-সাইডে দিন, তারপর limit। |
| S3 | **Medium** | **রুটিন target course দিয়ে ফিল্টার হয় না** | `listRoutines({fromDate, limit: 10})` — BCS শিক্ষার্থীর hero-তে Petrobangla-র রুটিন চিপও মিশে যেতে পারে। **ফিক্স:** `courseId: user.profile?.target_course_id` পাস করা। |
| S4 | **Medium** | **Analytics সব কোর্স মিলিয়ে** | `getStudentAnalytics(null)` — দুই কোর্সে ভর্তি থাকলে BCS+Petro-র স্কোর/accuracy মিশে যায়; dashboard-এ কোর্স switcher নেই। **ফিক্স:** ডিফল্ট `target_course_id`, সাথে "সব কোর্স" টগল। |
| S5 | **Medium** | **Resume banner-এর "X মিনিট বাকি" স্থির** | সার্ভার রেন্ডারের মুহূর্তের হিসাব; ট্যাব খুলে রাখলে ভুল সংখ্যা। ছাত্র "১০ মিনিট আছে" ভেবে ঢুকে দেখবে শেষ। **ফিক্স:** ছোট client component-এ লাইভ countdown। |
| S6 | **Low** | **র‍্যাংক ৫০-এর বাইরে হলে "—"** | রank বের করা হয় top-50 তালিকায় `find()` করে; ৫১তম ছাত্র দেখবে "এখনো তালিকায় নেই" — demotivating এবং অসত্য। **ফিক্স:** নিজের rank ফেরত দেওয়া ছোট RPC। |
| S7 | **Low** | **মোবাইল nav-এ active state exact-match** | `dashboard-shell.tsx:137` মোবাইলে `pathname === item.href` (ডেস্কটপে `startsWith` আছে) — nested route-এ (যেমন ভবিষ্যতে `/practice/...`) ট্যাব হাইলাইট হারায়। |

---

## Part 2 — Senior developer-এর চোখে

### Architecture: যা সঠিক আছে ✅

- `getCurrentUser` React `cache()`-এ wrap করা — layout + page দুবার ডাকলেও **এক রিকোয়েস্টে একবারই** Supabase round-trip হয়। (সন্দেহ ছিল duplicate fetch — ভুল প্রমাণিত।)
- Dashboard-এ ৭টা কুয়েরি `Promise.all` — waterfall নেই।
- `jh_student_analytics`: `security definer` কিন্তু শুরুতেই `auth.uid()` null-check + `42501` raise — সঠিক pattern। টপিক/সাবজেক্ট accuracy ascending সাজানো, তাই "weak topics" semantics সঠিক।
- RLS-respecting server client সর্বত্র; কোনো service-role leak পাইনি।
- `force-dynamic` dashboard pages-এ যুক্তিসঙ্গত।

### Findings (severity-ranked)

| # | Severity | Issue | Fix |
| --- | --- | --- | --- |
| D1 | **High** | **`queries.ts` নীরবে এরর গেলে** — প্রায় সব কুয়েরি `const { data } = ...` প্যাটার্নে; `error` কখনো পড়া হয় না। DB outage বা RLS ভুলে ছাত্র দেখবে নিখুঁত "কোনো ডেটা নেই" empty state — ডিবাগ করা দুঃসাধ্য, মনিটরিংও অন্ধ। | প্রতিটি কুয়েরিতে `if (error) console.error(...)` (ন্যূনতম) বা একটি `unwrap()` হেল্পার যা log করে throw/null করে; Vercel log-এ সিগন্যাল আসবে। |
| D2 | **Medium** | **সব route dynamic (ƒ)** — build output-এ `/faq`, `/privacy`, `/terms`, `/contact`-ও server-rendered on demand। মার্কেটিং পেজগুলো static হওয়ার কথা; সম্ভবত root layout-এ cookie/auth read। প্রতি ভিজিটে অকারণ server invocation + TTFB। | মার্কেটিং layout থেকে auth-নির্ভরতা client component-এ সরান বা `(marketing)` গ্রুপে আলাদা layout দিন যাতে পেজগুলো static/ISR হয়। |
| D3 | **Medium** | **Practice পেজে fan-out কুয়েরি** — প্রতি কোর্সের জন্য আলাদা subject+topic ফেচ, আর `listTopicsWithSubtopics` ভেতরে ৩টি sequential কুয়েরি। ২ কোর্সেই ~৮ round-trip। | এক RPC-তে পুরো taxonomy tree (`jsonb_agg` nested) ফেরত দিন — ১ round-trip। |
| D4 | **Medium** | **Weekly chart-এ timezone seam** — RPC-তে বার গ্রুপিং Asia/Dhaka তারিখে, কিন্তু ফিল্টার `submitted_at >= now() - interval '7 days'` (UTC rolling)। সপ্তাহের প্রান্তের দিনে Dhaka-দিনের প্রথম ৬ ঘণ্টার attempt বাদ পড়ে — প্রান্তের বার আংশিক/ভুল। `(d at time zone 'utc')::date` join-টিও অস্বচ্ছ। | ফিল্টারও Dhaka-দিন সীমায় করুন: `submitted_at >= (dhaka_today - 6)::timestamp at time zone 'Asia/Dhaka'`। |
| D5 | **Low** | **`dashboard/page.tsx` ৬৮৩ লাইনের monolith** — hero, stats, chart, weak-topics, upcoming, SVG art সব এক ফাইলে। কাজ করে, কিন্তু পরিবর্তনের ঝুঁকি/রিভিউ খরচ বাড়ায়। | সেকশনগুলো `components/dashboard/`-এ ভাঙুন (ইতিমধ্যে shell ওখানে আছে)। |
| D6 | **Low** | **১৬টি lint warning** — মূলত `react-hooks/set-state-in-effect` (effect-এ `void load()` প্যাটার্ন) + ১টি `exhaustive-deps`। এখন ক্ষতিকর নয়, কিন্তু React Compiler-যুগে ভাঙবে। | ধাপে ধাপে data-fetch effect-গুলো `use()`/server fetch বা at least cancelled-flag cleanup-এ আনুন। |

### যা ইচ্ছা করেই flag করিনি

- `force-dynamic` + per-request RPC: ছাত্রসংখ্যা হাজারে না পৌঁছানো পর্যন্ত ঠিক আছে; আগে D1 (observability) জরুরি।
- Dashboard-এ inline SVG art: বড় হলেও একবারই পার্স হয়, সমস্যা নয়।

---

## অগ্রাধিকার তালিকা (করলে এই ক্রমে)

1. **D1** — queries.ts-এ error logging (৩০ মিনিটের কাজ, সবচেয়ে বড় রিটার্ন)
2. **S1** — weak-topic থ্রেশহোল্ড `attempted >= 3` + attempt count দেখানো
3. **S2** — dashboard schedule ফেচে server-side date ফিল্টার
4. **S3 + S4** — target course দিয়ে routine ও analytics ফিল্টার
5. **S5** — resume banner লাইভ countdown
6. **D2–D4, S6–S7, D5–D6** — পরের স্প্রিন্টে

---

## ✅ ফিক্স স্ট্যাটাস (২১ নভেম্বর ২০২৬ — implemented)

| Finding | Status | কীভাবে ফিক্স হলো |
| --- | --- | --- |
| **D1** | ✅ Fixed | `queries.ts`-এ `logDbError()` হেল্পার; ১৫+ কুয়েরির প্রতিটিতে `error` এখন পড়া হয় ও `[db:scope]` ট্যাগসহ Vercel log-এ যায়। Fallback আচরণ অপরিবর্তিত — UX graceful থাকে, outage আর অদৃশ্য নয়। |
| **S1** | ✅ Fixed | Weak-topic থ্রেশহোল্ড `attempted >= 3` + `accuracy < 80`; কার্ডে এখন "Xটির মধ্যে Yটি সঠিক (Z%)"। ১–২ প্রশ্নের নয়েজ থাকলে "আর অল্প কিছু প্রশ্ন বাকি" উৎসাহব্যঞ্জক বার্তা। |
| **S2** | ✅ Fixed | Dashboard schedule ফেচে `from: now` (server-side `ends_at >= now` ফিল্টার) — অতীতের schedule আর limit-20 কোটা খায় না; লাইভ পরীক্ষা কখনো hero থেকে হারাবে না। |
| **S3** | ✅ Fixed | `listRoutines`-এ `courseId: target_course_id` — অন্য কোর্সের রুটিন চিপ আর মিশবে না। |
| **S4** | ✅ Fixed | Analytics এখন target course-স্কোপড; target কোর্সে কোনো attempt না থাকলে সব-কোর্স fallback (এক edge-case এ মাত্র ১টি অতিরিক্ত RPC)। |
| **S5** | ✅ Fixed | নতুন `attempt-countdown.tsx` client component — resume banner-এ লাইভ টিকিং countdown (২ মিনিটের নিচে প্রতি সেকেন্ডে), সময় শেষ হলে লাল "সময় শেষ — জমা দিন"। |
| **S7** | ✅ Fixed | মোবাইল nav-এও এখন `startsWith` match — nested route-এ ট্যাব হাইলাইট থাকে। |
| **S6** | ✅ Fixed | নতুন `jh_my_rank` RPC — টপ-৫০ এর বাইরের ছাত্রও এখন নিজের আসল র‍্যাংক দেখে ("আপনার অবস্থান: ৬৭ / ১২০ জনের মধ্যে"); লিডারবোর্ড API ও client আপডেটেড। |
| **D3** | ✅ Fixed | নতুন `jh_course_taxonomy` RPC — practice পেজের ~৮ round-trip এখন ১টি কলে (সব কোর্সের subject+topic+subtopic nested JSON)। |
| **D4** | ✅ Fixed | `jh_student_analytics` weekly chart: ফিল্টার ও গ্রুপিং দুটোই এখন Asia/Dhaka দিন-সীমায় — প্রান্তের বার আর আংশিক নয়; অস্বচ্ছ UTC join সরানো হয়েছে। |
| **D5** | ✅ Fixed | ৬৮৩-লাইনের `dashboard/page.tsx` ভেঙে এখন ~১৪০-লাইনের orchestrator + ৫টি presentational component ফাইল (`hero-section`, `exam-banners`, `stats-grid`, `activity-cards`, `insight-cards`)। |
| D2, D6 | ⏳ ব্যাকলগ | D2: মার্কেটিং পেজগুলো build output-এ এরই মধ্যে static (○) — বড় অংশ নিষ্পন্ন। D6: ১৬টি pre-existing `react-hooks/*` warning — React Compiler মাইগ্রেশনের সময় একসাথে। |

**Verification:** `tsc --noEmit` PASS · `next build` PASS · lint ০ error / ১৬ warning (সব pre-existing)। DB: মাইগ্রেশন `20261212000000_analytics_tz_my_rank_taxonomy.sql` লাইভ প্রয়োগ করা হয়েছে (taxonomy: BCS-এ ১০ subject/১৩৭ topic verified)।
