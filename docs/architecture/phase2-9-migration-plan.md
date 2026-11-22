# PROPOSED MIGRATION PLAN — PHASES 2–9 (AWAITING APPROVAL)
**JobHub — Hybrid Centralized Question Intelligence Architecture**
Status: **DRAFT — nothing below has been executed.** All migrations are **additive-only** (new tables, new columns, new views/functions). No row is deleted, no ID changes, no existing constraint is dropped.

---

## Design principle: "Hybrid" = course layer stays, master layer links

The existing course-scoped rows (`subjects`, `topics`, `subtopics` with their own display names and `sort_order`) **are kept exactly as they are** — they already serve as the per-course display/mapping layer the spec requires. The "central" layer is added *above* them via canonical links:

```
canonical_subjects (NEW)            canonical_topics (EXISTS, 28 rows)
        ▲                                   ▲
        │ subjects.canonical_subject_id     │ topics.canonical_id (EXISTS, unused)
        │ (NEW column, nullable)            │ (start wiring it)
   subjects (62, unchanged)            topics (438, unchanged)
        course-specific names, ordering, weight — preserved
```

**A "merge" = setting the same canonical id on 2+ course rows.** Nothing is deleted or repointed, so:
- every course keeps its own subjects/topics/display names/ordering (spec §Phase 2 ✔)
- BCS topic→subtopic hierarchy untouched (✔)
- rollback of any merge = set canonical id back to NULL (✔)
- same-name-different-concept rows simply get **different** canonical ids (✔)

## Phase 2 — Central Academic Taxonomy (migration `A_master_taxonomy.sql`)

Additive DDL:
1. `canonical_subjects` (id, slug, title_en, title_bn, description, created_at) — NEW.
2. `subjects.canonical_subject_id uuid NULL references canonical_subjects` — NEW column.
3. Extend `canonical_topics` with `canonical_subject_id uuid NULL`, `approval_status` — NEW columns.
4. `taxonomy_merges` audit table (id, kind subject|topic, canonical_id, member_ids uuid[], merged_by, merged_at, note, reverted_at) — merge log with rollback info.
5. View `v_canonical_topic_members`: canonical topic → all course topics linked to it (merge preview + impact).

Seeding (data, admin-approved, not automatic):
- Propose ~12 canonical subjects (বাংলা, English, গণিত/Quantitative, মানসিক দক্ষতা/Reasoning, বাংলাদেশ বিষয়াবলি, আন্তর্জাতিক, বিজ্ঞান, ICT, ভূগোল-পরিবেশ, নৈতিকতা, EEE-Core, General-GK) and link the obvious members found in the audit (§5a) — **as a reviewable seed file, applied only after you approve the mapping list**.
- Topic-level links only for the 35 duplicate-name groups **after per-group human decision** (merge list shipped as CSV for review; hazards from audit §5b default to "do NOT merge").

## Phase 3 — Central Question Bank (migration `B_question_links.sql`)

`questions` stays the single canonical record (IDs preserved; `unique(course_id, fingerprint)` kept).

Additive DDL:
1. `question_topic_links` (question_id, course_id, subject_id, topic_id, subtopic_id NULL, is_primary bool, created_at; unique(question_id, course_id, topic_id)) — lets ONE question appear in multiple courses/topics **without duplicating the row**. Existing single-placement columns on `questions` remain the "primary" link; a backfill inserts one `is_primary=true` link per existing question (pure copy, reversible).
2. Enable `pg_trgm`; expression index on `lower(statement)`.
3. `question_similarity` (question_id, similar_question_id, similarity numeric, kind exact|near|concept, status pending|confirmed|dismissed, detected_at) + nightly/`on-demand` function `jh_detect_similar_questions(threshold)` — cross-course **detection and reporting**, never auto-merge.
4. View `v_question_bank`: canonical question + all its course/topic placements + source + verification.

## Phase 4 — Previous-Year Evidence Engine (migration `C_evidence.sql`)

Reuses existing (currently empty) `question_frequency` and `source_documents` tables + existing `questions.exam_name/year/source_*` columns.

Additive DDL:
1. `evidence_records` — one row per *verified appearance* of a question in a real exam: (question_id, exam_name, exam_year, course_scope, original_text, source_document_id NULL, source_ref, match_kind exact|same_concept|related, verified_by, verified_at). A question asked in BCS-2019 *and* NTRCA-2022 = 2 evidence rows, 1 question.
2. View `v_topic_frequency`: per canonical topic & per course topic → count(distinct exam_name, exam_year) from **verified evidence only**.
3. View `v_evidence_coverage`: per course → % of previous-year questions having year, exam_name, source ref → drives the **missing-source warnings** in admin (today: 0.4% year coverage — the UI must show this honestly).
4. No invented data: all seeds empty; population happens through Admin verification workflow (Phase 8) + CSV import (existing `/admin/import` pipeline extended with evidence columns).

## Phase 5 — BCS Priority System (migration `D_priority.sql`)

1. `topic_priorities` (course_id, topic_id, canonical_topic_id, evidence_count, distinct_exam_years, frequency_score numeric, priority_level high|medium|low|insufficient_evidence, is_manual_override bool, computed_at) — recomputed by function `jh_recompute_topic_priorities()` from `v_topic_frequency` **only** (historical evidence; AI predictions are stored nowhere near this table).
2. Transparent formula (documented in function body): frequency_score = distinct exam-year appearances, normalized per course; level thresholds configurable in `system_settings`.
3. Cross-course relevance: a BCS-evidenced canonical topic boosts a sibling course topic **only if** that course topic is linked to the same canonical id (prevents broad-name false boosts — spec rule ✔). Priority raises practice-question *allocation weight* in the exam generator; each course's own paper structure stays authoritative.

## Phase 6 — AI Question Engine (app code + migration `E_ai_meta.sql`)

1. `ai_generations` (id, requested_by, course_id, topic_id, difficulty, model, prompt_ref, raw_output jsonb, created_at) — generation log.
2. Generated questions are inserted as `source_type='ai_assisted'`, `status='pending'`, `is_verified=false`, linked to `ai_generations.id` — **can never become `source_type='previous'`** (CHECK constraint: `source_type='previous' → requires evidence_records ≥ 1` enforced via trigger at verification time, or app-level guard + nightly audit view — I recommend trigger).
3. Pre-insert duplicate guard: fingerprint exact-match + `jh_detect_similar_questions` near-match ≥0.85 → generation rejected/flagged.
4. Uses existing Gemini integration (`GEMINI_MODEL=gemini-2.5-flash`), existing admin review queue (`question_reviews`).

## Phase 7 — Smart Exam Generator (app code, no schema change beyond above)

Selection pipeline for Daily/Weekly/Practice/Mock:
1. Filter: course → paper composition (existing `exam_papers.composition`) → topic pool.
2. Weight: `topic_priorities.frequency_score` (Phase 5) × difficulty mix (existing `difficulty_mix`) × user weak-topic boost (from `student_answers` accuracy per topic; `study_progress` table reused).
3. Repetition window: exclude question_ids appearing in this user's `exam_questions ∩ exam_attempts` within N days (N in `system_settings`, default 30) — falls back gracefully when the pool is small (shows "pool exhausted" instead of silently repeating).
4. Balanced coverage: round-robin across topics before random fill.

## Phase 8 — Admin Control Center (app code, incremental pages under existing `/admin`)

| Page | Function |
|---|---|
| Taxonomy Manager (extend existing) | master subjects/topics, pending-approval queue (187 waiting), canonical linking |
| **Merge Preview** | pick rows → shows affected questions/routines/exam counts (via `v_canonical_topic_members`) → confirm → writes `taxonomy_merges` → one-click revert |
| Duplicate Center | `question_similarity` queue: exact/near/concept with side-by-side diff, confirm/dismiss |
| Evidence Verifier | per question: add exam_name/year/source → creates `evidence_records`; coverage dashboard with missing-source warnings |
| Priority Config | view computed priorities + manual override + threshold settings |
| AI Review | pending `ai_assisted` questions with similarity flags, approve/reject (existing review flow reused) |
| Import/Export | existing CSV import extended with evidence + multi-topic columns; export per course/topic |

## Phase 9 — Validation (checklist run after each migration)

Automated script `docs/architecture/validation-queries.sql` re-runs audit §1–§9 and asserts:
- course count = 8, question count ≥ 462, all existing question IDs still present (snapshot compare), results/attempts/answers counts unchanged, 0 orphans, all new FKs valid, routines/leaderboard/PDF endpoints smoke-tested (`tsc` + build + manual URL checks).
- Deliverables: migration report, validation report, rollback instructions (below).

## Execution order & rollback

| Step | Migration | Rollback |
|---|---|---|
| 1 | `A_master_taxonomy.sql` | drop new tables/columns (`canonical_subjects`, `subjects.canonical_subject_id`, `taxonomy_merges`, views) — no existing data touched |
| 2 | `B_question_links.sql` | drop `question_topic_links`, `question_similarity`, views, extension index |
| 3 | `C_evidence.sql` | drop `evidence_records`, views |
| 4 | `D_priority.sql` | drop `topic_priorities`, function |
| 5 | `E_ai_meta.sql` | drop `ai_generations`, trigger |
| 6 | App code (PR) | git revert; DB unaffected |

Each migration is wrapped in a transaction, recorded in `schema_migrations`, and applied to production **only after you approve** this plan. Canonical/merge *data* changes additionally go through the Merge Preview UI with per-merge revert.

---

## ⚠️ Decisions needed from you before implementation

1. **Approve the additive schema plan above?** (Phases 2–5 migrations)
2. **Subject-level canonical mapping seed** — merge the 7 audit groups (বাংলা×4, English×4, গণিত×3, মানসিক দক্ষতা×3, সাধারণ জ্ঞান×2, বাংলাদেশ×2, আন্তর্জাতিক×2) + BCS variants (বাংলা ভাষা ও সাহিত্য → বাংলা, গাণিতিক যুক্তি → গণিত)? Or leave ALL linking to the admin UI?
3. **Topic-level merges** — auto-propose the 35 same-name groups as *pending* merge suggestions in admin (recommended), or pre-link the unambiguous ones (সমাস, সন্ধি, শতকরা…)?
4. **Evidence backfill** — the 71 existing `previous` questions lack exam/year. Backfill via admin UI one-by-one, or bulk CSV (I prepare the template)?
