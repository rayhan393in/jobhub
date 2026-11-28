# BCS taxonomy V4 — one tree, classified questions

Applied to production on 2026-11-26 as
`supabase/migrations/20261219000000_bcs_taxonomy_unify.sql`.
**The migration file is the deliverable. This directory is how it was derived.**

## What changed in the database

| | before | after |
|---|---|---|
| topics (all) | 140 | **55** |
| topics `is_active = false` | 85 | **0** |
| subtopics (all) | 827 | **620** |
| questions with no topic | 2,112 | **669** |
| questions on a topic | 2,296 | **3,739** |
| duplicate topic titles | 0 | 0 |
| duplicate subtopic titles | 1 | **0** |
| `study_plan_assignments` | 544 | 546 |
| coverage gaps (`jh_coverage_unassigned`) | 0 | **0** |

## The three changes

1. **Deleted the retired placeholder branch** — 85 topics and their 208
   subtopics, all already `is_active = false` with
   `metadata.retired_by = 'bcs-syllabus-v2'`. Verified empty first (0 questions,
   0 links, 0 assignments, 0 progress, 0 frequency, 0 micro topics, 0 revision
   items, 0 ai generations); the migration re-checks and aborts instead of
   trusting that sentence.
2. **Collapsed the one duplicate subtopic** — geography had `নদ-নদী` twice, once
   under বাংলাদেশের ভূগোল and once under বিশ্ব ভূগোল. Both were empty.
3. **Classified 1,443 questions** by wording (rules below), each keeping
   `topic_id = null` when no rule matched.

## Why the rules live here and not in the SQL

`rules.py` is a list of `(order, subject, topic, subtopic, condition)`.
`emit_migration.py` turns it into SQL; nothing in the migration is hand-written
except the guards, comments and the two-subtopic insert. Regenerate with:

```sh
cd gen/taxonomy-v4 && python3 emit_migration.py
```

Then re-run `npx vitest run tests/db/bcs-taxonomy-unify.test.ts`.

Every rule target is resolved by normalised title at run time and the migration
raises if one is missing — that is how the two wrong names I had guessed
(`সূত্র`, `কোণ`) were caught: the real rows are `বীজগাণিতিক সূত্র` and
`রেখা ও কোণ`.

## Two things the first draft got wrong, found by running it

**A question can carry two primary links.** 101 production questions had two
`question_topic_links` rows with `is_primary = true` and `topic_id = null`. The
unique index is `(question_id, course_id, topic_id)` and Postgres treats NULLs
as distinct, so nothing rejected the duplicate — but the moment a backfill gave
both rows a real topic, the `jh_sync_primary_link` trigger collided and the
whole statement aborted with `23505`. The migration now keeps the newest link
per question and drops the rest.

**`jh_sync_primary_link` is the only writer for links.** My first draft also
inserted into `question_topic_links` manually after updating the questions. That
is redundant and, once the topics matched, a second duplicate. The trigger is an
`AFTER UPDATE` on `questions` and already rewrites or creates the primary link.

## What is NOT classified, and why that is deliberate

669 questions keep `topic_id = null`:

- 377 Bengali questions (writer / work / quotation / award identification
  spread across 16 author subtopics). A keyword cannot tell
  "রবীন্দ্রনাথের কোন রচনাটি…" from "নজরুলের…" reliably enough to file it.
- 174 maths rows whose wording carries no topic signal at all.
- 118 spread thinly over the other eight subjects (34 English, 26 science,
  16 Bangladesh, 14 international, 12 ICT, 6 geography, 5 ethics, 5 mental).

A wrong topic is worse than none: it puts the question into the wrong revision
list and into a routine day where it does not belong. 85% coverage with every
assignment correct beats 100% with a few hundred silently misfiled.

One thing worth knowing before trying to close the gap by re-running:

1. **Re-running the rules changes nothing.** The rules are exhaustively applied;
   every remaining row is one they do not match. 27 of the 669 *would* match if
   the subject were ignored — a Bengali literature question containing `ধারা`
   scores as "ধারার যোগফল", `বৃত্ত` in a history question scores as geometry.
   The migration's `t.subject_id = m.subject_id` predicate is what drops them.
   Never remove that predicate to "improve coverage".

To finish them, either extend `rules.py` (one row per pattern, regenerate,
re-test) or classify them in the admin question table.

## Naming decisions

Two subtopics your master list names did not exist in the live tree, so the
migration creates them under বাংলা ভাষা ও ব্যাকরণ:

- `পদ` (slug `pod`)
- `প্রয়োগ ও অপ্রয়োগ` (slug `prayog`)

Everything else reuses an existing row. That is why the subtopic count rose by
only 2 while 1,443 questions got a home.

The 55 topic titles are the existing syllabus titles, which are broader than the
master list's finer names (the list's `ঐকিক নিয়ম` / `গসাগু` / `শতকরা` are
subtopics under `পাটিগণিত` here). No topic was renamed: renaming would have
orphaned the questions, and the finer names already exist one level down.
