-- =====================================================================
--  JobHub · প্রশ্ন ঢোকানোর ছোট স্ক্রিপ্ট (১টা বা কয়েকটা প্রশ্ন)
--  পুরোটা একসাথে রান করুন। প্রশ্ন যোগ করুন শুধু STEP 1-এ।
--  কোনো ভুল থাকলে কিছুই ইনসার্ট হবে না — আস্ত একটা ব্যাচ বাতিল।
-- =====================================================================

-- ── STEP 0 · কোর্স ──────────────────────────────────────────────────────
--  বিসিএস  = 599509ae-c4c3-440a-9463-802a4efc7a0c
--  পেট্রোবাংলা = 4ab82963-892e-4c69-9a5d-09d289c33c04
drop table if exists jh_ctx;
create temp table jh_ctx as
select
  '599509ae-c4c3-440a-9463-802a4efc7a0c'::uuid as course_id,
  'b0d40cca-e34b-42fe-bc19-dae3627b7a48'::uuid as admin_id;

-- ── STEP 1 · প্রশ্ন লিখুন ────────────────────────────────────────────────
--  ক্রম: statement, a, b, c, d, correct_option, explanation, difficulty,
--        subject, topic, exam_name, exam_year, source_title, source_locator
--
--  correct_option : 0 = ক   1 = খ   2 = গ   3 = ঘ        (১–৪ নয়!)
--  difficulty     : easy / medium / hard
--  exam_name      : PYQ হলে পরীক্ষার নাম, নাহলে null
--  exam_year      : PYQ হলে সাল, নাহলে null  (দুটোই দিন, নাহলে দুটোই null)
--  subject/topic  : ডাটাবেজে যেমন আছে হুবহু — এক বানান আলাদা হলে ব্যাচ বাতিল
drop table if exists jh_in;
create temp table jh_in as
select * from (values
  (
    'নিচের কোনটি মৌলিক সংখ্যা?',
    '৬৯', '৮৭', '৮৩', '৪৫',
    2,
    '৬৯ = ৩×২৩, ৮৭ = ৩×২৯, ৪৫ = ৩×১৫ — এরা যৌগিক। ৮৩ শুধু ১ ও ৮৩ দিয়ে বিভাজ্য, তাই মৌলিক।',
    'easy',
    'গাণিতিক যুক্তি', 'বাস্তব সংখ্যা',
    '৩০তম বিসিএস প্রিলিমিনারি', 2009,
    'Khaiul''s Basic Math (6th Edition)', 'পৃষ্ঠা ৩১, প্রশ্ন ৩'
  )
  -- নতুন প্রশ্ন এভাবে যোগ করুন (আগেরটার পরে কমা দিয়ে):
  -- ,(
  --   'দ্বিতীয় প্রশ্ন?', 'ক', 'খ', 'গ', 'ঘ', 0, 'ব্যাখ্যা।', 'medium',
  --   'গাণিতিক যুক্তি', 'শতকরা', null, null, 'AI draft', null
  -- )
) as v(statement, a, b, c, d, correct_option, explanation, difficulty,
       subject_title, topic_title, exam_name, exam_year, source_title, source_locator);

-- ── STEP 2 · যাচাই (কিছু ভুল থাকলে এখানেই থামবে) ─────────────────────────
drop table if exists jh_rows;
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
    into v_list
    from jh_rows where subject_id is null or topic_id is null;
  if v_list is not null then
    raise exception 'বিষয়/টপিক পাওয়া যায়নি: %. নাম ডাটাবেজে যেমন আছে হুবহু তেমন লিখুন। কিছুই ঢোকেনি।', v_list;
  end if;

  if exists (select 1 from jh_rows where correct_option not between 0 and 3) then
    raise exception 'correct_option 0-3 এর মধ্যে হতে হবে (0=ক 1=খ 2=গ 3=ঘ)। কিছুই ঢোকেনি।';
  end if;

  if exists (select 1 from jh_rows where difficulty not in ('easy','medium','hard')) then
    raise exception 'difficulty শুধু easy / medium / hard হবে। কিছুই ঢোকেনি।';
  end if;

  if exists (select 1 from jh_rows where explanation is null or btrim(explanation) = '') then
    raise exception 'explanation খালি রাখা যাবে না। কিছুই ঢোকেনি।';
  end if;

  if exists (select 1 from jh_rows
              where statement is null or length(btrim(statement)) < 8) then
    raise exception 'statement কমপক্ষে ৮ অক্ষরের হতে হবে। কিছুই ঢোকেনি।';
  end if;

  if exists (select 1 from jh_rows
              where a = b or a = c or a = d or b = c or b = d or c = d) then
    raise exception 'একই অপশন দুইবার দেওয়া হয়েছে। কিছুই ঢোকেনি।';
  end if;

  if exists (select 1 from jh_rows where (exam_name is null) <> (exam_year is null)) then
    raise exception 'exam_name আর exam_year দুটোই দিন, নাহলে দুটোই null দিন। কিছুই ঢোকেনি।';
  end if;
end $$;

-- একই statement দুইবার দিলে একটাই রাখা হয় (PYQ তথ্য থাকলে সেটাই)
drop table if exists jh_dedup;
create temp table jh_dedup as
select distinct on (statement) *
from (
  select q.*, row_number() over (
    partition by statement
    order by exam_name nulls last, source_locator nulls last
  ) as rn
  from jh_rows q
) ranked
where rn = 1;

-- ── STEP 3 · ইনসার্ট (pending_review + unverified + ai_assisted) ─────────
drop table if exists jh_inserted;
create temp table jh_inserted as
with ins as (
  insert into questions (
    course_id, subject_id, topic_id, statement,
    option_a, option_b, option_c, option_d, correct_option,
    explanation, difficulty, source, source_type, status, is_verified,
    question_type, question_kind, fingerprint,
    exam_name, "year", created_by
  )
  select
    q.course_id, q.subject_id, q.topic_id, q.statement,
    q.a, q.b, q.c, q.d, q.correct_option,
    q.explanation, q.difficulty,
    coalesce(q.source_title, 'AI draft — মানব যাচাই বাকি'),
    'ai_assisted', 'pending_review', false,
    'mcq', 'practice',
    encode(sha256(convert_to(q.statement, 'UTF8')), 'hex'),
    q.exam_name, q.exam_year::smallint, q.admin_id
  from jh_dedup q
  on conflict (course_id, fingerprint) do nothing
  returning id, fingerprint
)
select id, fingerprint from ins;

-- ── STEP 4 · PYQ হলে প্রমাণ + লেবেল (শুধু এইমাত্র ঢোকা সারিতে) ───────────
insert into evidence_records (question_id, exam_name, exam_year, match_kind, verified_by, source_ref)
select i.id, q.exam_name, q.exam_year::smallint, 'exact', q.admin_id, q.source_locator
from jh_inserted i
join jh_dedup q on q.course_id = (select course_id from jh_ctx)
               and encode(sha256(convert_to(q.statement, 'UTF8')), 'hex') = i.fingerprint
where q.exam_name is not null
on conflict (question_id, exam_name, exam_year) do nothing;

update questions q2
   set source_type   = 'previous',
       question_kind = 'exact_pyq'
from jh_inserted i
join jh_dedup q on encode(sha256(convert_to(q.statement, 'UTF8')), 'hex') = i.fingerprint
where q2.id = i.id
  and q.exam_name is not null;

-- ── STEP 5 · ফলাফল ──────────────────────────────────────────────────────
select
  d.statement,
  case d.correct_option when 0 then 'ক' when 1 then 'খ' when 2 then 'গ' else 'ঘ' end as সঠিক_উত্তর,
  q2.source_type,
  q2.status,
  q2.is_verified     as যাচাইকৃত,
  q2.question_kind,
  q2.exam_name,
  q2."year",
  (q2.topic_id is not null) as টপিক_আছে,
  case when i.id is null then 'আগেই ছিল — বাদ পড়েছে' else 'নতুন ঢুকেছে' end as ফলাফল
from jh_dedup d
left join jh_inserted i
       on i.fingerprint = encode(sha256(convert_to(d.statement, 'UTF8')), 'hex')
left join questions q2
       on q2.course_id   = d.course_id
      and q2.fingerprint = encode(sha256(convert_to(d.statement, 'UTF8')), 'hex')
order by d.statement;
