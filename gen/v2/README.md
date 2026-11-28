# BCS taxonomy V3 (P1–P4 master structure) — staged, not yet applied

Status: **staged / not applied to production.** Nothing in this folder is wired
into an npm script or a migration runner. `supabase/migrations/` does not
reference it.

## What V2 is (live today)

`20261214000000_bcs_preliminary_taxonomy.sql` replaced the 137 placeholder
topics with the "55 topics / 504 subtopics" outline, and it is **applied**:

| | live (verified 2026-11-27) |
|---|---|
| subjects | 10, marks 30/30/25/25/10/15/15/20/15/15 = 200 |
| topics | 55 active (+85 retired placeholders) |
| subtopics | 504 active |
| questions | 4408 |
| assignments | 685 |

Priorities in V2 are **P1/P2/P3 only** (`subtopics.metadata.priority`), and
`src/lib/syllabus.ts` types them as `"P1" | "P2" | "P3"`.

## What V3 changes

The user's 2026-11-27 "Master Topic & Subtopic Structure": **37 topics / 411
subtopics**, with a fourth priority class **P4 (তুলনামূলক কম অগ্রাধিকার)**.

- `data.py` — the source of truth (10 subjects, 37 topics, 411 subtopics, P1–P4).
- `render.py` — renders the replacement migration from `data.py`.
- `map.json` — 137 legacy-placeholder-slug → new-topic mapping.
- `split_live.py` — splits the rendered SQL into connector-sized chunks
  (`create temp … on commit drop` → persistent `jh_mig.*` tables, JSON-escaped
  byte budget, grouped seed inserts).
- `compact_live.py` — denser variant that ships a whole seed table via
  `string_to_array` payloads (7 files, largest 18,893 escaped bytes).

## Why it is staged and not applied

V3 retires all 55 V2 topics and relinks questions through `map.json`. That map
was written against the **137 placeholder** slugs (`topic-1`,
`parts-of-speech-1`, …), but production no longer has them — it has the 55 V2
topics, whose slugs carry a `P1-` prefix
(`P1-bangla-language-and-grammar-1`, `P1-modern-bangla-literature-3`, …).

Consequences if it were applied as-is:

- `jh_sub_claim` matches **0 rows** (no subtopic name overlap), so no V2
  subtopic is renamed and no priority is carried over;
- all 55 V2 topics get retired, including the 55 that hold **2296 questions**;
- `jh_link_map` matches almost none of the V2 slugs, so those questions fall
  back to topic-level on retired rows;
- every one of the 685 `study_plan_assignments` is deleted (all sit on rows
  that would be retired).

So before V3 can run it needs, at minimum:

1. a claim/link map built against the **55 V2 slugs** (keep the 137-entry map
   too, so the migration still works on a database replayed from scratch);
2. a content decision for Bangla: V2 has 4 topics, V3 has 5. The old
   `P1-modern-bangla-literature-3` holds 932 questions spanning Tagore,
   Nazrul, Michael, Bankim, Sarat, Rokeya, Jibanananda, Jasim, Sukanta — in V3
   those split into `rabindranath-tagore`, `kazi-nazrul-islam` and
   `other-literary-figures`. One legacy row can only become one new topic, so
   a subtopic-relocation step is needed to keep Tagore/Nazrul questions
   correctly filed;
3. an extended priority type in `src/lib/syllabus.ts` (`"P4"`), the P4 badge,
   and the "P1–P4 is study priority, not a 10th–50th BCS frequency audit"
   disclaimer that the spec requires on every surface that prints a priority;
4. a PGlite proof against a fixture of the **real** V2 tree (the existing
   `tests/db/fixtures/bcs-legacy-topics.tsv` is the 137-placeholder tree and
   cannot catch this class of bug — it is why the V3 replay passed in PGlite
   while being unsafe against production).

## Connector notes (learned the hard way)

- The Supabase `execute_query` MCP path mangles multi-byte box-drawing
  characters in comments — keep generated payload comments ASCII-only.
- Budget payloads in **JSON-escaped** bytes, not characters: Bengali costs 6
  escaped bytes per character. The usable ceiling is ~24 KB and the practical
  working ceiling ~19 KB.
- A single huge `values` statement cannot be split; group repeated prefixes
  (one `insert` per subject/topic) or use the `string_to_array` form.
- `create table jh_mig.x` (no `if not exists`) errors on replay — drop first,
  or skip a chunk whose table is already populated.
