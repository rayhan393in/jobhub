-- ============================================================================
--  JobHub | UNIVERSAL AI QUESTION IMPORT — TEMPLATE for the SQL Editor
--  Copy this whole file into Supabase → SQL Editor → Run.
--  Only STEP 0 and STEP 1 change between batches. Everything else is fixed.
-- ============================================================================
--
--  STRUCTURE
--  ---------
--   ┌ STEP 0  config      course_id, created_by, filename  (temp table jh_ctx)
--   ├ STEP 1  payload     JSON array of questions          (temp table jh_in)
--   ├ STEP 2  report      prints only rows that have problems
--   ├ STEP 3  validate    RAISE EXCEPTION → whole batch aborts
--   ├ STEP 4  map         subject → topic → subtopic, ids resolved
--   ├ STEP 5  dedupe      sha256(statement) already in the bank → skipped
--   ├ STEP 6  batch row   import_batches (the audit record)
--   ├ STEP 7  insert      questions + auto topic link
--   └ STEP 8  summary     planned / to_insert / inserted_now / total_after
--
--  JSON OBJECT — one per question
--  ------------------------------
--   subject        required  exact title_bn or title_en, e.g. "English Language & Literature"
--   topic          required  exact topic title,      e.g. "Grammar"
--   subtopic       optional  exact subtopic title,   e.g. "Voice"  ("" or omit = no subtopic)
--   statement      required  >= 8 chars
--   option_a/b/c/d required  four distinct options
--   correct_option required  "a" | "b" | "c" | "d"   (also ক/খ/গ/ঘ, 0..3)
--   explanation    required  why the answer is right
--   difficulty     optional  easy | medium | hard   (default medium)
--   exam_name      optional  e.g. "40th BCS"
--   exam_year      optional  number 1971..2100
--   source_title   optional  e.g. "Master"
--   source_locator optional  e.g. "Page 377, Q-1"
--
--  HARD RULES the database enforces (do not fight them)
--  ----------------------------------------------------
--   • Voice / Tense / Narration etc. are SUBTOPICS, not topics.
--     Wrong: {"topic":"Voice"}
--     Right: {"topic":"Grammar","subtopic":"Voice"}
--   • question_kind is NOT taken from the JSON. It is always 'practice'.
--     'previous' is a source_type, not a question_kind. Claiming exact_pyq
--     needs a verified evidence_records row, which cannot exist at insert
--     time — do that later per question.
--   • created_by / import_batches.created_by reference profiles(id),
--     never auth.users.
--   • Re-running the same batch inserts nothing new.
--
--  DRY RUN: change the final "commit;" to "rollback;".
--  PREVIEW: run STEP 1..4 only, then  select * from jh_rows;
-- ============================================================================

begin;

drop table if exists jh_ctx, jh_in, jh_rows, jh_dedup, jh_batch;

-- ── STEP 0 · CONFIG ─────────────────────────────────────────────────────────
create temp table jh_ctx as
select
  coalesce(nullif(current_setting('jh.course_id', true), ''),
           '599509ae-c4c3-440a-9463-802a4efc7a0c')::uuid as course_id,
  coalesce(nullif(current_setting('jh.created_by', true), ''),
           'b0d40cca-e34b-42fe-bc19-dae3627b7a48')::uuid as admin_id,
  ('ai-import — ' || to_char(now() at time zone 'Asia/Dhaka', 'YYYY-MM-DD HH24:MI'))::text as filename;

-- ── STEP 1 · PAYLOAD ────────────────────────────────────────────────────────
create temp table jh_in as
select
  nullif(btrim(q->>'subject'), '')  as subject_title,
  nullif(btrim(q->>'topic'), '')    as topic_title,
  nullif(btrim(q->>'subtopic'), '') as subtopic_title,
  regexp_replace(btrim(q->>'statement'), '\s+', ' ', 'g') as st,
  btrim(q->>'option_a') as a,
  btrim(q->>'option_b') as b,
  btrim(q->>'option_c') as c,
  btrim(q->>'option_d') as d,
  case lower(btrim(q->>'correct_option'))
    when 'a' then 0::smallint when 'b' then 1::smallint
    when 'c' then 2::smallint when 'd' then 3::smallint
    when 'ক' then 0::smallint when 'খ' then 1::smallint
    when 'গ' then 2::smallint when 'ঘ' then 3::smallint
    when '0' then 0::smallint when '1' then 1::smallint
    when '2' then 2::smallint when '3' then 3::smallint
  end as co,
  nullif(btrim(q->>'explanation'), '')  as ex,
  coalesce(nullif(lower(btrim(q->>'difficulty')), ''), 'medium') as diff,
  nullif(btrim(q->>'exam_name'), '')            as exam_name,
  nullif(btrim(q->>'exam_year'), '')::smallint  as exam_year,
  nullif(btrim(q->>'source_title'), '')         as source_title,
  nullif(btrim(q->>'source_locator'), '')       as source_locator
from jsonb_array_elements($json$
[
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"Replace this sample question with your first real one.","option_a":"option one","option_b":"option two","option_c":"option three","option_d":"option four","correct_option":"a","explanation":"Replace this sample explanation too.","difficulty":"easy","exam_name":"40th BCS","exam_year":"2019","source_title":"Master","source_locator":"Page 1, Q-1"}
]
$json$::jsonb) as q;

-- ── STEP 2 · REPORT (prints only the bad rows; silent when clean) ───────────
select
  st as statement,
  array_remove(array[
    case when st is null or length(st) < 8 then 'Statement too short' end,
    case when a is null or a = '' or b is null or b = '' or c is null or c = ''
           or d is null or d = '' then 'Missing option' end,
    case when a = b or a = c or a = d or b = c or b = d or c = d then 'Duplicate options' end,
    case when co is null then 'Invalid correct_option' end,
    case when diff not in ('easy','medium','hard') then 'Invalid difficulty' end,
    case when ex is null then 'Missing explanation' end,
    case when exam_year is not null and exam_year < 1971 then 'Invalid exam_year' end
  ], null) as problems
from jh_in
where st is null or length(st) < 8
   or a is null or a = '' or b is null or b = '' or c is null or c = ''
   or d is null or d = ''
   or a = b or a = c or a = d or b = c or b = d or c = d
   or co is null or diff not in ('easy','medium','hard') or ex is null
   or (exam_year is not null and exam_year < 1971);

-- ── STEP 3 · STRICT VALIDATION ──────────────────────────────────────────────
do $$
declare bad int; dup int; empty int;
begin
  select count(*) into empty from jh_in;
  if empty = 0 then
    raise exception 'No questions in the payload. Import cancelled.';
  end if;

  select count(*) into bad from jh_in
  where st is null or length(st) < 8
     or a is null or a = '' or b is null or b = '' or c is null or c = ''
     or d is null or d = ''
     or a = b or a = c or a = d or b = c or b = d or c = d
     or co is null or diff not in ('easy','medium','hard') or ex is null
     or (exam_year is not null and exam_year < 1971);
  if bad > 0 then
    raise exception '% invalid questions found. Import cancelled.', bad;
  end if;

  select count(*) into dup from (
    select st from jh_in group by st having count(*) > 1
  ) d;
  if dup > 0 then
    raise exception '% duplicate statements found. Import cancelled.', dup;
  end if;
end $$;

-- ── STEP 4 · MAP subject → topic → subtopic ─────────────────────────────────
--  Matches title_bn or title_en, and only active topics/subtopics.
--  The guard t.subject_id = s.id keeps every question inside its own subject.
create temp table jh_rows as
select i.*, c.course_id, c.admin_id as _admin,
       s.id as subject_id, t.id as topic_id, sub.id as subtopic_id
from jh_in i
cross join jh_ctx c
left join subjects s
  on s.course_id = c.course_id
 and (lower(btrim(s.title_bn)) = lower(btrim(i.subject_title))
   or lower(btrim(s.title_en)) = lower(btrim(i.subject_title)))
left join topics t
  on t.subject_id = s.id
 and t.is_active
 and (lower(btrim(t.title_bn)) = lower(btrim(i.topic_title))
   or lower(btrim(t.title_en)) = lower(btrim(i.topic_title)))
left join subtopics sub
  on sub.topic_id = t.id
 and sub.is_active
 and (lower(btrim(sub.title_bn)) = lower(btrim(i.subtopic_title))
   or lower(btrim(sub.title_en)) = lower(btrim(i.subtopic_title)));

do $$
declare unmapped int; detail text;
begin
  select count(*) into unmapped from jh_rows
  where subject_id is null or topic_id is null
     or (subtopic_title is not null and subtopic_id is null);
  if unmapped > 0 then
    select string_agg(distinct
             coalesce('subject=' || subject_title, '?') || ' / topic=' ||
             coalesce(topic_title, '?') || ' / subtopic=' ||
             coalesce(subtopic_title, '-'), '; ')
      into detail
      from jh_rows
     where subject_id is null or topic_id is null
        or (subtopic_title is not null and subtopic_id is null);
    raise exception '% questions have unmatched subject/topic/subtopic: %. Import cancelled.',
      unmapped, detail;
  end if;
end $$;

-- ── STEP 5 · DEDUPE AGAINST THE EXISTING BANK ───────────────────────────────
create temp table jh_dedup as
select r.*
from jh_rows r
where not exists (
  select 1 from questions q
  where q.course_id = r.course_id
    and q.fingerprint = encode(sha256(convert_to(r.st, 'UTF8')), 'hex')
);

-- ── STEP 6 · IMPORT BATCH RECORD ────────────────────────────────────────────
create temp table jh_batch as select gen_random_uuid() as id;

insert into import_batches (
  id, created_by, filename, format, mode,
  total_rows, created_rows, failed_rows, duplicate_rows, errors
)
select b.id, c.admin_id, c.filename, 'json', 'commit',
       (select count(*) from jh_rows),
       (select count(*) from jh_dedup),
       0,
       (select count(*) from jh_rows) - (select count(*) from jh_dedup),
       '[]'::jsonb
from jh_batch b cross join jh_ctx c;

-- ── STEP 7 · INSERT ─────────────────────────────────────────────────────────
--  question_kind is hard-coded to 'practice' on purpose (see HARD RULES).
--  source_type 'previous' means "printed as a past-exam question in a book".
insert into questions (
  course_id, subject_id, topic_id, subtopic_id, statement,
  option_a, option_b, option_c, option_d, correct_option,
  explanation, difficulty,
  source, source_title, source_locator,
  source_type, status, is_verified,
  question_type, question_kind, fingerprint,
  exam_name, year, import_batch_id, created_by
)
select r.course_id, r.subject_id, r.topic_id, r.subtopic_id, r.st,
       r.a, r.b, r.c, r.d, r.co,
       r.ex, r.diff,
       coalesce(r.source_title, 'Imported'), r.source_title, r.source_locator,
       'previous', 'pending_review', false,
       'mcq', 'practice',
       encode(sha256(convert_to(r.st, 'UTF8')), 'hex'),
       r.exam_name, r.exam_year, b.id, r._admin
from jh_dedup r cross join jh_batch b
on conflict (course_id, fingerprint) do nothing;

-- ── STEP 8 · SUMMARY ────────────────────────────────────────────────────────
update import_batches
set created_rows = (select count(*) from questions
                     where import_batch_id = (select id from jh_batch))
where id = (select id from jh_batch);

select
  (select count(*) from jh_rows)                                  as planned,
  (select count(*) from jh_dedup)                                 as to_insert,
  (select count(*) from questions
    where import_batch_id = (select id from jh_batch))             as inserted_now,
  (select count(*) from jh_rows) - (select count(*) from jh_dedup) as skipped_existing;

commit;
