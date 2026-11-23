# JobHub — Full Site Audit (2026-11-21)

Scope: repository & build health, automated test suite, live Supabase database
(security + data integrity), live Vercel deployment, and anonymous-access
probes of every API route and protected page. Two issues were found and
**fixed during the audit** (details below).

## Verdict

| Area | Result |
|---|---|
| Build (`next build`) | ✅ clean |
| Typecheck (`tsc --noEmit`) | ✅ clean |
| Test suite | ✅ 237/237 (18 files; unit + in-process Postgres harness) |
| Lint | ⚠️ 12 pre-existing `setState`-in-effect warnings, none in new code |
| RLS | ✅ enabled **and forced** on all 39 public tables |
| Table privileges | ✅ admin-only tables have zero client grants |
| Views | ✅ none readable by anon/authenticated |
| Function privileges | ✅ **fixed this audit** — anon: 33 → 2 functions |
| Data integrity | ✅ 15/15 checks zero defects |
| Migrations | ✅ 18 repo files == 18 ledger rows, checksums recorded |
| Anonymous probes | ✅ 13 API routes → 401; 8 protected pages → 307; public pages → 200 |
| Production deploy | ✅ READY, serving `main` @ `3c88cec` |

## Finding 1 (HIGH, fixed): anon could execute 33 security-definer RPCs

Postgres grants EXECUTE to PUBLIC on new functions by default, so every
`jh_*` function was callable by the `anon` role. Most guard themselves, but
the ownership-guard pattern

```sql
if v_attempt.user_id <> v_user and not jh_has_permission(...) then raise ...
```

is **NULL-bypassable**: for anon, `auth.uid()` is NULL, `uuid <> NULL`
evaluates to NULL, the `AND` collapses, and the guard never fires.
Consequence: an anonymous caller who obtained a leaked attempt UUID (e.g. a
shared results link) could pull the full `jh_get_attempt_review` payload —
answer key included — before release.

**Fix** (`supabase/migrations/20261127000000_function_privilege_lockdown.sql`,
applied live): anon keeps EXECUTE on exactly the two functions public pages
genuinely call without a session — `jh_public_question_count` (homepage
stats) and `jh_admin_seat_available` (login page) — and loses it on every
other `jh_*` function. Every revoked function got an explicit
`authenticated, service_role` grant, so logged-in behaviour is unchanged.
Default privileges for future functions now exclude PUBLIC. A schema-test
invariant pins the anon allowlist to exactly those two names.

Verified live: `has_function_privilege('anon', ...)` false for all others;
positive probes as `anon` still work for the two allowlisted functions.

## Finding 2 (LOW, fixed): homepage question counter always showed ০

`jh_public_question_count` delegated to `jh_question_availability`, whose
course filter is `q.course_id = p_course_id` with no NULL branch. The
marketing homepage calls it with `p_course_id => null`, which always counted
0. Rewritten NULL-tolerant in the same migration. Verified as anon:
platform-wide 444, BCS 437.

## Database integrity (live production data)

All zero: bad answer keys, missing options, empty statements, duplicate
fingerprints, approved-but-unverified questions, AI questions approved
without verification, unapproved questions inside published papers, duplicate
questions within a paper, paper count mismatches, schedules with
end ≤ start, result release before exam end, orphaned attempts / results /
answers, submitted attempts without a score.

Content snapshot: 444 approved+verified questions, 3 published schedules
(2 upcoming), 6 attempts, 2 users, 167-row published 60-day routine.

## Anonymous access probes (dev server, unauthenticated)

- `POST /api/admin/{daily-exam, exams, weekly-exam, evidence, merges,
  questions, bulk, import, frequency, ai-generate}` → **401**
- `GET/POST /api/leaderboard`, `/api/recommendations`, `/api/routines/weekly` → **401/405**
- `/dashboard /admin /admin/exams /practice /results/* /leaderboard
  /analytics /exams` → **307 → /login**
- `/` and `/login` → **200**

## Deployment

Production (`jobhub-xi-five.vercel.app`): latest deployment READY/PROMOTED,
built from `main` @ `3c88cec` (PR #6 merge). The evidence/merge system, daily
90:10 exam system, and this audit's fixes live on branch
`arena/b34c2a23-jobhub` (PR #7, open) — they reach production when PR #7 is
merged. The database fixes are already live (DB is shared, not deployed via
Vercel).

## Known, accepted
- 12 lint warnings (pre-existing React `setState`-in-effect patterns in admin
  workbenches; cosmetic, no runtime defect observed).
- `schema_migrations` retains a legacy `authenticated` table grant; RLS is
  forced with no policy, so it is deny-all in practice.
- Daily-exam whole-subject fallback is ON for BCS until routines carry real
  topic links (flagged on every paper's pre-publish checklist).
