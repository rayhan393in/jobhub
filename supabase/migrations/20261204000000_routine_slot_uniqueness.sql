-- 20261204000000_routine_slot_uniqueness.sql
--
-- The rebuilt course-wise routine legitimately places:
--   * the same subject in MORE THAN ONE time slot of the same day
--     (Petrobangla technical deep-work blocks: morning + afternoon + night), and
--   * more than one course-level activity (subject_id null) on the same date
--     (e.g. full model test + ভুল বিশ্লেষণ on the final days).
--
-- The old uniqueness rule (course, kind, date, subject, topic) forbade both,
-- so the time-slot label joins the key: a row is now a duplicate only when it
-- repeats the same subject/topic in the SAME slot of the same day. This keeps
-- the original intent (no accidental double-insert of a slot) while allowing
-- multi-slot study days.
--
-- NULLS NOT DISTINCT is preserved so rows with null subject/topic/slot are
-- still deduplicated instead of silently multiplying.

drop index if exists public.routines_unique_slot_idx;

create unique index if not exists routines_unique_slot_idx
  on public.routines (course_id, kind, routine_date, subject_id, topic_id, slot_label)
  nulls not distinct;
