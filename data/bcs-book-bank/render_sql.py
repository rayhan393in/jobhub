#!/usr/bin/env python3
"""
Render the question rows into a single, idempotent SQL file.

Two things this deliberately does not do:

  * it does not approve anything. Nothing here was checked against an official
    BCS question paper, so every row lands as `draft` + `is_verified = false`
    and the sheet constraint that refuses an approved-but-unverified question is
    never skirted. The admin approves after reading the page reference.
  * it does not guess the course. Every id is looked up by name inside the
    course, so running it twice cannot double the bank (fingerprint is the
    statement hash, matching `questions_course_id_fingerprint_key`).
"""

import json

COURSE_ID = "599509ae-c4c3-440a-9463-802a4efc7a0c"

rows = json.load(open("data/bcs-book-bank/_rows.json", encoding="utf-8"))


def q(value: str) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def lit(value):
    """SQL literal, NULL when empty — an empty author is not an author."""
    if value is None or str(value) == "":
        return "null"
    return q(value)


header = f"""-- ---------------------------------------------------------------------------
-- JobHub — BCS book-based question bank (batch 01)
--
-- Source: the user's Drive books, transcribed page by page.
--   * Khairul's Advanced Math        (file 1ptOe2Ft038mQ3B1RepHUMNeBPB3SyLcS)
--   * Khairul Percentage / Profit-Loss combined notes
--   * BCS English Grammar — Tense, Right Form of Verbs, Conditionals
--
-- Honesty contract, stated up front because it decides what this file may feed:
--   * every row names its book and, where the book states one, its page;
--   * rows whose method comes from the notes but whose wording is ours carry
--     `official_paper_crosschecked = false` and say so in the locator;
--   * nothing is marked verified here. These are NOT official BCS past papers,
--     they are book exercises and textbook-recipe questions, so they must never
--     be counted as past-paper evidence by `jh_rebuild_frequency`.
--
-- Safe to re-run: questions are matched on the statement fingerprint, and
-- topics/subtopics are resolved by name inside the course.
-- ---------------------------------------------------------------------------
begin;

do $bcsbook$
declare
  v_course uuid := {q(COURSE_ID)};
  v_author uuid;
  v_subject uuid;
  v_topic uuid;
  v_subtopic uuid;
  v_created int := 0;
  v_skipped int := 0;
  r jsonb;
  v_rows jsonb := $rows$__ROWS__$rows$;
begin
  -- Attribution goes to an admin, but the import must not fail if the caller is
  -- running it by hand in the SQL editor with no session. Roles live in their
  -- own table, so the lookup joins it rather than reading a profile column.
  select p.id into v_author
    from public.profiles p
    join public.roles ro on ro.id = p.role_id
   where ro.name_en = 'super_admin'
   order by p.created_at
   limit 1;

  if v_author is null then
    select p.id into v_author from public.profiles p order by p.created_at limit 1;
  end if;

  for r in select value from jsonb_array_elements(v_rows) loop

    -- Subject and topic are resolved by name: hard-coded uuids would break the
    -- moment the syllabus is re-seeded, and an id from another course would be
    -- worse than no id at all.
    v_subject := null;
    v_topic := null;
    v_subtopic := null;

    select s.id into v_subject
      from public.subjects s
     where s.course_id = v_course and s.title_bn = r->>'subject_bn'
     limit 1;

    select t.id into v_topic
      from public.topics t
      join public.subjects s on s.id = t.subject_id
     where s.course_id = v_course
       and s.title_bn = r->>'subject_bn'
       and t.title_bn = r->>'topic_bn'
     limit 1;

    if v_topic is not null and coalesce(r->>'subtopic_bn', '') <> '' then
      select st.id into v_subtopic
        from public.subtopics st
       where st.topic_id = v_topic and st.title_bn = r->>'subtopic_bn'
       limit 1;
    end if;

    -- A statement already in the bank is skipped, not duplicated.
    if exists (
      select 1 from public.questions qq
       where qq.course_id = v_course
         and qq.fingerprint = encode(digest(btrim(r->>'statement'), 'sha256'), 'hex')
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    insert into public.questions (
      course_id, subject_id, topic_id, subtopic_id,
      statement, statement_bn, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year,
      status, is_verified,
      fingerprint, external_ref,
      source_title, source_locator, source_url, source_file_id,
      book_chapter, book_page, author, edition,
      exam_name, created_by
    ) values (
      v_course, v_subject, v_topic, v_subtopic,
      r->>'statement', nullif(r->>'statement_bn', ''),
      r->>'option_a', r->>'option_b', r->>'option_c', r->>'option_d',
      case upper(btrim(r->>'correct'))
        when 'A' then 0 when 'B' then 1 when 'C' then 2 when 'D' then 3
        when '0' then 0 when '1' then 1 when '2' then 2 when '3' then 3
      end,
      r->>'explanation',
      case when r->>'difficulty' in ('easy', 'medium', 'hard') then r->>'difficulty' else 'medium' end,
      (r->>'source_title') || ' — ' || (r->>'source_locator'),
      'manual',
      case when coalesce(r->>'exam_year', '') ~ '^[0-9]{{4}}$' then (r->>'exam_year')::smallint else null end,
      'draft', false,
      encode(digest(btrim(r->>'statement'), 'sha256'), 'hex'),
      'bcs-book-bank-01-' || lpad((v_created + v_skipped + 1)::text, 3, '0'),
      nullif(r->>'source_title', ''),
      nullif(r->>'source_locator', ''),
      nullif(r->>'source_url', ''),
      nullif(r->>'source_file_id', ''),
      nullif(r->>'book_chapter', ''),
      case when coalesce(r->>'book_page', '') ~ '^[0-9]+$' then (r->>'book_page')::int else null end,
      nullif(r->>'author', ''),
      null,
      nullif(r->>'exam_name', ''),
      v_author
    );
    v_created := v_created + 1;
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (v_author, 'questions.import', 'course', v_course::text,
          jsonb_build_object('batch', 'bcs-book-bank-01', 'created', v_created, 'skipped', v_skipped));

  raise notice 'bcs-book-bank-01: % created, % skipped as duplicates', v_created, v_skipped;
end;
$bcsbook$;

commit;
"""

rows_json = json.dumps(rows, ensure_ascii=False).replace("$rows$", "$rows $")
sql = header.replace("__ROWS__", rows_json)
open("data/bcs-book-bank/bcs-book-bank-questions.sql", "w", encoding="utf-8").write(sql)
print("sql written:", len(sql), "bytes")
print("rows:", len(rows))
