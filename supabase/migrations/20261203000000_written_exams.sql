-- ============================================================================
-- JobHub — Written exam module (টাইপ করা উত্তর + খাতা আপলোড, দুটোই)
--
-- Scope rule from the user: written exams exist ONLY for recruitment tracks
-- that genuinely have a written stage (BCS, NTRCA, Government Jobs,
-- Petrobangla AE, Technical Recruitment). Eligibility is data, not code:
-- a course is eligible when exam_registry carries a PUBLISHED row with
-- exam_stage='written' for it — admins can enable more courses later by
-- adding registry rows, never by code changes.
--
-- Flow:
--   admin creates exam (+questions, each with marks) → publish →
--   student starts ONE attempt within the open window →
--   types answers (mode typed/both) and/or uploads খাতা pages (upload/both) →
--   submits → examiner marks each answer / the sheet → finalize → graded.
--
-- Integrity:
--   * students can never touch awarded_marks / examiner fields / graded
--     status — enforced by guard triggers, not just API code;
--   * submitted attempts are frozen for the student;
--   * uploads live in the PRIVATE storage bucket 'written-scripts'
--     (served only through signed URLs from the server).
--
-- ROLLBACK:
--   drop table if exists public.written_uploads, public.written_answers,
--     public.written_attempts, public.written_questions, public.written_exams cascade;
--   drop function if exists public.jh_guard_written_attempt(), public.jh_guard_written_answer();
--   delete from public.exam_registry where slug like '%-written-stage';
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table if not exists public.written_exams (
  id               uuid primary key default gen_random_uuid(),
  course_id        uuid not null references public.courses(id) on delete cascade,
  title_bn         text not null check (length(btrim(title_bn)) >= 3),
  instructions_bn  text,
  mode             text not null default 'both' check (mode in ('typed', 'upload', 'both')),
  duration_minutes integer not null default 180 check (duration_minutes between 10 and 600),
  total_marks      numeric(6,2) not null default 100 check (total_marks > 0),
  opens_at         timestamptz,
  closes_at        timestamptz,
  status           text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (opens_at is null or closes_at is null or closes_at > opens_at)
);
create index if not exists written_exams_course_idx on public.written_exams (course_id, status);

create table if not exists public.written_questions (
  id          uuid primary key default gen_random_uuid(),
  exam_id     uuid not null references public.written_exams(id) on delete cascade,
  question_bn text not null check (length(btrim(question_bn)) >= 5),
  marks       numeric(5,2) not null default 10 check (marks > 0),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists written_questions_exam_idx on public.written_questions (exam_id, sort_order);

create table if not exists public.written_attempts (
  id               uuid primary key default gen_random_uuid(),
  exam_id          uuid not null references public.written_exams(id) on delete cascade,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  status           text not null default 'in_progress'
                     check (status in ('in_progress', 'submitted', 'graded')),
  started_at       timestamptz not null default now(),
  submitted_at     timestamptz,
  graded_at        timestamptz,
  total_awarded    numeric(6,2) check (total_awarded is null or total_awarded >= 0),
  examiner_id      uuid references public.profiles(id) on delete set null,
  examiner_note_bn text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (exam_id, user_id)        -- one attempt per student per written exam
);
create index if not exists written_attempts_user_idx on public.written_attempts (user_id, status);
create index if not exists written_attempts_exam_idx on public.written_attempts (exam_id, status);

create table if not exists public.written_answers (
  id               uuid primary key default gen_random_uuid(),
  attempt_id       uuid not null references public.written_attempts(id) on delete cascade,
  question_id      uuid not null references public.written_questions(id) on delete cascade,
  answer_text      text,
  awarded_marks    numeric(5,2) check (awarded_marks is null or awarded_marks >= 0),
  examiner_note_bn text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (attempt_id, question_id)
);
create index if not exists written_answers_attempt_idx on public.written_answers (attempt_id);

create table if not exists public.written_uploads (
  id          uuid primary key default gen_random_uuid(),
  attempt_id  uuid not null references public.written_attempts(id) on delete cascade,
  storage_path text not null,
  file_name   text,
  mime_type   text,
  size_bytes  bigint check (size_bytes is null or size_bytes > 0),
  uploaded_at timestamptz not null default now()
);
create index if not exists written_uploads_attempt_idx on public.written_uploads (attempt_id);

-- updated_at bookkeeping (existing trigger fn).
drop trigger if exists set_updated_at on public.written_exams;
create trigger set_updated_at before update on public.written_exams
  for each row execute function public.jh_touch_updated_at();
drop trigger if exists set_updated_at on public.written_questions;
create trigger set_updated_at before update on public.written_questions
  for each row execute function public.jh_touch_updated_at();
drop trigger if exists set_updated_at on public.written_attempts;
create trigger set_updated_at before update on public.written_attempts
  for each row execute function public.jh_touch_updated_at();
drop trigger if exists set_updated_at on public.written_answers;
create trigger set_updated_at before update on public.written_answers
  for each row execute function public.jh_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Guard triggers: students can submit, never grade.
-- ---------------------------------------------------------------------------
create or replace function public.jh_guard_written_attempt()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() = 'service_role' or public.jh_is_staff() then
    return new;
  end if;
  if old.status <> 'in_progress' then
    raise exception 'জমা দেওয়া খাতা আর পরিবর্তন করা যাবে না' using errcode = '42501';
  end if;
  if new.status not in ('in_progress', 'submitted') then
    raise exception 'শিক্ষার্থী নিজের খাতায় গ্রেড বসাতে পারে না' using errcode = '42501';
  end if;
  if new.total_awarded    is distinct from old.total_awarded
     or new.examiner_id      is distinct from old.examiner_id
     or new.examiner_note_bn is distinct from old.examiner_note_bn
     or new.graded_at        is distinct from old.graded_at
     or new.user_id          is distinct from old.user_id
     or new.exam_id          is distinct from old.exam_id
     or new.started_at       is distinct from old.started_at then
    raise exception 'এই ঘরগুলো শুধুমাত্র পরীক্ষক পরিবর্তন করতে পারেন' using errcode = '42501';
  end if;
  if new.status = 'submitted' and new.submitted_at is null then
    new.submitted_at := now();
  end if;
  return new;
end;
$$;
revoke all on function public.jh_guard_written_attempt() from public, anon;

drop trigger if exists guard_written_attempt on public.written_attempts;
create trigger guard_written_attempt before update on public.written_attempts
  for each row execute function public.jh_guard_written_attempt();

create or replace function public.jh_guard_written_answer()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() = 'service_role' or public.jh_is_staff() then
    return new;
  end if;
  if tg_op = 'UPDATE' and (
       new.awarded_marks    is distinct from old.awarded_marks
    or new.examiner_note_bn is distinct from old.examiner_note_bn
  ) then
    raise exception 'নম্বর ও পরীক্ষকের মন্তব্য শুধুমাত্র পরীক্ষক দিতে পারেন' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and (new.awarded_marks is not null or new.examiner_note_bn is not null) then
    raise exception 'নম্বর ও পরীক্ষকের মন্তব্য শুধুমাত্র পরীক্ষক দিতে পারেন' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.jh_guard_written_answer() from public, anon;

drop trigger if exists guard_written_answer on public.written_answers;
create trigger guard_written_answer before insert or update on public.written_answers
  for each row execute function public.jh_guard_written_answer();

-- ---------------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------------
alter table public.written_exams     enable row level security;
alter table public.written_exams     force  row level security;
alter table public.written_questions enable row level security;
alter table public.written_questions force  row level security;
alter table public.written_attempts  enable row level security;
alter table public.written_attempts  force  row level security;
alter table public.written_answers   enable row level security;
alter table public.written_answers   force  row level security;
alter table public.written_uploads   enable row level security;
alter table public.written_uploads   force  row level security;

drop policy if exists "read published written exams" on public.written_exams;
create policy "read published written exams"
  on public.written_exams for select to authenticated
  using (status in ('published', 'closed') or public.jh_is_staff());

drop policy if exists "staff manage written exams" on public.written_exams;
create policy "staff manage written exams"
  on public.written_exams for all to authenticated
  using (public.jh_has_permission('exam.publish'))
  with check (public.jh_has_permission('exam.publish'));

drop policy if exists "read questions of visible exams" on public.written_questions;
create policy "read questions of visible exams"
  on public.written_questions for select to authenticated
  using (
    public.jh_is_staff()
    or exists (select 1 from public.written_exams e
                where e.id = exam_id and e.status in ('published', 'closed'))
  );

drop policy if exists "staff manage written questions" on public.written_questions;
create policy "staff manage written questions"
  on public.written_questions for all to authenticated
  using (public.jh_has_permission('exam.publish'))
  with check (public.jh_has_permission('exam.publish'));

drop policy if exists "own or staff attempts read" on public.written_attempts;
create policy "own or staff attempts read"
  on public.written_attempts for select to authenticated
  using (user_id = auth.uid() or public.jh_is_staff());

drop policy if exists "start own attempt in window" on public.written_attempts;
create policy "start own attempt in window"
  on public.written_attempts for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'in_progress'
    and exists (
      select 1 from public.written_exams e
       where e.id = exam_id
         and e.status = 'published'
         and (e.opens_at  is null or now() >= e.opens_at)
         and (e.closes_at is null or now() <= e.closes_at)
    )
  );

drop policy if exists "update own or staff attempts" on public.written_attempts;
create policy "update own or staff attempts"
  on public.written_attempts for update to authenticated
  using (user_id = auth.uid() or public.jh_is_staff())
  with check (user_id = auth.uid() or public.jh_is_staff());

drop policy if exists "own or staff answers read" on public.written_answers;
create policy "own or staff answers read"
  on public.written_answers for select to authenticated
  using (
    public.jh_is_staff()
    or exists (select 1 from public.written_attempts a
                where a.id = attempt_id and a.user_id = auth.uid())
  );

drop policy if exists "write answers while in progress" on public.written_answers;
create policy "write answers while in progress"
  on public.written_answers for insert to authenticated
  with check (
    exists (select 1
              from public.written_attempts a
              join public.written_questions q
                on q.id = question_id and q.exam_id = a.exam_id
             where a.id = attempt_id and a.user_id = auth.uid()
               and a.status = 'in_progress')
  );

drop policy if exists "update answers while in progress or staff" on public.written_answers;
create policy "update answers while in progress or staff"
  on public.written_answers for update to authenticated
  using (
    public.jh_is_staff()
    or exists (select 1 from public.written_attempts a
                where a.id = attempt_id and a.user_id = auth.uid()
                  and a.status = 'in_progress')
  )
  with check (
    public.jh_is_staff()
    or exists (select 1 from public.written_attempts a
                where a.id = attempt_id and a.user_id = auth.uid()
                  and a.status = 'in_progress')
  );

drop policy if exists "own or staff uploads read" on public.written_uploads;
create policy "own or staff uploads read"
  on public.written_uploads for select to authenticated
  using (
    public.jh_is_staff()
    or exists (select 1 from public.written_attempts a
                where a.id = attempt_id and a.user_id = auth.uid())
  );

drop policy if exists "upload while in progress" on public.written_uploads;
create policy "upload while in progress"
  on public.written_uploads for insert to authenticated
  with check (
    exists (select 1 from public.written_attempts a
             where a.id = attempt_id and a.user_id = auth.uid()
               and a.status = 'in_progress')
  );

drop policy if exists "remove own upload while in progress" on public.written_uploads;
create policy "remove own upload while in progress"
  on public.written_uploads for delete to authenticated
  using (
    public.jh_is_staff()
    or exists (select 1 from public.written_attempts a
                where a.id = attempt_id and a.user_id = auth.uid()
                  and a.status = 'in_progress')
  );

revoke all on public.written_exams, public.written_questions, public.written_attempts,
             public.written_answers, public.written_uploads from anon;
grant select, insert, update, delete on public.written_exams     to authenticated;
grant select, insert, update, delete on public.written_questions to authenticated;
grant select, insert, update         on public.written_attempts  to authenticated;
grant select, insert, update         on public.written_answers   to authenticated;
grant select, insert, delete         on public.written_uploads   to authenticated;
grant all on public.written_exams, public.written_questions, public.written_attempts,
             public.written_answers, public.written_uploads to service_role;

-- ---------------------------------------------------------------------------
-- 4. Private storage bucket for খাতা uploads (skipped where storage absent,
--    e.g. the PGlite test harness).
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables
              where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public)
    values ('written-scripts', 'written-scripts', false)
    on conflict (id) do nothing;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Eligibility data: the tracks that genuinely HAVE a written stage.
--    (Registry rows without a year: exam_year NULL + year_verified=false —
--    these describe the stage, they do not fabricate a dated exam.)
-- ---------------------------------------------------------------------------
insert into public.exam_registry
  (slug, exam_name, exam_name_bn, exam_body, exam_stage, course_id, status, notes)
select v.slug, v.exam_name, v.exam_name_bn, v.exam_body, 'written', c.id, 'published',
       'লিখিত পরীক্ষা স্টেজ — written exam module eligibility'
from (values
  ('bcs-written-stage',            'BCS Written Examination',
   'বিসিএস লিখিত পরীক্ষা',            'BPSC',        'bcs'),
  ('ntrca-written-stage',          'NTRCA Written Examination',
   'এনটিআরসিএ লিখিত পরীক্ষা',          'NTRCA',       'ntrca'),
  ('govt-jobs-written-stage',      'Government Jobs Written Examination',
   'সরকারি চাকরি লিখিত পরীক্ষা',        null,          'government-jobs'),
  ('petrobangla-ae-written-stage', 'Petrobangla AE (EEE) Written Examination',
   'পেট্রোবাংলা সহকারী প্রকৌশলী লিখিত পরীক্ষা', 'Petrobangla', 'petrobangla-ae-eee'),
  ('technical-written-stage',      'Technical Recruitment Written Examination',
   'টেকনিক্যাল নিয়োগ লিখিত পরীক্ষা',     null,          'technical-recruitment')
) v(slug, exam_name, exam_name_bn, exam_body, course_slug)
join public.courses c on c.slug = v.course_slug
on conflict (slug) do nothing;
