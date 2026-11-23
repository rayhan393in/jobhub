# QA Report — Evidence Verification & Merge System

**Date:** 2026-11-21 · **Scope:** `/admin/evidence`, `/admin/merges`, migration `20261124000000_question_intelligence.sql` · **DB:** prod Supabase `bozmbnelcokhbuumkdry` · **Branch:** `arena/b34c2a23-jobhub` (PR #7)

Test method: 3 layers —
1. **Unit tests** (`tests/unit/evidence-validate.test.ts`, 12 tests) against the exact CSV validation code the API runs (extracted to `src/lib/evidence/validate.ts` so production code == tested code).
2. **Database integration tests** (`tests/db/question-intelligence.test.ts`, 24 tests) on PGlite running the real migrations, with real role switching (`anon` / `authenticated` / `service_role`).
3. **Live checks** against prod: role-simulated RLS probes (read-only / transactional), privilege audits, HTTP authorization probes on a running server.

**Result: 200/200 automated tests green** (36 new + 164 pre-existing regression tests, incl. full exam flow). Production build + typecheck clean.

---

## 1. Functional test report

### A. Evidence Verifier

| Test | Result |
|---|---|
| Valid CSV row matching existing question → evidence only, no new question | ✅ pass |
| Missing exam name → row rejected with reason, never inferred | ✅ pass |
| Missing/invalid/out-of-range year (blank, `20X8`, 1950, 2150) → rejected; year inside question text is NOT picked up | ✅ pass |
| Missing source reference → allowed, stored as `null` (optional metadata) | ✅ pass |
| Duplicate row in one file (same question+exam+year) → rejected | ✅ pass |
| Same question in two different exams/years → two legitimate evidence rows | ✅ pass |
| DB unique constraint (question_id, exam_name, exam_year) rejects duplicates a second way | ✅ pass |
| Individual verification (per-question add form) → correct `evidence_records` row, `verified_by` = acting admin | ✅ pass (code path + DB constraints) |
| Bulk verification (CSV) → dry-run report first, commit second; per-row verdicts returned | ✅ pass |
| Unmatched row without options/answer → rejected, NOT auto-created | ✅ pass |
| Unmatched row with full body → **draft** question: `status='draft'`, `is_verified=false` | ✅ pass |
| Unverified question never appears as confirmed previous-year: RLS hides non-approved questions from students; guard trigger blocks `source_type→'previous'` without evidence | ✅ pass (both proven in DB tests) |
| Rejection (deleting an evidence record) does not delete the question | ✅ pass |
| Approval updates the correct records (evidence row + recompute only; question row untouched) | ✅ pass |
| All actions create audit logs | ✅ pass **after fix** (see §2) |

### B. Merge management

| Test | Result |
|---|---|
| Exact-match topic mapping (same normalized name) applies as canonical link only | ✅ pass |
| Same-name different-scope (BCS basic vs univ. উচ্চতর গণিত) is NOT auto-linked — stays `proposed` | ✅ verified in prod: 3 proposals (বৃত্ত, সম্ভাবনা, বিন্যাস ও সমাবেশ) untouched |
| Affected-record preview: member topics with course/subject/question/routine counts shown from `v_canonical_topic_members` | ✅ pass |
| Approve → links exactly the member_ids, zero question rows touched | ✅ pass |
| Reject → leaves every topic unlinked and intact | ✅ pass |
| Rollback (revert) → `canonical_id` cleared, topics/questions/FKs all preserved, merge row keeps full history (`reverted`) | ✅ pass |
| FK integrity after rollback: 0 orphaned `questions.topic_id` | ✅ pass |
| No unrelated merges: every one of the 32 applied groups has a single normalized title across members; subject-level mapping untouched (0 links, per decision) | ✅ verified in prod |
| Duplicate detection (`jh_detect_similar_questions`) reports pairs, never deletes/merges | ✅ pass (question count identical before/after) |

## 2. Failed test cases and fixes (all fixed, all re-tested)

| # | Failure found | Fix |
|---|---|---|
| F1 | **No audit logs** — evidence/merge APIs didn't write `audit_logs` (project convention) | Added `evidence.add/delete/bulk_import`, `merge.approve/reject/revert` audit entries with actor + details |
| F2 | **Migration broke the test harness** — in-file `schema_migrations` insert (table exists only in prod via migrate.mjs) | Removed from the file; `scripts/migrate.mjs` records the ledger row itself |
| F3 | **Migration not idempotent** — `create policy` without `drop policy if exists` would fail on re-run (migrate.mjs re-runs changed files) | All policies now drop-before-create; every statement idempotent |
| F4 | **Future questions invisible to the frequency engine** — backfill covered existing questions only; a question created after the migration had no `question_topic_links` row | New `trg_qtl_autolink` (insert) + `trg_qtl_sync` (placement edit) triggers; applied live; prod shows 0 questions without a primary link |
| F5 | **Default-privilege exposure** — Supabase granted anon/authenticated FULL rights (incl. `TRUNCATE`, which bypasses RLS) on all 7 new tables + `canonical_topics` | Revoked all; `authenticated` keeps SELECT only where policies intend it |
| F6 | **Admin views readable by anon via REST** — views run with owner rights, so `v_question_bank` (incl. correct answers) was exposed to the anon key | Revoked all view grants from anon/authenticated (service-role only) |
| F7 | **RLS not FORCED** on the new tables (+`micro_topics`, `schema_migrations`) — violates the project invariant in `tests/db/schema.test.ts` | `force row level security` everywhere; prod now has 0 unforced tables |
| F8 | **Missing service_role grants** in the migration file (prod worked only by default privileges; harness proved the gap) | Explicit `grant all … to service_role` for tables, views, functions |
| F9 | *(earlier, this phase)* zero-evidence topics read as "low" frequency | `FILTER (where er.id is not null)` fix in `v_topic_frequency`; regression-tested |

## 3. Database integrity report (prod, after all QA)

| Check | Value | Verdict |
|---|---|---|
| Questions | 462 (455 bcs / 7 eee), 0 archived changes | ✅ identical to pre-phase |
| Previous-year tagged | 71 (all still pending evidence) | ✅ unchanged |
| Question IDs / course FKs | 462/462 primary links intact; 0 orphaned topic FKs | ✅ |
| Courses | 8 | ✅ |
| Pending topics | **187** (user's figure was 184; DB has 187) — all still `pending`, **none auto-approved** | ✅ |
| Exam features | 2 published upcoming exams; 6 attempts + 6 results intact; `jh_get_attempt_review` / `jh_leaderboard` / `jh_release_due_results` present | ✅ |
| Merge audit | 32 applied + 3 proposed + full reasons; reversible | ✅ |
| Note | 71 of the 83 R1-linked topics are pending-approval topics — the canonical link does NOT approve them; taxonomy review still gates them | ℹ️ observation |

## 4. RLS & authorization test report

**Server-side (live HTTP, unauthenticated):**
- `POST /api/admin/evidence` → **401** · `POST /api/admin/merges` → **401** (auth checked before any parsing/DB work)
- Cross-origin forged POST → rejected (origin/host check after auth)
- `GET /admin/evidence`, `/admin/merges` → **307 → /login** (server redirect, not frontend hiding)
- Permissions: evidence requires `question.review`, merges `taxonomy.manage`; `student` role explicitly refused

**Database (prod role simulation + harness):**
- `anon`: SELECT/INSERT on `evidence_records` → `42501 permission denied`; all 4 admin views denied; zero write grants anywhere in `public`
- `authenticated`: can read `question_topic_links` (462) / `topic_priorities` (438) / `canonical_subjects` via read-only policies; INSERT on `evidence_records` → denied; writes on merges/priorities/links → denied
- even a **super_admin JWT** cannot write these tables directly — writes go only through the service role after the API's permission check
- `TRUNCATE` (not covered by RLS) revoked from client roles on **every** public table; RLS now enabled+forced on **all** public tables (0 unforced)

## 5. Evidence verification statistics (prod, current)

| Metric | Value |
|---|---|
| Previous-year tagged questions | 71 |
| With verified evidence | 0 (verification work not yet started) |
| Without evidence (shown "অযাচাইকৃত/পেন্ডিং") | 71 |
| Evidence records | 0 |
| Guard trigger active | yes — no question can newly become `previous` without evidence |
| Similar-question pairs flagged (pending human verdict) | 13 (1 true duplicate: Ox/ox) |

## 6. Merge rollback test results

- Approve→link→revert cycle executed in the integration suite: after revert, both member topics exist, `canonical_id` is `NULL`, question count and every `questions.topic_id` FK unchanged, merge row preserved as audit history (`status='reverted'`, `reverted_at` set).
- Live prod rollback path (`/admin/merges` → রোলব্যাক button) runs the same two UPDATE statements; nothing is deleted anywhere in the path.
- `docs/architecture/rollback-20261124.sql` additionally reverts the whole schema if ever needed.

## 7. Frequency Engine readiness status

**Status: READY — and deliberately NOT activated.**

- Frequency is defined **only** from `evidence_records` via `v_topic_frequency`, exposing exactly the required measures: verified question count (`evidence_count`), distinct exam count (`distinct_exams`), distinct exam years (`distinct_years` / `distinct_exam_years`), exact match count (`exact_matches`), similar-concept count (`concept_matches`).
- With 0 evidence records, **all 438 topic-priority rows read `insufficient_evidence`** — never zero-as-low, never a guessed "low". Tested: a topic with zero evidence shows `distinct_exam_years = 0`, and recompute can never score an evidence-less topic.
- Manual priority overrides survive recompute (tested).
- Activation is automatic and gradual: as verified evidence lands via `/admin/evidence`, `jh_recompute_topic_priorities()` (called after every evidence mutation) starts scoring only the topics that actually have evidence (≥1 exam-year → low, ≥3 → medium, ≥6 → high).

**Gate to real activation:** import verified evidence for the 71 BCS previous-year questions (CSV template or per-question form). Until then the engine correctly reports "তথ্য নেই".
