# BCS Preliminary taxonomy — what the database actually contains

*Audit 2026-11-26 against `bozmbnelcokhbuumkdry`, course `bcs` =
`599509ae-c4c3-440a-9463-802a4efc7a0c`. Sections 1–5 are the read-only findings
that were used to decide the plan; **section 7 records what was then applied**.*

## 1. There is only ONE visible tree already

The "two parallel setups" I started from was wrong in an important way. There
are indeed 140 topic rows, but they split into:

| | topics | subtopics | `is_active` | questions | visible in UI |
|---|---|---|---|---|---|
| **Active tree** | 55 | 619 | **true** | **2,296** | yes |
| Retired placeholders | 85 | 208 | **false** | 0 | **no** |

The 85 retired rows carry `metadata = {"retired_by": "bcs-syllabus-v2"}` — they
were already retired by migration `20261214000000_bcs_preliminary_taxonomy.sql`,
which renamed them, set `is_active = false`, and re-pointed every link. **All 208
of their subtopics are `is_active = false` too**, and

```sql
select count(*) from subtopics st join topics t on t.id = st.topic_id
where t.is_active and st.is_active   -- 619
```

So the syllabus page, the routine sheet and the admin picker all read the same
55-topic tree. `src/lib/syllabus.ts` and `src/lib/queries.ts` filter
`.eq("is_active", true)` on every level, which is why the retired branch never
surfaces. **Students are not seeing two arrangements today.**

The retired rows are still valuable, though, and this is the finding that
changes the plan: **they hold the fine-grained topic names that your master list
uses.** `ঐকিক নিয়ম`, `গসাগু ও লসাগু`, `শতকরা`, `নৌকা ও স্রোত`, `এসিড ক্ষার লবণ`,
`কম্পিউটার পেরিফেরালস` — 26 of them under math alone. Your spec's math section
is a close descendant of this branch, not of the 6-topic active one.

## 2. The real gap is 2,112 untagged questions, not the topic count

| | questions |
|---|---|
| on a topic | **2,296** |
| `topic_id is null` | **2,112** |

And the untagged ones are not a random sample:

| source_type | null-topic questions | subjects |
|---|---|---|
| `ai_assisted` | **1,948** | math 982, bangla 962, science 9, english 8, bd 5, ict 1 |
| `previous` (real past-paper) | **164** | spread across all 10 subjects |

Only **164** are genuine BCS past questions sitting on no topic. The 1,948 are
bulk-generated and concentrated in exactly the two subjects where your spec's
tree diverges most from the live one.

## 3. Duplicates: one, and it is harmless

Checking normalised subtopic titles *within the active tree only*
(`jh_title_norm`, so matra/hasanta variants count as equal):

- topics repeating a title inside a subject: **0**
- **subtopics repeating a title inside a subject: exactly 1**

```
নদ-নদী  →  বাংলাদেশের ভূগোল   (0 questions, 0 links, 0 progress)
নদ-নদী  →  বিশ্ব ভূগোল        (0 questions, 0 links, 0 progress)
```

Both are empty, so it can be collapsed with no data loss.

## 4. Why I am not applying my transcription of your list as-is

I transcribed your master list into `gen/taxonomy-v4/data.py` (210 topics /
226 subtopics) before checking it against the live tree. Measured against what
is actually in the database, applying it would do real damage:

| subject | live active subtopics | my transcription | consequence of applying |
|---|---|---|---|
| math | 44 | 23 topics, mostly leaf | would orphan the 44 |
| bangla | 57 | 5 topics, 31 subs under one | would orphan ~40 |
| english | 47 | 30 leaf topics | would orphan all 47 |
| mental | 29 | 24 leaf topics | would orphan all 29 |
| bd | 80 | 22 topics | **80 subtopics hold questions** |

Those 619 subtopics are not decorative — they are the attachment points for
2,296 questions, 84 `study_plan_assignments` across 72 routines, and the
`topic_priorities` / `study_progress` rows that student progress hangs off. A
tree that dropped them would violate your own rule to **keep every existing
question**.

It would also *create* the duplication you forbade, because the live topics that
hold the questions would have to be recreated alongside the new ones.

## 5. What "one arrangement, nothing twice" can mean safely

The only shape that satisfies both of your constraints at once is:

> **The live 55 topics stay** (they hold the questions). Your master list is
> **merged into** them: matching topics are reused, your extra subtopics are
> added under the matching topic by normalised title, subtopics that already
> exist are not inserted again, and topics your list has that the live tree
> lacks are added. Nothing the list does not mention is deleted while it still
> holds a question.

That is a merge, not a replacement, and it is also what makes questions easy to
add — one canonical branch survives, so "which topic?" has exactly one answer.

## 6. Decisions taken (2026-11-26)

1. **The 85 retired topics** → delete permanently. Verified empty on every
   referencing table first; a guard in the migration re-checks and aborts.
2. **All 2,112 null-topic questions** → classify, not just the 164 past-paper
   ones. 1,948 of them are AI-generated math/bangla banks whose wording is
   regular enough to classify reliably.
3. **The transcription** → not applied. It diverged from the live tree in
   exactly the places that hold data, so the master list was used as *naming
   input* and merged into the live tree rather than replacing it.

## 7. What was applied

Migration `20261219000000_bcs_taxonomy_unify.sql`, derived from
`gen/taxonomy-v4/rules.py`. See `gen/taxonomy-v4/README.md` for the generation
and regeneration steps.

| | before | after |
|---|---|---|
| topics | 140 (85 retired) | **55, none inactive** |
| subtopics | 827 (208 retired) | **620** |
| questions on a topic | 2,296 | **3,739** |
| questions with no topic | 2,112 | **669** |
| duplicate topic titles (active) | 0 | **0** |
| duplicate subtopic titles (active) | 1 | **0** |
| first-study assignments | 544 | **546** |
| coverage gaps | 0 | **0** |

Integrity checks after the run: 0 questions on another subject's topic, 0
questions whose subtopic belongs to a different topic, 0 links with a null
topic, 0 orphan topic references.

### Two production bugs found by applying it

**101 questions carried two primary topic links.** The unique index is
`(question_id, course_id, topic_id)` and Postgres treats NULLs as distinct, so
duplicate primaries accumulated silently while `topic_id` was null. The moment a
classification filled both in, the `jh_sync_primary_link` trigger collided on
that index and the migration aborted. Fixed by keeping the newest link per
question. Wiping the 1,013 surplus rows from `question_topic_links` was the
prerequisite for the classification to land at all.

**Nothing else writes `question_topic_links` by hand.** The trigger already
syncs the primary link from the question row, so a manual insert afterwards
duplicates it.

### What is still open

**669 questions keep `topic_id = null`** — 377 Bengali (author / work /
quotation / award identification), 174 maths, and 118 spread over the other
eight subjects. Filing those needs either more `rules.py` entries or a human
pass in the admin question table. This is the honest remaining gap, not an
oversight: a wrongly filed question lands in the wrong revision list.

Of those 669, 27 would match a rule *if the rule's subject were ignored* — a
Bengali literature question containing the word `ধারা` scores as
"ধারার যোগফল", `বৃত্ত` in a history question scores as geometry. The
migration's `t.subject_id = m.subject_id` predicate drops exactly those, which
is why the count is 669 and not 642. Re-running the rules over the remaining
nulls therefore changes nothing; closing this gap needs new rules, not a rerun.

### A note on this file

`20261219000000_bcs_taxonomy_unify.sql` was applied to production, so it is now
immutable — `scripts/migrate.mjs` fingerprints every applied migration and
refuses to start when the file changes, even in a comment. Correcting the
header's expected counts here therefore broke a production build:

```
[migrate] edited after it was applied: 20261219000000_bcs_taxonomy_unify.sql
[migrate] Refusing to continue. Every migration must be immutable once applied.
```

The file was restored byte-for-byte; the corrected counts live in this document
and in `gen/taxonomy-v4/README.md`. If the migration ever needs a real change,
it is a new file, not an edit to this one.

## 8. Adding a question now

The tree is one subject → topic → subtopic path with no retired shadow behind
it, so a new question needs exactly three picks:

```sql
-- one row, four ids
insert into public.questions (
  course_id, subject_id, topic_id, subtopic_id, statement, option_a, option_b,
  option_c, option_d, correct_option, status, is_verified, fingerprint, source_type)
select c.id, s.id, t.id, st.id, 'প্রশ্ন…', 'ক', 'খ', 'গ', 'ঘ', 1,
       'draft', false, 'unique-fingerprint', 'ai_assisted'
  from public.courses   c  join public.subjects  s  on s.course_id = c.id and s.slug = 'bcs'
  join public.topics    t  on t.subject_id  = s.id and t.slug = '<topic-slug>'
  join public.subtopics st on st.topic_id   = t.id and st.slug = '<subtopic-slug>';
```

`jh_qtl_autolink` creates the primary `question_topic_links` row for you — do
not insert it by hand. The `(subject, topic, subtopic)` triple is now the only
choice on the syllabus, so "which topic?" has one answer.

To find the slugs:

```sql
select s.slug as subject, t.slug as topic, t.title_bn, st.slug as subtopic, st.title_bn
  from public.topics t join public.subjects s on s.id = t.subject_id
  left join public.subtopics st on st.topic_id = t.id
 where s.course_id = '599509ae-c4c3-440a-9463-802a4efc7a0c'
   and t.is_active and st.is_active
 order by s.sort_order, t.sort_order, st.sort_order;
```
