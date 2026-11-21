-- ============================================================================
-- JobHub — personal 30-day study plans
--
-- `routines` is the staff-published, course-wide calendar. Students need their
-- own plan, which is a different thing:
--
--   * every row belongs to one student (`user_id`), and is only readable by
--     them — a personal plan is not a public syllabus;
--   * the same course/day appears for every student, so the existing
--     `routines_unique_slot_idx` (course, kind, date, subject, topic) with
--     NULLS NOT DISTINCT would collapse 30 days into a single row. The plan
--     table therefore carries its own key including `user_id` and `plan_day`.
--
-- The 30-day generator writes through the service role after authenticating the
-- caller (see `src/app/api/routines/plan/route.ts`), because students have no
-- write grant on the staff-owned `routines` table. Reads are RLS-scoped to the
-- owner, so the service role is only needed for writes, never for exposure.
-- ============================================================================

create table if not exists public.student_routines (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  course_id      uuid not null references public.courses(id) on delete cascade,
  kind           text not null default 'daily'
                   check (kind in ('daily', 'weekly_special')),
  routine_date   date not null,
  plan_day       smallint not null check (plan_day between 1 and 31),
  plan_kind      text not null default 'study'
                   check (plan_kind in ('study', 'revision', 'rest')),
  title_en       text not null default '',
  title_bn       text not null default '',
  subject_id     uuid references public.subjects(id) on delete set null,
  topic_id       uuid references public.topics(id) on delete set null,
  subtopic_id    uuid references public.subtopics(id) on delete set null,
  minutes        smallint not null default 45 check (minutes between 0 and 480),
  focus_note_bn  text,
  status         text not null default 'published'
                   check (status in ('draft', 'published', 'archived', 'cancelled')),
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  archived_at    timestamptz
);

-- One plan per student per course: re-saving replaces the previous rows.
create unique index if not exists student_routines_slot_idx
  on public.student_routines(user_id, course_id, plan_day);

create index if not exists student_routines_owner_date_idx
  on public.student_routines(user_id, routine_date);

alter table public.student_routines enable row level security;
-- FORCE as well: without it the table owner (and therefore any SECURITY DEFINER
-- function that owns it) would silently bypass these policies.
alter table public.student_routines force row level security;

drop policy if exists "students read own routines" on public.student_routines;
create policy "students read own routines" on public.student_routines
  for select to authenticated using (user_id = auth.uid());

-- Deliberate: no insert/update/delete policy. Plans are written by the server
-- after it authenticates the caller, so a compromised browser cannot choose its
-- own `user_id`.

comment on table public.student_routines is
  'Per-student 30-day study plan, generated from the course syllabus. Readable by its owner; written only by the server.';

-- Keep `updated_at` honest without touching every call site.
create or replace function public.jh_touch_student_routine()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_student_routine on public.student_routines;
create trigger touch_student_routine
  before update on public.student_routines
  for each row execute function public.jh_touch_student_routine();
