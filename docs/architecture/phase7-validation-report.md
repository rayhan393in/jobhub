# Phase 7 — Final Validation Report

**Date:** 2026-11-21 · **Database:** prod Supabase (`bozmbnelcokhbuumkdry`) · **Branch:** `arena/b34c2a23-jobhub` (PR #7)

All changes in this phase are **additive and reversible**. No table was dropped or recreated, no row was deleted, no ID changed. Rollback script: `docs/architecture/rollback-20261124.sql`.

---

## 1. Before / after integrity

| Metric | Before (Phase 1 audit) | After | Verdict |
|---|---|---|---|
| Questions (total, non-archived) | 462 | 462 | ✅ unchanged |
| BCS questions (approved / previous / AI) | 455 (437 / 71 / 300) | 455 (437 / 71 / 300) | ✅ unchanged |
| EEE questions | 7 | 7 | ✅ unchanged |
| Exam attempts / user results | 6 | 6 | ✅ unchanged |
| Topics | 438 (251 approved + 187 pending) | 438 (187 still pending review) | ✅ unchanged |
| Courses / subjects | 8 courses | 8 courses | ✅ unchanged |

No existing constraint was dropped; the `UNIQUE (course_id, fingerprint)` and `correct_option 0–3` invariants are intact.

## 2. New infrastructure (migration `20261124000000_question_intelligence.sql`)

| Object | Kind | Purpose |
|---|---|---|
| `canonical_subjects`, `subjects.canonical_subject_id` | table + column | subject-level canonical layer (links made ONLY via Admin UI, per decision) |
| `canonical_topics.canonical_subject_id`, `.approval_status` | columns | topic canon metadata |
| `taxonomy_merges` | table | full audit log of every link decision (reason + affected counts + revert) |
| `question_topic_links` (+2 indexes) | table | central question bank: 462/462 questions back-filled, 1 primary link each |
| `question_similarity`, `jh_detect_similar_questions(numeric)` | table + fn | trigram duplicate detection (pg_trgm + GIN index) |
| `evidence_records` | table | one row per VERIFIED exam appearance; unique (question, exam, year) |
| `v_topic_frequency`, `v_question_bank`, `v_evidence_coverage`, `v_canonical_topic_members` | views | read models for frequency/coverage |
| `topic_priorities`, `jh_recompute_topic_priorities()` | table + fn | transparent, AI-free priority score |
| `ai_generations` | table | provenance for AI drafts |
| `jh_guard_previous_source()` + `trg_guard_previous` | trigger | a question cannot BECOME `source_type='previous'` without an evidence record |
| RLS | policies | enabled on all 7 new tables; read-only policies for app pages |

## 3. Topic mapping results

- **32 groups auto-linked** (rule R1: identical normalized Bangla/English title across job-prep basic-level courses — সমাস, সন্ধি, শতকরা, Parts of Speech, Tense ইত্যাদি), covering **83 topics → 60 canonical topics**. Each link is logged in `taxonomy_merges` (status `applied`) with reason and affected counts.
- **3 groups deliberately NOT linked** (status `proposed`, awaiting human review at `/admin/merges`): বিন্যাস ও সমাবেশ, বৃত্ত, সম্ভাবনা — same names but BCS basic-level vs university-admission উচ্চতর গণিত scope differs.
- **0 subject-level links seeded** — per decision, subjects are linked only manually via Admin UI.
- Rollback of any link = `canonical_id = null` (one click at `/admin/merges`, or the SQL in the rollback script).

## 4. Duplicate detection

`jh_detect_similar_questions(0.80)` found **13 similar pairs**, all within BCS:

- 1 true duplicate (similarity 1.00): *"What is the plural form of 'Ox'/'ox'?"* — flagged `pending`, NOT auto-deleted.
- 12 near-matches (0.80–0.92) that are **genuinely different questions** (e.g., ক-ধ্বনি vs হ-ধ্বনি; different number series) — left pending for human verdict.

Nothing was merged or removed automatically.

## 5. Evidence & frequency state (honest zeros)

- `evidence_records`: **0 rows** — no evidence has been verified yet, so **all 438 topic-priority rows read `insufficient_evidence`**, not "low".
- A view bug found during validation (LEFT-JOIN NULL counted as 1 exam-year, making zero-evidence topics look like "low" priority) was **fixed**; the system now structurally distinguishes *no data* from *zero frequency*.
- The 71 BCS previous-year questions are visible at `/admin/evidence` as **unverified-pending** until an admin records which exam/year each appeared in. Years/exam names are never inferred from question text.

## 6. New admin surfaces (this PR)

| Surface | Route | What it does |
|---|---|---|
| Evidence Verifier | `/admin/evidence` | per-question evidence add/delete; CSV bulk import with downloadable template (exam_name, exam_year, question, subject, topic, source_ref, source_url, option_a–d, correct_option, explanation, match_kind); dry-run validation before save; unmatched rows with full bodies become **draft** (unverified) questions routed to the review queue |
| Merge Review | `/admin/merges` | every canonical-link proposal with reason + affected records; approve / reject / revert (rollback) |

APIs: `/api/admin/evidence`, `/api/admin/merges` — both permission-gated (`question.review` / `taxonomy.manage`), origin-checked, service-role writes after auth.

## 7. Failed migrations & recovery

- Batch E failed twice on the `schema_migrations` ledger insert (`version` column doesn't exist; then `checksum NOT NULL`). Both attempts were single transactions and **rolled back cleanly**; the third attempt (filename + checksum) succeeded. Nothing partial was ever left in the database.

## 8. Course-wise distribution (unchanged by this phase)

| Course | Questions | Previous-year | Status |
|---|---|---|---|
| bcs | 455 | 71 (pending evidence) | live |
| eee | 7 | 0 | live |
| other 6 courses | 0 | 0 | awaiting verified source collection / approved AI drafts (Phase 6 — content work, not schema) |

Cross-course expansion now has its machinery (central bank links + canonical topics + evidence engine); **no BCS question was copied into any other course**.

## 9. How to roll everything back

```bash
# full schema rollback (drop-only, ordered):
psql "$SUPABASE_DB_URL" -f docs/architecture/rollback-20261124.sql
```

Data-level rollbacks (links, seeds) are documented inside that script as commented SQL; applied topic links can also be reverted one-by-one from `/admin/merges`.
