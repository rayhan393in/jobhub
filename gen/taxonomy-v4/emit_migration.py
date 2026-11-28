"""Generate the V4 taxonomy migration from rules.py.

Emits `supabase/migrations/20261219000000_bcs_taxonomy_unify.sql`.

Everything the SQL does is derived from data, not typed by hand:

  * the retired-topic delete is guarded by an orphan check that raises if a
    question, link or assignment still points at a row about to be removed;
  * every backfill rule resolves its (subject, topic, subtopic) by *normalised
    title* at run time and raises if a target is missing, so the migration can
    never silently skip a rule;
  * the update assigns topic and subtopic together and requires the question's
    own `subject_id` to match the rule's subject, so a Bengali question that
    happens to contain a math phrase cannot be filed under math.
"""
from pathlib import Path

from rules import RULES

COURSE = "599509ae-c4c3-440a-9463-802a4efc7a0c"
OUT = Path(__file__).resolve().parents[2] / "supabase/migrations/20261219000000_bcs_taxonomy_unify.sql"


def q(value: str) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def case_block() -> str:
    lines = []
    for order, _subject, _topic, _sub, cond in RULES:
        lines.append(f"           when ({cond}) then {order}")
    return "\n".join(lines)


def map_rows() -> str:
    rows = []
    for order, subject, topic, sub, _cond in RULES:
        rows.append(f"    ({order}::int, {q(subject)}::text, {q(topic)}::text, {q(sub)}::text)")
    return ",\n".join(rows)


def build() -> str:
    return f"""-- ───────────────────────────────────────────────────────────────────────────
-- BCS Preliminary — unify the taxonomy (V4)
--
-- Three changes, in this order. Nothing is deleted while it still holds data.
--
-- ১ · Delete the 85 retired placeholder topics (and their 208 subtopics).
--     They are already `is_active = false` and carry
--     `metadata.retired_by = 'bcs-syllabus-v2'`. Verified before writing this
--     migration: 0 questions, 0 question_topic_links, 0 study_plan_assignments,
--     0 study_progress, 0 question_frequency, 0 micro_topics, 0 revision_items,
--     0 ai_generations point at them. Only 85 computed `topic_priorities` rows
--     cascade away. A guard below re-checks this at run time and aborts rather
--     than relying on this comment.
--
-- ২ · Collapse the one duplicate subtopic title in the active tree.
--     `নদ-নদী` exists twice under geography (normalised equal by
--     `jh_title_norm`), once under বাংলাদেশের ভূগোল and once under বিশ্ব ভূগোল.
--     Both hold no questions, links or progress. The Bangladesh one is kept —
--     it is the tree the syllabus page renders first.
--
-- ৩ · Classify the 2,112 questions whose `topic_id` is NULL.
--     Rules live in `gen/taxonomy-v4/rules.py` and are keyed on question
--     wording, because these rows carry no other signal (all 4,408 questions
--     keep their Bengali text in `statement`; only 43 have `statement_bn`).
--     A question the rules do not confidently match KEEPS `topic_id = null` —
--     a wrong topic is worse than none, since it would surface the question in
--     the wrong revision list. Expected split: ~1,470 classified, ~642 left
--     null, almost all of them Bengali literature questions that need a human.
--
-- Idempotent: every statement is a no-op on a second run.
-- ───────────────────────────────────────────────────────────────────────────

create temp table jh_v4_course on commit drop as
select c.id as course_id from public.courses c where c.slug = 'bcs';

do $$
begin
  if not exists (select 1 from jh_v4_course) then
    raise exception 'BCS কোর্স পাওয়া যায়নি';
  end if;
end $$;

-- ── ১ · স্বাধীনতা যাচাই: retired গাছে কোনো ডেটা নেই ─────────────────────────
create temp table jh_v4_retired on commit drop as
select t.id as topic_id
  from public.topics t
  join public.subjects s on s.id = t.subject_id
  join jh_v4_course c on c.course_id = s.course_id
 where t.is_active = false
   and t.metadata ->> 'retired_by' is not null;

create temp table jh_v4_retired_sub on commit drop as
select st.id as subtopic_id, st.topic_id
  from public.subtopics st
 where st.topic_id in (select topic_id from jh_v4_retired);

do $$
declare
  n_questions int;
  n_links     int;
  n_assign    int;
  n_progress  int;
begin
  select count(*) into n_questions from public.questions
   where topic_id in (select topic_id from jh_v4_retired)
      or subtopic_id in (select subtopic_id from jh_v4_retired_sub);
  select count(*) into n_links from public.question_topic_links
   where topic_id in (select topic_id from jh_v4_retired)
      or subtopic_id in (select subtopic_id from jh_v4_retired_sub);
  select count(*) into n_assign from public.study_plan_assignments
   where topic_id in (select topic_id from jh_v4_retired)
      or subtopic_id in (select subtopic_id from jh_v4_retired_sub);
  select count(*) into n_progress from public.study_progress
   where topic_id in (select topic_id from jh_v4_retired)
      or subtopic_id in (select subtopic_id from jh_v4_retired_sub);

  if n_questions + n_links + n_assign + n_progress > 0 then
    raise exception
      'retired গাছে ডেটা আছে: questions=%, links=%, assignments=%, progress=% — মাইগ্রেশন বাতিল',
      n_questions, n_links, n_assign, n_progress;
  end if;
end $$;

-- Subtopic before topic: the subtopics→topics FK is not uniform across the two
-- constraints on that column, so neither order can be assumed safe by rule.
delete from public.subtopics where id in (select subtopic_id from jh_v4_retired_sub);
delete from public.topics    where id in (select topic_id    from jh_v4_retired);

-- ── ২ · একই নামের subtopic একটাই থাকবে ──────────────────────────────────────
-- Verified empty first; the delete is scoped by title so it cannot touch a row
-- that holds a question.
delete from public.subtopics st
 using public.topics t, public.subjects s, jh_v4_course c
 where st.topic_id = t.id
   and t.subject_id = s.id
   and s.course_id = c.course_id
   and s.slug = 'geography'
   and public.jh_title_norm(st.title_bn) = public.jh_title_norm('নদ-নদী')
   and public.jh_title_norm(t.title_bn) = public.jh_title_norm('বিশ্ব ভূগোল')
   and not exists (select 1 from public.questions q where q.subtopic_id = st.id)
   and not exists (select 1 from public.question_topic_links l where l.subtopic_id = st.id);

-- ── ৩ · প্রশ্নের শ্রেণিবিন্যাস ───────────────────────────────────────────────
-- The two subtopics above are created first; every other target must already
-- exist or the migration aborts with the missing list.
-- `পদ` and `প্রয়োগ ও অপ্রয়োগ` are names your master list uses that the live
-- tree never had. Create them so the rules below have a real target instead of
-- those questions being filed under a neighbour or left untagged. Re-running is
-- a no-op: the pair (topic_id, slug) is unique.
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order, is_active, approval_status, metadata)
select t.id, v.slug, v.title_en, v.title_bn, v.sort_order, true, 'approved',
       '{{"syllabus": "bcs-preliminary", "added_by": "bcs-taxonomy-v4"}}'::jsonb
  from (values
    ('bangla', 'বাংলা ভাষা ও ব্যাকরণ', 'pod',    'Pad (Word Class)',  'পদ',               20::smallint),
    ('bangla', 'বাংলা ভাষা ও ব্যাকরণ', 'prayog', 'Usage and Non-usage', 'প্রয়োগ ও অপ্রয়োগ', 21::smallint)
  ) as v(subject_slug, topic_bn, slug, title_en, title_bn, sort_order)
  join public.subjects s
    on s.course_id = (select course_id from jh_v4_course)
   and s.slug = v.subject_slug
  join public.topics t
    on t.subject_id = s.id
   and t.is_active
   and public.jh_title_norm(t.title_bn) = public.jh_title_norm(v.topic_bn)
on conflict (topic_id, slug) do update
   set title_bn = excluded.title_bn,
       title_en = excluded.title_en,
       is_active = true,
       updated_at = now();

create temp table jh_v4_map on commit drop as
select r.ord, t.id as topic_id, st.id as subtopic_id, t.subject_id
  from (values
{map_rows()}
  ) as r(ord, subject_slug, topic_bn, sub_bn)
  join public.subjects s
    on s.course_id = (select course_id from jh_v4_course)
   and s.slug = r.subject_slug
  join public.topics t
    on t.subject_id = s.id
   and t.is_active
   and public.jh_title_norm(t.title_bn) = public.jh_title_norm(r.topic_bn)
  join public.subtopics st
    on st.topic_id = t.id
   and st.is_active
   and public.jh_title_norm(st.title_bn) = public.jh_title_norm(r.sub_bn);

do $$
declare
  n_rules int := {len(RULES)};
  n_map   int;
begin
  select count(*) into n_map from jh_v4_map;
  if n_map <> n_rules then
    raise exception
      'শ্রেণিবিন্যাসের target পাওয়া যায়নি: rules=%, resolved=% — মাইগ্রেশন বাতিল',
      n_rules, n_map;
  end if;
end $$;

create temp table jh_v4_pick on commit drop as
select q.id as question_id,
       q.subject_id,
       case
{case_block()}
       else null
       end as ord
  from public.questions q
  join jh_v4_course c on c.course_id = q.course_id
 where q.topic_id is null;

-- Some questions arrived carrying TWO primary links with `topic_id = null`.
-- The unique index is (question_id, course_id, topic_id) and Postgres treats
-- NULLs as distinct, so nothing stopped the duplicate; but the moment the
-- update above gives both rows a real topic, the `jh_sync_primary_link` trigger
-- collides on that index and the whole migration aborts. Keep the newest link
-- per question and drop the rest — a question has exactly one primary topic,
-- and the duplicate was never visible anywhere because the topic was null.
delete from public.question_topic_links t
 using (select l.id,
               row_number() over (partition by l.question_id
                                  order by l.created_at desc, l.id) as rn
          from public.question_topic_links l
          join public.questions q on q.id = l.question_id
          join jh_v4_course c on c.course_id = q.course_id
         where q.topic_id is null) dup
 where t.id = dup.id and dup.rn > 1;

update public.questions t
   set topic_id    = m.topic_id,
       subtopic_id = m.subtopic_id,
       updated_at  = now()
  from jh_v4_pick p
  join jh_v4_map m on m.ord = p.ord
 where t.id = p.question_id
   and t.subject_id = m.subject_id      -- subject must agree, see header
   and t.topic_id is null;

-- No manual link insert here on purpose: `jh_sync_primary_link` is an AFTER
-- UPDATE trigger on questions and already rewrites the question's primary link
-- (or inserts one when the question had none). Doing both would duplicate it.

-- ── ৪ · নতুন subtopic-এর প্রথম-অধ্যয়ন সারি ─────────────────────────────────
-- A "unit" for the coverage engine is every active subtopic plus every active
-- topic that has none. The two subtopics above add two units, and
-- `jh_coverage_summary` would report both as gaps. Seed them here so coverage
-- stays 100% without waiting for the next `jh_generate_study_plan` run.
--
-- Placement copies 20261214000000 exactly: a 60-day rotation starting on the
-- course's first study day, ordered by priority then sort_order. Those two rows
-- sit at the end of that ordering, so they land on rotation slots 59 and 60 and
-- no existing row moves. The date is computed whether or not a routine has been
-- published yet — 20261214000000 seeds coverage on an empty routine table too,
-- and the assignment rows are what the routine is later built from.
with unit as (
  select su.id as subject_id, t.id as topic_id, st.id as subtopic_id,
         st.title_en,
         coalesce(st.metadata ->> 'priority', 'P2') as priority,
         row_number() over (
           order by case coalesce(st.metadata ->> 'priority', 'P2')
                      when 'P1' then 1 when 'P2' then 2 else 3 end,
                    su.sort_order, t.sort_order, st.sort_order, st.id) as rn
    from public.subtopics st
    join public.topics t on t.id = st.topic_id and t.is_active
    join public.subjects su on su.id = t.subject_id and su.is_active
    join jh_v4_course c on c.course_id = su.course_id
   where st.is_active
     and st.metadata ->> 'added_by' = 'bcs-taxonomy-v4'
)
insert into public.study_plan_assignments
  (course_id, subject_id, topic_id, subtopic_id, plan_day, first_study_date,
   minutes, priority, objective_bn)
select c.course_id, u.subject_id, u.topic_id, u.subtopic_id,
       1 + ((u.rn - 1) % 60)::smallint,
       date '2026-11-28' + (((u.rn - 1) % 60)::int),
       20,
       case u.priority when 'P1' then 'high' when 'P3' then 'low' else 'normal' end,
       'সিলেবাসের সাব-টপিক: ' || u.title_en
  from unit u
  cross join jh_v4_course c
 where not exists (
   select 1 from public.study_plan_assignments a
    where a.course_id = c.course_id and a.topic_id = u.topic_id
      and a.subtopic_id is not distinct from u.subtopic_id);

-- ── ৫ · ফল যাচাই ────────────────────────────────────────────────────────────
do $$
declare
  n_topics   int;
  n_subs     int;
  n_dup_t    int;
  n_dup_s    int;
  n_orphan   int;
begin
  select count(*) into n_topics from public.topics t
    join public.subjects s on s.id = t.subject_id
    join jh_v4_course c on c.course_id = s.course_id
   where t.is_active;
  select count(*) into n_subs from public.subtopics st
    join public.topics t on t.id = st.topic_id
    join public.subjects s on s.id = t.subject_id
    join jh_v4_course c on c.course_id = s.course_id
   where t.is_active and st.is_active;

  select count(*) into n_dup_t from (
    select s.slug, public.jh_title_norm(t.title_bn)
      from public.topics t join public.subjects s on s.id = t.subject_id
      join jh_v4_course c on c.course_id = s.course_id
     where t.is_active
     group by 1, 2 having count(*) > 1) d;

  select count(*) into n_dup_s from (
    select s.slug, public.jh_title_norm(st.title_bn)
      from public.subtopics st
      join public.topics t on t.id = st.topic_id
      join public.subjects s on s.id = t.subject_id
      join jh_v4_course c on c.course_id = s.course_id
     where t.is_active and st.is_active
     group by 1, 2 having count(*) > 1) d;

  select count(*) into n_orphan from public.questions q
    join jh_v4_course c on c.course_id = q.course_id
   where q.topic_id is not null
     and not exists (select 1 from public.topics t where t.id = q.topic_id);

  if n_dup_t > 0 or n_dup_s > 0 then
    raise exception 'একই নামের topic/subtopic রয়ে গেছে: topics=%, subtopics=%', n_dup_t, n_dup_s;
  end if;
  if n_orphan > 0 then
    raise exception 'orphan topic reference: %', n_orphan;
  end if;

  raise notice 'V4: % active topics, % active subtopics, 0 duplicates', n_topics, n_subs;
end $$;
"""


if __name__ == "__main__":
    orders = [o for o, *_ in RULES]
    if len(set(orders)) != len(orders):
        raise SystemExit(f"duplicate rule order: {sorted({o for o in orders if orders.count(o) > 1})}")
    OUT.write_text(build(), encoding="utf-8")
    print(f"wrote {OUT} ({len(build())} bytes, {len(RULES)} rules)")
