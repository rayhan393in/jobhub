-- ============================================================
-- QUESTION INTELLIGENCE ARCHITECTURE — additive only
-- Phases 2-6 schema from docs/architecture/phase2-9-migration-plan.md
-- Approved by owner 2026-11-21. No row deleted, no ID changed,
-- no existing constraint dropped. Rollback:
-- docs/architecture/rollback-20261124.sql
-- ============================================================

-- ---------- A. MASTER TAXONOMY LAYER ----------

create table if not exists canonical_subjects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_en text,
  title_bn text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table subjects
  add column if not exists canonical_subject_id uuid references canonical_subjects(id) on delete set null;

alter table canonical_topics
  add column if not exists canonical_subject_id uuid references canonical_subjects(id) on delete set null,
  add column if not exists approval_status text not null default 'approved';

-- Merge audit log: a merge is ONLY a canonical link, never a delete.
create table if not exists taxonomy_merges (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('subject','topic')),
  canonical_id uuid,
  member_ids uuid[] not null,
  status text not null default 'proposed' check (status in ('proposed','applied','rejected','reverted')),
  reason text,
  affected_questions integer not null default 0,
  affected_routines integer not null default 0,
  merged_by uuid,
  decided_at timestamptz,
  reverted_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace view v_canonical_topic_members as
select ct.id   as canonical_topic_id,
       ct.title_bn as canonical_title,
       ct.slug as canonical_slug,
       t.id    as topic_id,
       t.title_bn as topic_title,
       s.id    as subject_id,
       s.title_bn as subject_title,
       c.id    as course_id,
       c.slug  as course_slug,
       (select count(*) from questions q where q.topic_id = t.id and q.archived_at is null) as question_count,
       (select count(*) from routines r where t.id = any(r.topic_ids)) as routine_count
from canonical_topics ct
join topics t   on t.canonical_id = ct.id
join subjects s on s.id = t.subject_id
join courses c  on c.id = s.course_id;

-- ---------- B. CENTRAL QUESTION BANK LINKS ----------

-- One canonical question row (existing `questions`) can now surface in many
-- course/topic placements without being duplicated.
create table if not exists question_topic_links (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  course_id uuid not null references courses(id),
  subject_id uuid references subjects(id),
  topic_id uuid references topics(id),
  subtopic_id uuid references subtopics(id),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (question_id, course_id, topic_id)
);
create index if not exists idx_qtl_topic  on question_topic_links(topic_id);
create index if not exists idx_qtl_course on question_topic_links(course_id);

-- Backfill: existing single placement becomes the primary link (pure copy).
insert into question_topic_links (question_id, course_id, subject_id, topic_id, subtopic_id, is_primary)
select q.id, q.course_id, q.subject_id, q.topic_id, q.subtopic_id, true
from questions q
on conflict do nothing;

-- Every FUTURE question must get its primary link too, or it would be
-- invisible to the evidence/frequency engine (QA finding).
create or replace function jh_autolink_question()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into question_topic_links (question_id, course_id, subject_id, topic_id, subtopic_id, is_primary)
  values (new.id, new.course_id, new.subject_id, new.topic_id, new.subtopic_id, true)
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists trg_qtl_autolink on questions;
create trigger trg_qtl_autolink after insert on questions
  for each row execute function jh_autolink_question();

-- Keep the primary link in sync when a question's placement is edited.
create or replace function jh_sync_primary_link()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from question_topic_links
   where question_id = new.id and not is_primary
     and course_id = new.course_id and topic_id is not distinct from new.topic_id;
  update question_topic_links
     set course_id = new.course_id, subject_id = new.subject_id,
         topic_id = new.topic_id, subtopic_id = new.subtopic_id
   where question_id = new.id and is_primary;
  if not found then
    insert into question_topic_links (question_id, course_id, subject_id, topic_id, subtopic_id, is_primary)
    values (new.id, new.course_id, new.subject_id, new.topic_id, new.subtopic_id, true)
    on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists trg_qtl_sync on questions;
create trigger trg_qtl_sync after update of course_id, subject_id, topic_id, subtopic_id on questions
  for each row execute function jh_sync_primary_link();

create extension if not exists pg_trgm;
create index if not exists idx_questions_statement_trgm
  on questions using gin (lower(statement) gin_trgm_ops);

create table if not exists question_similarity (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  similar_question_id uuid not null references questions(id) on delete cascade,
  similarity numeric not null,
  kind text not null check (kind in ('exact','near','concept')),
  status text not null default 'pending' check (status in ('pending','confirmed','dismissed')),
  detected_at timestamptz not null default now(),
  unique (question_id, similar_question_id)
);

-- Detection reports; it never merges or deletes anything.
create or replace function jh_detect_similar_questions(p_threshold numeric default 0.80)
returns integer
language plpgsql security definer set search_path = public as $$
declare v_count integer := 0;
begin
  insert into question_similarity (question_id, similar_question_id, similarity, kind)
  select a.id, b.id,
         round(similarity(lower(a.statement), lower(b.statement))::numeric, 3),
         case
           when a.fingerprint = b.fingerprint then 'exact'
           when similarity(lower(a.statement), lower(b.statement)) >= 0.95 then 'near'
           else 'concept'
         end
  from questions a
  join questions b
    on b.id > a.id
   and (a.fingerprint = b.fingerprint
        or similarity(lower(a.statement), lower(b.statement)) >= p_threshold)
  where a.archived_at is null and b.archived_at is null
  on conflict (question_id, similar_question_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ---------- C. PREVIOUS-YEAR EVIDENCE ENGINE ----------

-- One row per VERIFIED appearance of a question in a real exam.
-- The same question asked in two different exams/years = two evidence rows.
create table if not exists evidence_records (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  exam_name text not null,
  exam_year smallint not null check (exam_year between 1971 and 2100),
  course_scope text,
  original_text text,
  source_document_id uuid references source_documents(id),
  source_ref text,
  source_url text,
  match_kind text not null default 'exact' check (match_kind in ('exact','same_concept','related')),
  verified_by uuid,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (question_id, exam_name, exam_year)
);
create index if not exists idx_evidence_question on evidence_records(question_id);

-- Frequency comes ONLY from verified evidence; zero evidence shows as zero,
-- and the UI must distinguish "no data collected yet" via v_evidence_coverage.
create or replace view v_topic_frequency as
select t.id  as topic_id,
       t.title_bn as topic_title,
       s.id  as subject_id,
       s.course_id,
       t.canonical_id as canonical_topic_id,
       count(er.id)                                   as evidence_count,
       count(distinct er.exam_name)                   as distinct_exams,
       count(distinct er.exam_year)                   as distinct_years,
       -- FILTER is essential: without it the NULL row from the LEFT JOIN counts as 1,
       -- making zero-evidence topics look like they have one exam-year of evidence.
       count(distinct (er.exam_name, er.exam_year)) filter (where er.id is not null) as distinct_exam_years,
       count(er.id) filter (where er.match_kind = 'exact')        as exact_matches,
       count(er.id) filter (where er.match_kind = 'same_concept') as concept_matches,
       count(er.id) filter (where er.match_kind = 'related')      as related_matches
from topics t
join subjects s on s.id = t.subject_id
left join question_topic_links qtl on qtl.topic_id = t.id
left join evidence_records er      on er.question_id = qtl.question_id
group by t.id, t.title_bn, s.id, s.course_id, t.canonical_id;

create or replace view v_question_bank as
select q.id, q.statement, q.difficulty, q.question_type, q.status, q.is_verified,
       q.source_type, q.exam_name, q.year, q.source_title,
       count(distinct qtl.course_id) as course_placements,
       count(qtl.id)                 as topic_placements,
       count(distinct er.id)         as evidence_count
from questions q
left join question_topic_links qtl on qtl.question_id = q.id
left join evidence_records er      on er.question_id  = q.id
where q.archived_at is null
group by q.id;

create or replace view v_evidence_coverage as
select c.slug as course,
       count(q.id) filter (where q.source_type = 'previous')                          as previous_questions,
       count(distinct er.question_id)                                                 as questions_with_evidence,
       count(q.id) filter (where q.source_type = 'previous' and q.year is not null)   as with_year_column,
       count(q.id) filter (where q.source_type = 'previous' and q.exam_name is not null) as with_exam_name,
       round(100.0 * count(distinct er.question_id)
             / nullif(count(q.id) filter (where q.source_type = 'previous'), 0), 1)   as coverage_pct
from courses c
left join questions q  on q.course_id = c.id and q.archived_at is null
left join evidence_records er on er.question_id = q.id
group by c.slug, c.sort_order
order by c.sort_order;

-- ---------- D. TOPIC PRIORITY (evidence-driven, AI-free) ----------

create table if not exists topic_priorities (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id),
  topic_id uuid not null references topics(id) on delete cascade,
  canonical_topic_id uuid,
  evidence_count integer not null default 0,
  distinct_exam_years integer not null default 0,
  shared_exam_years integer not null default 0,
  frequency_score numeric not null default 0,
  priority_level text not null default 'insufficient_evidence'
    check (priority_level in ('high','medium','low','insufficient_evidence')),
  is_manual_override boolean not null default false,
  computed_at timestamptz not null default now(),
  unique (course_id, topic_id)
);

-- Transparent formula (documented, no AI input):
--   own    = distinct (exam, year) appearances of this topic's own questions
--   shared = distinct (exam, year) appearances of sibling topics that share the
--            same canonical topic in OTHER courses, weighted 0.5
--   score  = own + 0.5 * shared
--   level  : score >= 6 high | >= 3 medium | >= 1 low | else insufficient_evidence
create or replace function jh_recompute_topic_priorities()
returns integer
language plpgsql security definer set search_path = public as $$
declare v_count integer := 0;
begin
  insert into topic_priorities as tp
    (course_id, topic_id, canonical_topic_id, evidence_count, distinct_exam_years,
     shared_exam_years, frequency_score, priority_level, computed_at)
  select f.course_id, f.topic_id, f.canonical_topic_id,
         f.evidence_count,
         f.distinct_exam_years,
         coalesce(sib.shared_years, 0),
         f.distinct_exam_years + 0.5 * coalesce(sib.shared_years, 0),
         case
           when f.distinct_exam_years + 0.5 * coalesce(sib.shared_years, 0) >= 6 then 'high'
           when f.distinct_exam_years + 0.5 * coalesce(sib.shared_years, 0) >= 3 then 'medium'
           when f.distinct_exam_years + 0.5 * coalesce(sib.shared_years, 0) >= 1 then 'low'
           else 'insufficient_evidence'
         end,
         now()
  from v_topic_frequency f
  left join lateral (
    select sum(f2.distinct_exam_years) as shared_years
    from v_topic_frequency f2
    where f2.canonical_topic_id is not null
      and f2.canonical_topic_id = f.canonical_topic_id
      and f2.topic_id <> f.topic_id
      and f2.course_id <> f.course_id
  ) sib on true
  on conflict (course_id, topic_id) do update
    set canonical_topic_id = excluded.canonical_topic_id,
        evidence_count      = excluded.evidence_count,
        distinct_exam_years = excluded.distinct_exam_years,
        shared_exam_years   = excluded.shared_exam_years,
        frequency_score     = excluded.frequency_score,
        priority_level      = excluded.priority_level,
        computed_at         = excluded.computed_at
    where tp.is_manual_override = false;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ---------- E. AI GENERATION METADATA + PREVIOUS-SOURCE GUARD ----------

create table if not exists ai_generations (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid,
  course_id uuid references courses(id),
  topic_id uuid references topics(id),
  difficulty text,
  model text,
  prompt_ref text,
  raw_output jsonb,
  question_id uuid references questions(id) on delete set null,
  created_at timestamptz not null default now()
);

-- A question may only BECOME source_type='previous' when at least one verified
-- evidence record exists. Existing previous rows and fresh imports are
-- unaffected (trigger fires only on the transition into 'previous').
create or replace function jh_guard_previous_source()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from evidence_records where question_id = new.id) then
    raise exception
      'question % cannot be marked source_type=previous without a verified evidence record', new.id;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_previous on questions;
create trigger trg_guard_previous
  before update of source_type on questions
  for each row
  when (new.source_type = 'previous' and old.source_type is distinct from 'previous')
  execute function jh_guard_previous_source();

-- ---------- SECURITY ----------
-- New tables: RLS on, no anon/auth policies (server uses service role which
-- bypasses RLS — same pattern as other admin-written tables).
alter table canonical_subjects   enable row level security;
alter table taxonomy_merges      enable row level security;
alter table question_topic_links enable row level security;
alter table question_similarity  enable row level security;
alter table evidence_records     enable row level security;
alter table topic_priorities     enable row level security;
alter table ai_generations       enable row level security;

-- FORCE is the project invariant (tests/db/schema.test.ts): even the table
-- owner is subject to RLS; postgres + service_role carry BYPASSRLS.
alter table canonical_subjects   force row level security;
alter table taxonomy_merges      force row level security;
alter table question_topic_links force row level security;
alter table question_similarity  force row level security;
alter table evidence_records     force row level security;
alter table topic_priorities     force row level security;
alter table ai_generations       force row level security;
alter table canonical_topics     force row level security;
alter table micro_topics         force row level security;

-- schema_migrations exists only where scripts/migrate.mjs created it.
do $$ begin
  if to_regclass('public.schema_migrations') is not null then
    execute 'alter table public.schema_migrations enable row level security';
    execute 'alter table public.schema_migrations force row level security';
  end if;
end $$;

-- Kill Supabase's default table privileges first: they grant anon and
-- authenticated FULL access (including TRUNCATE, which RLS does NOT cover).
-- Grants decide whether a role may even attempt an operation; RLS then
-- narrows rows. Writes go exclusively through the service role.
revoke all on canonical_subjects, taxonomy_merges, question_topic_links,
  question_similarity, evidence_records, topic_priorities, ai_generations
  from anon, authenticated;
grant select on question_topic_links, topic_priorities, canonical_subjects to authenticated;

-- The server (service role) is the only writer.
grant all on canonical_subjects, taxonomy_merges, question_topic_links,
  question_similarity, evidence_records, topic_priorities, ai_generations to service_role;
grant select on v_canonical_topic_members, v_topic_frequency, v_question_bank,
  v_evidence_coverage to service_role;
grant execute on function jh_detect_similar_questions(numeric) to service_role;
grant execute on function jh_recompute_topic_priorities() to service_role;

-- Admin-only read models must not be readable through the anon REST API:
-- views run with OWNER rights, so a grant here would bypass table RLS
-- (v_question_bank exposes correct answers — QA finding).
revoke all on v_canonical_topic_members, v_topic_frequency, v_question_bank,
  v_evidence_coverage from anon, authenticated;

-- canonical_topics (from an earlier migration) had the same default-privilege
-- exposure; staff read it via its RLS policy, nobody writes it as a client role.
revoke all on canonical_topics from anon, authenticated;
grant select on canonical_topics to authenticated;
grant all on canonical_topics to service_role;

-- Global hardening: TRUNCATE is NOT subject to RLS and nothing legitimate
-- truncates as a client role; anon never writes anything.
revoke truncate on all tables in schema public from anon, authenticated;
revoke insert, update, delete on all tables in schema public from anon;

-- Authenticated users may read links/priorities (needed for app pages).
drop policy if exists qtl_read on question_topic_links;
create policy qtl_read  on question_topic_links for select to authenticated using (true);
drop policy if exists tp_read on topic_priorities;
create policy tp_read   on topic_priorities     for select to authenticated using (true);
drop policy if exists cs_read on canonical_subjects;
create policy cs_read   on canonical_subjects   for select to authenticated using (true);

-- ---------- F. APPLIED-STATE EXTRAS (ran live 2026-11-21) ----------
-- Unique slug needed for idempotent canonical seeding.
create unique index if not exists canonical_topics_slug_key on canonical_topics(slug);

-- Topic pre-link seed (approved decision: "pre-link the unambiguous ones").
-- Rule R1: same normalized title across job-prep/basic-level courses only;
-- any group touching advanced subjects (উচ্চতর গণিত / EEE / science) is NOT
-- linked and is instead recorded in taxonomy_merges as status='proposed'
-- for human review. Every applied link is logged in taxonomy_merges with
-- member_ids, reason and affected counts; rollback = set canonical_id null.
-- (The exact seed SQL that ran is preserved in docs/architecture/rollback-20261124.sql
--  header comments; it is data, not schema, so it is not repeated here verbatim.)

-- NOTE: this file does NOT insert into schema_migrations itself —
-- scripts/migrate.mjs records the ledger row (and the test harness has no
-- such table). Every statement above is idempotent, so a re-run is safe.
