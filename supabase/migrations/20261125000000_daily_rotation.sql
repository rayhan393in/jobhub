-- ============================================================
-- DAILY 100-MARK EXAM SYSTEM (90:10) — rotation engine storage
-- Additive only. Reuses the existing exam engine end to end:
-- exam_schedules + settings.composition + jh_build_paper_with_mix
-- + jh_publish/start/save/submit/review. No duplicate exam system.
-- ============================================================

-- Per-course knobs for the standard daily paper. The 90:10 ratio itself is
-- not stored — it is the format's definition; only the total count scales.
create table if not exists daily_exam_config (
  course_id uuid primary key references courses(id) on delete cascade,
  anchor_date date not null,
  question_count integer not null default 100 check (question_count between 20 and 200),
  duration_minutes integer not null default 60 check (duration_minutes between 10 and 240),
  negative_marks numeric not null default 0.50 check (negative_marks >= 0 and negative_marks <= 5),
  -- previous/easy/medium/hard percentages, must sum to 100 (validated in API).
  difficulty_mix jsonb not null default '{"previous":0,"easy":30,"medium":50,"hard":20}'::jsonb,
  -- true: eligible topics = everything studied up to the exam date (cumulative
  -- revision). false: only the last 7 routine days.
  cumulative_revision boolean not null default true,
  -- When a subject has no routine topics yet, allow whole-subject scope
  -- instead of blocking (explicit admin opt-in; default off).
  allow_whole_subject_fallback boolean not null default false,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

-- The repeating rotation template. position is 1-based; the engine resolves
-- a date to position ((date - anchor) mod slot_count) + 1 and continues
-- forever, so "after day 14" needs no extra data.
create table if not exists daily_rotation_slots (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  position integer not null check (position >= 1),
  main_subject_id uuid references subjects(id) on delete cascade,
  secondary_subject_id uuid references subjects(id) on delete cascade,
  is_grand boolean not null default false,
  unique (course_id, position),
  -- A grand-exam day carries no subject pair; a daily slot must have two
  -- DIFFERENT subjects.
  check (is_grand or (main_subject_id is not null
                      and secondary_subject_id is not null
                      and main_subject_id <> secondary_subject_id))
);

-- Admin manual override for a specific date, without touching the template.
create table if not exists daily_rotation_overrides (
  course_id uuid not null references courses(id) on delete cascade,
  exam_date date not null,
  main_subject_id uuid not null references subjects(id) on delete cascade,
  secondary_subject_id uuid not null references subjects(id) on delete cascade,
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  primary key (course_id, exam_date),
  check (main_subject_id <> secondary_subject_id)
);

-- ---------- security: same posture as the question-intelligence tables ----
alter table daily_exam_config        enable row level security;
alter table daily_rotation_slots     enable row level security;
alter table daily_rotation_overrides enable row level security;
alter table daily_exam_config        force row level security;
alter table daily_rotation_slots     force row level security;
alter table daily_rotation_overrides force row level security;

revoke all on daily_exam_config, daily_rotation_slots, daily_rotation_overrides
  from anon, authenticated;
grant all on daily_exam_config, daily_rotation_slots, daily_rotation_overrides
  to service_role;

-- ---------- seed: the initial 14-day BCS rotation ----------
-- Resolved by title against the course's real subjects; a slot is inserted
-- only when both subjects exist (no invented IDs). Idempotent.
with bcs as (select id from courses where slug = 'bcs'),
sub as (
  select s.id, s.title_bn, s.sort_order from subjects s join bcs on s.course_id = bcs.id
),
template(position, main_title, secondary_title, is_grand) as (
  values
    (1,  'বাংলা ভাষা ও সাহিত্য',            'English Language & Literature',  false),
    (2,  'English Language & Literature',   'বাংলাদেশ বিষয়াবলি',             false),
    (3,  'বাংলাদেশ বিষয়াবলি',              'আন্তর্জাতিক বিষয়াবলি',          false),
    (4,  'আন্তর্জাতিক বিষয়াবলি',           'ভূগোল, পরিবেশ ও দুর্যোগ',        false),
    (5,  'ভূগোল, পরিবেশ ও দুর্যোগ',         'সাধারণ বিজ্ঞান',                 false),
    (6,  'সাধারণ বিজ্ঞান',                  'কম্পিউটার ও তথ্যপ্রযুক্তি',       false),
    (7,  null,                              null,                             true),
    (8,  'কম্পিউটার ও তথ্যপ্রযুক্তি',        'গাণিতিক যুক্তি',                 false),
    (9,  'গাণিতিক যুক্তি',                  'মানসিক দক্ষতা',                  false),
    (10, 'মানসিক দক্ষতা',                   'নৈতিকতা, মূল্যবোধ ও সুশাসন',     false),
    (11, 'নৈতিকতা, মূল্যবোধ ও সুশাসন',      'বাংলা ভাষা ও সাহিত্য',           false),
    (12, 'বাংলা ভাষা ও সাহিত্য',            'বাংলাদেশ বিষয়াবলি',             false),
    (13, 'English Language & Literature',   'সাধারণ বিজ্ঞান',                 false),
    (14, null,                              null,                             true)
)
insert into daily_rotation_slots (course_id, position, main_subject_id, secondary_subject_id, is_grand)
select bcs.id, t.position, m.id, sec.id, t.is_grand
from template t
cross join bcs
left join sub m   on m.title_bn   = t.main_title
left join sub sec on sec.title_bn = t.secondary_title
where t.is_grand or (m.id is not null and sec.id is not null)
on conflict (course_id, position) do nothing;

-- Whole-subject fallback starts ON for BCS: the live 60-day routine carries
-- subject_id but no topic links yet, so strict topic scoping would block every
-- daily exam. The pre-publish checklist surfaces the fallback as a warning on
-- each paper; flip it off once routines reference real topic ids.
insert into daily_exam_config (course_id, anchor_date, allow_whole_subject_fallback)
select id, date '2026-11-23', true from courses where slug = 'bcs'
on conflict (course_id) do nothing;
