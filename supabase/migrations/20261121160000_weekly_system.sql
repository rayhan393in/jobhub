-- ============================================================================
-- JobHub — weekly routine, progress tracking, question frequency, PDF policy
--
-- The 9-part spec asks for things the original schema has no home for:
--
--   * a *week* as the unit of planning (`routines` is a flat dated calendar),
--     with the week's topics rolling forward when they are not finished;
--   * per-topic completion, so "progress" is measured against the routine the
--     student was actually given, not against the whole syllabus;
--   * previous-BCS question frequency per topic/subtopic — the evidence that
--     decides study priority. It is stored as *counts read from a real source*,
--     never as a prediction;
--   * an admin switch for which PDF downloads students may take.
--
-- Everything here is additive: no existing column changes type or meaning.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Weeks
--
-- A week is identified by its Monday (ISO). `routines.week_start` makes the
-- daily rows of one week groupable without a calendar table, and the check
-- keeps every row's date inside its own week so a bad import cannot produce a
-- "week 3" row dated in week 5.
-- ---------------------------------------------------------------------------
alter table public.routines
  add column if not exists week_start     date,
  add column if not exists week_index     smallint check (week_index is null or week_index between 1 and 104),
  add column if not exists slot_label     text,
  add column if not exists target_bn      text,
  add column if not exists task_kind      text not null default 'study'
    check (task_kind in ('study', 'practice', 'revision', 'exam', 'rest'));

comment on column public.routines.week_start is
  'ISO Monday of the week this routine row belongs to. Null for legacy rows.';
comment on column public.routines.slot_label is
  'Optional clock slot from the source routine, e.g. "07:30–09:00" or "রাত ৯টা".';

-- Safe to run on existing data: only rows that carry a date are stamped.
update public.routines
set week_start = (routine_date - (extract(isodow from routine_date)::int - 1))
where week_start is null;

create index if not exists routines_week_idx
  on public.routines(course_id, week_start, status);

alter table public.routines
  drop constraint if exists routines_date_in_week_check;
alter table public.routines
  add constraint routines_date_in_week_check
  check (week_start is null or routine_date between week_start and week_start + 6);

-- ---------------------------------------------------------------------------
-- Weekly exam link
--
-- The spec says the weekly examination must be built from *that week's*
-- routine topics and start automatically on a published day. `exam_schedules`
-- gains the week it examines and the routine rows it draws from, so the exam
-- can be regenerated when the plan changes and so the student's result page
-- can show which week it covered.
-- ---------------------------------------------------------------------------
alter table public.exam_schedules
  add column if not exists week_start    date,
  add column if not exists routine_ids   uuid[] not null default '{}',
  add column if not exists auto_start    boolean not null default false,
  add column if not exists exam_kind     text not null default 'daily'
    check (exam_kind in ('daily', 'weekly'));

comment on column public.exam_schedules.week_start is
  'For exam_kind = weekly, the Monday of the week this exam covers.';

create unique index if not exists exam_schedules_weekly_unique_idx
  on public.exam_schedules(course_id, week_start)
  where exam_kind = 'weekly' and status in ('draft', 'published');

-- ---------------------------------------------------------------------------
-- Per-topic routine completion
--
-- `study_progress` (from the original schema) tracks practice accuracy per
-- topic and is written by the exam submitter. This is a different question:
-- "did the student finish the topic the routine told them to study today?"
-- Keeping them apart means a practice attempt can never mark a routine day
-- done, and a tick on the planner can never corrupt an accuracy figure.
-- ---------------------------------------------------------------------------
create table if not exists public.routine_progress (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  course_id      uuid not null references public.courses(id) on delete cascade,
  routine_id     uuid references public.routines(id) on delete cascade,
  plan_id        uuid references public.student_routines(id) on delete cascade,
  subject_id     uuid references public.subjects(id) on delete set null,
  topic_id       uuid references public.topics(id) on delete set null,
  subtopic_id    uuid references public.subtopics(id) on delete set null,
  progress_date  date not null default current_date,
  minutes_spent  smallint not null default 0 check (minutes_spent between 0 and 1440),
  completion     smallint not null default 0 check (completion between 0 and 100),
  status         text not null default 'pending'
                   check (status in ('pending', 'in_progress', 'done', 'skipped')),
  note_bn        text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Progress must hang off exactly one plan source, never both.
  check (num_nonnulls(routine_id, plan_id) <= 1)
);

create unique index if not exists routine_progress_slot_idx
  on public.routine_progress(user_id, progress_date, subject_id, topic_id, subtopic_id)
  nulls not distinct;
create index if not exists routine_progress_owner_idx
  on public.routine_progress(user_id, progress_date desc);
create index if not exists routine_progress_carried_idx
  on public.routine_progress(user_id, course_id, status)
  where status in ('pending', 'in_progress', 'skipped');

alter table public.routine_progress enable row level security;
-- FORCE as well — the schema test requires it, and without it the table owner
-- would silently bypass the policies below.
alter table public.routine_progress force row level security;

drop policy if exists "students read own routine progress" on public.routine_progress;
create policy "students read own routine progress" on public.routine_progress
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "students write own routine progress" on public.routine_progress;
create policy "students write own routine progress" on public.routine_progress
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "students update own routine progress" on public.routine_progress;
create policy "students update own routine progress" on public.routine_progress
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "staff read all routine progress" on public.routine_progress;
create policy "staff read all routine progress" on public.routine_progress
  for select to authenticated using (public.jh_is_staff());

-- ---------------------------------------------------------------------------
-- Previous-examination question frequency
--
-- This is the table behind "high / medium / low frequency topic". It has to be
-- *evidence*: every row is a count that came from a named paper set that the
-- admin actually has. Nothing here is inferred — a topic with no row is
-- reported as "no data", not as low frequency.
-- ---------------------------------------------------------------------------
create table if not exists public.question_frequency (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references public.courses(id) on delete cascade,
  subject_id    uuid references public.subjects(id) on delete cascade,
  topic_id      uuid references public.topics(id) on delete cascade,
  subtopic_id   uuid references public.subtopics(id) on delete cascade,
  exam_name     text not null,
  exam_year     smallint check (exam_year is null or exam_year between 1971 and 2100),
  question_count smallint not null default 0 check (question_count >= 0),
  -- Where the count was read from, e.g. a Drive PDF id or a CSV filename.
  source_title  text not null default '',
  source_file_id text,
  source_url    text,
  notes         text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (topic_id is not null or subtopic_id is not null or subject_id is not null)
);

create unique index if not exists question_frequency_slot_idx
  on public.question_frequency(course_id, exam_name, exam_year, subject_id, topic_id, subtopic_id)
  nulls not distinct;
create index if not exists question_frequency_topic_idx
  on public.question_frequency(course_id, topic_id);

alter table public.question_frequency enable row level security;
alter table public.question_frequency force row level security;

-- Frequency drives study priority, so students may read it; only staff write.
drop policy if exists "authenticated read frequency" on public.question_frequency;
create policy "authenticated read frequency" on public.question_frequency
  for select to authenticated using (true);

drop policy if exists "staff write frequency" on public.question_frequency;
create policy "staff write frequency" on public.question_frequency
  for all to authenticated using (public.jh_has_permission('question.import'))
  with check (public.jh_has_permission('question.import'));

-- ---------------------------------------------------------------------------
-- PDF download policy (admin controlled)
--
-- Requirement 7: "Admin চাইলে কোন PDF Download Option শিক্ষার্থীদের জন্য চালু
-- থাকবে তা নিয়ন্ত্রণ করতে পারবে". Stored in system_settings under
-- key='pdf_downloads' so the existing settings UI can edit it.
-- ---------------------------------------------------------------------------
insert into public.system_settings (key, value)
values (
  'pdf_downloads',
  '{"question_paper":true,"answer_key":true,"performance_report":true,"embed_exam_id":true,"embed_user_info":false}'::jsonb
)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Frequency roll-up used by the routine planner and the priority page.
--
-- Returns one row per topic with the total questions seen across every exam on
-- record and the number of distinct papers, plus a band. The band is a *relative*
-- ranking inside the course data — tertiles of what has actually been counted.
-- It says "this topic appeared more often than the others in your data", which
-- is true, and never claims a probability of appearing again.
--
-- `percentile_cont(... ) over ()` is not allowed as a window with ORDER BY in
-- this Postgres build, so the tertile split uses ntile(3) instead.
-- ---------------------------------------------------------------------------
create or replace function public.jh_topic_frequency(p_course_id uuid)
returns table (
  subject_id    uuid,
  subject_bn    text,
  topic_id      uuid,
  topic_bn      text,
  total_questions bigint,
  paper_count   bigint,
  last_year     smallint,
  band          text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with totals as (
    select
      f.subject_id,
      f.topic_id,
      sum(f.question_count)::bigint as total_questions,
      count(distinct (f.exam_name, f.exam_year))::bigint as paper_count,
      max(f.exam_year) as last_year
    from public.question_frequency f
    where f.course_id = p_course_id
    group by f.subject_id, f.topic_id
  ),
  thirds as (
    select t.*, ntile(3) over (order by t.total_questions desc, t.topic_id) as bucket
    from totals t
  )
  select
    b.subject_id,
    s.title_bn as subject_bn,
    b.topic_id,
    tp.title_bn as topic_bn,
    b.total_questions,
    b.paper_count,
    b.last_year,
    case b.bucket when 1 then 'high' when 2 then 'medium' else 'low' end as band
  from thirds b
  left join public.subjects s on s.id = b.subject_id
  left join public.topics tp on tp.id = b.topic_id
  order by b.total_questions desc, b.topic_id;
$$;

revoke all on function public.jh_topic_frequency(uuid) from public;
grant execute on function public.jh_topic_frequency(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Unfinished topics from one week, for the next week's plan.
--
-- The carry-forward itself happens in TypeScript (`buildWeekPlan` takes
-- `priorityTopicIds`), because deciding *which* day a carried topic lands on is
-- planning logic. The database only answers the factual question: which topics
-- were scheduled that week and have no completed progress row.
-- ---------------------------------------------------------------------------
create or replace function public.jh_unfinished_topics(p_course_id uuid, p_week_start date)
returns table (topic_id uuid, subject_id uuid, minutes integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select sr.topic_id, sr.subject_id, sum(sr.minutes)::int
  from public.student_routines sr
  where sr.user_id = auth.uid()
    and sr.course_id = p_course_id
    and sr.routine_date between p_week_start and p_week_start + 6
    and sr.plan_kind = 'study'
    and sr.topic_id is not null
    and not exists (
      select 1 from public.routine_progress rp
      where rp.user_id = auth.uid()
        and rp.plan_id = sr.id
        and rp.status = 'done'
    )
  group by sr.topic_id, sr.subject_id;
$$;

revoke all on function public.jh_unfinished_topics(uuid,date) from public;
grant execute on function public.jh_unfinished_topics(uuid,date) to authenticated;

-- ---------------------------------------------------------------------------
-- Week completion, per subject. This is what "Daily Progress ও Weekly
-- Completion Tracking" means in numbers: slots scheduled vs slots ticked.
-- ---------------------------------------------------------------------------
create or replace function public.jh_week_completion(p_course_id uuid, p_week_start date)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with planned as (
    select count(*)::int as slots,
           coalesce(sum(minutes), 0)::int as planned_minutes
    from public.student_routines
    where user_id = auth.uid()
      and course_id = p_course_id
      and routine_date between p_week_start and p_week_start + 6
  ),
  done as (
    select count(*)::int as completed,
           coalesce(sum(rp.minutes_spent), 0)::int as spent_minutes
    from public.routine_progress rp
    join public.student_routines sr on sr.id = rp.plan_id
    where rp.user_id = auth.uid()
      and sr.course_id = p_course_id
      and sr.routine_date between p_week_start and p_week_start + 6
      and rp.status = 'done'
  )
  select jsonb_build_object(
    'week_start', p_week_start,
    'slots', planned.slots,
    'completed', done.completed,
    'completion', case when planned.slots = 0 then 0
                       else round(100.0 * done.completed / planned.slots) end,
    'planned_minutes', planned.planned_minutes,
    'spent_minutes', done.spent_minutes
  )
  from planned, done;
$$;

revoke all on function public.jh_week_completion(uuid,date) from public;
grant execute on function public.jh_week_completion(uuid,date) to authenticated;
