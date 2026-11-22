-- Advanced Subject / Topic / Subtopic management upgrade.
--
-- Adds (purely additive — no existing row is modified or deleted):
--   1. canonical_topics  — central, course-agnostic topic library so a common
--      topic (সন্ধি, Tense, শতকরা…) is created once and mapped to many courses.
--   2. topics            — approval workflow (pending → approved/rejected),
--      previous-year occurrence list, source reference URL, canonical link.
--   3. subtopics         — the same approval workflow.
--   4. micro_topics      — a fourth level below subtopics.
--   5. routines          — multi-topic / multi-subtopic selection per entry.
--
-- RLS mirrors the existing model: public reads only content of published
-- courses; staff read everything; writes require taxonomy.manage.

-- 1) Central topic library ---------------------------------------------------
create table if not exists public.canonical_topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_en text not null,
  title_bn text not null,
  subject_group text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.canonical_topics enable row level security;

drop policy if exists "staff read canonical topics" on public.canonical_topics;
create policy "staff read canonical topics"
  on public.canonical_topics for select to authenticated
  using (jh_is_staff());

drop policy if exists "staff write canonical topics" on public.canonical_topics;
create policy "staff write canonical topics"
  on public.canonical_topics for all to authenticated
  using (jh_has_permission('taxonomy.manage'::text))
  with check (jh_has_permission('taxonomy.manage'::text));

-- 2) Topic research + approval metadata --------------------------------------
alter table public.topics
  add column if not exists approval_status text not null default 'approved',
  add column if not exists source_url text,
  add column if not exists occurrence_years jsonb not null default '[]'::jsonb,
  add column if not exists canonical_id uuid references public.canonical_topics(id) on delete set null;

do $$ begin
  alter table public.topics
    add constraint topics_approval_status_check
    check (approval_status in ('pending', 'approved', 'rejected'));
exception when duplicate_object then null; end $$;

create index if not exists topics_approval_status_idx on public.topics (approval_status);
create index if not exists topics_canonical_id_idx on public.topics (canonical_id);

-- 3) Subtopic approval workflow ----------------------------------------------
alter table public.subtopics
  add column if not exists approval_status text not null default 'approved';

do $$ begin
  alter table public.subtopics
    add constraint subtopics_approval_status_check
    check (approval_status in ('pending', 'approved', 'rejected'));
exception when duplicate_object then null; end $$;

create index if not exists subtopics_approval_status_idx on public.subtopics (approval_status);

-- 4) Micro-topics (fourth level) ----------------------------------------------
create table if not exists public.micro_topics (
  id uuid primary key default gen_random_uuid(),
  subtopic_id uuid not null references public.subtopics(id) on delete cascade,
  slug text not null,
  title_en text not null,
  title_bn text not null,
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  approval_status text not null default 'approved'
    check (approval_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subtopic_id, slug)
);

create index if not exists micro_topics_subtopic_idx on public.micro_topics (subtopic_id);

alter table public.micro_topics enable row level security;

drop policy if exists "public reads micro topics of published courses" on public.micro_topics;
create policy "public reads micro topics of published courses"
  on public.micro_topics for select to anon, authenticated
  using (exists (
    select 1
    from public.subtopics st
    join public.topics t on t.id = st.topic_id
    join public.subjects s on s.id = t.subject_id
    join public.courses c on c.id = s.course_id
    where st.id = micro_topics.subtopic_id and c.status = 'published'::text
  ));

drop policy if exists "staff read micro topics" on public.micro_topics;
create policy "staff read micro topics"
  on public.micro_topics for select to authenticated
  using (jh_is_staff());

drop policy if exists "staff write micro topics" on public.micro_topics;
create policy "staff write micro topics"
  on public.micro_topics for all to authenticated
  using (jh_has_permission('taxonomy.manage'::text))
  with check (jh_has_permission('taxonomy.manage'::text));

-- 5) Multi-topic routine entries ----------------------------------------------
alter table public.routines
  add column if not exists topic_ids uuid[] not null default '{}'::uuid[],
  add column if not exists subtopic_ids uuid[] not null default '{}'::uuid[];
