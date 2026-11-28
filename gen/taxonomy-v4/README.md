# BCS Preliminary — Master taxonomy V4 (single canonical tree)

The user's 2026-11-28 spec, transcribed verbatim. **This file is the source of
truth** for the canonical BCS Preliminary subject → topic → subtopic tree; the
migration generated from it only transports it into Postgres.

> **STATUS: NOT APPLIED — blocked on decisions.** See
> `docs/bcs-taxonomy-audit-2026-11-26.md`. This transcription was written from
> memory of the master list and diverges from the live tree (math 23 vs 44
> subtopics, bangla 31 vs 57). It must be re-diffed against the user's actual
> text before any migration is generated from it.

## Why V4 exists

Before V4 the database carried **two parallel taxonomies** for the same course:

| | topics | subtopics | questions attached |
|---|---|---|---|
| V2 (55 tagged, `metadata.priority` P1–P3) | 55 | 619 | 2,296 |
| retired placeholders (`is_active = false`) | 85 | 208 | **0** |

The retired branch is already `is_active = false` at every level, so readers do
not see it — there is **one** visible tree today, not two. V4's job is therefore
to merge the master list *into* the live tree, not to replace it.

## Rules applied by the migration

1. **One tree.** After V4 the course has exactly the V4 topics; the 85 legacy
   placeholders are deleted (they hold no questions, no assignments, no
   progress — verified before the delete).
2. **Existing rows are reused, never duplicated.** A V4 topic claims the V2 topic
   that already holds the same concept, matched by a normalized-title map
   (`map_v2.py`) and, failing that, by subtopic overlap. The claimed row keeps
   its uuid, so its questions, `question_topic_links` and
   `study_plan_assignments` survive untouched.
3. **Subtopics merge by title.** A V4 subtopic whose normalized name already
   exists under the claimed topic keeps the existing row. New names are
   inserted. Existing subtopics that are not in the V4 list are retained
   (deactivated only if empty) so their questions keep a home.
4. **`subtopics = null` stays null.** Where the spec gives a topic with no
   sub-list, the topic is created with **no** subtopics. Nothing is invented.
5. **No duplicates.** A topic title appears once per subject; a subtopic title
   appears once per topic. The generator asserts this on load
   (`assert_no_duplicates()`), and the migration is idempotent on re-run.
6. **Easy question entry.** V4 leaves one obvious path — course → subject →
   topic → subtopic — so adding a question only ever needs a pick from that
   tree. The legacy placeholder branch, which made "which topic?" ambiguous,
   is gone.

## Shape

`DATA = [(subject_slug, [(topic_bn, None | [(subtopic_bn, priority)])])]`

`priority` is the spec's P1–P4 **study-priority** classification, not a verified
question-frequency ranking — the migration header and the UI both say so.
Subtopics inherit their priority from the level they were listed under.

Subjects keep their existing `sort_order` and `weight` (marks 30/30/25/25/10/
15/15/20/15/15 = 200), so nothing about marks changes here.
