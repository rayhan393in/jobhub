-- ============================================================================
-- JobHub — Marks distribution (নম্বর বিভাজন)
--
-- Why a table instead of JSON on courses: the syllabus page and the admin
-- editor need to render a per-stage marks table (প্রিলিমিনারি / লিখিত / ভাইভা),
-- compare it across courses, and let admins edit it without a deploy. Marks
-- belong to a *stage* of an examination, not to the course, and a course can
-- have several stages (BCS: prelim 200, written general 900, technical 900,
-- both 1200, viva 200).
--
-- Sources (verified 2026-11-27):
--   * BCS — BPSC: preliminary 200 (100 MCQ × 1, negative 0.5, 2 hours incl.
--     20-minute written part); written general 900 (বাংলা 200, ইংরেজি 200,
--     বাংলাদেশ 200, আন্তর্জাতিক 100, গাণিতিক 50 + মানসিক 50, বিজ্ঞান 100);
--     technical 900 (+ পেশাগত 200 ⇒ both 1200); viva 200.
--   * প্রাথমিক শিক্ষক — 80 MCQ + 20 viva = 100, 4 options, negative 0.25, 1h.
--   * NTRCA — preliminary 100 (25 × 4, pass 40, negative 0.25) + written 100.
--
-- Only figures that were verified are seeded. Other courses (EEE, Petrobangla,
-- technical recruitment, university admission, government/private jobs) keep
-- their existing `courses.exam_config` marking rules and get NO rows here —
-- their weights are not verified, and an invented marks table is worse than an
-- empty one. Admins can add rows through the editor when they have a source.
--
-- ROLLBACK:
--   drop table if exists public.exam_marks;
-- ============================================================================

create table if not exists public.exam_marks (
  id                  uuid primary key default gen_random_uuid(),
  course_id           uuid not null references public.courses(id) on delete cascade,
  stage               text not null check (stage in ('preliminary', 'written', 'viva', 'total')),
  stage_bn            text not null,
  paper_bn            text not null default '',
  question_count      integer check (question_count is null or question_count > 0),
  marks_per_question  numeric(5,2) check (marks_per_question is null or marks_per_question > 0),
  negative_marks      numeric(5,2) not null default 0 check (negative_marks >= 0),
  duration_minutes    integer check (duration_minutes is null or duration_minutes > 0),
  total_marks         numeric(7,2) not null check (total_marks > 0),
  pass_marks          numeric(7,2) check (pass_marks is null or pass_marks >= 0),
  note_bn             text not null default '',
  sort_order          smallint not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists exam_marks_course_idx on public.exam_marks (course_id, sort_order);

-- One row per (course, stage, paper): a re-run never duplicates a paper and an
-- admin edit is never silently overwritten.
create unique index if not exists exam_marks_course_stage_paper_key
  on public.exam_marks (course_id, stage, paper_bn);

alter table public.exam_marks enable row level security;
alter table public.exam_marks force row level security;

drop policy if exists "public reads marks of published courses" on public.exam_marks;
create policy "public reads marks of published courses" on public.exam_marks
  for select to anon, authenticated
  using (exists (select 1 from public.courses c where c.id = exam_marks.course_id and c.status = 'published'));

drop policy if exists "staff read all marks" on public.exam_marks;
create policy "staff read all marks" on public.exam_marks
  for select to authenticated using (public.jh_is_staff());

drop policy if exists "staff write marks" on public.exam_marks;
create policy "staff write marks" on public.exam_marks
  for all to authenticated using (public.jh_has_permission('taxonomy.manage'))
  with check (public.jh_has_permission('taxonomy.manage'));

-- Table privileges: RLS narrows rows; grants decide whether the role may
-- touch the table at all. Mirrors the taxonomy tables' grants.
grant select on public.exam_marks to anon;
grant select, insert, update, delete on public.exam_marks to authenticated;
grant all on public.exam_marks to service_role;

drop trigger if exists set_updated_at on public.exam_marks;
create trigger set_updated_at before update on public.exam_marks
  for each row execute function public.jh_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Seed: verified figures only. `on conflict do nothing` — an admin's later edit
-- of the same paper always wins.
-- ---------------------------------------------------------------------------
insert into public.exam_marks
  (course_id, stage, stage_bn, paper_bn, question_count, marks_per_question,
   negative_marks, duration_minutes, total_marks, pass_marks, note_bn, sort_order)
select c.id, v.stage, v.stage_bn, v.paper_bn, v.q_count, v.per_q, v.negative,
       v.minutes, v.total, v.pass, v.note_bn, v.sort_order
from (values
  -- BCS — প্রিলিমিনারি (সাধারণ)
  ('bcs', 'preliminary', 'প্রিলিমিনারি', '', 100, 1.00, 0.50, 120, 200, null,
   '১০০টি MCQ × ১ নম্বর; প্রতি ভুলে ০.৫০ কাটা; ২ ঘণ্টা (২০ মিনিটের লিখিত অংশসহ)। প্রিলিমিনারি উত্তীর্ণ হলেই লিখিত।', 10),
  -- BCS — লিখিত (সাধারণ / ক্যাডার)
  ('bcs', 'written', 'লিখিত (সাধারণ)', 'বাংলা', null, null, 0, 180, 200, null, 'রচনামূলক ও ব্যাকরণ — ২০০ নম্বর', 20),
  ('bcs', 'written', 'লিখিত (সাধারণ)', 'ইংরেজি', null, null, 0, 180, 200, null, 'Essay, Grammar, Comprehension — ২০০ নম্বর', 21),
  ('bcs', 'written', 'লিখিত (সাধারণ)', 'বাংলাদেশ বিষয়াবলি', null, null, 0, 180, 200, null, '২০০ নম্বর', 22),
  ('bcs', 'written', 'লিখিত (সাধারণ)', 'আন্তর্জাতিক বিষয়াবলি', null, null, 0, 180, 100, null, '১০০ নম্বর', 23),
  ('bcs', 'written', 'লিখিত (সাধারণ)', 'গাণিতিক যুক্তি', null, null, 0, 180, 50, null, '৫০ নম্বর', 24),
  ('bcs', 'written', 'লিখিত (সাধারণ)', 'মানসিক দক্ষতা', null, null, 0, 180, 50, null, '৫০ নম্বর', 25),
  ('bcs', 'written', 'লিখিত (সাধারণ)', 'সাধারণ বিজ্ঞান ও প্রযুক্তি', null, null, 0, 180, 100, null, '১০০ নম্বর', 26),
  -- BCS — লিখিত (কারিগরি / পেশাগত)
  ('bcs', 'written', 'লিখিত (কারিগরি)', 'সাধারণ ক্যাডার পত্রসমূহ', null, null, 0, 180, 900, null,
   'কারিগরি ক্যাডারের প্রার্থী সাধারণ ৯০০ নম্বরের পত্রগুলোও দেন', 30),
  ('bcs', 'written', 'লিখিত (কারিগরি)', 'পেশাগত পত্র', null, null, 0, 180, 200, null, 'পেশাগত (কারিগরি) বিষয় — ২০০ নম্বর', 31),
  ('bcs', 'total', 'লিখিত মোট', 'সাধারণ', null, null, 0, null, 900, null, '৯০০ নম্বর', 40),
  ('bcs', 'total', 'লিখিত মোট', 'কারিগরি ও সাধারণ', null, null, 0, null, 1200, null, 'কারিগরি ক্যাডার: ৯০০ + ২০০ = ১১০০; সাধারণ ও কারিগরি উভয়ের ক্ষেত্রে সর্বোচ্চ ১২০০', 41),
  ('bcs', 'viva', 'মৌখিক (ভাইভা)', '', null, null, 0, null, 200, null, 'ভাইভা বোর্ড — ২০০ নম্বর', 50),

  -- প্রাথমিক শিক্ষক নিয়োগ
  ('primary-teacher', 'preliminary', 'প্রিলিমিনারি (লিখিত)', '', 80, 1.00, 0.25, 60, 80, null,
   '৮০টি MCQ × ১ নম্বর; প্রতি ভুলে ০.২৫ কাটা; ১ ঘণ্টা; ৪টি অপশন', 10),
  ('primary-teacher', 'viva', 'মৌখিক (ভাইভা)', '', null, null, 0, null, 20, null, 'ভাইভা — ২০ নম্বর', 20),
  ('primary-teacher', 'total', 'সর্বমোট', '', null, null, 0, null, 100, null, '৮০ (MCQ) + ২০ (ভাইভা) = ১০০', 30),

  -- NTRCA
  ('ntrca', 'preliminary', 'প্রিলিমিনারি', '', 25, 4.00, 0.25, null, 100, 40, '২৫টি প্রশ্ন × ৪ নম্বর; প্রতি ভুলে ০.২৫ কাটা; পাস ৪০', 10),
  ('ntrca', 'written', 'লিখিত', 'নিজ বিষয়', null, null, 0, 180, 100, null, 'নিজ বিষয়ে লিখিত — ১০০ নম্বর, ৩ ঘণ্টা', 20),
  ('ntrca', 'total', 'সর্বমোট', '', null, null, 0, null, 200, null, '১০০ (প্রিলিমিনারি) + ১০০ (লিখিত)', 30)
) v(course_slug, stage, stage_bn, paper_bn, q_count, per_q, negative, minutes, total, pass, note_bn, sort_order)
join public.courses c on c.slug = v.course_slug
on conflict (course_id, stage, paper_bn) do nothing;

-- NOTE: no security-definer read helper here on purpose. The public syllabus
-- page reads `exam_marks`, `subjects.weight` and the subtopic priorities
-- through RLS like every other public read (see src/lib/queries.ts), so the
-- anon-executable function surface stays exactly the two audited ones.

comment on table public.exam_marks is
  'Per-stage marks distribution (প্রিলিমিনারি / লিখিত / ভাইভা) per course. Verified figures only; admins edit via /admin/marks.';
