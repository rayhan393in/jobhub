# JobHub

Bangladesh competitive-exam preparation platform — BCS, bank, teaching and
engineering cadres. Bilingual (Bangla / English), server-authoritative exams,
row-level security on every table.

**Status: Phase 2 complete.** Student app, exam engine and all 15 admin modules
are built, tested and deployable. No questions or exams are published yet — that
is deliberate, see [Content is under editorial review](#content-is-under-editorial-review).

---

## Stack

| Layer    | Choice                                                    |
| -------- | --------------------------------------------------------- |
| App      | Next.js 16 (App Router, Turbopack), React 19, TypeScript   |
| Styling  | Tailwind CSS 4, custom design tokens                       |
| Data     | Supabase Postgres 17 — RLS, 23 `security definer` functions |
| Auth     | Supabase Auth (email + password, confirmation required)    |
| Tests    | Vitest 5 + PGlite (real Postgres in-process), 72 tests     |
| Hosting  | Vercel (region `sin1`)                                     |

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
npm test            # 72 tests: schema, RLS, exam engine, unit
npm run check       # all three
npm run build       # production build (auto-applies migrations if configured)
```

The database suites boot PGlite and replay **every migration**, so schema, RLS
policies and the exam engine are verified without touching Supabase.

## Database

Migrations live in `supabase/migrations/` and are applied in filename order:

| File                    | Contents                                            |
| ----------------------- | --------------------------------------------------- |
| `..._schema.sql`        | 22 tables, enums, checks, indexes                   |
| `..._rls.sql`           | RLS enablement and 51 policies                      |
| `..._functions.sql`     | 23 `security definer` RPCs (exam engine, admin ops) |
| `..._seed_catalogue.sql`| 8 courses, 25 subjects, 227 topics, 146 subtopics   |
| `..._seed_content.sql`  | 48 editorial sample questions (all `pending_review`) |
| `..._demo_bootstrap.sql`| `jh_bootstrap_super_admin(email)` — operator only    |

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

Never auto-promote the first sign-up — that is a privilege-escalation hole.
Instead:

1. Register normally at `/register` and confirm the email.
2. In the Supabase SQL editor run:
   ```sql
   select public.jh_bootstrap_super_admin('you@example.com');
   ```
3. Sign out and in again; `/admin` is now available.

The function is `security definer` but revoked from `anon` and `authenticated`, so
it can only be called by an operator with database access.

## Roles

| Role            | Capabilities                                                              |
| --------------- | ------------------------------------------------------------------------- |
| `student`       | Take exams, practice, see own results after release                        |
| `content_editor`| Review/import/edit questions, manage taxonomy, view analytics               |
| `admin`         | + publish exams & routines, inspect attempts, manage students, settings     |
| `super_admin`   | + manage roles                                                             |

Permissions are defined once in `src/lib/permission-matrix.ts` (pure, unit-tested
for monotonicity) and re-exported by the server-only `src/lib/permissions.ts`.

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

| Variable                        | Notes                                    |
| ------------------------------- | ---------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | `https://<ref>.supabase.co`              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | safe for the browser                     |
| `SUPABASE_DB_URL`               | **secret**, used by the build-time migrator |

Post-deploy check:

```bash
npm run smoke -- https://your-preview.vercel.app
```

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
