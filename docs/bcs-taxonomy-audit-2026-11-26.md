# BCS Preliminary taxonomy — what the database actually contains

*Read-only audit, 2026-11-26. Every figure below was queried live against
`bozmbnelcokhbuumkdry`, course `bcs` = `599509ae-c4c3-440a-9463-802a4efc7a0c`.
No data was modified.*

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

## 6. Decisions I need from you

1. **The 85 retired topics.** They hold no questions, but they are the only
   copy of the fine-grained naming your list uses. Delete them permanently, or
   keep them (invisible, `is_active = false`) as the source I map your list from?
2. **The 1,948 AI-assisted untagged questions** (982 math, 962 bangla).
   Classify them too, or leave `topic_id` null and only classify the 164 past
   questions?
3. **My transcription.** `gen/taxonomy-v4/data.py` was written from memory of
   your message and clearly diverges for math and bangla. If you still have the
   text, paste it again and I will diff it against this file before generating
   any SQL.

No migration will be written until these are answered — the change is
irreversible in the direction that matters (a dropped subtopic takes its
questions' classification with it).
