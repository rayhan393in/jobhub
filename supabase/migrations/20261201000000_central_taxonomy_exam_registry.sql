-- =============================================================================
-- 20261201000000_central_taxonomy_exam_registry.sql
--
-- CENTRAL ACADEMIC TAXONOMY + REFERENCE-BASED QUESTION BANK (Phases 2-6 core)
--
-- What this migration does (ALL ADDITIVE — no renames, no deletes, no merges):
--   CHUNK:1  Structure:
--            - archival columns on canonical_subjects / canonical_topics
--            - NEW canonical_subtopics + subtopics.canonical_id
--            - NEW exam_registry (exam name + year + stage + position, status)
--            - evidence_records: exam_id FK, exam_stage, source_page
--            - questions.question_kind 4-way classification
--              ('exact_pyq' | 'similar_concept' | 'practice' | 'ai_generated')
--              with an honesty trigger: 'exact_pyq' / 'similar_concept' can only
--              be set when a matching VERIFIED evidence record exists.
--            - v_exam_question_analytics: analytics from verified refs ONLY.
--   CHUNK:2  Seed 27 canonical subjects (15 common + 12 shared-technical).
--            on conflict (slug) do nothing — reruns are no-ops.
--   CHUNK:3  Explicitly audited subject -> canonical mappings (76 pairs, each
--            hand-reviewed from the live inventory of 89 course subjects).
--            NO fuzzy/auto matching. Mixed-meaning subjects (e.g. "GK & ICT",
--            "General Section", "Higher Mathematics") are deliberately LEFT
--            UNMAPPED. Only fills canonical_subject_id where it is NULL.
--   CHUNK:4  Canonical TOPIC LIBRARY (91 'lib-*' rows) as central candidates.
--            Course topics are NOT auto-linked to them — linking stays an
--            explicit admin action (taxonomy workbench / merge review).
--
-- What it does NOT do:
--   - does not touch the BCS 10/137/366 syllabus rows;
--   - does not modify any existing question row except the additive
--     question_kind backfill (source_type='ai_assisted' -> 'ai_generated');
--   - does not invent any exam year: exam_registry starts EMPTY and
--     year_verified defaults to false.
--
-- ROLLBACK:
--   drop view if exists public.v_exam_question_analytics;
--   drop trigger if exists trg_questions_kind_honesty on public.questions;
--   drop function if exists public.jh_enforce_question_kind();
--   alter table public.questions drop column if exists question_kind;
--   alter table public.evidence_records
--     drop column if exists exam_id, drop column if exists exam_stage,
--     drop column if exists source_page;
--   drop table if exists public.exam_registry;
--   alter table public.subtopics drop column if exists canonical_id;
--   drop table if exists public.canonical_subtopics;
--   delete from public.canonical_topics where slug like 'lib-%';
--   update public.subjects set canonical_subject_id = null
--     where canonical_subject_id in (select id from public.canonical_subjects where slug like 'cs-%');
--   delete from public.canonical_subjects where slug like 'cs-%';
--   alter table public.canonical_subjects drop column if exists is_active, drop column if exists archived_at;
--   alter table public.canonical_topics  drop column if exists is_active, drop column if exists archived_at;
-- =============================================================================

-- CHUNK:1 — structure

-- 1a. Archival (soft-delete) columns for canonical records referenced elsewhere.
alter table public.canonical_subjects
  add column if not exists is_active boolean not null default true,
  add column if not exists archived_at timestamptz;

alter table public.canonical_topics
  add column if not exists is_active boolean not null default true,
  add column if not exists archived_at timestamptz;

-- 1b. Canonical subtopic library (completes Subject -> Topic -> Subtopic).
create table if not exists public.canonical_subtopics (
  id                 uuid primary key default gen_random_uuid(),
  canonical_topic_id uuid not null references public.canonical_topics(id) on delete cascade,
  slug               text not null unique,
  title_en           text not null,
  title_bn           text not null,
  description        text,
  is_active          boolean not null default true,
  archived_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists canonical_subtopics_topic_idx
  on public.canonical_subtopics (canonical_topic_id);

alter table public.subtopics
  add column if not exists canonical_id uuid references public.canonical_subtopics(id) on delete set null;

create index if not exists subtopics_canonical_id_idx on public.subtopics (canonical_id);

alter table public.canonical_subtopics enable row level security;
alter table public.canonical_subtopics force row level security;

drop policy if exists "staff read canonical subtopics" on public.canonical_subtopics;
create policy "staff read canonical subtopics"
  on public.canonical_subtopics for select to authenticated
  using (public.jh_is_staff());

drop policy if exists "staff write canonical subtopics" on public.canonical_subtopics;
create policy "staff write canonical subtopics"
  on public.canonical_subtopics for all to authenticated
  using (public.jh_is_staff()) with check (public.jh_is_staff());

revoke all on public.canonical_subtopics from anon;
grant select, insert, update, delete on public.canonical_subtopics to authenticated;
grant all on public.canonical_subtopics to service_role;

-- 1c. Exam registry: every examination becomes a first-class record.
--     exam_year is NULLABLE on purpose: an unverified year is stored as NULL +
--     year_verified=false, never guessed.
create table if not exists public.exam_registry (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  exam_name          text not null check (length(btrim(exam_name)) >= 3),
  exam_name_bn       text,
  exam_body          text,                       -- e.g. BPSC, NTRCA, Petrobangla
  exam_year          smallint check (exam_year is null or exam_year between 1971 and 2100),
  exam_date          date,
  exam_stage         text not null default 'preliminary'
                       check (exam_stage in ('preliminary','written','viva','technical','practical','other')),
  position_title     text,                       -- recruitment position, if any
  course_id          uuid references public.courses(id) on delete set null,
  status             text not null default 'draft'
                       check (status in ('draft','published','archived')),
  year_verified      boolean not null default false,
  source_document_id uuid references public.source_documents(id) on delete set null,
  source_url         text,
  notes              text,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- honesty invariant: a year can only be "verified" if a year is present
  check (not year_verified or exam_year is not null)
);

-- One identity per (name, year, stage, position) — case-insensitive, NULL-safe.
create unique index if not exists exam_registry_identity_key
  on public.exam_registry (lower(exam_name), coalesce(exam_year, 0), exam_stage, coalesce(lower(position_title), ''));

create index if not exists exam_registry_year_idx  on public.exam_registry (exam_year);
create index if not exists exam_registry_stage_idx on public.exam_registry (exam_stage);

alter table public.exam_registry enable row level security;
alter table public.exam_registry force row level security;

drop policy if exists "students read published exams" on public.exam_registry;
create policy "students read published exams"
  on public.exam_registry for select to authenticated
  using (status = 'published' or public.jh_is_staff());

drop policy if exists "staff write exam registry" on public.exam_registry;
create policy "staff write exam registry"
  on public.exam_registry for all to authenticated
  using (public.jh_is_staff()) with check (public.jh_is_staff());

revoke all on public.exam_registry from anon;
grant select, insert, update, delete on public.exam_registry to authenticated;
grant all on public.exam_registry to service_role;

-- 1d. Evidence records learn the registry + page-level provenance.
alter table public.evidence_records
  add column if not exists exam_id     uuid references public.exam_registry(id) on delete set null,
  add column if not exists exam_stage  text check (exam_stage is null or exam_stage in ('preliminary','written','viva','technical','practical','other')),
  add column if not exists source_page integer check (source_page is null or source_page > 0);

create index if not exists evidence_records_exam_id_idx on public.evidence_records (exam_id);

-- 1e. Four-way question classification.
alter table public.questions
  add column if not exists question_kind text not null default 'practice'
    check (question_kind in ('exact_pyq','similar_concept','practice','ai_generated'));

create index if not exists questions_kind_idx on public.questions (question_kind);

-- Backfill PROVENANCE only (no quality claim): AI-assisted imports are labelled.
update public.questions
   set question_kind = 'ai_generated'
 where source_type = 'ai_assisted'
   and question_kind = 'practice';

-- Honesty trigger: 'exact_pyq' requires a VERIFIED exact evidence record;
-- 'similar_concept' requires verified same_concept/related evidence.
-- Nothing can be labelled a PYQ without traceable proof.
create or replace function public.jh_enforce_question_kind()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.question_kind = 'exact_pyq' then
    if not exists (
      select 1 from public.evidence_records er
       where er.question_id = new.id
         and er.match_kind = 'exact'
         and er.verified_by is not null
    ) then
      raise exception 'question % cannot be labelled exact_pyq: no verified exact evidence record', new.id;
    end if;
  elsif new.question_kind = 'similar_concept' then
    if not exists (
      select 1 from public.evidence_records er
       where er.question_id = new.id
         and er.match_kind in ('same_concept','related')
         and er.verified_by is not null
    ) then
      raise exception 'question % cannot be labelled similar_concept: no verified concept evidence record', new.id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_questions_kind_honesty on public.questions;
create trigger trg_questions_kind_honesty
  before insert or update of question_kind on public.questions
  for each row
  when (new.question_kind in ('exact_pyq','similar_concept'))
  execute function public.jh_enforce_question_kind();

-- Trigger functions do not need caller EXECUTE to fire; keep the anon surface
-- at exactly the two deliberately-public functions.
revoke execute on function public.jh_enforce_question_kind() from public, anon, authenticated;

-- 1f. Historical analytics — VERIFIED references only.
--     A missing (exam, subject) pair simply produces no row: the UI must render
--     "Insufficient Verified Historical Data", never zero.
create or replace view public.v_exam_question_analytics as
select x.id            as exam_id,
       x.exam_name,
       x.exam_year,
       x.exam_stage,
       x.position_title,
       q.course_id,
       q.subject_id,
       q.topic_id,
       q.subtopic_id,
       count(distinct q.id) as question_count
from public.exam_registry x
join public.evidence_records er
  on er.exam_id = x.id
 and er.verified_by is not null
join public.questions q
  on q.id = er.question_id
where x.status = 'published'
  and x.year_verified
group by x.id, x.exam_name, x.exam_year, x.exam_stage, x.position_title,
         q.course_id, q.subject_id, q.topic_id, q.subtopic_id;

revoke all on public.v_exam_question_analytics from anon;
grant select on public.v_exam_question_analytics to authenticated;
grant select on public.v_exam_question_analytics to service_role;

-- CHUNK:2 — canonical subject seeds (27). Stable slugs, idempotent.
insert into public.canonical_subjects (slug, title_en, title_bn)
values
  ('cs-bangla',                   'Bangla Language & Literature',      'বাংলা ভাষা ও সাহিত্য'),
  ('cs-english',                  'English Language & Literature',     'ইংরেজি ভাষা ও সাহিত্য'),
  ('cs-mathematics',              'Mathematics',                       'গণিত'),
  ('cs-general-knowledge',        'General Knowledge',                 'সাধারণ জ্ঞান'),
  ('cs-bangladesh-affairs',       'Bangladesh Affairs',                'বাংলাদেশ বিষয়াবলি'),
  ('cs-international-affairs',    'International Affairs',             'আন্তর্জাতিক বিষয়াবলি'),
  ('cs-general-science',          'General Science',                   'সাধারণ বিজ্ঞান'),
  ('cs-ict',                      'ICT and Computer Knowledge',        'আইসিটি ও কম্পিউটার'),
  ('cs-mental-ability',           'Mental Ability',                    'মানসিক দক্ষতা'),
  ('cs-geography-environment',    'Geography and Environment',         'ভূগোল ও পরিবেশ'),
  ('cs-ethics-governance',        'Ethics, Values and Governance',     'নৈতিকতা, মূল্যবোধ ও সুশাসন'),
  ('cs-current-affairs',          'Current Affairs',                   'সাম্প্রতিক বিষয়াবলি'),
  ('cs-engineering-math',         'Engineering Mathematics',           'ইঞ্জিনিয়ারিং গণিত'),
  ('cs-analytical-reasoning',     'Analytical and Logical Reasoning',  'বিশ্লেষণাত্মক ও যৌক্তিক দক্ষতা'),
  ('cs-general-aptitude',         'General Aptitude',                  'সাধারণ অ্যাপটিটিউড'),
  ('cs-electrical-circuits',      'Electrical Circuit Theory',         'ইলেকট্রিক্যাল সার্কিট তত্ত্ব'),
  ('cs-electrical-machines',      'Electrical Machines',               'ইলেকট্রিক্যাল মেশিন'),
  ('cs-power-systems',            'Power Systems',                     'পাওয়ার সিস্টেম'),
  ('cs-power-generation',         'Power Generation',                  'বিদ্যুৎ উৎপাদন'),
  ('cs-transmission-distribution','Power Transmission & Distribution', 'বিদ্যুৎ সঞ্চালন ও বিতরণ'),
  ('cs-power-electronics',        'Power Electronics',                 'পাওয়ার ইলেকট্রনিক্স'),
  ('cs-control-systems',          'Control Systems',                   'কন্ট্রোল সিস্টেম'),
  ('cs-analog-electronics',       'Analog Electronics',                'অ্যানালগ ইলেকট্রনিক্স'),
  ('cs-digital-electronics',      'Digital Electronics',               'ডিজিটাল ইলেকট্রনিক্স'),
  ('cs-electrical-measurements',  'Electrical Measurements',           'ইলেকট্রিক্যাল পরিমাপ'),
  ('cs-protection-switchgear',    'Protection & Switchgear',           'প্রোটেকশন ও সুইচগিয়ার'),
  ('cs-electrical-safety',        'Electrical Installation & Safety',  'ইলেকট্রিক্যাল ইনস্টলেশন ও নিরাপত্তা')
on conflict (slug) do nothing;

-- CHUNK:3 — audited subject -> canonical mappings.
-- Every pair below was hand-reviewed against the live inventory (89 subjects,
-- 2026-11-23 audit). Mixed-meaning subjects are intentionally absent:
--   university-admission: physics, chemistry, biology, higher-math, gk-ict
--   technical-recruitment: basic-electrical, electronics, safety-maintenance, general-section
--   eee: renewable, micro        petrobangla: pb-energy-sector, pb-petrobangla
-- Only fills NULLs — an admin's later decision is never overwritten.
update public.subjects s
   set canonical_subject_id = cs.id
  from (values
    -- cs-bangla
    ('bcs','bangla','cs-bangla'),
    ('government-jobs','bangla','cs-bangla'),
    ('ntrca','bangla','cs-bangla'),
    ('primary-teacher','bangla','cs-bangla'),
    ('university-admission','bangla','cs-bangla'),
    ('petrobangla-ae-eee','pb-bangla','cs-bangla'),
    -- cs-english
    ('bcs','english','cs-english'),
    ('government-jobs','english','cs-english'),
    ('ntrca','english','cs-english'),
    ('primary-teacher','english','cs-english'),
    ('university-admission','english','cs-english'),
    ('petrobangla-ae-eee','pb-english','cs-english'),
    ('private-jobs','english-communication','cs-english'),
    -- cs-mathematics
    ('bcs','math','cs-mathematics'),
    ('government-jobs','math','cs-mathematics'),
    ('ntrca','math','cs-mathematics'),
    ('primary-teacher','math','cs-mathematics'),
    ('petrobangla-ae-eee','pb-math','cs-mathematics'),
    ('private-jobs','analytical-math','cs-mathematics'),
    -- cs-general-knowledge
    ('ntrca','general-knowledge','cs-general-knowledge'),
    ('primary-teacher','general-knowledge','cs-general-knowledge'),
    ('private-jobs','gk-current','cs-general-knowledge'),
    -- cs-bangladesh-affairs
    ('bcs','bd','cs-bangladesh-affairs'),
    ('government-jobs','bangladesh-affairs','cs-bangladesh-affairs'),
    ('petrobangla-ae-eee','pb-bangladesh','cs-bangladesh-affairs'),
    -- cs-international-affairs
    ('bcs','international','cs-international-affairs'),
    ('government-jobs','international-affairs','cs-international-affairs'),
    ('petrobangla-ae-eee','pb-international','cs-international-affairs'),
    -- cs-general-science
    ('bcs','science','cs-general-science'),
    ('government-jobs','general-science','cs-general-science'),
    ('petrobangla-ae-eee','pb-science','cs-general-science'),
    ('primary-teacher','science-tech','cs-general-science'),
    -- cs-ict
    ('bcs','ict','cs-ict'),
    ('government-jobs','computer-ict','cs-ict'),
    ('petrobangla-ae-eee','pb-ict','cs-ict'),
    ('private-jobs','computer-skills','cs-ict'),
    -- cs-mental-ability
    ('bcs','mental','cs-mental-ability'),
    ('government-jobs','mental-ability','cs-mental-ability'),
    ('primary-teacher','mental-ability','cs-mental-ability'),
    -- singles
    ('bcs','geography','cs-geography-environment'),
    ('bcs','ethics','cs-ethics-governance'),
    ('petrobangla-ae-eee','pb-current-affairs','cs-current-affairs'),
    ('eee','eng-math','cs-engineering-math'),
    ('private-jobs','iq-aptitude','cs-general-aptitude'),
    -- shared technical
    ('eee','circuit','cs-electrical-circuits'),
    ('petrobangla-ae-eee','circuit-theory','cs-electrical-circuits'),
    ('petrobangla-ae-eee','ac-circuits','cs-electrical-circuits'),
    ('eee','machines','cs-electrical-machines'),
    ('technical-recruitment','electrical-machines','cs-electrical-machines'),
    ('petrobangla-ae-eee','machines-fundamentals','cs-electrical-machines'),
    ('petrobangla-ae-eee','transformer','cs-electrical-machines'),
    ('petrobangla-ae-eee','dc-machines','cs-electrical-machines'),
    ('petrobangla-ae-eee','induction-motor','cs-electrical-machines'),
    ('petrobangla-ae-eee','synchronous-machines','cs-electrical-machines'),
    ('eee','power','cs-power-systems'),
    ('technical-recruitment','power-system','cs-power-systems'),
    ('petrobangla-ae-eee','power-system-analysis','cs-power-systems'),
    ('eee','generation','cs-power-generation'),
    ('petrobangla-ae-eee','power-generation','cs-power-generation'),
    ('eee','transmission','cs-transmission-distribution'),
    ('petrobangla-ae-eee','transmission-distribution','cs-transmission-distribution'),
    ('eee','power-electronics','cs-power-electronics'),
    ('petrobangla-ae-eee','power-electronics-eee','cs-power-electronics'),
    ('eee','control','cs-control-systems'),
    ('petrobangla-ae-eee','control-systems','cs-control-systems'),
    ('eee','analog','cs-analog-electronics'),
    ('petrobangla-ae-eee','analog-electronics','cs-analog-electronics'),
    ('eee','digital','cs-digital-electronics'),
    ('petrobangla-ae-eee','digital-electronics','cs-digital-electronics'),
    ('eee','measurement','cs-electrical-measurements'),
    ('petrobangla-ae-eee','measurements','cs-electrical-measurements'),
    ('technical-recruitment','measurement','cs-electrical-measurements'),
    ('eee','protection','cs-protection-switchgear'),
    ('petrobangla-ae-eee','protection-switchgear','cs-protection-switchgear'),
    ('eee','safety','cs-electrical-safety'),
    ('petrobangla-ae-eee','installation-safety','cs-electrical-safety')
  ) as m(course_slug, subject_slug, canonical_slug)
  join public.courses c on c.slug = m.course_slug
  join public.canonical_subjects cs on cs.slug = m.canonical_slug
 where s.course_id = c.id
   and s.slug = m.subject_slug
   and s.canonical_subject_id is null;

-- CHUNK:4 — canonical topic LIBRARY (central candidates, 'lib-' prefix).
-- These do NOT touch any course syllabus. Course topics are linked to them only
-- through explicit admin action. Existing syllabus records take precedence.
insert into public.canonical_topics (slug, title_en, title_bn, subject_group, canonical_subject_id)
select v.slug, v.title_en, v.title_bn, v.grp, cs.id
from (values
  -- বাংলা (cs-bangla)
  ('lib-bn-dhwani-barna',      'Phonemes and Letters',            'ধ্বনি ও বর্ণ',                    'cs-bangla'),
  ('lib-bn-shabda-pada',       'Words and Parts of Speech',       'শব্দ ও পদ',                       'cs-bangla'),
  ('lib-bn-sandhi',            'Sandhi',                          'সন্ধি',                           'cs-bangla'),
  ('lib-bn-samas',             'Samas (Compounds)',               'সমাস',                            'cs-bangla'),
  ('lib-bn-karok-bivokti',     'Karok and Bivokti',               'কারক ও বিভক্তি',                  'cs-bangla'),
  ('lib-bn-uposorgo-prottoy',  'Prefixes and Suffixes',           'উপসর্গ ও প্রত্যয়',                'cs-bangla'),
  ('lib-bn-bakko',             'Sentences and Transformation',    'বাক্য ও বাক্য পরিবর্তন',          'cs-bangla'),
  ('lib-bn-shuddhikoron',      'Correction',                      'শুদ্ধিকরণ',                       'cs-bangla'),
  ('lib-bn-bagdhara',          'Idioms and Proverbs',             'বাগধারা ও প্রবাদ',                'cs-bangla'),
  ('lib-bn-ek-kothay',         'One-word Substitution',           'এককথায় প্রকাশ',                  'cs-bangla'),
  ('lib-bn-somarthok',         'Synonyms and Antonyms',           'সমার্থক ও বিপরীতার্থক শব্দ',      'cs-bangla'),
  ('lib-bn-sahitto',           'Bangla Literature',               'বাংলা সাহিত্য',                   'cs-bangla'),
  ('lib-bn-jug-vag',           'Ancient, Medieval & Modern Eras', 'প্রাচীন, মধ্যযুগ ও আধুনিক সাহিত্য','cs-bangla'),
  ('lib-bn-sahityik',          'Writers and Their Works',         'সাহিত্যিক ও তাঁদের রচনা',         'cs-bangla'),
  -- English (cs-english)
  ('lib-en-parts-of-speech',   'Parts of Speech',                 'পার্টস অব স্পিচ',                 'cs-english'),
  ('lib-en-tense',             'Tense',                           'টেন্স',                           'cs-english'),
  ('lib-en-voice',             'Voice',                           'ভয়েস',                           'cs-english'),
  ('lib-en-narration',         'Narration',                       'ন্যারেশন',                        'cs-english'),
  ('lib-en-sv-agreement',      'Subject-Verb Agreement',          'সাবজেক্ট-ভার্ব এগ্রিমেন্ট',       'cs-english'),
  ('lib-en-articles',          'Articles',                        'আর্টিকেল',                        'cs-english'),
  ('lib-en-prepositions',      'Prepositions',                    'প্রিপজিশন',                       'cs-english'),
  ('lib-en-right-verbs',       'Right Forms of Verbs',            'রাইট ফর্মস অব ভার্বস',            'cs-english'),
  ('lib-en-clauses',           'Clauses and Phrases',             'ক্লজ ও ফ্রেজ',                    'cs-english'),
  ('lib-en-transformation',    'Transformation',                  'ট্রান্সফরমেশন',                   'cs-english'),
  ('lib-en-correction',        'Sentence Correction',             'সেনটেন্স কারেকশন',                'cs-english'),
  ('lib-en-vocabulary',        'Vocabulary',                      'ভোকাবুলারি',                      'cs-english'),
  ('lib-en-syn-ant',           'Synonyms and Antonyms',           'সিনোনিম ও অ্যান্টোনিম',           'cs-english'),
  ('lib-en-idioms',            'Idioms and Phrases',              'ইডিয়মস ও ফ্রেজেস',               'cs-english'),
  ('lib-en-spelling',          'Spelling',                        'স্পেলিং',                         'cs-english'),
  ('lib-en-comprehension',     'Comprehension',                   'কম্প্রিহেনশন',                    'cs-english'),
  ('lib-en-composition',       'Composition',                     'কম্পোজিশন',                       'cs-english'),
  ('lib-en-literature',        'English Literature',              'ইংরেজি সাহিত্য',                  'cs-english'),
  -- Mathematics (cs-mathematics)
  ('lib-math-number-system',   'Number System',                   'সংখ্যা পদ্ধতি',                   'cs-mathematics'),
  ('lib-math-percentage',      'Percentage',                      'শতকরা',                           'cs-mathematics'),
  ('lib-math-profit-loss',     'Profit and Loss',                 'লাভ-ক্ষতি',                       'cs-mathematics'),
  ('lib-math-ratio',           'Ratio and Proportion',            'অনুপাত ও সমানুপাত',               'cs-mathematics'),
  ('lib-math-average',         'Average',                         'গড়',                             'cs-mathematics'),
  ('lib-math-partnership',     'Partnership',                     'অংশীদারি কারবার',                 'cs-mathematics'),
  ('lib-math-interest',        'Simple and Compound Interest',    'সরল ও চক্রবৃদ্ধি মুনাফা',         'cs-mathematics'),
  ('lib-math-time-work',       'Time and Work',                   'সময় ও কাজ',                      'cs-mathematics'),
  ('lib-math-speed-distance',  'Time, Speed and Distance',        'সময়, গতি ও দূরত্ব',              'cs-mathematics'),
  ('lib-math-algebra',         'Algebra',                         'বীজগণিত',                         'cs-mathematics'),
  ('lib-math-equations',       'Equations',                       'সমীকরণ',                          'cs-mathematics'),
  ('lib-math-geometry',        'Geometry',                        'জ্যামিতি',                        'cs-mathematics'),
  ('lib-math-mensuration',     'Mensuration',                     'পরিমিতি',                         'cs-mathematics'),
  ('lib-math-trigonometry',    'Trigonometry',                    'ত্রিকোণমিতি',                     'cs-mathematics'),
  ('lib-math-set-theory',      'Set Theory',                      'সেট তত্ত্ব',                      'cs-mathematics'),
  ('lib-math-permutation',     'Permutation and Combination',     'বিন্যাস ও সমাবেশ',                'cs-mathematics'),
  ('lib-math-probability',     'Probability',                     'সম্ভাবনা',                        'cs-mathematics'),
  ('lib-math-statistics',      'Statistics',                      'পরিসংখ্যান',                      'cs-mathematics'),
  ('lib-math-reasoning',       'Mathematical Reasoning',          'গাণিতিক যুক্তি',                  'cs-mathematics'),
  -- General Knowledge (cs-general-knowledge)
  ('lib-gk-bd-affairs',        'Bangladesh Affairs',              'বাংলাদেশ বিষয়াবলি',              'cs-general-knowledge'),
  ('lib-gk-intl-affairs',      'International Affairs',           'আন্তর্জাতিক বিষয়াবলি',           'cs-general-knowledge'),
  ('lib-gk-history',           'History',                         'ইতিহাস',                          'cs-general-knowledge'),
  ('lib-gk-geography',         'Geography',                       'ভূগোল',                           'cs-general-knowledge'),
  ('lib-gk-economy',           'Economy',                         'অর্থনীতি',                        'cs-general-knowledge'),
  ('lib-gk-constitution',      'Constitution',                    'সংবিধান',                         'cs-general-knowledge'),
  ('lib-gk-govt-admin',        'Government and Administration',   'সরকার ও প্রশাসন',                 'cs-general-knowledge'),
  ('lib-gk-intl-org',          'International Organizations',     'আন্তর্জাতিক সংস্থা',              'cs-general-knowledge'),
  ('lib-gk-sci-tech',          'Science and Technology',          'বিজ্ঞান ও প্রযুক্তি',             'cs-general-knowledge'),
  ('lib-gk-environment',       'Environment',                     'পরিবেশ',                          'cs-general-knowledge'),
  ('lib-gk-current',           'Current Affairs',                 'সাম্প্রতিক বিষয়াবলি',            'cs-general-knowledge'),
  -- ICT (cs-ict)
  ('lib-ict-fundamentals',     'Computer Fundamentals',           'কম্পিউটার মৌলিক',                 'cs-ict'),
  ('lib-ict-hw-sw',            'Hardware and Software',           'হার্ডওয়্যার ও সফটওয়্যার',       'cs-ict'),
  ('lib-ict-os',               'Operating Systems',               'অপারেটিং সিস্টেম',                'cs-ict'),
  ('lib-ict-networking',       'Networking',                      'নেটওয়ার্কিং',                    'cs-ict'),
  ('lib-ict-internet',         'Internet',                        'ইন্টারনেট',                       'cs-ict'),
  ('lib-ict-cybersecurity',    'Cyber Security',                  'সাইবার নিরাপত্তা',                'cs-ict'),
  ('lib-ict-database',         'Database',                        'ডাটাবেস',                         'cs-ict'),
  ('lib-ict-programming',      'Programming',                     'প্রোগ্রামিং',                     'cs-ict'),
  ('lib-ict-digital-tech',     'Digital Technology',              'ডিজিটাল প্রযুক্তি',               'cs-ict'),
  ('lib-ict-ai',               'Artificial Intelligence',         'কৃত্রিম বুদ্ধিমত্তা',             'cs-ict'),
  ('lib-ict-info-systems',     'Information Systems',             'ইনফরমেশন সিস্টেম',                'cs-ict'),
  -- Mental Ability (cs-mental-ability)
  ('lib-mental-verbal',        'Verbal Reasoning',                'ভাষাগত যুক্তি',                   'cs-mental-ability'),
  ('lib-mental-numerical',     'Numerical Reasoning',             'সাংখ্যিক যুক্তি',                 'cs-mental-ability'),
  ('lib-mental-logical',       'Logical Reasoning',               'যৌক্তিক বিচার',                   'cs-mental-ability'),
  ('lib-mental-analytical',    'Analytical Reasoning',            'বিশ্লেষণাত্মক যুক্তি',            'cs-mental-ability'),
  ('lib-mental-series',        'Number Series',                   'সংখ্যা ধারা',                     'cs-mental-ability'),
  ('lib-mental-analogy',       'Analogy',                         'সাদৃশ্য',                         'cs-mental-ability'),
  ('lib-mental-coding',        'Coding-Decoding',                 'কোডিং-ডিকোডিং',                   'cs-mental-ability'),
  ('lib-mental-direction',     'Direction and Distance',          'দিক ও দূরত্ব',                    'cs-mental-ability'),
  ('lib-mental-blood',         'Blood Relations',                 'রক্তের সম্পর্ক',                  'cs-mental-ability'),
  ('lib-mental-pattern',       'Pattern Recognition',             'প্যাটার্ন শনাক্তকরণ',             'cs-mental-ability'),
  ('lib-mental-spatial',       'Spatial Reasoning',               'স্থানিক যুক্তি',                  'cs-mental-ability'),
  -- Science (cs-general-science)
  ('lib-sci-physics',          'Physics',                         'পদার্থবিজ্ঞান',                   'cs-general-science'),
  ('lib-sci-chemistry',        'Chemistry',                       'রসায়ন',                          'cs-general-science'),
  ('lib-sci-biology',          'Biology',                         'জীববিজ্ঞান',                      'cs-general-science'),
  ('lib-sci-human-body',       'Human Body',                      'মানবদেহ',                         'cs-general-science'),
  ('lib-sci-environment',      'Environment',                     'পরিবেশ',                          'cs-general-science'),
  ('lib-sci-everyday',         'Everyday Science',                'দৈনন্দিন বিজ্ঞান',                'cs-general-science'),
  ('lib-sci-discoveries',      'Scientific Discoveries',          'বৈজ্ঞানিক আবিষ্কার',              'cs-general-science')
) as v(slug, title_en, title_bn, grp)
join public.canonical_subjects cs on cs.slug = v.grp
on conflict (slug) do nothing;
