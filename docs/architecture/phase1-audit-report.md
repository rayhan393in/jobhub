# PHASE 1 — DATABASE AUDIT REPORT
**JobHub — Hybrid Centralized Question Intelligence Architecture**
Audited: 2026-11-21 · Supabase project `bozmbnelcokhbuumkdry` (production) · Read-only audit, no changes made.

---

## 1. Inventory (29 tables)

| Area | Tables | Rows |
|---|---|---|
| Taxonomy | `courses` (8), `subjects` (62), `topics` (438), `subtopics` (366), `canonical_topics` (28), `micro_topics` (0) | — |
| Question bank | `questions` (462), `question_reviews` (66), `question_frequency` (0), `source_documents` (0), `import_batches` (1) | — |
| Exam pipeline | `exam_schedules` (3), `exam_papers` (8), `exam_questions` (390), `exam_attempts` (6), `student_answers` (156), `results` (6) | — |
| Learning | `routines` (169), `routine_progress` (0), `study_progress` (0), `student_routines` (0), `bookmarks` (0) | — |
| Platform | `profiles`, `roles`, `permissions`, `role_permissions`, `audit_logs`, `system_settings`, `schema_migrations` | — |

**Key observation:** several tables the target architecture needs **already exist but are empty/unused**: `question_frequency` (evidence engine), `source_documents` (source verification), `canonical_topics` + `topics.canonical_id` (master taxonomy — 28 canonical rows exist, but **0 topics are linked**), `micro_topics`, `study_progress`.

## 2. Referential Integrity — ✅ CLEAN

All checks returned **0 problems**:

| Check | Result |
|---|---|
| Questions whose topic belongs to a different subject | 0 |
| Questions whose subject belongs to a different course | 0 |
| Questions whose subtopic belongs to a different topic | 0 |
| `exam_questions` → missing question | 0 |
| `student_answers` → missing question / missing attempt | 0 |
| `results` → missing attempt | 0 |
| Orphan topics (no subject) / orphan subtopics (no topic) | 0 |

No orphan records. No broken chains. **No destructive cleanup is needed.**

## 3. Question Bank State

| Course | Questions | Approved | Previous-year | AI-assisted |
|---|---|---|---|---|
| bcs | 455 | 437 | 71 | 300 |
| eee | 7 | 7 | 0 | 0 |
| other 6 courses | **0** | 0 | 0 | 0 |

- Duplicates by fingerprint: **0** within courses, **0** across courses (unique `(course_id, fingerprint)` enforced; fingerprint = md5 of normalized statement).
- Difficulty (bcs approved): 187 easy / 188 medium / 62 hard.
- `question_type` column exists; `archived_at` soft-delete exists.

## 4. Evidence / Source Metadata — ⚠️ CRITICAL GAP

| Metadata field | Populated |
|---|---|
| `year` | **2 / 462** (460 missing) |
| `exam_name` | **1 / 462** |
| `source_title` | 43 / 462 |
| `source_url` | 0 / 462 |
| `explanation` | 462 / 462 ✅ |

The 71 `source_type='previous'` questions are **not yet usable as evidence**: almost none carry exam name/year/source reference. The Previous-Year Evidence Engine (Phase 4) therefore starts from near-zero verified evidence. **Frequencies must NOT be invented** — the engine must display coverage warnings until real metadata is backfilled through admin verification.

## 5. Duplicate / Similar Taxonomy Names (candidates — NOT auto-merged)

### 5a. Subject names appearing in multiple courses (7 groups)

| Subject name | Copies | Courses |
|---|---|---|
| বাংলা | 4 | university-admission, government-jobs, primary-teacher, ntrca |
| English | 4 | university-admission, government-jobs, primary-teacher, ntrca |
| গণিত | 3 | government-jobs, primary-teacher, ntrca |
| মানসিক দক্ষতা | 3 | bcs, government-jobs, primary-teacher |
| সাধারণ জ্ঞান | 2 | primary-teacher, ntrca |
| বাংলাদেশ বিষয়াবলি | 2 | bcs, government-jobs |
| আন্তর্জাতিক বিষয়াবলি | 2 | bcs, government-jobs |

Note: BCS "বাংলা ভাষা ও সাহিত্য" vs others' "বাংলা", BCS "English Language & Literature" vs others' "English", BCS "গাণিতিক যুক্তি" vs "গণিত" are **same concept, different display names** — exactly what the master-taxonomy + course display-name layer must handle. University-admission "বাংলা" (literature-analysis oriented) overlaps only partially → map at topic level, not blanket subject merge.

### 5b. Topic names duplicated across courses: **35 name-groups**, top examples

সমাস ×5 · শতকরা ×5 · লাভ-ক্ষতি ×4 · কারক ও বিভক্তি ×4 · সন্ধি ×4 · Parts of Speech ×4 · সুদকষা ×3 · Tense ×3 · আন্তর্জাতিক বিষয়াবলি ×3 · সংখ্যা সিরিজ ×3 · সাম্প্রতিক ঘটনাবলি ×3 · জাতিসংঘ ×2 · পরিমিতি ×2 · বৃত্ত ×2 … (full list reproducible via audit SQL §8)

⚠️ Same-name-but-different-concept hazards found (must stay separate):
- university-admission **বৃত্ত** (higher-math circle equations) ≠ bcs **বৃত্ত** (mensuration basics) — related, not equivalent.
- eee **Digital Electronics → Number systems** ≠ bcs **সংখ্যা পদ্ধতি ও ডিজিটাল লজিক** — similar concept, different exam standard/level.
- মানসিক দক্ষতা topics overlap গণিত topics by name (শতকরা, গড়) but test different skills.

### 5c. Hierarchy depth inconsistency

- **bcs**: subjects → topics (137 approved+… of 438 total incl. 187 pending) → subtopics (366). Full 3-level. **Must be preserved as-is.**
- Other 7 courses: subjects → topics only (0 subtopics).
- `topics.approval_status`: 251 approved, **187 pending** (await admin review — these are the advanced-taxonomy seed topics).
- `canonical_topics` has 28 rows (subject_group'd) but no topic links yet → the master layer is scaffolded, never wired.

## 6. Exam / Results / Routines (working systems — do not disturb)

- Pipeline: `exam_schedules` → `exam_papers` (composition jsonb, difficulty_mix) → `exam_questions` (paper↔question, position, marks) → `exam_attempts` → `student_answers` → `results` (+ two-phase release functions `jh_get_attempt_review`, `jh_leaderboard`, `jh_release_due_results` — live).
- 60-day BCS routine live (167 active rows, 12 mocks), printable PDF routes live.
- 6 attempts / 6 results / 156 answers exist — **user progress must survive untouched**.

## 7. Risk Register

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | Blanket merging same-name subjects/topics destroys course-specific standards | HIGH | Merge = linking to canonical IDs only; never delete/repoint course rows; human-approved merge list |
| R2 | Changing `unique(course_id,fingerprint)` to global uniqueness breaks legitimate per-course variants | MED | Keep constraint; add cross-course similarity *detection* (report, not constraint) |
| R3 | Evidence engine shows fake confidence with 0.4% year coverage | HIGH | Coverage %, missing-source warnings, "insufficient evidence" states; no invented data |
| R4 | FK churn on `questions` breaks exam_questions/student_answers | HIGH | Question IDs are never changed; only additive link tables |
| R5 | 187 pending topics approved blindly pollutes taxonomy | MED | Keep approval queue; canonical-linking happens at approval time |

## 8. Reproducible audit SQL

All queries used for this report are additive/read-only and stored in `docs/architecture/audit-queries.sql`.

---

**Conclusion:** The database is healthy and already contains ~60% of the structural scaffolding the target architecture needs (canonical layer, frequency table, source documents, review log, import batches, soft delete, approval states). The upgrade can be done **100% additively** — no destructive migration is required. See `phase2-9-migration-plan.md` for the proposed plan awaiting approval.
