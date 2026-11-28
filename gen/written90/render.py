#!/usr/bin/env python3
"""Render the BCS Written taxonomy as an idempotent SQL migration.

    python3 gen/written90/render.py

Output: supabase/migrations/20261218000000_bcs_written_taxonomy.sql

Design notes
------------
* A SEPARATE course (`bcs-written`), not new subject rows on `bcs`. The Written
  paper shares seven subjects with the Preliminary one by *name* only: their
  syllabus trees differ (বাংলা ১ম পত্র is grammar + composition; Preliminary's
  বাংলা ভাষা ও সাহিত্য is MCQ language + literature). Hanging them off the same
  subject row would silently mix two syllabi into one progress bar and one
  study-plan assignment set.
* Each Written subject records `metadata.canonical_subject_slug`, the slug of
  its Preliminary counterpart, so a shared question bank can be joined on slug
  without duplicating a single row. (`subjects.canonical_subject_id` is NOT
  used: that column references the central canonical taxonomy, not another
  subject.)
* Nothing is ever deleted. Re-running finds every slug already present, updates
  the titles/sort/priority in place, and leaves uuids untouched — so any
  question, routine or progress row that points at a Written topic keeps
  pointing at it.
* Every row carries `metadata.priority_source = 'proposed-study-priority'`
  because BPSC does not rank Written topics; P1–P4 here is a study order, and
  no screen may present it as an official ranking.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from data import (
    COURSE_SLUG,
    COURSE_SORT_ORDER,
    COURSE_TITLE_BN,
    COURSE_TITLE_EN,
    PROVISIONAL_BANDS,
    SUBJECTS,
    TOTAL_MARKS,
    units,
)

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "supabase/migrations/20261218000000_bcs_written_taxonomy.sql"

# The Preliminary course these subjects may share a question bank with.
PRELIM_COURSE_SLUG = "bcs"
CANONICAL_BY_WRITTEN = {
    "bangla-1": "bangla",
    "bangla-2": "bangla",  # both Bangla papers draw on বাংলা ভাষা ও সাহিত্য
    "english": "english",
    "bd-affairs": "bd",
    "international-affairs": "international",
    "math-reasoning": "math",
    "mental-ability": "mental",
    "general-science": "science",
}


COURSE_ID_SUBQUERY = "(select id from public.courses where slug = 'bcs-written')"
SUBJECT_ID_SUBQUERY = (
    "(select su.id from public.subjects su join public.courses c on c.id = su.course_id"
    " where c.slug = 'bcs-written' and su.slug = {subject_slug})"
)
TOPIC_ID_SUBQUERY = (
    "(select tp.id from public.topics tp"
    " join public.subjects su on su.id = tp.subject_id"
    " join public.courses c on c.id = su.course_id"
    " where c.slug = 'bcs-written' and su.slug = {subject_slug} and tp.slug = {topic_slug})"
)


def lit(text: str) -> str:
    """SQL text literal."""
    return "'" + text.replace("'", "''") + "'"


def slugify(text: str) -> str:
    """Database slug from Bengali/English titles.

    Bengali text has no ASCII letters, so the readable part is lost; the
    caller appends a stable ordinal to keep every slug unique and never empty.
    """
    ascii_part = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return ascii_part


def subject_slug_for_index(index: int) -> str:
    return f"written-{index:02d}"


def build_rows():
    """(subject, band, topic, subtopic) tuples with stable slugs and order."""
    subjects = []
    topics = []
    subtopics = []

    for s_index, subject in enumerate(SUBJECTS, start=1):
        subjects.append(
            {
                "slug": subject["slug"],
                "title_bn": subject["title_bn"],
                "title_en": subject["title_en"],
                "marks": subject["marks"],
                "sort_order": s_index,
                "canonical": CANONICAL_BY_WRITTEN[subject["slug"]],
            }
        )
        # sort_order runs across the whole paper (P1 topics first), which is the
        # study order the user asked for: never leave a topic for the next.
        for u_index, unit in enumerate(units(subject), start=1):
            topic_slug = f"{subject['slug']}-t{u_index:02d}"
            topics.append(
                {
                    "subject_slug": subject["slug"],
                    "slug": topic_slug,
                    "title_bn": unit["topic_bn"],
                    "title_en": unit["topic_bn"],
                    "sort_order": u_index,
                    "band": unit["band"],
                    "band_marks": unit["band_marks"],
                    "provisional": (subject["slug"], unit["band"]) in PROVISIONAL_BANDS,
                }
            )
            for sub_index, sub in enumerate(unit["subtopics"], start=1):
                sub_slug = f"{topic_slug}-s{sub_index:02d}"
                subtopics.append(
                    {
                        "subject_slug": subject["slug"],
                        "topic_slug": topic_slug,
                        "slug": sub_slug,
                        "title_bn": sub,
                        "title_en": sub,
                        "sort_order": sub_index,
                        "band": unit["band"],
                        "provisional": (subject["slug"], unit["band"]) in PROVISIONAL_BANDS,
                    }
                )
    return subjects, topics, subtopics


# A topic's metadata also records which paper it belongs to and its band, so the
# Written study order can be rebuilt from the syllabus alone.
def topic_meta(row) -> str:
    meta = {
        "syllabus": "bcs-written",
        "priority": row["band"],
        "priority_source": "proposed-study-priority",
    }
    if row["band_marks"] is not None:
        meta["band_marks"] = row["band_marks"]
    if row["provisional"]:
        meta["provisional"] = True
    return lit(json.dumps(meta, ensure_ascii=False))


HEADER = f"""-- ============================================================================
-- BCS Written (compulsory) — subject -> P1..P4 -> topic -> subtopic
-- ============================================================================
-- 8 compulsory papers / {TOTAL_MARKS} marks / {len(SUBJECTS)} subjects.
--
-- SCOPE: a new course, slug '{COURSE_SLUG}'. The Preliminary course ('bcs') is
-- not touched: no row of it is renamed, retired or moved. Each Written subject
-- records metadata.canonical_subject_slug (its Preliminary namesake) so shared
-- questions can be joined by slug without copying any row. The FK column
-- subjects.canonical_subject_id is left alone: it points at the central
-- canonical taxonomy, not at a peer subject.
--
-- P1-P4 IS NOT AN OFFICIAL BPSC RANKING. The written syllabus does not rank its
-- topics; P1-P4 here is the user's proposed study order, recorded on every row
-- as metadata.priority_source = 'proposed-study-priority'. The paper marks ARE
-- official.
--
-- General Science & Technology P4 is marked metadata.provisional = true: the
-- Technology part of the official PDF was not fully mapped when this was built.
--
-- SAFE TO RE-RUN: every insert is `on conflict (slug) do update`, so a second
-- run refreshes titles, order and priority and changes no uuid. Nothing is
-- deleted, and no existing question/routine/progress link can be lost.
-- ============================================================================

"""


def build_sql() -> str:
    subjects, topics, subtopics = build_rows()
    out = [HEADER]

    # ---- course -----------------------------------------------------------
    # This migration must stand on its own: `subtopics.metadata` is added by
    # 20261214000000, and tests apply migrations in an arbitrary subset.
    out.append(
        """-- 0. প্রয়োজনীয় কলাম (এই মাইগ্রেশন একা চলতে পারবে)
alter table public.subtopics
  add column if not exists metadata jsonb not null default '{}'::jsonb;

"""
    )

    out.append(
        f"""-- 1. কোর্স: বিসিএস লিখিত (আলাদা কোর্স, প্রিলিমিনারি অক্ষত)
insert into public.courses
  (slug, title_en, title_bn, short_en, short_bn, summary_bn, description_bn,
   level, icon, accent, status, sort_order, metadata)
values
  ({lit(COURSE_SLUG)}, {lit(COURSE_TITLE_EN)}, {lit(COURSE_TITLE_BN)},
   'BCS Written', {lit(COURSE_TITLE_BN)},
   {lit("বিসিএস লিখিত পরীক্ষার ৮টি আবশ্যিক পত্র — ৯০০ নম্বর। P1 → P2 → P3 → P4 অগ্রাধিকারক্রমে সাজানো।")},
   {lit("লিখিত পরীক্ষার জন্য মুখস্থ নয় — উত্তর লেখার অনুশীলন, বিশ্লেষণ ও উপসংহার লেখার দক্ষতা।")},
   'advanced', 'pen-line', 'emerald', 'published', {COURSE_SORT_ORDER},
   {lit(json.dumps({"exam": "bcs", "stage": "written", "marks": TOTAL_MARKS, "papers": len(SUBJECTS)}, ensure_ascii=False))}::jsonb)
on conflict (slug) do update
  set title_en = excluded.title_en,
      title_bn = excluded.title_bn,
      short_bn = excluded.short_bn,
      summary_bn = excluded.summary_bn,
      description_bn = excluded.description_bn,
      level = excluded.level,
      status = 'published',
      sort_order = excluded.sort_order,
      metadata = public.courses.metadata || excluded.metadata,
      updated_at = now();

"""
    )

    # ---- subjects ---------------------------------------------------------
    subject_values = []
    for row in subjects:
        # `subjects.weight` is a 1..100 syllabus weight in the schema, not the
        # paper mark (Bengali 1st paper is 100 marks but the Written total is
        # 900). The real mark lives in metadata.marks, which is where the
        # paper-mark reader already looks.
        meta = {
            "syllabus": "bcs-written",
            "marks": row["marks"],
            "stage": "written",
            "canonical_subject_slug": row["canonical"],
        }
        subject_values.append(
            "  ({course_id}, {slug}, {en}, {bn}, {weight}, {order}, true, {meta}::jsonb)".format(
                course_id=COURSE_ID_SUBQUERY,
                slug=lit(row["slug"]),
                en=lit(row["title_en"]),
                bn=lit(row["title_bn"]),
                weight=min(row["marks"], 100),
                order=row["sort_order"],
                meta=lit(json.dumps(meta, ensure_ascii=False)),
            )
        )

    out.append(
        """-- 2. আটটি পত্র (subject). weight = পত্রের পূর্ণমান।
--    VALUES-এর ভেতরে CTE ব্যবহার করা যায় না, তাই কোর্স আইডি subquery দিয়ে।
insert into public.subjects
  (course_id, slug, title_en, title_bn, weight, sort_order, is_active, metadata)
values
{values}
on conflict (course_id, slug) do update
  set title_en = excluded.title_en,
      title_bn = excluded.title_bn,
      weight = excluded.weight,
      sort_order = excluded.sort_order,
      is_active = true,
      metadata = public.subjects.metadata || excluded.metadata,
      updated_at = now();

""".format(values=",\n".join(subject_values))
    )

    # ---- topics -----------------------------------------------------------
    # One `select ... from (values ...)` per chunk: the subject row is joined
    # once per statement instead of being re-resolved by a subquery on every
    # row, which keeps each statement small enough to paste into a SQL editor.
    topic_rows = [
        "    ({}, {}, {}, {}, {}, {}::jsonb)".format(
            lit(row["subject_slug"]),
            lit(row["slug"]),
            lit(row["title_en"]),
            lit(row["title_bn"]),
            row["sort_order"],
            topic_meta(row),
        )
        for row in topics
    ]

    for i in range(0, len(topic_rows), 60):
        out.append(
            """-- 3. টপিক (P1 → P4 ক্রমে সাজানো)
insert into public.topics (subject_id, slug, title_en, title_bn, sort_order, is_active, approval_status, metadata)
select su.id, v.slug, v.title_en, v.title_bn, v.sort_order, true, 'approved', v.metadata
  from (values
{values}
  ) as v(subject_slug, slug, title_en, title_bn, sort_order, metadata)
  join public.subjects su on su.slug = v.subject_slug
  join public.courses c on c.id = su.course_id and c.slug = 'bcs-written'
on conflict (subject_id, slug) do update
  set title_en = excluded.title_en,
      title_bn = excluded.title_bn,
      sort_order = excluded.sort_order,
      is_active = true,
      metadata = public.topics.metadata || excluded.metadata,
      updated_at = now();

""".format(values=",\n".join(topic_rows[i : i + 60]))
        )

    # ---- subtopics --------------------------------------------------------
    # The slug and the metadata are both derived from the parent topic, so the
    # emitted row only carries what is genuinely new: the title and its order.
    # This keeps the file ~4x smaller and makes the migration textually
    # identical to the statements that were applied to production.
    sub_rows = [
        "    ({}, {}, {}, {}, {})".format(
            lit(row["topic_slug"]),
            lit(row["title_en"]),
            lit(row["title_bn"]),
            row["sort_order"],
            lit(row["subject_slug"]),
        )
        for row in subtopics
    ]

    for i in range(0, len(sub_rows), 110):
        out.append(
            """-- 4. সাবটপিক (slug ও priority পেরেন্ট টপিক থেকে নেওয়া)
insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order, is_active, approval_status, metadata)
select tp.id,
       tp.slug || '-s' || lpad(v.n::text, 2, '0'),
       v.title_en, v.title_bn, v.n, true, 'approved',
       tp.metadata - 'band_marks' - 'syllabus'
  from (values
{values}
  ) as v(topic_slug, title_en, title_bn, n, subject_slug)
  join public.subjects su on su.slug = v.subject_slug
  join public.courses c on c.id = su.course_id and c.slug = 'bcs-written'
  join public.topics tp on tp.subject_id = su.id and tp.slug = v.topic_slug
on conflict (topic_id, slug) do update
  set title_en = excluded.title_en,
      title_bn = excluded.title_bn,
      sort_order = excluded.sort_order,
      is_active = true,
      metadata = public.subtopics.metadata || excluded.metadata,
      updated_at = now();

""".format(values=",\n".join(sub_rows[i : i + 110]))
        )

    # ---- verification -----------------------------------------------------
    out.append(
        """-- 5. যাচাই — মাইগ্রেশন নিজেই ব্যর্থ হয় যদি সংখ্যা মিলে না যায়।
do $$
declare
  v_course uuid;
  v_subjects int;
  v_topics int;
  v_subtopics int;
  v_marks int;
begin
  select id into v_course from public.courses where slug = {course};
  if v_course is null then
    raise exception 'bcs-written course missing';
  end if;

  select count(*), coalesce(sum((metadata->>'marks')::int), 0)
    into v_subjects, v_marks
    from public.subjects where course_id = v_course and is_active;

  select count(*) into v_topics
    from public.topics t join public.subjects s on s.id = t.subject_id
   where s.course_id = v_course and t.is_active;

  select count(*) into v_subtopics
    from public.subtopics st
    join public.topics t on t.id = st.topic_id
    join public.subjects s on s.id = t.subject_id
   where s.course_id = v_course and st.is_active;

  if v_subjects <> {n_subjects} then
    raise exception 'expected {n_subjects} subjects, found %', v_subjects;
  end if;
  if v_marks <> {marks} then
    raise exception 'expected {marks} marks, found %', v_marks;
  end if;
  if v_topics <> {n_topics} then
    raise exception 'expected {n_topics} topics, found %', v_topics;
  end if;
  if v_subtopics <> {n_subtopics} then
    raise exception 'expected {n_subtopics} subtopics, found %', v_subtopics;
  end if;
end $$;
""".format(
            course=lit(COURSE_SLUG),
            n_subjects=len(subjects),
            marks=TOTAL_MARKS,
            n_topics=len(topics),
            n_subtopics=len(subtopics),
        )
    )

    return "".join(out)


def _split_top_level(text: str) -> list[str]:
    """Split on commas that are outside quotes, parentheses and $dollar$ blocks."""
    parts, current = [], []
    depth = 0
    quote = None
    index = 0
    while index < len(text):
        char = text[index]
        if quote:
            current.append(char)
            if char == quote:
                # A doubled quote is an escaped quote, not the end of the literal.
                if index + 1 < len(text) and text[index + 1] == quote:
                    current.append(text[index + 1])
                    index += 2
                    continue
                quote = None
        elif char in ("'", '"'):
            quote = char
            current.append(char)
        elif char == "(":
            depth += 1
            current.append(char)
        elif char == ")":
            depth -= 1
            current.append(char)
        elif char == "," and depth == 0:
            parts.append("".join(current).strip())
            current = []
        else:
            current.append(char)
        index += 1
    tail = "".join(current).strip()
    if tail:
        parts.append(tail)
    return parts


def check_insert_arity(sql: str) -> None:
    """Fail the render if any INSERT's column list and its values disagree.

    Handles both shapes used in this file:
      insert into t (a, b) values (..), (..)
      insert into t (a, b) select .. from (values (..), (..)) as v(a, b)
    A missing `::jsonb` or an extra column would otherwise only fail at
    migration time, where the message is far harder to place.
    """
    for match in re.finditer(r"insert into public\.(\w+)\s*\(", sql):
        table = match.group(1)
        open_paren = match.end() - 1
        close_paren = sql.index(")", open_paren)
        columns = _split_top_level(sql[open_paren + 1 : close_paren])
        # Bound the search to this one statement, or a later chunk's
        # `as v(...)` alias would be picked up for an earlier insert.
        body = sql[close_paren + 1 : _statement_end(sql, close_paren + 1)]

        alias = re.search(r"\bas\s+v\s*\(", body)
        if alias:
            # insert into t (a, b, ...) select <one expr per column>
            #   from (values (r1), (r2)) as v(c1, c2)
            # The insert list must match the SELECT list, and every v.<name>
            # referenced must actually be declared by the alias.
            select_at = body.index("select") + len("select")
            from_index = re.search(r"\bfrom\b", body[select_at:]).start() + select_at
            selected = _split_top_level(body[select_at:from_index])
            assert len(columns) == len(selected), (
                f"{table}: insert lists {len(columns)} columns but the select "
                f"has {len(selected)} expressions\n  columns:  {columns}\n  select:   {selected}"
            )

            values_at = body.index("values")
            tuple_start = body.index("(", values_at)
            first_row = _split_top_level(
                body[tuple_start + 1 : tuple_start + 1 + _matching_paren(body, tuple_start)]
            )
            alias_end = body.index(")", alias.end())
            aliased = _split_top_level(body[alias.end() : alias_end])
            assert len(first_row) == len(aliased), (
                f"{table}: values alias names {len(aliased)} columns but the "
                f"first row has {len(first_row)}\n  alias: {aliased}\n  row:   {first_row}"
            )
            referenced = set(re.findall(r"\bv\.(\w+)", body))
            unknown = referenced - set(aliased)
            assert not unknown, (
                f"{table}: values alias {aliased} has no column(s) {sorted(unknown)}"
            )
            continue

        values_at = body.index("values")
        tuple_start = body.index("(", values_at)
        expressions = _split_top_level(body[tuple_start + 1 : tuple_start + 1 + _matching_paren(body, tuple_start)])
        assert len(columns) == len(expressions), (
            f"{table}: {len(columns)} columns but {len(expressions)} values\n"
            f"  columns: {columns}\n  values:  {expressions}"
        )


def _statement_end(text: str, start: int) -> int:
    """Index of the top-level `;` that ends the statement containing `start`."""
    depth, index, quote = 0, start, None
    while index < len(text):
        char = text[index]
        if quote:
            if char == quote:
                if index + 1 < len(text) and text[index + 1] == quote:
                    index += 1
                else:
                    quote = None
        elif char in ("'", '"'):
            quote = char
        elif char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
        elif char == ";" and depth == 0:
            return index
        index += 1
    return len(text)


def _matching_paren(text: str, open_index: int) -> int:
    """Length of the balanced (...) group that starts at `open_index`."""
    depth, index, quote = 0, open_index, None
    while index < len(text):
        char = text[index]
        if quote:
            if char == quote:
                if index + 1 < len(text) and text[index + 1] == quote:
                    index += 1
                else:
                    quote = None
        elif char in ("'", '"'):
            quote = char
        elif char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
            if depth == 0:
                return index - open_index - 1
        index += 1
    raise ValueError("unbalanced parentheses")


def main() -> None:
    sql = build_sql()
    check_insert_arity(sql)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(sql, encoding="utf-8")
    subjects, topics, subtopics = build_rows()
    print(
        f"{OUT}  {len(sql)} bytes  "
        f"{len(subjects)} subjects / {len(topics)} topics / {len(subtopics)} subtopics"
    )


if __name__ == "__main__":
    main()
