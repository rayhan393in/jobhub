# JobHub

Bangladesh competitive-exam preparation platform — BCS, bank, teaching and
engineering cadres. Bilingual (Bangla / English), server-authoritative exams,
row-level security on every table.

**Status: Phase 2 complete.** Student app, exam engine and all 15 admin modules
are built, tested and deployable. No questions or exams are published yet — that
is deliberate, see [Content is under editorial review](#content-is-under-editorial-review).

---

## Stack

| Layer    | Choice                                                      |
| -------- | ----------------------------------------------------------- |
| App      | Next.js 16 (App Router, Turbopack), React 19, TypeScript     |
| Styling  | Tailwind CSS 4, custom design tokens                         |
| Data     | Supabase Postgres 17 — RLS on 39 tables, 51 `jh_*` functions |
| Auth     | Supabase Auth (email + password, confirmation required)      |
| Tests    | Vitest 5 + PGlite (real Postgres in-process), 347 tests      |
| Hosting  | Vercel (region `sin1`)                                       |

> These counts are checked by the test suite (`tests/db/schema.test.ts`) and by
> `grep -c "create policy" supabase/migrations/*.sql`; update them when the
> schema grows rather than trusting this table.

## Local development

```bash
npm install
cp .env.example .env.local     # fill in the two NEXT_PUBLIC_SUPABASE_* values
npm run db:migrate             # needs SUPABASE_DB_URL, see below
npm run dev                    # http://localhost:3000
```

Verification commands:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # 347 tests: schema, RLS, exam engine, unit
npm run check       # all three
npm run build       # production build (auto-applies migrations if configured)
```

The database suites boot PGlite and replay **every migration**, so schema, RLS
policies and the exam engine are verified without touching Supabase.

## Database

Migrations live in `supabase/migrations/` and are applied in filename order:

28 files, applied in filename order (the first six are the original core; the
rest add taxonomy, exam structure, study plans, written exams and analytics):

| File                    | Contents                                             |
| ----------------------- | ---------------------------------------------------- |
| `..._schema.sql`        | core tables, enums, checks, indexes, guard triggers  |
| `..._rls.sql`           | RLS enablement and the base policy set               |
| `..._functions.sql`     | `security definer` RPCs (exam engine, admin ops)     |
| `..._seed_catalogue.sql`| 8 courses, 25 subjects, 227 topics, 146 subtopics    |
| `..._seed_content.sql`  | 48 editorial sample questions (all `pending_review`)  |
| `..._demo_bootstrap.sql`| `jh_bootstrap_super_admin(email)` — operator only     |

Totals across all 29 migrations: **39 tables, 92 RLS policies, 51 `jh_*`
functions**. `..._function_privilege_lockdown.sql` is the one to read before
adding an RPC — it fixes the set of functions `anon` may execute, and
`tests/db/schema.test.ts` fails if a later migration widens it.

### Adding an RPC: the anon rule

Postgres grants `EXECUTE` to `PUBLIC` on every new function, and `ALTER DEFAULT
PRIVILEGES ... REVOKE ... FROM PUBLIC` cannot remove that built-in default.
`postgres` is not a superuser on Supabase, so a migration cannot install an
event trigger to close it either. **A new function is therefore anon-callable
until its own migration revokes it** — this is exactly how `jh_my_rank` and
`jh_course_taxonomy` leaked anon access in `20261212000000`, fixed by
`20261213000000_anon_execute_lockdown_followup.sql`.

So every new `jh_*` function must end its migration with:

```sql
revoke execute on function public.<fn>(<args>) from public, anon;
grant  execute on function public.<fn>(<args>) to authenticated;  -- + service_role only if needed
```

Only `jh_public_question_count` and `jh_admin_seat_available` may stay anon
callable (marketing stats and the first-admin seat check). If you add a
deliberately public one, add it to the allowlist in `tests/db/schema.test.ts`
and to the README, or CI fails.

Apply them with the versioned runner:

```bash
SUPABASE_DB_URL='postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres' \
  npm run db:migrate
```

The runner records each file in `schema_migrations`, wraps every file in its own
transaction, and auto-detects the correct Supavisor shard (`aws-0`, `aws-1`, …).
`npm run db:migrate:check` lists what would run. `npm run build` calls the runner
with `--skip`, so a build without database credentials still succeeds.

In CI/hosting, set the same value as `SUPABASE_DB_URL`. The credentials to use are
under **Supabase → Project Settings → Database → Connection pooling**.

## First administrator

A fresh deployment has no staff, and roles can only be granted by an existing
super admin — so there is a deliberate, **single-use** bootstrap path:

1. Register normally at `/register` and confirm the email.
2. Sign in. While the platform has no staff at all, `/dashboard` shows a
   **"প্রথম অ্যাডমিন সেটআপ"** banner with an *অ্যাডমিন বানুন* button. The same
   panel also appears on `/login?next=/admin`.
3. Click it. `jh_claim_first_admin()` promotes you to `super_admin`, writes an
   audit row, and the banner disappears for everyone forever.

> **Why the guard has to be bypassed.** `jh_guard_profile_role()` refuses any
> write where the JWT subject is the row being changed ("You cannot change your
> own role"). The claim function therefore blanks **both** copies of the token
> claim — `request.jwt.claim.sub` *and* `request.jwt.claims` — for the duration
> of the update. Blanking only the first is not enough: Supabase's `auth.uid()`
> is `coalesce(flat claim, claims json ->> 'sub')`, so the fallback still
> identified the caller and the claim failed with 42501. `tests/db/harness.ts`
> mirrors the real `auth.uid()` for exactly this reason — a simpler stub makes
> the bug invisible.

The seat is checked under an advisory lock inside the database, so this cannot
be raced or replayed, and `anon` has no execute grant. Once any content editor,
admin or super admin exists, the endpoint returns 409 and the only way to add
staff is `/admin/students` (requires `role.manage`).

Staff entry points: a **অ্যাডমিন** button in the site header for signed-in staff,
`/admin` directly, or the **স্টাফ প্রবেশ** link in the footer pointing at
`/admin/login`, which forwards to sign-in and then back to `/admin`.

Operators with database access can still promote out of band:

```sql
select public.jh_bootstrap_super_admin('you@example.com');
```

Never auto-promote the first sign-up: that is a privilege-escalation hole.

## Roles

| Role            | Capabilities                                                              |
| --------------- | ------------------------------------------------------------------------- |
| `student`       | Take exams, practice, see own results after release                        |
| `content_editor`| Review/import/edit questions, manage taxonomy, view analytics               |
| `admin`         | + publish exams & routines, inspect attempts, manage students, settings     |
| `super_admin`   | + manage roles                                                             |

Permissions are defined once in `src/lib/permission-matrix.ts` (pure, unit-tested
for monotonicity) and re-exported by the server-only `src/lib/permissions.ts`.

**There are exactly two authorization entry points.** Use the one that matches
the caller's failure mode; do not hand-roll a third.

| Context        | Guard                                  | On failure                   |
| -------------- | -------------------------------------- | ---------------------------- |
| API route      | `requireApiPermission(perm)` — `@/lib/api` | returns a 401/403 `NextResponse` |
| Page / layout  | `requirePermission(perm)` — `@/lib/permissions` | `redirect()` to `/admin?denied=…` |

```ts
// route handler
const gate = await requireApiPermission("settings.manage");
if ("error" in gate) return gate.error;
// gate.user is typed and authorized from here on

// mutating handler: also reject cross-site form posts
if (!assertSameOrigin(request)) return fail("অবৈধ অনুরোধ।", 403);
```

`requireApiPermission` and `assertSameOrigin` are covered by
`tests/unit/api-guards.test.ts` — including that a malformed `Origin` header
fails closed with a 403 rather than throwing. `assertSameOrigin` is the only
implementation; it fixes a `TypeError: Invalid URL` that 23 inlined copies of the
same check used to throw (turning a 403 into a 500).

## Exam engine

Everything that decides a mark happens in Postgres:

- `jh_start_scheduled_attempt` / `jh_start_custom_attempt` → attempt with a
  **server-computed deadline**.
- `jh_get_attempt_paper` → questions plus any answers already saved, so a phone
  that dies mid-exam resumes exactly where it left off. The answer key is never
  included.
- `jh_save_answer` → refuses writes after the deadline.
- `jh_submit_attempt` → scores **+1 / −0.5 / 0**, idempotent, one `results` row.
- `jh_get_attempt_review` → blocked until `result_release_at`.
- `jh_leaderboard` → ties broken by score → accuracy → duration → `submitted_at` → `user_id`.

The custom-exam builder (`/custom-exam`, `/practice`) lets a student pick several
subjects, topics and subtopics at once. `src/lib/exam-composition.ts` splits the
requested question count across that selection in proportion to each scope's
verified pool, never asking one scope for more than it holds — a composition the
database would reject rather than silently top up. It is unit-tested
(`tests/unit/exam-composition.test.ts`) because a bad split is invisible in the
UI until the attempt fails to start.

## Content is under editorial review

The 48 seeded questions are **JobHub-authored editorial samples**, explicitly not
verified past questions. They land in `pending_review` and are not usable by any
exam until a staff member approves them at `/admin/review`. Consequently:

- `/exams` is empty and `/courses/[slug]` shows an honest empty state.
- The landing page's live-exam preview renders the real schedule query and shows
  its empty state rather than a fake demo.

To get a usable exam:

1. `/admin/review` → approve enough questions (an exam needs ≥ the requested count).
2. `/admin/schedules` or `/admin/exams` → create a schedule, then publish it.
   Publishing freezes the paper, so later edits cannot change a live exam.

## Deployment

`vercel.json` pins the framework, region and security headers. The `jobhub`
project builds every branch as a **preview**; production is `main`.

Environment variables (Vercel → Project → Settings → Environment Variables):

| Variable                        | Required | Notes                                                      |
| ------------------------------- | -------- | ---------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | yes      | `https://<ref>.supabase.co`                                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes      | safe for the browser                                       |
| `SUPABASE_SERVICE_ROLE_KEY`     | for uploads / maintenance | **secret**, bypasses RLS. Needed by written-exam uploads (`assertServerEnv`) and service-role admin reads |
| `SUPABASE_DB_URL`               | no       | **secret**, used by the build-time migrator                |
| `GEMINI_API_KEY`                | no       | enables `/admin/ai`; `/api/admin/ai-generate` returns 503 with a setup hint when missing |
| `NEXT_PUBLIC_SITE_URL`          | no       | canonical URL for metadata and auth redirects              |

The AI drafting tool is optional: without `GEMINI_API_KEY` the route fails
cleanly with a Bangla setup message rather than a 500.

Post-deploy check:

```bash
npm run smoke -- https://your-preview.vercel.app
```

The sandbox in which this was built has no outbound access to Vercel or
Supabase, so the preview was verified through the hosting APIs instead:
migrations applied (counts above), 39 RLS tables / 92 policies / 51 functions
present, `anon` denied on `jh_bootstrap_super_admin`, and every branch build
producing a **preview** (`target: null`) — `main` is untouched.

It verifies pages render with Bangla copy, private routes redirect to `/login`,
the exam API refuses anonymous callers without leaking an answer key, and RLS
hides draft schedules while exposing published courses.

## Project layout

```
src/app/(marketing)   public site: landing, courses, about, faq, legal, contact
src/app/(auth)        login, register
src/app/(dashboard)   student app: dashboard, exams, practice, results, analytics…
src/app/(admin)/admin 15 admin modules (overview → settings → roles)
src/app/api           REST routes for exams, practice, leaderboard, admin
src/lib               types, validation, auth, exam-service, permissions, queries
src/components        ui, marketing, exam, dashboard, admin
supabase/migrations   schema → RLS → functions → seeds
tests/db              PGlite harness driving the real schema and RPCs
tests/unit            pure-function tests
```
