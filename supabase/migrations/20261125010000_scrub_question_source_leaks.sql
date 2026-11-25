-- 20261125 — Remove collection-source leakage from student-facing question text.
--
-- Context: imported batches had provenance appended inside `explanation`
-- ("উৎস: EduHive — … PDF রিস্টার … Admin review প্রয়োজন", AI-project tails,
-- "[প্রা.শি.নি.প. ২০১৫, পৃ. ৪]" citation brackets in `statement`). Students must
-- never see where a question came from; the true source lives in
-- `questions.source` (admin-only) and exam attribution stays in
-- `exam_name`/`year`, which students may see.
--
-- This migration is idempotent: it only rewrites text that still carries the
-- leak markers. It never touches `status`, `is_verified`, `exam_name` or `year`.
--
-- Audit trail: rows affected were snapshotted into
-- public.qa_backup_20261125_question_text (RLS on, no anon/authenticated grants).

-- 1) Strip citation brackets and provenance tails; collapse whitespace.
with cleaned as (
  select q.id,
         btrim(regexp_replace(regexp_replace(q.statement, '\s*\[[^\]]*\]', '', 'g'),
                              '\s+', ' ', 'g')) as new_statement,
         btrim(regexp_replace(regexp_replace(regexp_replace(q.explanation,
                               '\s*(উৎস\s*:|AI-জেনারেটেড|Bd\.Job\.House|EduHive|AjkerBongo).*$', '', 's'),
                               '\s*—\s*$', ''), '^\s*—\s*', '')) as new_explanation
  from public.questions q
  where q.explanation ~ 'উৎস\s*:|AI-জেনারেটেড|Bd\.Job\.House|EduHive|AjkerBongo'
     or q.statement    ~ '\[|পৃষ্ঠা'
)
update public.questions q
set statement   = c.new_statement,
    explanation = c.new_explanation
from cleaned c
where q.id = c.id
  and (q.statement is distinct from c.new_statement
       or q.explanation is distinct from c.new_explanation);

-- 2) Preserve the stripped provenance in the admin-only `source` column so no
--    citation is lost. (Run against the backup snapshot when present.)
do $$
begin
  -- Dynamic SQL on purpose: if the statement were written inline, PL/pgSQL
  -- would resolve public.qa_backup_… when it parses this block, and a fresh
  -- database (CI, a new environment) would fail with 42P01 before the guard
  -- could ever run.
  if to_regclass('public.qa_backup_20261125_question_text') is not null then
    execute $restore$
      with src as (
        select b.id,
               btrim(regexp_replace(substring(b.explanation from '(উৎস\s*:.*)$'), '\s+', ' ', 'g')) as prov,
               (regexp_match(b.statement, '\[([^\]]*)\]'))[1] as stmtref
        from public.qa_backup_20261125_question_text b
      )
      update public.questions q
      set source = nullif(btrim(
            coalesce(btrim(q.source), '') ||
            case when length(coalesce(s.prov, '')) > 0 and position(s.prov in coalesce(q.source, '')) = 0
                 then E'\n' || s.prov else '' end ||
            case when length(coalesce(s.stmtref, '')) > 0 and position(s.stmtref in coalesce(q.source, '')) = 0
                 then E'\nউদ্ধৃতি-সূত্র: [' || s.stmtref || ']' else '' end), '')
      from src s
      where q.id = s.id
    $restore$;
  end if;
end $$;

-- 3) Provenance brackets that survived the tail-strip (math worked solutions).
update public.questions
set explanation = btrim(regexp_replace(explanation, E'\n?\s*\[মূল নোটের সমাধান[^\]]*\]', '', 'g'))
where position('মূল নোটের সমাধান' in explanation) > 0;

-- 4) Rows the import machine-damaged so badly they were unanswerable:
--    a) identical option text repeated across slots;
--    b) a key that was re-pointed at a misspelled distractor when the options
--       were rewritten (the answer slot moved, correct_option did not).
--    Each statement below is guarded by the option text it expects, so it is a
--    no-op on databases that were never damaged.
update public.questions set option_a='কৃষিজিবি', option_b='কৃষিজীবী', option_c='কৃষীজিবি', option_d='কৃষীজীবী'
 where id in ('0b253da0-93e5-4472-8754-50a0dd3ed95c','12e09aaf-2796-401f-800d-a1a3e1ac617f')
   and option_a = option_b;
update public.questions set correct_option = 1
 where id in ('0b253da0-93e5-4472-8754-50a0dd3ed95c','12e09aaf-2796-401f-800d-a1a3e1ac617f')
   and option_b = 'কৃষিজীবী' and option_b <> option_d;

update public.questions set option_a='দুস্প্রাপ্য', option_b='দূষ্প্রাপ্য', option_c='দুঃপ্রাপ্য', option_d='দুষ্প্রাপ্য'
 where id in ('1ad717eb-467f-4bf3-ae74-7b4f14b348b5','bb8c3b53-b0cd-47bf-b2a6-1cff1670ebc5')
   and option_d = option_c;
-- 'প্র'-ফলা যুক্ত হলে বিসর্গ অক্ষুণ্ন থাকে, তাই শুদ্ধ রূপ দুঃপ্রাপ্য (তুলুন: দুঃখ, দুঃসাহস)।
update public.questions set correct_option = 2
 where id in ('1ad717eb-467f-4bf3-ae74-7b4f14b348b5','bb8c3b53-b0cd-47bf-b2a6-1cff1670ebc5')
   and option_c = 'দুঃপ্রাপ্য';

update public.questions set option_a='ক্ষীণজিবি', option_b='ক্ষিণজীবী', option_c='ক্ষীনজীবী', option_d='ক্ষীণজীবী'
 where id in ('8deac4da-f514-481b-99f3-8230a4e5d5dd','f4f91762-7256-4cf8-ba43-c8f2df26d5bc')
   and option_c = option_d;
update public.questions set option_a='কনিষ্ঠ', option_b='কণিষ্ঠ', option_c='কনিস্ট', option_d='কণিন্ঠ'
 where id in ('8ec1dcc1-23a7-409b-9bcb-041963ae1233','aadeaeef-0e59-429d-aa52-522aaf7a9361')
   and option_a = 'কনিষ্ঠ' and option_d = 'কণিন্ঠ';

-- 5) Wrong key: দন্ত্য 'ন' never becomes মূর্ধন্য 'ণ' before ত-বর্গ.
update public.questions set correct_option = 2
 where id in ('345f9648-ef9a-447d-b131-d27757ab4f6e','76abdbe7-7ace-4366-8680-d860c5d447ca')
   and option_c = 'ত বর্গের আগে';

-- 6) Malformed stem + duplicate distractor for the ষ-ণ (দূষণীয়) item.
update public.questions set statement = 'কোন বানানটি শুদ্ধ?', correct_option = 2
 where id in ('94842d60-ffba-478b-81ce-8ea7162b04b0','a7c1f608-c7ab-4505-8e9c-ed6546d1001e');
update public.questions set option_d = 'দুষণীয়'
 where id in ('94842d60-ffba-478b-81ce-8ea7162b04b0','a7c1f608-c7ab-4505-8e9c-ed6546d1001e')
   and option_d = option_b;
update public.questions set option_a = 'দুষণীয়'
 where id in ('94842d60-ffba-478b-81ce-8ea7162b04b0','a7c1f608-c7ab-4505-8e9c-ed6546d1001e')
   and option_a = 'দূরণীয়';

-- 7) Separator hygiene: the bulk appends used " — " mid-sentence.
update public.questions
set explanation = regexp_replace(explanation, '^(.*[^।]) — ', E'\\1। ')
where position(' — ' in explanation) > 0
  and position('। — ' in explanation) = 0
  and position('. — ' in explanation) = 0;

-- 8) The pre-scrub snapshot public.qa_backup_20261125_question_text exists only
--    in the production project where it was taken. It is deliberately not
--    touched here: this migration must apply cleanly to a fresh database
--    (CI, staging), so every reference to it stays inside the to_regclass
--    guard above.
