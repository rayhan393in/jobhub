-- ============================================================================
-- JobHub — fixed 100-mark structure, question provenance, Drive sources
--
-- Three gaps this closes, all driven by the real material already in the
-- user's Google Drive:
--
--  1. `questions` had no way to record *which exam* a question came from
--     (৪০তম BCS, Bank 2012) or *which book/chapter/page* its explanation
--     follows. The existing CSV in Drive already carries exam_name, exam_year,
--     source_title, source_locator and author columns that had nowhere to go.
--  2. No source registry, so "no fabricated questions" could not be enforced:
--     there was no row to point at when asking where a question came from.
--  3. Papers were all-or-nothing on the verified pool, with no difficulty
--     mix, so a 100-mark paper could not honour 60/20/10/10.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Where a question came from
-- ---------------------------------------------------------------------------
alter table public.questions
  add column if not exists exam_name         text,
  add column if not exists question_type     text not null default 'mcq'
    check (question_type in ('mcq', 'written')),
  -- The CSV that started all of this uses source_type='previous' for real past
  -- exam questions; the original check constraint had no such value.
  add column if not exists source_title      text,
  add column if not exists source_locator    text,
  add column if not exists source_url        text,
  add column if not exists source_file_id    text,
  add column if not exists book_chapter      text,
  add column if not exists book_page         integer check (book_page is null or book_page > 0),
  add column if not exists author            text,
  add column if not exists edition           text;

-- Widen the source_type constraint to include past-exam questions.
alter table public.questions drop constraint if exists questions_source_type_check;
alter table public.questions
  add constraint questions_source_type_check
  check (source_type in ('manual', 'csv_import', 'json_import', 'ai_assisted', 'previous'));

comment on column public.questions.exam_name is
  'Named paper the question came from, e.g. ৪০তম BCS বা Bank Recruitment 2012.';
comment on column public.questions.source_file_id is
  'Google Drive file id backing the question. NULL means no source document.';

create index if not exists questions_exam_name_idx on public.questions(exam_name);
create index if not exists questions_source_type_idx on public.questions(source_type, difficulty);

-- ---------------------------------------------------------------------------
-- Registered source documents (Google Drive books, PDFs, study material)
-- ---------------------------------------------------------------------------
create table if not exists public.source_documents (
  id             uuid primary key default gen_random_uuid(),
  course_id      uuid references public.courses(id) on delete set null,
  title          text not null,
  author         text,
  edition        text,
  doc_type       text not null default 'book'
                   check (doc_type in ('book', 'past_paper', 'note', 'syllabus', 'routine')),
  drive_file_id  text,
  drive_url      text,
  page_count     integer,
  notes          text,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index if not exists source_documents_drive_idx
  on public.source_documents(drive_file_id) where drive_file_id is not null;

alter table public.source_documents enable row level security;
alter table public.source_documents force row level security;

drop policy if exists "staff read sources" on public.source_documents;
create policy "staff read sources" on public.source_documents
  for select to authenticated using (public.jh_is_staff());

drop policy if exists "staff write sources" on public.source_documents;
create policy "staff write sources" on public.source_documents
  for all to authenticated using (public.jh_has_permission('question.import'))
  with check (public.jh_has_permission('question.import'));

-- ---------------------------------------------------------------------------
-- Difficulty mix on a paper
--
-- The composition already decides the topic split; this decides the difficulty
-- split inside each topic, which is where 60/20/10/10 actually bites. Stored on
-- the paper so a past result stays explainable even if the defaults change.
-- ---------------------------------------------------------------------------
alter table public.exam_papers
  add column if not exists difficulty_mix jsonb
    default '{"previous":60,"hard":20,"easy":10,"medium":10}'::jsonb;

comment on column public.exam_papers.difficulty_mix is
  'Percent split by difficulty. previous = real past-exam questions.';

-- ---------------------------------------------------------------------------
-- Grading an MCQ paper out of exactly 100 marks
--
-- The default +1/-0.5 marking gives one mark per question, so a 100-mark paper
-- is 100 questions. That is fine but rigid; a 50-question paper should also be
-- able to total 100 (2 marks each). `exam_papers.total_marks` already exists —
-- this makes the marking arithmetic derive from it instead of assuming 1.
-- ---------------------------------------------------------------------------
create or replace function public.jh_paper_marks(p_paper_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'question_count', p.question_count,
    'total_marks',    p.total_marks,
    'positive_marks', p.positive_marks,
    'negative_marks', p.negative_marks,
    'structure_ok',   p.total_marks = 100
  )
  from public.exam_papers p
  where p.id = p_paper_id;
$$;

revoke all on function public.jh_paper_marks(uuid) from public;
grant execute on function public.jh_paper_marks(uuid) to authenticated;
