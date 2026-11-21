# BCS বই-ভিত্তিক প্রশ্নব্যাংক

## ব্যাচ ০২ (২০২৬-১১-২১, দ্বিতীয় রিড)

`bcs-book-bank-questions-02.csv` + `bcs-book-bank-questions-02.sql` + `batch02.py` — **১০টি প্রশ্ন**, সবই Khairul's Advanced Math থেকে:

- **H.C.F & L.C.M, পৃ. ৩–৪** — ৬টি (৪টি বইয়ের নিজস্ব MCQ, ২টি সমাধানকৃত উদাহরণ→MCQ)
- **Profit & Loss, পৃ. ৩৮৬–৩৮৭** — ৪টি (সবই বইয়ের নিজস্ব MCQ)

স্ট্যাটাস: বইয়ের অপশন+ছাপা উত্তরসহ **৮টি → approved (Source Verified)**; উদাহরণ-রূপান্তরিত ২টির অপশন আমাদের সাজানো, তাই **draft**। লাইভ DB-তে `bcs-book-bank-02-001`…`-010` হিসেবে ইমপোর্টেড।

**নতুন আপলোড প্রসঙ্গে:** `bangla grammar(.part2)`, `bangla literature`, `Basic View International-*`, `BCS Preli Question Bank-*` — <২৫ MB অংশগুলোও পড়ে দেখা হয়েছে; সবগুলোই **CamScanner-স্ক্যান, টেক্সট-লেয়ারহীন**। ভাগ করলে লাভ নেই — OCR-করা সংস্করণ দরকার।

---

## ব্যাচ ০১

Drive-এর বই থেকে হাতে ট্রান্সক্রাইব করা **৩৩টি MCQ**। এগুলো **BCS-এর কোনো বিগত বছরের প্রশ্ন নয়** — বইয়ের অনুশীলনী ও নোটের উদাহরণ। তাই কোনো সারিতে `exam_name`/`year` নেই এবং এগুলো কখনোই past-paper frequency-তে গণনা হবে না।

## ফাইল

| ফাইল | কাজ |
|---|---|
| `bcs-book-bank-questions.csv` | সাইটের অ্যাডমিন ইমপোর্ট পেজে সরাসরি আপলোডযোগ্য (UTF-8 BOM, ২৭ কলাম)। `src/lib/import/parse.ts` দিয়ে যাচাই করা: ৩৩/৩৩ valid, ০ invalid, ০ duplicate। |
| `bcs-book-bank-questions.sql` | Supabase SQL Editor-এ একবারে চালানো যায়; টপিক-সাবটপিক নাম দিয়ে resolve হয়, fingerprint-ডুপ্লিকেট নিজে স্কিপ করে — দ্বিতীয়বার চালালে কিছুই দ্বিগুণ হয় না। |
| `build.py` | ৩৩টি সারির উৎস-সংজ্ঞা + যাচাই (ডুপ্লিকেট স্টেটমেন্ট, খালি অপশন, লোকেটর অনুপস্থিতি)। |
| `render_sql.py` | `_rows.json` → SQL রেন্ডারার। |
| `_rows.json` | সারিগুলোর কাঁচা JSON। |

## কভারেজ (৩৩টি)

- **Khairul's Advanced Math** — ১৭টি, **ছাপা পৃষ্ঠাসহ** (পৃ. ১–৫):
  - H.C.F & L.C.M অধ্যায় (পৃ. ১–৪) → টপিক `গসাগু ও লসাগু` / সাবটপিক `গসাগু`
  - Problems on numbers (পৃ. ৪–৫) → টপিক `বাস্তব সংখ্যা` / সাবটপিক `সংখ্যার শ্রেণি`
- **Khairul Percentage & Profit-Loss নোট** — ১২টি (৪ শতকরা + ৮ লাভ-ক্ষতি)। নোটে ছাপা পৃষ্ঠা নেই, তাই `book_page` খালি; `source_locator`-এ নোটের সেকশন-নাম।
- **BCS English Grammar নোট (Tense / Right Form / Conditionals)** — ৬টি → টপিক `Tense and aspect` (Tense ৫, Inversion ১)। সিলেবাসে Conditionals-এর আলাদা টপিক নেই বলে এগুলো Tense-এর অধীনে; **নতুন কোনো টপিক বানানো হয়নি**।

## সত্যতা-চিহ্নের নিয়ম (ব্যবহারকারীর সিদ্ধান্ত)

- বইয়ের নাম **+ ছাপা পৃষ্ঠা** আছে ⇒ **Source Verified**: `status='approved'`, `is_verified=true` (১৭টি Advanced Math সারি)।
- নোট-ভিত্তিক (পৃষ্ঠাহীন) ⇒ `draft`, অ্যাডমিন রিভিউর অপেক্ষায় (১৬টি)।
- `source_type='manual'` — DB-র CHECK তালিকায় `book` নেই; বই-পরিচয় বহন করে `source_title`/`author`/`book_chapter`/`book_page`/`source_file_id`।

## লাইভ ডেটাবেসে অবস্থা

২০২৬-১১-২১-এ ৩৩টিই `bozmbnelcokhbuumkdry`-তে ইমপোর্ট করা হয়েছে (`external_ref` = `bcs-book-bank-01-001` … `-033`)। সব সারি বিষয়-টপিকে ম্যাপড; fingerprint সাইটের `sha256(statement.trim())`-এর সাথে যাচাই করা।

## কেন ১৫০ নয়, ৩৩

লক্ষ্য ছিল ~১৫০; টেক্সট-পাঠযোগ্য উৎসে যা সত্যিই আছে তার বাইরে কিছু বানানো হয়নি:

- `Khairul-Basic-Math-*` স্প্লিটগুলো স্ক্যান-ছবি — টেক্সট এক্সট্রাক্ট হয় না (OCR দরকার)।
- `BCS Preli Question Bank.pdf` ১১৯ MB — পড়ার ২৫ MB সীমার বাইরে (ছোট ভাগে ভাগ করা ফাইল দিলে পড়া যাবে)।
- MASTER English / Basic View / অগ্রদূত Drive-এ নামে খুঁজে পাওয়া যায়নি।

পরের ব্যাচ বড় করতে: Basic Math-এর OCR-করা সংস্করণ বা Question Bank-এর <২৫ MB খণ্ড দিলেই হবে।
