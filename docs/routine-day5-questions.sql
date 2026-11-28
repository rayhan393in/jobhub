-- ============================================================================
--  JobHub · রুটিন দিন ৫-এর জন্য স্ট্যান্ডার্ড প্রশ্ন (৩০টি)
--  উৎস: Drive → Khairul's Advanced Math (Percentage/Profit-Loss notes,
--        টেক্সট লেয়ার থেকে পড়া) + বিসিএস সিলেবাস
--  সব প্রশ্ন pending_review হিসেবে ঢোকে — অনুমোদন আপনার হাতে।
-- ============================================================================

drop table if exists jh_ctx, jh_in, jh_rows, jh_dedup, jh_inserted;

-- ── STEP 0 · কোর্স ও অ্যাডমিন ────────────────────────────────────────────
create temp table jh_ctx as
select
  '599509ae-c4c3-440a-9463-802a4efc7a0c'::uuid as course_id,   -- বিসিএস
  'b0d40cca-e34b-42fe-bc19-dae3627b7a48'::uuid as admin_id;

-- ── STEP 1 · প্রশ্ন ──────────────────────────────────────────────────────
--  ক্রম: statement, a, b, c, d, correct_option(0=ক..3=ঘ), explanation,
--        difficulty, subject, topic, source_title, source_locator
create temp table jh_in as
select * from (values

-- ════ আন্তর্জাতিক বিষয়াবলি → বিশ্ব ইতিহাস (৫টি) ════════════════════════
('ফরাসি বিপ্লব শুরু হয় কোন সালে?', '১৭৭৬', '১৭৮৯', '১৭৯৯', '১৮০৪', 1,
 '১৭৮৯ সালের ১৪ জুলাই বাস্তিল দুর্গের পতনের মধ্য দিয়ে ফরাসি বিপ্লব শুরু হয়।',
 'easy', 'আন্তর্জাতিক বিষয়াবলি', 'বিশ্ব ইতিহাস',
 'JobHub editorial — বিসিএস সিলেবাসভিত্তিক', null),

('প্রথম বিশ্বযুদ্ধ শুরু হয় কোন সালে?', '১৯১২', '১৯১৭', '১৯১৯', '১৯১৪', 3,
 '১৯১৪ সালে অস্ট্রিয়া-হাঙ্গেরির যুবরাজ ফার্দিনান্দের হত্যাকাণ্ডের পর প্রথম বিশ্বযুদ্ধ শুরু হয়।',
 'easy', 'আন্তর্জাতিক বিষয়াবলি', 'বিশ্ব ইতিহাস',
 'JobHub editorial — বিসিএস সিলেবাসভিত্তিক', null),

('রুশ সমাজতান্ত্রিক বিপ্লব সংঘটিত হয় কোন সালে?', '১৯০৫', '১৯১৪', '১৯১৭', '১৯২১', 2,
 '১৯১৭ সালের অক্টোবর বিপ্লবের মাধ্যমে রাশিয়ায় জার শাসনের অবসান ও সোভিয়েত রাষ্ট্র প্রতিষ্ঠিত হয়।',
 'medium', 'আন্তর্জাতিক বিষয়াবলি', 'বিশ্ব ইতিহাস',
 'JobHub editorial — বিসিএস সিলেবাসভিত্তিক', null),

('আমেরিকা যুক্তরাষ্ট্রের স্বাধীনতা ঘোষণা করা হয় কোন সালে?', '১৭৭৬', '১৭৮৩', '১৭৮৭', '১৭৯১', 0,
 '১৭৭৬ সালের ৪ জুলাই স্বাধীনতা ঘোষণাপত্র গৃহীত হয়; ১৭৮৩ সালে প্যারিস চুক্তিতে স্বাধীনতা স্বীকৃত হয়।',
 'easy', 'আন্তর্জাতিক বিষয়াবলি', 'বিশ্ব ইতিহাস',
 'JobHub editorial — বিসিএস সিলেবাসভিত্তিক', null),

('ম্যাগনা কার্টা স্বাক্ষরিত হয় কোন সালে?', '১০৬৬', '১৪৯২', '১৬৮৮', '১২১৫', 3,
 '১২১৫ সালে ইংল্যান্ডের রাজা জন ম্যাগনা কার্টায় স্বাক্ষর করেন — রাজার ক্ষমতা আইনের অধীনে আনার প্রথম দলিল।',
 'medium', 'আন্তর্জাতিক বিষয়াবলি', 'বিশ্ব ইতিহাস',
 'JobHub editorial — বিসিএস সিলেবাসভিত্তিক', null),

-- ════ নৈতিকতা, মূল্যবোধ ও সুশাসন → নৈতিকতার ধারণা (৫টি) ════════════════
('"নৈতিকতা" (Morality) শব্দটি কোন শব্দ থেকে এসেছে?', 'গ্রিক Ethos', 'ল্যাটিন Mores', 'ফরাসি Morale', 'আরবি Akhlaq', 1,
 'Morality এসেছে ল্যাটিন "Mores" থেকে, যার অর্থ আচার-আচরণ বা রীতিনীতি।',
 'easy', 'নৈতিকতা, মূল্যবোধ ও সুশাসন', 'নৈতিকতার ধারণা',
 'JobHub editorial — বিসিএস সিলেবাসভিত্তিক', null),

('নৈতিকতা মূলত কোন বিষয়ে নির্দেশনা দেয়?', 'শুধু আইনি বাধ্যবাধকতা', 'শুধু ধর্মীয় আচার', 'কোনটি ভালো-মন্দ ও করা উচিত-অনুচিত', 'অর্থনৈতিক লাভ-ক্ষতি', 2,
 'নৈতিকতা মানুষের কাজের ভালো-মন্দ ও উচিত-অনুচিতের মানদণ্ড নির্ধারণ করে; এর ভিত্তি বিবেক ও মূল্যবোধ, শুধু আইন নয়।',
 'easy', 'নৈতিকতা, মূল্যবোধ ও সুশাসন', 'নৈতিকতার ধারণা',
 'JobHub editorial — বিসিএস সিলেবাসভিত্তিক', null),

('নিচের কোনটি সুশাসনের উপাদান নয়?', 'স্বচ্ছতা', 'জবাবদিহিতা', 'আইনের শাসন', 'দুর্নীতি', 3,
 'স্বচ্ছতা, জবাবদিহিতা ও আইনের শাসন সুশাসনের উপাদান; দুর্নীতি সুশাসনের পরিপন্থী।',
 'easy', 'নৈতিকতা, মূল্যবোধ ও সুশাসন', 'নৈতিকতার ধারণা',
 'JobHub editorial — বিসিএস সিলেবাসভিত্তিক', null),

('"মূল্যবোধ" বলতে বোঝায়—', 'সমাজে কাঙ্ক্ষিত ও গ্রহণযোগ্য আচরণের মানদণ্ড', 'শুধু পারিবারিক সম্পত্তি', 'সরকারি নীতিমালা', 'ব্যক্তির আর্থিক সক্ষমতা', 0,
 'মূল্যবোধ হলো ব্যক্তি ও সমাজের কাছে কাঙ্ক্ষিত, শুভ ও গ্রহণযোগ্য আচরণের মানদণ্ড — যা নৈতিকতার ভিত্তি গড়ে দেয়।',
 'medium', 'নৈতিকতা, মূল্যবোধ ও সুশাসন', 'নৈতিকতার ধারণা',
 'JobHub editorial — বিসিএস সিলেবাসভিত্তিক', null),

('"জবাবদিহিতা" (Accountability) বলতে বোঝায়—', 'কাজ না করার স্বাধীনতা', 'নিজের দায়িত্ব ও কাজের ব্যাখ্যা দেওয়ার বাধ্যবাধকতা', 'শুধু ঊর্ধ্বতনকে রিপোর্ট দেওয়া', 'দণ্ড দেওয়ার ক্ষমতা', 1,
 'জবাবদিহিতা মানে নিজের দায়িত্বপালন ও সিদ্ধান্তের জন্য ব্যাখ্যা দেওয়ার বাধ্যবাধকতা — সুশাসনের অন্যতম স্তম্ভ।',
 'medium', 'নৈতিকতা, মূল্যবোধ ও সুশাসন', 'নৈতিকতার ধারণা',
 'JobHub editorial — বিসিএস সিলেবাসভিত্তিক', null),

-- ════ গাণিতিক যুক্তি → বাস্তব সংখ্যা (৫টি) ══════════════════════════════
('নিচের কোনটি মৌলিক সংখ্যা?', '৬৯', '৮৭', '৮৩', '৪৫', 2,
 '৬৯ = ৩×২৩, ৮৭ = ৩×২৯, ৪৫ = ৩×১৫ — এরা যৌগিক। ৮৩ শুধু ১ ও ৮৩ দিয়ে বিভাজ্য, তাই মৌলিক।',
 'easy', 'গাণিতিক যুক্তি', 'বাস্তব সংখ্যা',
 'JobHub editorial — বিসিএস সিলেবাসভিত্তিক', null),

('নিচের কোনটি অমূলদ সংখ্যা?', '০.২৫', '√১৬', '২২/৭', '√২', 3,
 '√১৬ = ৪ (পূর্ণসংখ্যা), ০.২৫ ও ২২/৭ ভগ্নাংশে লেখা যায়, তাই মূলদ। √২ কে দুটি পূর্ণসংখ্যার অনুপাতে লেখা যায় না — অমূলদ।',
 'medium', 'গাণিতিক যুক্তি', 'বাস্তব সংখ্যা',
 'JobHub editorial — বিসিএস সিলেবাসভিত্তিক', null),

('π (পাই) কোন ধরনের সংখ্যা?', 'অমূলদ', 'মূলদ', 'পূর্ণসংখ্যা', 'স্বাভাবিক', 0,
 'π = ৩.১৪১৫৯… এর দশমিক অংশ অসীম ও অনাবৃত্ত, ভগ্নাংশে লেখা যায় না — তাই অমূলদ।',
 'easy', 'গাণিতিক যুক্তি', 'বাস্তব সংখ্যা',
 'JobHub editorial — বিসিএস সিলেবাসভিত্তিক', null),

('১ থেকে ১০০ পর্যন্ত মৌলিক সংখ্যা কতটি?', '২৩', '২৫', '২৪', '২৬', 1,
 '১ থেকে ১০০ পর্যন্ত মৌলিক সংখ্যা ২৫টি — ২, ৩, ৫, ৭ … ৯৭ পর্যন্ত।',
 'medium', 'গাণিতিক যুক্তি', 'বাস্তব সংখ্যা',
 'JobHub editorial — বিসিএস সিলেবাসভিত্তিক', null),

('দুটি ভিন্ন মৌলিক সংখ্যার গসাগু কত?', '০', 'সংখ্যা দুটির গুণফল', '১', 'সংখ্যা দুটির যোগফল', 2,
 'ভিন্ন মৌলিক সংখ্যার সাধারণ গুণনীয়ক কেবল ১, তাই গসাগু সর্বদা ১।',
 'easy', 'গাণিতিক যুক্তি', 'বাস্তব সংখ্যা',
 'JobHub editorial — বিসিএস সিলেবাসভিত্তিক', null),

-- ════ English Language & Literature → Parts of speech (৫টি) ════════════
('In the sentence "She sings beautifully", the word "beautifully" is a—',
 'Adverb', 'Noun', 'Adjective', 'Preposition', 0,
 'An adverb modifies a verb. "Beautifully" tells us how she sings, so it modifies the verb "sings".',
 'easy', 'English Language & Literature', 'Parts of speech',
 'JobHub editorial — BCS syllabus', null),

('"And" in "Rahim and Karim are friends" is a—',
 'Preposition', 'Interjection', 'Pronoun', 'Conjunction', 3,
 'A conjunction joins words, phrases or clauses. "And" joins two nouns here.',
 'easy', 'English Language & Literature', 'Parts of speech',
 'JobHub editorial — BCS syllabus', null),

('"Alas!" — এই শব্দটি কোন Parts of speech?',
 'Adverb', 'Interjection', 'Conjunction', 'Adjective', 1,
 'An interjection expresses sudden emotion and has no grammatical link with the rest of the sentence: Alas!, Wow!, Hurrah!',
 'easy', 'English Language & Literature', 'Parts of speech',
 'JobHub editorial — BCS syllabus', null),

('In "The book is on the table", the word "on" is a—',
 'Adverb', 'Conjunction', 'Preposition', 'Interjection', 2,
 '"On" shows the relation between "the book" and "the table" — the function of a preposition.',
 'easy', 'English Language & Literature', 'Parts of speech',
 'JobHub editorial — BCS syllabus', null),

('"Honesty" is an example of a—',
 'Proper noun', 'Collective noun', 'Material noun', 'Abstract noun', 3,
 'An abstract noun names a quality or state that cannot be seen or touched — honesty, courage, freedom.',
 'medium', 'English Language & Literature', 'Parts of speech',
 'JobHub editorial — BCS syllabus', null),

-- ════ গাণিতিক যুক্তি → শতকরা (Khairul PDF, PART-A) ══════════════════════
('একটি সংখ্যা ২০% ও ৩০% ধারাবাহিকভাবে বৃদ্ধি পেলে মোট কত শতাংশ বৃদ্ধি হয়?', '৫৬%', '৫০%', '৪৪%', '৬০%', 0,
 'ধারাবাহিক বৃদ্ধি = R + S + RS/100 = ২০ + ৩০ + (২০×৩০)/১০০ = ৫৬%।',
 'medium', 'গাণিতিক যুক্তি', 'শতকরা',
 'Khairul''s Advanced Math — Percentage notes (Drive)', 'PART-A §3 Successive Percentage Change'),

('একটি সংখ্যা ২০% ও ৩০% ধারাবাহিকভাবে হ্রাস পেলে মোট কত শতাংশ হ্রাস হয়?', '৫০%', '৪৪%', '৫৬%', '৩৬%', 1,
 'ধারাবাহিক হ্রাস = R + S − RS/100 = ২০ + ৩০ − (২০×৩০)/১০০ = ৪৪%।',
 'medium', 'গাণিতিক যুক্তি', 'শতকরা',
 'Khairul''s Advanced Math — Percentage notes (Drive)', 'PART-A §3 Successive Percentage Change'),

('৫ লিটার ৪০% অ্যালকোহল দ্রবণে ১ লিটার পানি যোগ করলে নতুন দ্রবণে অ্যালকোহলের শতকরা পরিমাণ কত?', '৩০%', '৩৬%', '৩৩⅓%', '৪০%', 2,
 'অ্যালকোহল = ৫ × ৪০/১০০ = ২ লিটার। নতুন মোট = ৬ লিটার। শতকরা = ২/৬ × ১০০ = ৩৩⅓%।',
 'medium', 'গাণিতিক যুক্তি', 'শতকরা',
 'Khairul''s Advanced Math — Percentage notes (Drive)', 'PART-A §5 Mixture-এ Percentage'),

('৬ cc ২০% অ্যালকোহল দ্রবণ ও ৪ cc ৬০% অ্যালকোহল দ্রবণ মেশানো হলে মিশ্রণে অ্যালকোহল কত শতাংশ?', '৩০%', '৪০%', '৪৪%', '৩৬%', 3,
 'অ্যালকোহল = ৬×২০% + ৪×৬০% = ১.২ + ২.৪ = ৩.৬ cc; মোট ১০ cc। শতকরা = ৩.৬/১০ × ১০০ = ৩৬%।',
 'medium', 'গাণিতিক যুক্তি', 'শতকরা',
 'Khairul''s Advanced Math — Percentage notes (Drive)', 'PART-A §5 Mixture-এ Percentage'),

('একটি পণ্যের মূল্য ২০% কমিয়ে বিক্রি করে ১২% লাভ হয়। ক্রয়মূল্যের উপর মোট লাভ কত?', '১২%', '৮%', '১০%', '১৪%', 0,
 'মূল্য ১০০ ধরি → ক্রয়মূল্য ৮০ → বিক্রয়মূল্য ৮০×১.১২ = ৮৯.৬; ক্রয়মূল্যের সাপেক্ষে লাভ ১২%।',
 'hard', 'গাণিতিক যুক্তি', 'শতকরা',
 'Khairul''s Advanced Math — Percentage notes (Drive)', 'PART-A §6 Base ঠিক করা'),

-- ════ গাণিতিক যুক্তি → লাভ-ক্ষতি (Khairul PDF, PART-B) ══════════════════
('একই পণ্য Tk. ১৭৫৪ ও Tk. ১৪৯২-এ বিক্রি করলে যথাক্রমে সমান লাভ ও সমান ক্ষতি হয়। ক্রয়মূল্য কত?', 'Tk. ১৫০০', 'Tk. ১৬২৩', 'Tk. ১৬৫০', 'Tk. ১৭০০', 1,
 'সমান লাভ-ক্ষতির ক্ষেত্রে ক্রয়মূল্য = (১৭৫৪ + ১৪৯২)/২ = ৩২৪৬/২ = Tk. ১৬২৩।',
 'medium', 'গাণিতিক যুক্তি', 'লাভ-ক্ষতি',
 'Khairul''s Advanced Math — Profit & Loss notes (Drive)', 'PART-B §10 Equal Profit ও Equal Loss'),

('Tk. ৮৩২ ও Tk. ৪৪৮-এ বিক্রি করলে যথাক্রমে সমান লাভ ও সমান ক্ষতি হয়। ৫০% লাভে বিক্রয়মূল্য কত হবে?', 'Tk. ৮৪০', 'Tk. ১০০০', 'Tk. ৯৬০', 'Tk. ১১২০', 2,
 'ক্রয়মূল্য = (৮৩২ + ৪৪৮)/২ = Tk. ৬৪০। ৫০% লাভে বিক্রয়মূল্য = ৬৪০ × ১৫০% = Tk. ৯৬০।',
 'hard', 'গাণিতিক যুক্তি', 'লাভ-ক্ষতি',
 'Khairul''s Advanced Math — Profit & Loss notes (Drive)', 'PART-B §10 Equal Profit ও Equal Loss'),

('একই মূল্যে দুটি ঘড়ি বিক্রি করলে একটিতে ১২% লাভ ও অন্যটিতে ১২% ক্ষতি হয়। মোট কত শতাংশ ক্ষতি?', '০%', '২.৪%', '১২%', '১.৪৪%', 3,
 'একই বিক্রয়মূল্যে x% লাভ ও x% ক্ষতি হলে সর্বদা ক্ষতি = (x/১০)² = (১২/১০)² = ১.৪৪%।',
 'medium', 'গাণিতিক যুক্তি', 'লাভ-ক্ষতি',
 'Khairul''s Advanced Math — Profit & Loss notes (Drive)', 'PART-B §11 Same Selling Price'),

('একটি পণ্য Tk. ৫০০০-এ কিনে ৩০% ক্ষতিতে বিক্রি করে প্রাপ্ত টাকায় আরেকটি পণ্য কেনা হয় এবং ৬০% লাভে বিক্রি করা হয়। মোট লাভ কত?', '১২%', '১৮%', '২০%', '৩০%', 0,
 'প্রথম বিক্রয় = ৫০০০ × ৭০% = ৩৫০০; দ্বিতীয় বিক্রয় = ৩৫০০ × ১৬০% = ৫৬০০; মোট লাভ = ৬০০ ⇒ ৬০০/৫০০০ = ১২%।',
 'hard', 'গাণিতিক যুক্তি', 'লাভ-ক্ষতি',
 'Khairul''s Advanced Math — Profit & Loss notes (Drive)', 'PART-B §12 Chain of Transactions'),

('ক্রয়মূল্যের উপর ২০% বেশি ধার্য মূল্যে ১০% ডিসকাউন্ট দিলে প্রকৃত লাভ কত?', '১০%', '৮%', '১২%', '২০%', 1,
 'ক্রয়মূল্য ১০০ → ধার্য মূল্য ১২০ → বিক্রয়মূল্য ১২০×৯০% = ১০৮ ⇒ লাভ ৮%।',
 'medium', 'গাণিতিক যুক্তি', 'লাভ-ক্ষতি',
 'Khairul''s Advanced Math — Profit & Loss notes (Drive)', 'PART-C §14 Markup + Discount')

) as v(statement, a, b, c, d, correct_option, explanation, difficulty,
       subject_title, topic_title, source_title, source_locator);

-- ── STEP 2 · যাচাই (কিছু ভুল থাকলে এখানেই থামবে) ─────────────────────────
create temp table jh_rows as
select
  i.*,
  c.course_id,
  c.admin_id,
  s.id as subject_id,
  t.id as topic_id
from jh_in i
cross join jh_ctx c
left join subjects s on s.course_id = c.course_id and s.title_bn = i.subject_title
left join topics   t on t.subject_id = s.id       and t.title_bn = i.topic_title;

do $$
declare v_list text;
begin
  select string_agg(distinct subject_title || ' → ' || topic_title, ', ')
    into v_list from jh_rows where subject_id is null or topic_id is null;
  if v_list is not null then
    raise exception 'বিষয়/টপিক পাওয়া যায়নি: %', v_list;
  end if;

  if exists (select 1 from jh_rows where correct_option not between 0 and 3) then
    raise exception 'correct_option 0-3 এর বাইরে আছে।';
  end if;

  if exists (select 1 from jh_rows where difficulty not in ('easy','medium','hard')) then
    raise exception 'difficulty অবৈধ।';
  end if;

  if exists (select 1 from jh_rows where explanation is null or btrim(explanation) = '') then
    raise exception 'explanation খালি আছে।';
  end if;

  if exists (select 1 from jh_rows
              where a = b or a = c or a = d or b = c or b = d or c = d) then
    raise exception 'একই অপশন দুইবার আছে।';
  end if;

  if exists (select 1 from jh_rows where length(btrim(statement)) < 8) then
    raise exception 'statement খুব ছোট।';
  end if;
end $$;

create temp table jh_dedup as
select distinct on (statement) *
from (
  select q.*, row_number() over (
    partition by statement order by source_locator nulls last
  ) as rn
  from jh_rows q
) ranked
where rn = 1;

-- ── STEP 3 · ইনসার্ট ─────────────────────────────────────────────────────
create temp table jh_inserted as
with ins as (
  insert into questions (
    course_id, subject_id, topic_id, statement,
    option_a, option_b, option_c, option_d, correct_option,
    explanation, difficulty, source, source_type, status, is_verified,
    question_type, question_kind, fingerprint,
    source_title, source_locator, created_by
  )
  select
    q.course_id, q.subject_id, q.topic_id, q.statement,
    q.a, q.b, q.c, q.d, q.correct_option,
    q.explanation, q.difficulty,
    coalesce(q.source_title, 'JobHub SQL import'),
    'manual', 'pending_review', false,
    'mcq', 'practice',
    encode(sha256(convert_to(q.statement, 'UTF8')), 'hex'),
    q.source_title, q.source_locator, q.admin_id
  from jh_dedup q
  on conflict (course_id, fingerprint) do nothing
  returning id, fingerprint
)
select id, fingerprint from ins;

-- ── STEP 4 · ফলাফল ──────────────────────────────────────────────────────
select
  s.title_bn as বিষয়,
  t.title_bn as টপিক,
  count(*) filter (where i.id is not null) as নতুন_যোগ,
  count(*) filter (where i.id is null)     as আগেই_ছিল,
  count(*)                                 as মোট
from jh_dedup d
join subjects s on s.id = d.subject_id
join topics   t on t.id = d.topic_id
left join jh_inserted i
       on i.fingerprint = encode(sha256(convert_to(d.statement, 'UTF8')), 'hex')
group by s.title_bn, t.title_bn
order by s.title_bn, t.title_bn;

-- উত্তর-কী বণ্টন (চারটাই প্রায় সমান হওয়া উচিত)
select
  case correct_option when 0 then 'ক' when 1 then 'খ'
                      when 2 then 'গ' else 'ঘ' end as উত্তর,
  count(*) as সংখ্যা
from questions
where fingerprint in (select encode(sha256(convert_to(statement, 'UTF8')), 'hex') from jh_dedup)
group by correct_option order by correct_option;
