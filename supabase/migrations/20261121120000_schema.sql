-- ============================================================================
-- JobHub — 01 Schema
-- Bangladesh competitive examination preparation platform
-- Idempotent, additive-first migration. Safe to re-run in development.
-- ============================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Roles & permissions
-- ---------------------------------------------------------------------------
create table if not exists public.roles (
  id            text primary key,
  name_en       text not null,
  name_bn       text not null,
  description   text,
  level         smallint not null default 10,
  is_system     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists public.permissions (
  key         text primary key,
  label_en    text not null,
  label_bn    text not null,
  category    text not null default 'general'
);

create table if not exists public.role_permissions (
  role_id         text not null references public.roles(id) on delete cascade,
  permission_key  text not null references public.permissions(key) on delete cascade,
  primary key (role_id, permission_key)
);

insert into public.roles (id, name_en, name_bn, description, level) values
  ('student',     'Student',      'শিক্ষার্থী',        'Learner account. Own data only.', 10),
  ('content_editor', 'Content Editor', 'কনটেন্ট এডিটর', 'Reviews and edits question content.', 40),
  ('admin',       'Administrator','প্রশাসক',          'Full content, exam and student operations.', 80),
  ('super_admin', 'Super Admin',  'সুপার অ্যাডমিন',   'Owner account. Can change roles and system settings.', 100)
on conflict (id) do update set
  name_en = excluded.name_en, name_bn = excluded.name_bn,
  description = excluded.description, level = excluded.level;

insert into public.permissions (key, label_en, label_bn, category) values
  ('question.review',      'Review questions',            'প্রশ্ন রিভিউ',              'content'),
  ('question.import',      'Import questions',            'প্রশ্ন ইমপোর্ট',            'content'),
  ('question.edit',        'Edit questions',              'প্রশ্ন সম্পাদনা',           'content'),
  ('taxonomy.manage',      'Manage courses and taxonomy','কোর্স ও ট্যাক্সোনমি',       'content'),
  ('routine.manage',       'Manage study routines',       'রুটিন ব্যবস্থাপনা',         'exams'),
  ('exam.publish',         'Publish examinations',        'পরীক্ষা প্রকাশ',            'exams'),
  ('attempt.inspect',      'Inspect student attempts',    'শিক্ষার্থীর প্রচেষ্টা দেখা', 'students'),
  ('student.manage',       'Manage students',             'শিক্ষার্থী ব্যবস্থাপনা',    'students'),
  ('analytics.view',       'View analytics',              'অ্যানালিটিক্স দেখা',        'reports'),
  ('audit.view',           'View audit logs',             'অডিট লগ দেখা',              'reports'),
  ('settings.manage',      'Manage system settings',      'সিস্টেম সেটিংস',            'system'),
  ('role.manage',          'Manage roles and permissions','রোল ও অনুমতি',              'system')
on conflict (key) do update set label_en = excluded.label_en, label_bn = excluded.label_bn;

insert into public.role_permissions (role_id, permission_key) values
  ('content_editor','question.review'), ('content_editor','question.import'),
  ('content_editor','question.edit'),   ('content_editor','taxonomy.manage'),
  ('content_editor','analytics.view'),
  ('admin','question.review'), ('admin','question.import'), ('admin','question.edit'),
  ('admin','taxonomy.manage'), ('admin','routine.manage'), ('admin','exam.publish'),
  ('admin','attempt.inspect'), ('admin','student.manage'), ('admin','analytics.view'),
  ('admin','audit.view'), ('admin','settings.manage'),
  ('super_admin','question.review'), ('super_admin','question.import'), ('super_admin','question.edit'),
  ('super_admin','taxonomy.manage'), ('super_admin','routine.manage'), ('super_admin','exam.publish'),
  ('super_admin','attempt.inspect'), ('super_admin','student.manage'), ('super_admin','analytics.view'),
  ('super_admin','audit.view'), ('super_admin','settings.manage'), ('super_admin','role.manage')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  email             text,
  full_name         text,
  full_name_bn      text,
  phone             text,
  role_id           text not null default 'student' references public.roles(id),
  target_course_id  uuid,
  locale            text not null default 'bn' check (locale in ('bn','en')),
  avatar_url        text,
  is_active         boolean not null default true,
  onboarded_at      timestamptz,
  last_active_at    timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Course catalogue & taxonomy
-- ---------------------------------------------------------------------------
create table if not exists public.courses (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,78}$'),
  title_en        text not null,
  title_bn        text not null,
  short_en        text,
  short_bn        text,
  summary_en      text,
  summary_bn      text,
  description_en  text,
  description_bn  text,
  level           text not null default 'foundation' check (level in ('foundation','intermediate','advanced')),
  icon            text not null default 'graduation-cap',
  accent          text not null default 'indigo',
  duration_weeks  smallint,
  price_bdt       integer not null default 0 check (price_bdt >= 0),
  status          text not null default 'draft' check (status in ('draft','published','archived')),
  sort_order      smallint not null default 0,
  metadata        jsonb not null default '{}'::jsonb,
  exam_config     jsonb not null default jsonb_build_object(
                    'duration_minutes', 60,
                    'max_questions', 100,
                    'max_duration_minutes', 180,
                    'positive_marks', 1,
                    'negative_marks', 0.5,
                    'publish_lead_minutes', 30,
                    'result_delay_minutes', 10
                  ),
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.subjects (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses(id) on delete cascade,
  slug        text not null,
  title_en    text not null,
  title_bn    text not null,
  chapter_group text,
  weight      smallint not null default 1 check (weight between 1 and 100),
  sort_order  smallint not null default 0,
  is_active   boolean not null default true,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (course_id, slug)
);

create table if not exists public.topics (
  id          uuid primary key default gen_random_uuid(),
  subject_id  uuid not null references public.subjects(id) on delete cascade,
  slug        text not null,
  title_en    text not null,
  title_bn    text not null,
  chapter     text,
  sort_order  smallint not null default 0,
  is_active   boolean not null default true,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (subject_id, slug)
);

create table if not exists public.subtopics (
  id          uuid primary key default gen_random_uuid(),
  topic_id    uuid not null references public.topics(id) on delete cascade,
  slug        text not null,
  title_en    text not null,
  title_bn    text not null,
  sort_order  smallint not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (topic_id, slug)
);

alter table public.profiles drop constraint if exists profiles_target_course_id_fkey;
alter table public.profiles
  add constraint profiles_target_course_id_fkey
  foreign key (target_course_id) references public.courses(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Question bank
-- ---------------------------------------------------------------------------
create table if not exists public.import_batches (
  id            uuid primary key default gen_random_uuid(),
  created_by    uuid references public.profiles(id) on delete set null,
  filename      text,
  format        text not null default 'json' check (format in ('csv','json')),
  mode          text not null default 'commit' check (mode in ('dry_run','commit')),
  total_rows    integer not null default 0,
  created_rows  integer not null default 0,
  failed_rows   integer not null default 0,
  duplicate_rows integer not null default 0,
  errors        jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now()
);

create table if not exists public.questions (
  id              uuid primary key default gen_random_uuid(),
  course_id       uuid not null references public.courses(id) on delete cascade,
  subject_id      uuid references public.subjects(id) on delete set null,
  topic_id        uuid references public.topics(id) on delete set null,
  subtopic_id     uuid references public.subtopics(id) on delete set null,
  statement       text not null check (length(btrim(statement)) >= 8),
  statement_bn    text,
  option_a        text not null,
  option_b        text not null,
  option_c        text not null,
  option_d        text not null,
  correct_option  smallint not null check (correct_option between 0 and 3),
  explanation     text not null default '',
  difficulty      text not null default 'medium' check (difficulty in ('easy','medium','hard')),
  source          text not null default '',
  source_type     text not null default 'manual' check (source_type in ('manual','csv_import','json_import','ai_assisted')),
  year            smallint check (year is null or (year between 1971 and 2100)),
  status          text not null default 'draft'
                    check (status in ('draft','pending_review','approved','rejected','archived')),
  is_verified     boolean not null default false,
  verified_by     uuid references public.profiles(id) on delete set null,
  verified_at     timestamptz,
  fingerprint     text not null,
  external_ref    text,
  import_batch_id uuid references public.import_batches(id) on delete set null,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  archived_at     timestamptz,
  check (status <> 'approved' or is_verified),
  unique (course_id, fingerprint)
);

create index if not exists questions_status_course_idx on public.questions(status, course_id);
create index if not exists questions_subject_idx on public.questions(subject_id, status);
create index if not exists questions_topic_idx on public.questions(topic_id, status);
create index if not exists questions_subtopic_idx on public.questions(subtopic_id, status);
create index if not exists questions_statement_trgm_idx on public.questions using gin (statement gin_trgm_ops);

create table if not exists public.question_reviews (
  id              uuid primary key default gen_random_uuid(),
  question_id     uuid not null references public.questions(id) on delete cascade,
  reviewer_id     uuid references public.profiles(id) on delete set null,
  action          text not null check (action in ('submit','approve','reject','return','archive','restore','flag','edit')),
  previous_status text,
  new_status      text,
  notes           text,
  created_at      timestamptz not null default now()
);
create index if not exists question_reviews_question_idx on public.question_reviews(question_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Study routines
-- ---------------------------------------------------------------------------
create table if not exists public.routines (
  id              uuid primary key default gen_random_uuid(),
  course_id       uuid not null references public.courses(id) on delete cascade,
  kind            text not null default 'daily' check (kind in ('daily','weekly_special')),
  routine_date    date not null,
  title_en        text not null default '',
  title_bn        text not null default '',
  subject_id      uuid references public.subjects(id) on delete set null,
  topic_id        uuid references public.topics(id) on delete set null,
  subtopic_id     uuid references public.subtopics(id) on delete set null,
  minutes         smallint not null default 45 check (minutes between 5 and 480),
  focus_note_bn   text,
  status          text not null default 'draft' check (status in ('draft','published','archived','cancelled')),
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  archived_at     timestamptz
);
create unique index if not exists routines_unique_slot_idx
  on public.routines(course_id, kind, routine_date, subject_id, topic_id) nulls not distinct;
create index if not exists routines_date_idx on public.routines(routine_date, course_id, status);

-- ---------------------------------------------------------------------------
-- Examinations
-- ---------------------------------------------------------------------------
create table if not exists public.exam_schedules (
  id                uuid primary key default gen_random_uuid(),
  course_id         uuid not null references public.courses(id) on delete cascade,
  kind              text not null default 'daily_live'
                      check (kind in ('daily_live','weekly_special','scheduled_mock')),
  title_en          text not null,
  title_bn          text not null,
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  result_release_at timestamptz not null,
  duration_minutes  smallint not null check (duration_minutes between 1 and 240),
  question_count    smallint not null check (question_count between 1 and 200),
  total_marks       numeric(7,2) not null check (total_marks > 0),
  positive_marks    numeric(4,2) not null default 1 check (positive_marks > 0),
  negative_marks    numeric(4,2) not null default 0.5 check (negative_marks >= 0),
  status            text not null default 'draft' check (status in ('draft','published','cancelled','completed')),
  routine_id        uuid references public.routines(id) on delete set null,
  settings          jsonb not null default '{}'::jsonb,
  created_by        uuid references public.profiles(id) on delete set null,
  published_by      uuid references public.profiles(id) on delete set null,
  published_at      timestamptz,
  cancelled_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (ends_at > starts_at),
  check (result_release_at >= ends_at)
);
create index if not exists exam_schedules_window_idx on public.exam_schedules(course_id, status, starts_at);
create unique index if not exists exam_schedules_no_duplicate_idx
  on public.exam_schedules(course_id, kind, starts_at) where status in ('draft','published');

create table if not exists public.exam_papers (
  id                uuid primary key default gen_random_uuid(),
  schedule_id       uuid references public.exam_schedules(id) on delete cascade,
  course_id         uuid not null references public.courses(id) on delete cascade,
  paper_type        text not null default 'scheduled' check (paper_type in ('scheduled','custom','practice')),
  title_en          text not null default '',
  title_bn          text not null default '',
  question_count    smallint not null check (question_count between 1 and 200),
  duration_minutes  smallint not null check (duration_minutes between 1 and 240),
  total_marks       numeric(7,2) not null,
  positive_marks    numeric(4,2) not null default 1,
  negative_marks    numeric(4,2) not null default 0.5,
  composition       jsonb not null default '{}'::jsonb,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index if not exists exam_papers_schedule_idx on public.exam_papers(schedule_id);

create table if not exists public.exam_questions (
  id          uuid primary key default gen_random_uuid(),
  paper_id    uuid not null references public.exam_papers(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  position    smallint not null check (position > 0),
  marks       numeric(4,2) not null default 1,
  unique (paper_id, question_id),
  unique (paper_id, position)
);

create table if not exists public.exam_attempts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  paper_id          uuid not null references public.exam_papers(id) on delete restrict,
  schedule_id       uuid references public.exam_schedules(id) on delete set null,
  course_id         uuid not null references public.courses(id) on delete cascade,
  mode              text not null default 'scheduled'
                      check (mode in ('scheduled','custom','mixed_practice','topic_practice','wrong_practice','bookmark_practice','timed_mock','revision')),
  status            text not null default 'in_progress'
                      check (status in ('in_progress','submitted','expired')),
  started_at        timestamptz not null default now(),
  deadline_at       timestamptz not null,
  submitted_at      timestamptz,
  submit_reason     text check (submit_reason in ('manual','timeout','admin')),
  duration_seconds  integer,
  total_questions   smallint not null,
  total_marks       numeric(7,2) not null,
  correct_count     smallint,
  wrong_count       smallint,
  unanswered_count  smallint,
  score             numeric(7,2),
  accuracy          numeric(5,2),
  is_released       boolean not null default false,
  released_at       timestamptz,
  submission_seq    integer not null default 0,
  idempotency_key   uuid,
  ip_hash           text,
  user_agent        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (deadline_at > started_at)
);
create unique index if not exists exam_attempts_one_per_schedule_idx
  on public.exam_attempts(user_id, schedule_id) where schedule_id is not null;
create index if not exists exam_attempts_user_idx on public.exam_attempts(user_id, status, created_at desc);
create index if not exists exam_attempts_paper_idx on public.exam_attempts(paper_id);

create table if not exists public.student_answers (
  id               uuid primary key default gen_random_uuid(),
  attempt_id       uuid not null references public.exam_attempts(id) on delete cascade,
  question_id      uuid not null references public.questions(id) on delete restrict,
  selected_option  smallint check (selected_option between 0 and 3),
  marked_for_review boolean not null default false,
  answered_at      timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (attempt_id, question_id)
);
create index if not exists student_answers_attempt_idx on public.student_answers(attempt_id);

create table if not exists public.results (
  id               uuid primary key default gen_random_uuid(),
  attempt_id       uuid not null unique references public.exam_attempts(id) on delete cascade,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  paper_id         uuid not null references public.exam_papers(id) on delete cascade,
  schedule_id      uuid references public.exam_schedules(id) on delete set null,
  course_id        uuid not null references public.courses(id) on delete cascade,
  score            numeric(7,2) not null,
  total_marks      numeric(7,2) not null,
  correct_count    smallint not null,
  wrong_count      smallint not null,
  unanswered_count smallint not null,
  accuracy         numeric(5,2) not null default 0,
  is_released      boolean not null default false,
  released_at      timestamptz,
  rank             integer,
  snapshot         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists results_release_idx on public.results(is_released, schedule_id, score desc);
create index if not exists results_user_idx on public.results(user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Student engagement
-- ---------------------------------------------------------------------------
create table if not exists public.bookmarks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  note        text,
  created_at  timestamptz not null default now(),
  unique (user_id, question_id)
);

create table if not exists public.study_progress (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  course_id          uuid not null references public.courses(id) on delete cascade,
  subject_id         uuid references public.subjects(id) on delete cascade,
  topic_id           uuid references public.topics(id) on delete cascade,
  subtopic_id        uuid references public.subtopics(id) on delete cascade,
  questions_attempted integer not null default 0,
  questions_correct   integer not null default 0,
  last_practiced_at   timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index if not exists study_progress_scope_idx
  on public.study_progress(user_id, course_id, subject_id, topic_id, subtopic_id) nulls not distinct;

alter table public.bookmarks drop constraint if exists bookmarks_note_check;
alter table public.bookmarks add constraint bookmarks_note_check check (note is null or length(note) <= 500);

create table if not exists public.audit_logs (
  id          bigserial primary key,
  actor_id    uuid references public.profiles(id) on delete set null,
  actor_role  text,
  action      text not null,
  entity_type text not null,
  entity_id   text,
  details     jsonb not null default '{}'::jsonb,
  ip_hash     text,
  created_at  timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_id, created_at desc);

create table if not exists public.system_settings (
  key         text primary key,
  value       jsonb not null,
  updated_by  uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now()
);

insert into public.system_settings (key, value) values
  ('platform', '{"name":"JobHub","timezone":"Asia/Dhaka","support_email":"support@jobhub.com.bd","daily_window":{"start":"10:00","end":"22:00"},"daily_target_marks":100,"locale_default":"bn","demo_mode":false}'::jsonb),
  ('exam_limits', '{"max_questions":100,"max_duration_minutes":180,"min_questions":5,"min_duration_minutes":5}'::jsonb),
  ('marking', '{"positive_marks":1,"negative_marks":0.5,"unanswered_marks":0}'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.jh_touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','courses','subjects','topics','subtopics','questions','routines',
    'exam_schedules','exam_attempts','student_answers','study_progress'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.jh_touch_updated_at()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- New auth user -> profile
-- ---------------------------------------------------------------------------
create or replace function public.jh_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name, full_name_bn)
  values (
    new.id,
    new.email,
    nullif(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), ''),
    nullif(new.raw_user_meta_data->>'full_name_bn', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.jh_handle_new_user();

-- ---------------------------------------------------------------------------
-- Role escalation guard: only staff can change a role, only super_admin may
-- grant privileged roles.
-- ---------------------------------------------------------------------------
create or replace function public.jh_guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
begin
  if new.role_id is distinct from old.role_id then
    select p.role_id into v_actor_role from public.profiles p where p.id = v_actor;
    -- No JWT subject means a privileged server-side connection (service role or
    -- a migration run). Browser sessions always carry a subject.
    if v_actor is null then
      return new;
    end if;
    if v_actor = old.id then
      raise exception 'You cannot change your own role' using errcode = '42501';
    end if;
    if coalesce(v_actor_role, '') not in ('admin','super_admin') then
      raise exception 'Role changes require administrator access' using errcode = '42501';
    end if;
    if new.role_id in ('admin','super_admin','content_editor') and v_actor_role <> 'super_admin' then
      raise exception 'Only a super admin can grant privileged roles' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_role on public.profiles;
create trigger guard_profile_role
  before update on public.profiles
  for each row execute function public.jh_guard_profile_role();

-- ---------------------------------------------------------------------------
-- Column-level guard: never allow a question to become "approved" without an
-- explicit reviewer action; AI-assisted imports are always unverified.
-- ---------------------------------------------------------------------------
create or replace function public.jh_guard_question_verification()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.source_type = 'ai_assisted' and new.status = 'approved' and old.status is distinct from 'approved' then
    raise exception 'AI-assisted questions require explicit editorial approval' using errcode = '42501';
  end if;
  if new.status = 'approved' and new.is_verified is false then
    raise exception 'Approved questions must be verified';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_question_verification on public.questions;
create trigger guard_question_verification
  before update on public.questions
  for each row execute function public.jh_guard_question_verification();
