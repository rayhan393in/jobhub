-- ============================================================================
--  JobHub · Supabase থেকে সোজা প্রশ্ন যোগ করা
--  এক ফাইলেই: স্ট্রাকচার + রান করার কোড। Supabase SQL Editor-এ পুরোটা পেস্ট
--  করে রান করুন। শুধু STEP 1-এর মানগুলো বদলাবেন।
-- ============================================================================
--
--  ┌──────────────────────────────────────────────────────────────────────┐
--  │  স্ট্রাকচার: একটা প্রশ্ন ঢুকতে কী কী লাগে                            │
--  └──────────────────────────────────────────────────────────────────────┘
--
--  questions টেবিলে ৩৯টা কলাম। বাধ্যতামূলক মাত্র ১০টা:
--
--    course_id      কোন কোর্স      → বিসিএস / পেট্রোবাংলা (STEP 1)
--    statement      প্রশ্ন          → কমপক্ষে ৮ অক্ষর
--    option_a..d    চারটা অপশন      → খালি চলবে না, একই অপশন দুবার চলবে না
--    correct_option সঠিক উত্তর     → 0=ক  1=খ  2=গ  3=ঘ   (১-৪ নয়!)
--    fingerprint    ডুপ্লিকেট গার্ড → sha256(statement)
--
--  বাকিগুলোর ডিফল্ট আছে, তবে প্রশ্নটা কাজে লাগাতে এগুলোও দিতে হয়:
--
--    subject_id / topic_id  → পরীক্ষায় প্রশ্নটা তোলার জন্য লাগে
--                             (null থাকলে paper-builder প্রশ্নটা পায় না)
--    status                 → 'pending_review' (approve আগে ছাত্ররা দেখবে না)
--    is_verified            → false
--    source_type            → 'ai_assisted' | 'manual' | 'previous' ...
--    explanation            → ছাত্ররা উত্তর দেখার সময় পড়ে
--    difficulty             → easy / medium / hard
--
--  ┌──────────────────────────────────────────────────────────────────────┐
--  │  ডাটাবেজ নিজে যা চেক করে (ভুল করলে এই এররগুলো আসবে)                  │
--  └──────────────────────────────────────────────────────────────────────┘
--
--    questions_statement_check        statement ≥ ৮ অক্ষর
--    questions_correct_option_check   correct_option 0–3
--    questions_difficulty_check       easy / medium / hard
--    questions_status_check           draft / pending_review / approved /
--                                     rejected / archived
--    questions_check                  approved হলে is_verified অবশ্যই true
--    questions_year_check             year ১৯৭১–২১০০ বা null
--    questions_course_id_fingerprint_key   একই কোর্সে একই প্রশ্ন দুবার নয়
--
--  ট্রিগার যা নিজে থেকে চলে:
--    guard_question_verification  → ai_assisted প্রশ্ন question.review
--                                   পারমিশন ছাড়া approve হতে দেয় না
--                                   (SQL Editor-এ auth.uid() null → approve করাই যায় না)
--    trg_guard_previous           → evidence_records ছাড়া source_type='previous' নয়
--    trg_questions_kind_honesty   → evidence ছাড়া exact_pyq লেবেল নয়
--    trg_qtl_autolink             → question_topic_links-এ নিজে রেকর্ড বানায়
--    set_updated_at               → updated_at নিজে আপডেট করে
--
--  ┌──────────────────────────────────────────────────────────────────────┐
--  │  প্রশ্নের জীবনচক্র                                                  │
--  └──────────────────────────────────────────────────────────────────────┘
--
--    SQL Editor  →  pending_review + is_verified=false
--                        ↓
--    /admin/review  →  approved + is_verified=true + verified_by
--                        ↓
--    সাইটে ছাত্ররা দেখতে পায়
--
--  SQL দিয়ে approved করা যাবে না — এটা ফিচার, বাগ নয়।
--  একসাথে ২০-৫০টা প্রশ্ন হলে SQL নয়, /admin/import ব্যবহার করুন।
--
-- ============================================================================


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 1 · এখানেই সব বদলাবেন                                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- কোন কোর্সে ঢুকবে
--   বিসিএস      : 599509ae-c4c3-440a-9463-802a4efc7a0c
--   পেট্রোবাংলা : 4ab82963-892e-4c69-9a5d-09d289c33c04
set jh.course = '599509ae-c4c3-440a-9463-802a4efc7a0c';

-- কে যোগ করছে (profiles.id) — আপনার super_admin আইডি
set jh.admin  = 'b0d40cca-e34b-42fe-bc19-dae3627b7a48';

-- ── প্রশ্ন ────────────────────────────────────────────────────────────────
set jh.statement = 'নিচের কোনটি মৌলিক সংখ্যা?';

set jh.a = '৬৯';
set jh.b = '৮৭';
set jh.c = '৮৩';
set jh.d = '৪৫';

-- সঠিক উত্তর: ক / খ / গ / ঘ  বের করে লিখুন (0-3 নয়, লেটারই লিখবেন)
set jh.answer = 'গ';

set jh.explanation = '৬৯ = ৩×২৩, ৮৭ = ৩×২৯, ৪৫ = ৩×১৫ — এরা যৌগিক। ৮৩ শুধু ১ ও ৮৩ দিয়ে বিভাজ্য, তাই মৌলিক।';

-- easy / medium / hard
set jh.difficulty = 'easy';

-- ai_assisted (AI-এর বানানো) / manual (নিজে লেখা) / previous (আগের পরীক্ষা)
set jh.source_type = 'ai_assisted';

-- ── বিষয় ও টপিক (ডাটাবেজে যেমন লেখা, হুবহু তেমন) ──────────────────────────
--  বিষয়ের নাম: বাংলা ভাষা ও সাহিত্য | English Language & Literature |
--  বাংলাদেশ বিষয়াবলি | আন্তর্জাতিক বিষয়াবলি | ভূগোল, পরিবেশ ও দুর্যোগ |
--  সাধারণ বিজ্ঞান | কম্পিউটার ও তথ্যপ্রযুক্তি | গাণিতিক যুক্তি |
--  মানসিক দক্ষতা | নৈতিকতা, মূল্যবোধ ও সুশাসন
set jh.subject = 'গাণিতিক যুক্তি';
set jh.topic   = 'বাস্তব সংখ্যা';

-- ── PYQ হলে (আগের পরীক্ষার প্রশ্ন) ───────────────────────────────────────
--  না হলে দুটোই খালি স্ট্রিং '' রাখুন। একটা দিয়ে আরেকটা খালি রাখলে বাতিল।
--  সাল অনুমান করবেন না — প্রশ্নপত্র মিলিয়ে নিন।
set jh.exam = '৩০তম বিসিএস প্রিলিমিনারি';
set jh.year = '2009';

-- ── উৎস (ঐচ্ছিক, তবে রাখা ভালো) ───────────────────────────────────────────
set jh.source_title   = 'Khaiul''s Basic Math (6th Edition)';
set jh.source_locator = 'পৃষ্ঠা ৩১, প্রশ্ন ৩';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 2 · নিচে হাত দেবেন না — যাচাই, ইনসার্ট, রিপোর্ট                   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

do $$
declare
  v_course      uuid := current_setting('jh.course')::uuid;
  v_admin       uuid := current_setting('jh.admin')::uuid;
  v_statement   text := btrim(current_setting('jh.statement'));
  v_a           text := btrim(current_setting('jh.a'));
  v_b           text := btrim(current_setting('jh.b'));
  v_c           text := btrim(current_setting('jh.c'));
  v_d           text := btrim(current_setting('jh.d'));
  v_answer      text := btrim(current_setting('jh.answer'));
  v_explanation text := btrim(current_setting('jh.explanation'));
  v_difficulty  text := lower(btrim(current_setting('jh.difficulty')));
  v_source_type text := lower(btrim(current_setting('jh.source_type')));
  v_subject     text := btrim(current_setting('jh.subject'));
  v_topic       text := btrim(current_setting('jh.topic'));
  v_exam        text := nullif(btrim(current_setting('jh.exam')), '');
  v_year_txt    text := nullif(btrim(current_setting('jh.year')), '');
  v_source_t    text := nullif(btrim(current_setting('jh.source_title')), '');
  v_source_l    text := nullif(btrim(current_setting('jh.source_locator')), '');
  v_co          smallint;
  v_year        smallint;
  v_subject_id  uuid;
  v_topic_id    uuid;
  v_id          uuid;
begin
  -- ── যাচাই ১ · প্রশ্ন ও অপশন ────────────────────────────────────────────
  if length(v_statement) < 8 then
    raise exception 'প্রশ্ন কমপক্ষে ৮ অক্ষরের হতে হবে — এখন % অক্ষর।', length(v_statement);
  end if;

  if v_a = '' or v_b = '' or v_c = '' or v_d = '' then
    raise exception 'চারটা অপশনই লাগবে — খালি আছে।';
  end if;

  if v_a = v_b or v_a = v_c or v_a = v_d
     or v_b = v_c or v_b = v_d or v_c = v_d then
    raise exception 'একই অপশন দুইবার দেওয়া হয়েছে।';
  end if;

  -- ── যাচাই ২ · সঠিক উত্তর ──────────────────────────────────────────────
  v_co := case v_answer
            when 'ক' then 0 when 'a' then 0
            when 'খ' then 1 when 'b' then 1
            when 'গ' then 2 when 'c' then 2
            when 'ঘ' then 3 when 'd' then 3
          end;

  if v_co is null then
    raise exception 'সঠিক উত্তর বুঝা যায়নি: "%" — ক / খ / গ / ঘ এর একটা দিন।', v_answer;
  end if;

  -- ── যাচাই ৩ · explanation ও difficulty ─────────────────────────────────
  if v_explanation = '' then
    raise exception 'explanation খালি রাখা যাবে না — কেন উত্তরটা সঠিক সেটা লিখুন।';
  end if;

  if v_difficulty not in ('easy','medium','hard') then
    raise exception 'difficulty "%" অবৈধ — easy / medium / hard এর একটা দিন।', v_difficulty;
  end if;

  if v_source_type not in ('manual','ai_assisted','previous','csv_import','json_import') then
    raise exception 'source_type "%" অবৈধ।', v_source_type;
  end if;

  -- ── যাচাই ৪ · বিষয় ও টপিক ─────────────────────────────────────────────
  select s.id into v_subject_id
    from public.subjects s
   where s.course_id = v_course and s.title_bn = v_subject;

  if v_subject_id is null then
    raise exception 'বিষয় পাওয়া যায়নি: "%" — subjects টেবিলে এই কোর্সে নেই। হুবহু নাম দিন।', v_subject;
  end if;

  select t.id into v_topic_id
    from public.topics t
   where t.subject_id = v_subject_id and t.title_bn = v_topic;

  if v_topic_id is null then
    raise exception 'টপিক পাওয়া যায়নি: "%" — "%" বিষয়ে এই নামে কোনো টপিক নেই।', v_topic, v_subject;
  end if;

  -- ── যাচাই ৫ · PYQ জোড়া ও সাল ──────────────────────────────────────────
  if (v_exam is null) <> (v_year_txt is null) then
    raise exception 'exam আর year দুটোই দিন, নাহলে দুটোই খালি রাখুন।';
  end if;

  if v_year_txt is not null then
    if v_year_txt !~ '^[0-9]{4}$' then
      raise exception 'year সংখ্যায় লিখুন (যেমন 2009), এখন "%"।', v_year_txt;
    end if;
    v_year := v_year_txt::smallint;
    if v_year < 1971 or v_year > 2100 then
      raise exception 'year ১৯৭১-২১০০ এর মধ্যে হতে হবে।';
    end if;
  end if;

  -- ── ইনসার্ট ────────────────────────────────────────────────────────────
  insert into public.questions (
    course_id, subject_id, topic_id, statement,
    option_a, option_b, option_c, option_d, correct_option,
    explanation, difficulty, source, source_type, status, is_verified,
    question_type, question_kind, fingerprint,
    exam_name, "year", source_title, source_locator, created_by
  ) values (
    v_course, v_subject_id, v_topic_id, v_statement,
    v_a, v_b, v_c, v_d, v_co,
    v_explanation, v_difficulty,
    coalesce(v_source_t, 'JobHub SQL import'),
    v_source_type, 'pending_review', false,
    'mcq', 'practice',
    encode(sha256(convert_to(v_statement, 'UTF8')), 'hex'),
    v_exam, v_year, v_source_t, v_source_l, v_admin
  )
  on conflict (course_id, fingerprint) do nothing
  returning id into v_id;

  if v_id is null then
    raise notice 'এই প্রশ্ন আগেই এই কোর্সে আছে — কিছু যোগ হয়নি।';
    return;
  end if;

  -- ── PYQ হলে প্রমাণ + লেবেল ─────────────────────────────────────────────
  if v_exam is not null then
    insert into public.evidence_records
      (question_id, exam_name, exam_year, match_kind, verified_by, source_ref)
    values
      (v_id, v_exam, v_year, 'exact', v_admin, v_source_l)
    on conflict (question_id, exam_name, exam_year) do nothing;

    update public.questions
       set source_type   = 'previous',
           question_kind = 'exact_pyq'
     where id = v_id;
  end if;

  raise notice 'যোগ হয়েছে — question id: %', v_id;
end $$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 3 · ফলাফল দেখুন                                                   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
select
  q.statement                                    as প্রশ্ন,
  case q.correct_option when 0 then 'ক' when 1 then 'খ'
                        when 2 then 'গ' else 'ঘ' end as সঠিক_উত্তর,
  s.title_bn                                     as বিষয়,
  t.title_bn                                     as টপিক,
  q.difficulty                                   as কঠিনতা,
  q.source_type,
  q.status,
  q.is_verified                                  as যাচাইকৃত,
  q.question_kind,
  q.exam_name                                    as পরীক্ষা,
  q."year"                                       as সাল,
  q.created_at                                   as যোগ_হয়েছে
from public.questions q
left join public.subjects s on s.id = q.subject_id
left join public.topics   t on t.id = q.topic_id
where q.fingerprint = encode(
        sha256(convert_to(btrim(current_setting('jh.statement')), 'UTF8')), 'hex')
  and q.course_id   = current_setting('jh.course')::uuid;
