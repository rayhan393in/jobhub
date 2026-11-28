#!/usr/bin/env python3
"""Render the 90-day BCS routine as an idempotent SQL file.

    python3 gen/routine90/render.py

Output: data/bcs-routine/bcs-routine-90day.sql (git-ignored scratch is avoided
on purpose — the SQL is the reviewable artefact, like the 60-day one).

Design:
  * old routine rows for the BCS course are ARCHIVED, never deleted, unless
    nothing references them (mirrors data/bcs-routine/bcs-routine-60day.sql);
  * a routine row is unique on (course, kind, date, subject, topic, slot), so
    every insert is `on conflict ... do update` — re-running is safe;
  * each day gets four rows: P1 main (150), P2 second (75), P3/P4 third (45),
    MCQ + error analysis (50). Topic text and subtopic text live in title/
    focus_note, and the real syllabus ids are resolved by slug at apply time
    (see the `jh_r90_subject` / topic lookups) so the rows stay linkable to
    questions once the taxonomy is settled.
"""
import json
from datetime import date
from pathlib import Path

from data import (
    DAYS,
    PHASES,
    MCQ,
    SECOND_BY_DAY,
    SLOTS,
    START,
    SUBJECT_LABEL,
    THIRD_BY_DAY,
    MAIN_BY_DAY,
    date_for_day,
    phase_for_day,
    subject_for_day,
)

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data/bcs-routine/bcs-routine-90day.sql"


def q(text: str) -> str:
    return "'" + str(text).replace("'", "''") + "'"


def arr(items) -> str:
    return "'{" + ",".join('"' + str(i).replace('"', '\\"') + '"' for i in items) + "}'::text[]"


def subject_cell(key: str | None) -> tuple[str, str]:
    """(display label, DB slug or '') for a subject key."""
    if not key:
        return "", ""
    return SUBJECT_LABEL[key], key


def main_title(day: int) -> str:
    _d, topic, subs = MAIN_BY_DAY[day]
    return f"{topic} ({', '.join(subs)})" if subs else topic


def main_focus(day: int) -> str:
    _d, topic, subs = MAIN_BY_DAY[day]
    return f"{topic} — " + (", ".join(subs) if subs else "সিলেবাস অনুযায়ী")


def second_row(day: int):
    _d, subject, topic, subs = SECOND_BY_DAY[day]
    return subject, topic, subs


def third_row(day: int):
    _d, subject, topic, subs = THIRD_BY_DAY[day]
    return subject, topic, subs


ROWS = []


def add(day, band, *, subject_key, title_bn, focus, task_kind, topics, subtopics, target):
    slot = SLOTS[band]
    day_date = date_for_day(day)
    ROWS.append(
        {
            "day": day,
            "band": band,
            "routine_date": day_date.isoformat(),
            "title_bn": title_bn,
            "focus_note_bn": focus,
            "slot_label": slot["label"],
            "minutes": slot["minutes"],
            "task_kind": task_kind,
            "subject_label": subject_cell(subject_key)[0],
            "subject_slug": subject_cell(subject_key)[1],
            "topics": topics,
            "subtopics": subtopics,
            "target_bn": target,
            "week_index": ((day - 1) // 7) + 1,
            "phase": phase_for_day(day),
        }
    )


for day in range(1, DAYS + 1):
    subject_key = subject_for_day(day)
    _d, main_topic, main_subs = MAIN_BY_DAY[day]
    header = f"দিন {day} · {phase_for_day(day)}"

    add(
        day,
        "p1",
        subject_key=subject_key,
        title_bn=f"{header} · P1 Main — {main_topic}",
        focus=main_focus(day),
        task_kind="study",
        topics=[main_topic],
        subtopics=main_subs,
        target=f"{MCQ['p1']}টি MCQ (P1 Main)",
    )

    sec_subject, sec_topic, sec_subs = second_row(day)
    add(
        day,
        "p2",
        subject_key=sec_subject,
        title_bn=f"{header} · P2 Second — {sec_topic}",
        focus=", ".join(sec_subs) if sec_subs else sec_topic,
        task_kind="study",
        topics=[sec_topic],
        subtopics=sec_subs,
        target=f"{MCQ['p2']}টি MCQ (P2 Second)",
    )

    th_subject, th_topic, th_subs = third_row(day)
    third_kind = "revision" if "Revision" in th_topic or "Previous" in th_topic else "study"
    add(
        day,
        "p3",
        subject_key=th_subject,
        title_bn=f"{header} · P3/P4 Third — {th_topic}",
        focus=", ".join(th_subs) if th_subs else th_topic,
        task_kind=third_kind,
        topics=[th_topic],
        subtopics=th_subs,
        target=f"{MCQ['p3']}টি MCQ (P3/P4 Third)",
    )

    add(
        day,
        "mcq",
        subject_key=None,
        title_bn=f"{header} · MCQ পরীক্ষা ও ভুল বিশ্লেষণ",
        focus=(
            f"P1 {MCQ['p1']} + P2 {MCQ['p2']} + P3/P4 {MCQ['p3']} + পূর্বে-পড়া {MCQ['revisit']} "
            f"= ১০০ প্রশ্ন · ৫০ মিনিট · সঠিক +১ · ভুল −০.৫০ · উত্তর না দিলে ০। "
            "শেষে ভুল প্রশ্ন Error Notebook-এ লিখুন।"
        ),
        task_kind="practice",
        topics=[],
        subtopics=[],
        target="১০০টি MCQ (মোট ১০০ নম্বর)",
    )


HEADER = f"""-- ============================================================================
-- JobHub — BCS Preliminary ৯০ দিনের স্টাডি রুটিন (V3)
-- ============================================================================
-- দিন ১ = {START.isoformat()} (শনিবার) · দিন {DAYS} = {date_for_day(DAYS).isoformat()}
--
-- প্রতিদিন ৪টি স্লট, সময় স্পেসিফিকেশন অনুযায়ী অপরিবর্তিত:
--   পি১ Main        ১৫০ মিনিট  (টপিক + সাবটপিক)
--   পি২ Second       ৭৫ মিনিট
--   পি৩/P4 Third     ৪৫ মিনিট
--   MCQ + ভুল বিশ্লেষণ ৫০ মিনিট  (P1 ৫০ + P2 ২৫ + P3/P4 ১৫ + পূর্বে-পড়া ১০ = ১০০)
--
-- শুধু রুটিনের সারি বদলায় — পুরোনো রুটিন ডিলিট হয় না (পরীক্ষা বা
-- progress থেকে রেফারেন্স থাকলে আর্কাইভ, নাহলে মুছে ফেলা হয়), ঠিক যেমন
-- bcs-routine-60day.sql করে।
--
-- ROLLBACK: পুরোনো রুটিন আর্কাইভ করা আছে (status='archived'); ফেরাতে
--   update public.routines set status='published', archived_at=null
--    where course_id = <bcs> and title_bn like 'দিন % · ফেজ %';
--   delete from public.routines where title_bn like 'দিন %· %P1 Main%' ... (৯০ দিনের সারি)
-- ============================================================================

begin;

-- পুরোনো সক্রিয় BCS রুটিন সরানো। আগে আর্কাইভ, পরে (রেফারেন্সহীন) সারি মুছে
-- ফেলা — ৬০ দিনের ফাইলে অর্ডারটা উল্টো ছিল, ফলে delete-এর guard কখনোই
-- কাজ করত না: update ঠিক তার আগেই সব সারি archived করে দিত।
update public.routines r
   set archived_at = now(), status = 'archived', updated_at = now()
  from public.courses c
 where c.id = r.course_id and c.slug = 'bcs'
   and r.status = 'published';

delete from public.routines r
using public.courses c
where c.id = r.course_id and c.slug = 'bcs'
  and r.status = 'archived'
  and not exists (select 1 from public.exam_schedules es
                   where es.routine_id = r.id
                      or r.id = any (coalesce(es.routine_ids, '{{}}'::uuid[])))
  and not exists (select 1 from public.study_plan_assignments a where a.routine_id = r.id)
  and not exists (select 1 from public.routine_progress rp where rp.routine_id = r.id);

commit;
"""


def li(text: str) -> str:
    """SQL string literal, single-quoted, safe for the routine's Bengali text."""
    return "'" + text.replace("'", "''") + "'"


def value_tuple(row) -> str:
    """Only the facts that differ per row; every repeated label is derived in SQL.

    Spelling the slot label, the 100-MCQ prompt and the target line into all 360
    tuples tripled the file for no information — each one is fixed per band.
    """
    subs = "array[" + ", ".join(li(x) for x in row["subtopics"]) + "]::text[]"
    return "  ({}, {}, {}, {}, {}, {})".format(
        row["day"],
        li(row["band"]),
        li(row["subject_slug"]),
        li(row["topics"][0] if row["topics"] else ""),
        subs,
        li(row["task_kind"]),
    )


PHASE_CASE = "case\n" + "".join(
    f"         when day_no <= {hi} then {li(label)}\n" for _lo, hi, label in PHASES
) + "       end"

SLOT_VALUES = ",\n".join(
    "  ({}, {}, {}, {})".format(li(band), li(slot["label"]), slot["minutes"], li(target))
    for band, slot, target in (
        ("p1", SLOTS["p1"], "50টি MCQ (P1 Main)"),
        ("p2", SLOTS["p2"], "25টি MCQ (P2 Second)"),
        ("p3", SLOTS["p3"], "15টি MCQ (P3/P4 Third)"),
        ("mcq", SLOTS["mcq"], "১০০টি MCQ (মোট ১০০ নম্বর)"),
    )
)

MCQ_NOTE = li(
    f"P1 {MCQ['p1']} + P2 {MCQ['p2']} + P3/P4 {MCQ['p3']} + পূর্বে-পড়া {MCQ['revisit']} "
    "= ১০০ প্রশ্ন · ৫০ মিনিট · সঠিক +১ · ভুল −০.৫০ · উত্তর না দিলে ০। "
    "শেষে ভুল প্রশ্ন Error Notebook-এ লিখুন।"
)


def batches(days_per_batch: int = 4):
    """One self-contained statement per batch of days.

    The whole 90-day plan is larger than the Supabase SQL editor accepts in a
    single call, so each batch is an independent statement that can be run on
    its own, in order.
    """
    out = []
    for start in range(0, DAYS, days_per_batch):
        lo, hi = start + 1, min(start + days_per_batch, DAYS)
        chunk = [r for r in ROWS if lo <= r["day"] <= hi]
        out.append((lo, hi, ",\n".join(value_tuple(r) for r in chunk)))
    return out


STAGE = "public.jh_r90_stage"


def insert_statement(body: str) -> str:
    return f"""
with bcs as (select id as course_id from public.courses where slug = 'bcs'),
seed(day_no, band, subject_slug, topic_bn, subtopic_bns, task_kind) as (
  values
{body}
),
built as (
  select b.course_id,
         s.day_no,
         date '{START.isoformat()}' + (s.day_no - 1) as routine_date,
         ((s.day_no - 1) / 7) + 1 as week_index,
         s.band, s.topic_bn, s.subtopic_bns, s.task_kind,
         {PHASE_CASE} as phase,
         (select su.id from public.subjects su
           where su.course_id = b.course_id and su.slug = s.subject_slug limit 1) as subject_id
    from seed s cross join bcs b
)
insert into {STAGE}
  (day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind)
select day_no, band, routine_date, phase, week_index, subject_id, topic_bn, subtopic_bns, task_kind
  from built;
"""


# Turns the staged facts into routine rows. Every repeated Bengali label (slot
# name, slot hours, the 100-MCQ note, the target line) is spelled once here
# rather than 360 times in the data, and the run is idempotent through the
# existing unique index.
PUBLISH = f"""
with bcs as (select id as course_id from public.courses where slug = 'bcs'),
slot(band, slot_label, minutes, target_bn) as (
  values
{SLOT_VALUES}
),
r as (
  select g.*, sl.slot_label, sl.minutes, sl.target_bn,
         case g.band
           when 'p1' then 'P1 Main'
           when 'p2' then 'P2 Second'
           when 'p3' then 'P3/P4 Third'
           else 'MCQ পরীক্ষা ও ভুল বিশ্লেষণ'
         end as slot_name,
         case when g.band = 'mcq'
              then 'দিন ' || g.day_no || ' · ' || g.phase || ' · MCQ পরীক্ষা ও ভুল বিশ্লেষণ'
              else 'দিন ' || g.day_no || ' · ' || g.phase || ' · ' ||
                   case g.band when 'p1' then 'P1 Main' when 'p2' then 'P2 Second'
                               else 'P3/P4 Third' end ||
                   ' — ' || g.topic_bn
         end as title_bn
    from {STAGE} g join slot sl on sl.band = g.band
)
insert into public.routines
  (course_id, kind, routine_date, title_en, title_bn, subject_id, minutes,
   focus_note_bn, slot_label, target_bn, task_kind, week_index, status, created_by)
select b.course_id, 'daily', r.routine_date,
       r.title_bn, r.title_bn, r.subject_id, r.minutes,
       case when r.band = 'mcq' then {MCQ_NOTE}
            when array_length(r.subtopic_bns, 1) is not null
              then r.topic_bn || ' — ' || array_to_string(r.subtopic_bns, ', ')
            else r.topic_bn
       end,
       r.slot_label, r.target_bn, r.task_kind, r.week_index, 'published', null
  from r cross join bcs b
on conflict (course_id, kind, routine_date, subject_id, topic_id, slot_label) do update
  set title_bn = excluded.title_bn,
      title_en = excluded.title_en,
      minutes = excluded.minutes,
      focus_note_bn = excluded.focus_note_bn,
      target_bn = excluded.target_bn,
      task_kind = excluded.task_kind,
      week_index = excluded.week_index,
      status = 'published',
      archived_at = null,
      updated_at = now();

drop table if exists {STAGE};
"""


STAGE_DDL = f"""
-- Scratch table for the day rows. The same DDL is used by the chunked apply
-- script, which stages the days in several small calls because the whole plan
-- is larger than one Supabase SQL-editor request.
create table if not exists {STAGE} (
  day_no smallint not null,
  band text not null,
  routine_date date not null,
  phase text not null,
  week_index smallint not null,
  subject_id uuid,
  topic_bn text not null,
  subtopic_bns text[] not null default '{{}}',
  task_kind text not null,
  primary key (day_no, band)
);
"""


def main():
    parts = [HEADER, STAGE_DDL]
    for lo, hi, body in batches():
        parts.append(f"\n-- ── দিন {lo}–{hi} ──{insert_statement(body)}")
    parts.append(PUBLISH)
    sql = "".join(parts)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(sql, encoding="utf-8")
    print(OUT, len(sql), "bytes,", len(ROWS), "rows,", len(batches()), "batches")


if __name__ == "__main__":
    main()
