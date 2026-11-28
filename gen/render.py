#!/usr/bin/env python3
"""Renders supabase/migrations/20261214000000_bcs_preliminary_taxonomy.sql
from the syllabus data in data_a/b/c.py.

Design decisions baked into the output (see the migration header for why):
  * subject rows are UPDATED in place (slug is unique per course) -> the
    routine rows, questions and study-plan assignments that point at them
    keep working;
  * every topic/subtopic row is matched by (parent, english title) first and,
    failing that, by the "P1 - ..." placeholder slug.  A match is renamed in
    place (same uuid) and a miss is inserted.  Legacy rows that no longer
    belong to the syllabus are retired (is_active = false), never deleted;
  * priorities P1/P2/P3 are stored in metadata.priority (jsonb), subtopic
    order in sort_order;
  * questions / routines / assignments that pointed at a retired row are
    re-pointed onto the new tree by title (subtopic first, then topic), so no
    link is silently lost;
  * nothing outside course slug='bcs' is touched.
"""
import json
import re
from pathlib import Path

from data_a import DATA_A
from data_b import DATA_B
from data_c import DATA_C

ROOT = Path(__file__).resolve().parents[1]

SUBJECT_EN = {
    "bangla": "Bangla Language and Literature",
    "english": "English Language and Literature",
    "bd": "Bangladesh Affairs",
    "international": "International Affairs",
    "geography": "Geography, Environment and Disaster Management",
    "science": "General Science",
    "ict": "Computer and Information Technology",
    "math": "Mathematical Reasoning",
    "mental": "Mental Ability",
    "ethics": "Ethics, Values and Good Governance",
}

TOPIC_EN = {
    # Subject 01
    "বাংলা ভাষা ও ব্যাকরণ": "Bangla Language and Grammar",
    "প্রাচীন ও মধ্যযুগের বাংলা সাহিত্য": "Old and Medieval Bangla Literature",
    "আধুনিক বাংলা সাহিত্য": "Modern Bangla Literature",
    "সাহিত্যকর্ম ও সাহিত্যবিষয়ক তথ্য": "Literary Works and Facts",
    # Subject 02
    "Grammar": "Grammar",
    "Vocabulary": "Vocabulary",
    "Composition": "Composition",
    "English Literature": "English Literature",
    # Subject 03
    "বাংলাদেশের ইতিহাস": "History of Bangladesh",
    "বাংলাদেশের স্বাধীনতা ও মুক্তিযুদ্ধ": "Independence and the Liberation War",
    "বাংলাদেশের সংবিধান": "Constitution of Bangladesh",
    "রাজনৈতিক ব্যবস্থা ও সরকার": "Political System and Government",
    "বাংলাদেশের অর্থনীতি": "Economy of Bangladesh",
    "কৃষি, শিল্প ও বাণিজ্য": "Agriculture, Industry and Trade",
    "জনসংখ্যা ও জাতিগোষ্ঠী": "Population and Ethnic Groups",
    "জাতীয় অর্জন ও সংস্কৃতি": "National Achievements and Culture",
    # Subject 04
    "বিশ্ব ইতিহাস": "World History",
    "আন্তর্জাতিক রাজনীতি ও সম্পর্ক": "International Politics and Relations",
    "আন্তর্জাতিক সংস্থা": "International Organisations",
    "আঞ্চলিক সংস্থা ও জোট": "Regional Organisations and Alliances",
    "আন্তর্জাতিক চুক্তি ও সম্মেলন": "International Treaties and Conferences",
    "দেশ পরিচিতি ও ভূ-রাজনীতি": "Country Profiles and Geopolitics",
    "আন্তর্জাতিক সাম্প্রতিক বিষয়": "Contemporary International Affairs",
    # Subject 05
    "বাংলাদেশের ভূগোল": "Geography of Bangladesh",
    "বাংলাদেশের প্রাকৃতিক পরিবেশ": "Natural Environment of Bangladesh",
    "বিশ্ব ভূগোল": "World Geography",
    "পরিবেশ ও জলবায়ু": "Environment and Climate",
    "দুর্যোগ ব্যবস্থাপনা": "Disaster Management",
    # Subject 06
    "পদার্থবিজ্ঞান": "Physics",
    "রসায়ন": "Chemistry",
    "জীববিজ্ঞান": "Biology",
    "মানবদেহ ও স্বাস্থ্য": "Human Body and Health",
    "আধুনিক ও প্রয়োগিক বিজ্ঞান": "Modern and Applied Science",
    # Subject 07
    "কম্পিউটার মৌলিক ধারণা": "Computer Fundamentals",
    "Number System ও Digital Logic": "Number System and Digital Logic",
    "Operating System ও Software": "Operating System and Software",
    "Internet ও Networking": "Internet and Networking",
    "Cyber Security": "Cyber Security",
    "আধুনিক তথ্যপ্রযুক্তি": "Modern Information Technology",
    # Subject 08
    "পাটিগণিত": "Arithmetic",
    "বীজগণিত": "Algebra",
    "ধারা ও সেট": "Series and Sets",
    "জ্যামিতি": "Geometry",
    "পরিমিতি": "Mensuration",
    "পরিসংখ্যান ও সম্ভাব্যতা": "Statistics and Probability",
    # Subject 09
    "Verbal Reasoning": "Verbal Reasoning",
    "Numerical Reasoning": "Numerical Reasoning",
    "Logical Reasoning": "Logical Reasoning",
    "Spatial Reasoning": "Spatial Reasoning",
    "Mechanical Reasoning": "Mechanical Reasoning",
    # Subject 10
    "নৈতিকতা": "Ethics",
    "মূল্যবোধ": "Values",
    "সুশাসন": "Good Governance",
    "গণতন্ত্র ও মানবাধিকার": "Democracy and Human Rights",
    "দুর্নীতি ও প্রশাসনিক নৈতিকতা": "Corruption and Administrative Ethics",
}

DATA = DATA_A + DATA_B + DATA_C

# legacy placeholder slug -> syllabus topic slug, per subject.  The live DB has
# 137 placeholder topics whose names are too coarse ("আধুনিক যুগ", "অপারেটিং
# সিস্টেম ও অ্যামবেডেড কম্পিউটার") to match a syllabus topic by similarity, so
# the mapping is explicit and reviewable here rather than guessed by trgm.
LEGACY_TOPIC_MAP = json.loads(Path(__file__).with_name("map.json").read_text(encoding="utf-8"))


def q(text: str) -> str:
    return "'" + text.replace("'", "''") + "'"


def ascii_slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "topic"


def topic_slug(title: str, index: int) -> str:
    base = ascii_slug(TOPIC_EN[title])
    return base if re.fullmatch(r"[A-Za-z ]+", title) else f"P1-{base}-{index}"


def tslug_of(title: str, index: int) -> str:
    return topic_slug(title, index)


def subject_block(slug: str, marks: int, sort_order: int) -> str:
    return (
        "update public.subjects s\n"
        f"   set title_en = {q(SUBJECT_EN[slug])},\n"
        f"       weight = {marks},\n"
        f"       sort_order = {sort_order},\n"
        "       is_active = true,\n"
        f"       metadata = s.metadata || {q(json.dumps({'marks': marks, 'syllabus': 'bcs-preliminary'}))}::jsonb,\n"
        "       updated_at = now()\n"
        "  from public.courses c\n"
        " where c.id = s.course_id and c.slug = 'bcs' and s.slug = " + q(slug) + ";\n"
    )


def values_block(rows) -> str:
    return "\n" + ",\n".join(rows) + "\n"


def topic_values() -> str:
    out = []
    for slug, _marks, topics in DATA:
        for i, (title, _subs) in enumerate(topics, start=1):
            meta = json.dumps({"syllabus": "bcs-preliminary"})
            out.append(
                "    ({}::text, {}::text, {}::text, {}::text, {}::smallint, {}::jsonb)".format(
                    q(slug), q(tslug_of(title, i)), q(TOPIC_EN[title]), q(title), i, q(meta)
                )
            )
    return values_block(out)


def subtopic_values() -> str:
    out = []
    for slug, _marks, topics in DATA:
        for i, (title, subs) in enumerate(topics, start=1):
            for j, (sub, prio) in enumerate(subs, start=1):
                out.append(
                    "    ({}::text, {}::text, {}::text, {}::text, {}::smallint, {}::text)".format(
                        q(slug), q(tslug_of(title, i)), q(f"sub-{j}"), q(sub), j, q(prio)
                    )
                )
    return values_block(out)



def claim_block() -> str:
    """For each syllabus topic, the ONE legacy row that is renamed into it.

    Two facts force this shape:
      * routines_unique_slot_idx is (course, kind, date, subject, topic) and is
        re-checked on every UPDATE - the staging date is collision-free only if
        each old row moves exactly once, to a distinct target;
      * a subtopic can only stay attached to a topic it was renamed with, so the
        legacy row that already holds a subtopic with the matching name must be
        the one claimed (renaming "কবি ও সাহিত্যিক" into "Modern Bangla
        Literature" would hide "রবীন্দ্রনাথ ঠাকুর" inside the wrong topic).
    Everything else in the legacy tree is retired - no data is deleted.
    """
    # best claimant per (subject, new topic slug)
    best = {}
    for slug, _marks, topics in DATA:
        for i, (title, _subs) in enumerate(topics, start=1):
            new_slug = tslug_of(title, i)
            old_slugs = [o for o, n in LEGACY_TOPIC_MAP.get(slug, {}).items() if n == new_slug]
            best.setdefault((slug, new_slug), None)
            for old in old_slugs:
                if best[(slug, new_slug)] is None:
                    best[(slug, new_slug)] = old
    rows = []
    for (slug, new_slug), old in best.items():
        if old is None:
            continue
        rows.append("    ({}::text, {}::text, {}::text)".format(q(slug), q(old), q(new_slug)))
    return values_block(rows)


def link_map_values() -> str:
    out = []
    for slug, _marks, topics in DATA:
        for i, (title, _subs) in enumerate(topics, start=1):
            for old, new in LEGACY_TOPIC_MAP.get(slug, {}).items():
                if new == tslug_of(title, i):
                    out.append("    ({}::text, {}::text, {}::text)".format(q(slug), q(old), q(new)))
    return values_block(out)


def detail_values() -> str:
    out = []
    for slug, _marks, topics in DATA:
        for i, (title, subs) in enumerate(topics, start=1):
            counts = {"P1": 0, "P2": 0, "P3": 0}
            for _sub, prio in subs:
                counts[prio] += 1
            markers = [f"{k}: {counts[k]}" for k in ("P1", "P2", "P3") if counts[k]]
            detail = f"{len(subs)} subtopic · " + " · ".join(markers)
            out.append(
                "    ({}::text, {}::text, {}::text)".format(q(slug), q(tslug_of(title, i)), q(detail))
            )
    return values_block(out)


HEADER = """-- ---------------------------------------------------------------------------
-- BCS Preliminary: full subject -> topic -> subtopic taxonomy + priorities
-- ---------------------------------------------------------------------------
-- Replaces the placeholder BCS outline (137 rows such as 'topic-14 / আধুনিক যুগ')
-- with the examined Preliminary syllabus, one database row per subtopic, in the
-- shape the importer and every product surface already expect:
--
--   Course    : BCS
--   Subject 01: বাংলা ভাষা ও সাহিত্য            marks 30  (subjects.weight)
--   Topic 1   : বাংলা ভাষা ও ব্যাকরণ
--   Subtopic  : শব্দ ও পদ                      priority P1 (subtopics.metadata)
--
--   10 subjects / 55 topics / 504 subtopics / 200 marks.
--
-- HOW THE OLD TREE IS CONVERTED WITHOUT LOSING LINKS
--   routines.subject_id|topic_id, questions.subject_id|topic_id|subtopic_id,
--   study_plan_assignments, routine_progress, question_frequency and
--   question_topic_links all reference these rows, and a delete would blank
--   thousands of question links (ON DELETE SET NULL).  So nothing is deleted:
--
--     1. subjects are UPDATEd in place by slug (marks -> weight, order);
--     2. for each syllabus topic ONE legacy row is claimed and renamed into it
--        (uuid unchanged).  The claimant is the legacy row that already holds
--        the subtopic with the matching name, otherwise the first mapped row -
--        see the jh_claim table below;
--     3. the claimed subtopics are renamed in place to the syllabus spelling;
--     4. every remaining legacy topic/subtopic is RETIRED
--        (is_active = false, metadata.retired_by = 'bcs-syllabus-v2');
--     5. questions / routines / progress rows that sat on a retired row are
--        re-pointed onto the new tree through an explicit, reviewable
--        (subject, legacy slug) -> syllabus topic map - no similarity guessing;
--     6. study_plan_assignments for the old tree are regenerated for the new
--        one (they are derived data).
--
--   Net effect: no question loses its topic, no routine row is orphaned, and
--   nothing is destroyed - the old names simply stop being "active".
--
-- RE-RUN BEHAVIOUR
--   Idempotent: a second run finds every claimed row already renamed (so the
--   claim set is empty), re-asserts subjects, order and priority, and finds no
--   retired rows left to re-point.
--
-- OUT OF SCOPE
--   Nothing outside course slug = 'bcs' is touched.
-- ---------------------------------------------------------------------------

-- ── ০ · প্রয়োজনীয় কলাম ও সহায়ক ফাংশন ────────────────────────────────────
--  subtopics-এ priority/focus রাখার জন্য metadata (topics-এ আগেই আছে)।
alter table public.subtopics
  add column if not exists metadata jsonb not null default '{}'::jsonb;

--  নাম মেলানোর "লঘু" রূপ: NFC → বাংলা কার/চিহ্ন বাদ → lower → য়/ড়/ঢ় এক করা
--  → স্পেস ও যতিচিহ্ন বাদ। (পুরোনো সাব-টপিকের নাম মেলাতে ব্যবহৃত)
create or replace function public.jh_title_norm(x text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select translate(
           translate(
             lower(regexp_replace(coalesce(x, ''),
               '[' || chr(2433) || '-' || chr(2435) || chr(2492) || '-' || chr(2509)
                   || chr(2519) || chr(2528) || '-' || chr(2531) || ']', '', 'g')),
             chr(2527) || chr(2524) || chr(2525),
             chr(2479) || chr(2465) || chr(2466)),
           ' ' || chr(9) || '.,;:।-–—()/' || chr(8203) || chr(8204) || chr(8205)
             || chr(8206) || chr(8207) || chr(65279),
           '')
$$;

revoke all on function public.jh_title_norm(text) from public, anon, authenticated;

-- ── ১ · কোর্স ───────────────────────────────────────────────────────────────
create temp table jh_tx on commit drop as
select c.id as course_id from public.courses c where c.slug = 'bcs';

do $$
begin
  if not exists (select 1 from jh_tx) then
    raise exception 'BCS কোর্স পাওয়া যায়নি';
  end if;
end $$;

-- ── ২ · বিষয়: ১০টি, নম্বর = weight, ক্রম = sort_order ──────────────────────
__SUBJECTS__
-- ── ৩ · সিলেবাসের বীজ (৫৫ টপিক · ৫০৪ সাব-টপিক) ────────────────────────────
create temp table jh_topic_seed on commit drop as
select v.subject_slug, v.slug, v.title_en, v.title_bn, v.sort_order, v.metadata
from (values
__TOPIC_VALUES__
) as v(subject_slug, slug, title_en, title_bn, sort_order, metadata);

create temp table jh_sub_seed on commit drop as
select v.subject_slug, v.topic_slug, v.slug, v.title_en, v.sort_order, v.priority
from (values
__SUBTOPIC_VALUES__
) as v(subject_slug, topic_slug, slug, title_en, sort_order, priority);

-- ── ৪ · দাবিদার (claim): প্রতিটি সিলেবাস টপিকের জন্য একটি পুরোনো সারি ─────
--  পুরোনো গাছের যে সারিতে ইতিমধ্যেই সিলেবাসের নামে সাব-টপিক আছে সেটিই দাবি
--  করে (তাতে সাব-টপিকগুলো সঠিক টপিকের ভেতরে থাকে); না থাকলে ম্যাপের প্রথম
--  সারি। বাকি সব সারি অবসরে যাবে।
create temp table jh_claim on commit drop as
select v.subject_slug, v.old_slug, v.new_topic_slug
from (values
__CLAIM_VALUES__
) as v(subject_slug, old_slug, new_topic_slug);

--  পুরোনো সাব-টপিক → সিলেবাসের নাম (একই বিষয়ে, একই নাম = একই সারি)।
create temp table jh_sub_claim on commit drop as
select c.subject_slug, c.old_slug as old_topic_slug, c.new_topic_slug,
       ns.slug as new_sub_slug, ns.title_en as new_sub_title,
       os.slug as old_sub_slug
from jh_claim c
join jh_tx x on true
join public.subjects su on su.course_id = x.course_id and su.slug = c.subject_slug
join public.topics ot on ot.subject_id = su.id and ot.slug = c.old_slug
join lateral (
  select st.* from public.subtopics st
  where st.topic_id = ot.id
    and exists (select 1 from jh_sub_seed s
                join public.topics nt2 on nt2.slug = s.topic_slug and nt2.subject_id = su.id
                where s.subject_slug = c.subject_slug and s.topic_slug = c.new_topic_slug
                  and public.jh_title_norm(s.title_en) = public.jh_title_norm(st.title_en))
  limit 1
) os on true
join lateral (
  select s.slug, s.title_en from jh_sub_seed s
  where s.subject_slug = c.subject_slug and s.topic_slug = c.new_topic_slug
    and public.jh_title_norm(s.title_en) = public.jh_title_norm(os.title_en)
  limit 1
) ns on true;

-- ── ৫ · সাব-টপিক ও টপিক নতুন নামে (uuid অপরিবর্তিত) ───────────────────────
update public.subtopics st
   set slug = sc.new_sub_slug,
       title_en = sc.new_sub_title,
       title_bn = sc.new_sub_title,
       is_active = true,
       approval_status = 'approved',
       metadata = coalesce(st.metadata, '{}'::jsonb)
                  || jsonb_build_object('priority',
                       (select s.priority from jh_sub_seed s
                         where s.subject_slug = sc.subject_slug
                           and s.topic_slug = sc.new_topic_slug
                           and s.slug = sc.new_sub_slug)),
       updated_at = now()
  from jh_sub_claim sc
  join jh_tx x on true
  join public.subjects su on su.course_id = x.course_id and su.slug = sc.subject_slug
  join public.topics ot on ot.subject_id = su.id and ot.slug = sc.old_topic_slug
 where st.topic_id = ot.id and st.slug = sc.old_sub_slug;

update public.topics t
   set slug = c.new_topic_slug,
       title_en = s.title_en,
       title_bn = s.title_bn,
       sort_order = s.sort_order,
       is_active = true,
       approval_status = 'approved',
       metadata = t.metadata || s.metadata,
       updated_at = now()
  from jh_claim c
  join jh_tx x on true
  join public.subjects su on su.course_id = x.course_id and su.slug = c.subject_slug
  join public.topics ot on ot.subject_id = su.id and ot.slug = c.old_slug
  join jh_topic_seed s on s.subject_slug = c.subject_slug and s.slug = c.new_topic_slug
 where t.id = ot.id
   -- পুনরায় চালালে সিলেবাসের slug আগেই আছে (আগের রানে দাবি করা সারিতে) → ছাড়
   and not exists (select 1 from public.topics t3
                    where t3.subject_id = su.id and t3.slug = c.new_topic_slug);

-- ── ৬ · নতুন গাছে যা এখনো নেই, যোগ করা ─────────────────────────────────────
insert into public.topics (subject_id, slug, title_en, title_bn, sort_order, is_active, approval_status, metadata)
select su.id, s.slug, s.title_en, s.title_bn, s.sort_order, true, 'approved', s.metadata
from jh_topic_seed s
join jh_tx x on true
join public.subjects su on su.course_id = x.course_id and su.slug = s.subject_slug
where not exists (select 1 from public.topics t where t.subject_id = su.id and t.slug = s.slug);

insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order, is_active, approval_status, metadata)
select t.id, s.slug, s.title_en, s.title_en, s.sort_order, true, 'approved',
       jsonb_build_object('priority', s.priority)
from jh_sub_seed s
join jh_tx x on true
join public.subjects su on su.course_id = x.course_id and su.slug = s.subject_slug
join public.topics t on t.subject_id = su.id and t.slug = s.topic_slug
where not exists (select 1 from public.subtopics st where st.topic_id = t.id and st.slug = s.slug);

--  নতুন যোগ হওয়া সারির sort_order/priority এক জায়গায় ঠিক করা
update public.subtopics st
   set sort_order = s.sort_order,
       title_bn = s.title_en,
       metadata = coalesce(st.metadata, '{}'::jsonb) || jsonb_build_object('priority', s.priority),
       updated_at = now()
  from jh_sub_seed s
  join jh_tx x on true
  join public.subjects su on su.course_id = x.course_id and su.slug = s.subject_slug
  join public.topics t on t.subject_id = su.id and t.slug = s.topic_slug
 where st.topic_id = t.id and st.slug = s.slug;

-- ── ৭ · পুরোনো গাছ অবসর (মোছা হয় না) ──────────────────────────────────────
create temp table jh_retired_topic on commit drop as
select t.id
from public.topics t
join public.subjects su on su.id = t.subject_id
join jh_tx x on x.course_id = su.course_id
where not exists (
  select 1 from jh_topic_seed s where s.subject_slug = su.slug and s.slug = t.slug
);

--  সক্রিয় টপিকের ভেতরে থাকা অচেনা সাব-টপিকও অবসরে যায় (নাম মিললেই সেটি
--  ইতিমধ্যে সিলেবাসের নামে বদলে গেছে, তাই আর অবসরে পড়বে না)।
create temp table jh_retired_sub on commit drop as
select st.id, st.topic_id
from public.subtopics st
join public.topics t on t.id = st.topic_id
join public.subjects su on su.id = t.subject_id
join jh_tx x on x.course_id = su.course_id
where not exists (
  select 1 from jh_sub_seed s
  where s.subject_slug = su.slug and s.topic_slug = t.slug and s.slug = st.slug
);

update public.topics t
   set is_active = false,
       metadata = t.metadata || jsonb_build_object('retired_by', 'bcs-syllabus-v2'),
       updated_at = now()
  from jh_retired_topic r
 where t.id = r.id and t.is_active;

update public.subtopics st
   set is_active = false,
       metadata = coalesce(st.metadata, '{}'::jsonb) || jsonb_build_object('retired_by', 'bcs-syllabus-v2'),
       updated_at = now()
  from jh_retired_sub r
 where st.id = r.id and st.is_active;

-- ── ৮ · পুরোনো লিংক নতুন গাছে আনা ─────────────────────────────────────────
--  হাতে যাচাই করা ম্যাপ: (subject, পুরোনো placeholder slug) → সিলেবাস টপিক।
--  পুরোনো নামগুলো এতটাই মোটা ("আধুনিক যুগ", "অপারেটিং সিস্টেম ও অ্যামবেডেড
--  কম্পিউটার") যে similarity দিয়ে অনুমান করা যায় না - তাই স্পষ্ট ম্যাপ।
create temp table jh_link_map on commit drop as
select v.subject_slug, v.old_slug, v.new_topic_slug
from (values
__LINK_MAP_VALUES__
) as v(subject_slug, old_slug, new_topic_slug);

create temp table jh_link_target on commit drop as
select ot.id as old_topic_id,
       nt.id as new_topic_id,
       (select nst.id from public.subtopics nst
         where nst.topic_id = nt.id and nst.is_active
           and public.jh_title_norm(nst.title_en) = public.jh_title_norm(os.title_en)
         limit 1) as new_subtopic_id
from public.topics ot
join public.subjects su on su.id = ot.subject_id
join jh_tx x on x.course_id = su.course_id
join jh_retired_topic rt on rt.id = ot.id
join jh_link_map m on m.subject_slug = su.slug and m.old_slug = ot.slug
join public.topics nt on nt.subject_id = su.id and nt.slug = m.new_topic_slug and nt.is_active
left join lateral (
  select st.title_en from public.subtopics st where st.topic_id = ot.id order by st.sort_order limit 1
) os on true;

update public.questions q
   set topic_id = t.new_topic_id,
       subtopic_id = null,
       updated_at = now()
  from jh_link_target t
 where q.topic_id = t.old_topic_id;

--  রুটিন: routines_unique_slot_idx = (course, kind, date, subject, topic) — তাই
--  প্রতিটি সারি আলাদাভাবে সরানো হয়, আর সংঘর্ষ হলে (যেমন একই দিনে একই বিষয়ে
--  পুরোনো আর্কাইভ সারি) সেই সারি আগের জায়গাতেই থাকে। শুধু প্রকাশিত রুটিন
--  সরানো হয়; আর্কাইভ করা ইতিহাস অপরিবর্তিত।
do $$
declare
  rec record;
  moved int := 0;
begin
  for rec in
    select r.id, t.new_topic_id, t.new_subtopic_id
    from public.routines r
    join jh_link_target t on t.old_topic_id = r.topic_id
    where r.status = 'published'
  loop
    begin
      update public.routines
         set topic_id = rec.new_topic_id,
             subtopic_id = rec.new_subtopic_id,
             updated_at = now()
       where id = rec.id;
      moved := moved + 1;
    exception when unique_violation then
      raise notice 'রুটিন % সরানো যায়নি (একই দিন/বিষয়ে অন্য সারি), আগের টপিকেই রাখা হলো', rec.id;
    end;
  end loop;
  raise notice 'রুটিন সারি সরানো হয়েছে: %', moved;
end $$;

update public.routine_progress p
   set topic_id = t.new_topic_id,
       subtopic_id = null
  from jh_link_target t
 where p.topic_id = t.old_topic_id;

--  সাব-টপিক: নতুন টপিকের ভেতরে হুবহু/অন্তর্ভুক্ত নামের সিলেবাস সাব-টপিক
--  খুঁজে বসানো হয় (similarity অনুমান নয়); না মিললে null — প্রশ্নটি
--  টপিক-লেভেলে থাকে, হারায় না।
create temp table jh_sub_remap on commit drop as
select os.id as old_sub_id, best.new_sub_id
from jh_retired_sub os
join public.subtopics ost on ost.id = os.id
join jh_link_target t on t.old_topic_id = os.topic_id
join lateral (
  select nst.id as new_sub_id,
         case
           when public.jh_title_norm(nst.title_en) = public.jh_title_norm(ost.title_en) then 1::real
           when length(public.jh_title_norm(nst.title_en)) >= 6
                and position(public.jh_title_norm(nst.title_en) in public.jh_title_norm(ost.title_en)) > 0 then 0.9::real
           when length(public.jh_title_norm(ost.title_en)) >= 6
                and position(public.jh_title_norm(ost.title_en) in public.jh_title_norm(nst.title_en)) > 0 then 0.9::real
           else similarity(public.jh_title_norm(nst.title_en), public.jh_title_norm(ost.title_en))
         end as score
  from public.subtopics nst
  where nst.topic_id = t.new_topic_id and nst.is_active
  order by score desc, nst.sort_order
  limit 1
) best on best.score >= 0.9;

update public.questions q
   set subtopic_id = m.new_sub_id,
       updated_at = now()
  from jh_sub_remap m
 where q.subtopic_id = m.old_sub_id;

update public.routines r
   set subtopic_id = m.new_sub_id,
       updated_at = now()
  from jh_sub_remap m
 where r.subtopic_id = m.old_sub_id;

update public.routine_progress p
   set subtopic_id = m.new_sub_id
  from jh_sub_remap m
 where p.subtopic_id = m.old_sub_id;

--  কোনো পুরোনো সাব-টপিকের নাম মিলল না → লিংকটি টপিক-লেভেলে নামানো হয়
--  (প্রশ্ন/রুটিন হারায় না, শুধু সাব-টপিক থাকে না)।
update public.questions q
   set subtopic_id = null,
       updated_at = now()
  from jh_retired_sub r
 where q.subtopic_id = r.id
   and not exists (select 1 from jh_sub_remap m where m.old_sub_id = r.id);

update public.routines r
   set subtopic_id = null,
       updated_at = now()
  from jh_retired_sub rs
 where r.subtopic_id = rs.id
   and not exists (select 1 from jh_sub_remap m where m.old_sub_id = rs.id);

update public.routine_progress p
   set subtopic_id = null
  from jh_retired_sub rs
 where p.subtopic_id = rs.id
   and not exists (select 1 from jh_sub_remap m where m.old_sub_id = rs.id);

--  অ্যাসাইনমেন্ট জেনারেট করা ডেটা → পুরোনো গাছের সারি বাদ, নতুন গাছে আবার।
delete from public.study_plan_assignments a
using jh_retired_topic r
where a.topic_id = r.id;

delete from public.study_plan_assignments a
using jh_retired_sub r
where a.subtopic_id = r.id;

-- ── ৯ · priority ও টপিকের মিশ্রণ ──────────────────────────────────────────
create temp table jh_detail_seed on commit drop as
select v.subject_slug, v.topic_slug, v.detail
from (values
__DETAIL_VALUES__
) as v(subject_slug, topic_slug, detail);

update public.topics t
   set metadata = t.metadata || jsonb_build_object(
         'priority', case
           when d.detail like '%P1:%' then 'P1'
           when d.detail like '%P2:%' then 'P2'
           else 'P3' end,
         'priority_mix', d.detail),
       updated_at = now()
  from jh_detail_seed d
  join jh_tx x on true
  join public.subjects su on su.course_id = x.course_id and su.slug = d.subject_slug
  join public.topics t2 on t2.subject_id = su.id and t2.slug = d.topic_slug
 where t.id = t2.id;

-- ── ১০ · প্রথম-পড়ার অ্যাসাইনমেন্ট (কভারেজ ইঞ্জিনের জন্য) ──────────────────
--  P1 আগে, তারপর P2, P3; ৬০ দিনের মধ্যে ঘুরিয়ে বসানো। আগে থেকে থাকলে
--  (unique index) হাত দেওয়া হয় না।
with unit as (
  select su.id as subject_id, t.id as topic_id, st.id as subtopic_id, st.title_en,
         coalesce(st.metadata ->> 'priority', 'P2') as priority,
         row_number() over (
           order by case coalesce(st.metadata ->> 'priority', 'P2')
                      when 'P1' then 1 when 'P2' then 2 else 3 end,
                    su.sort_order, t.sort_order, st.sort_order, st.id) as rn
  from jh_tx x
  join public.subjects su on su.course_id = x.course_id and su.is_active
  join public.topics t on t.subject_id = su.id and t.is_active
  join public.subtopics st on st.topic_id = t.id and st.is_active
)
insert into public.study_plan_assignments
  (course_id, subject_id, topic_id, subtopic_id, plan_day, first_study_date,
   minutes, priority, objective_bn)
select x.course_id, u.subject_id, u.topic_id, u.subtopic_id,
       1 + ((u.rn - 1) % 60)::smallint,
       date '2026-11-28' + (((u.rn - 1) % 60)::int),
       20,
       case u.priority when 'P1' then 'high' when 'P3' then 'low' else 'normal' end,
       'সিলেবাসের সাব-টপিক: ' || u.title_en
from unit u
cross join jh_tx x
where not exists (
  select 1 from public.study_plan_assignments a
  where a.course_id = x.course_id and a.topic_id = u.topic_id
    and a.subtopic_id is not distinct from u.subtopic_id);

-- ── ১১ · যাচাই ─────────────────────────────────────────────────────────────
--  পুরোনো গাছের সাথে সামঞ্জস্যরক্ষার ফাংশন (jh_guard_previous_source,
--  jh_recompute_topic_priorities) এবং ট্রিগার থেকে যায়; এখানে শুধু হিসাব।
do $$
declare bad int;
begin
  select count(*) into bad from jh_tx x
  where (select count(*) from public.subjects su where su.course_id = x.course_id and su.is_active) <> 10;
  if bad > 0 then raise exception 'BCS-এ ১০টি সক্রিয় বিষয় থাকা উচিত, পাওয়া গেল %', bad; end if;

  select count(*) into bad from jh_tx x
  where (select count(*) from public.topics t join public.subjects su on su.id = t.subject_id
          where su.course_id = x.course_id and su.is_active and t.is_active) <> 55;
  if bad > 0 then raise exception 'BCS-এ ৫৫টি সক্রিয় টপিক থাকা উচিত, পাওয়া গেল %', bad; end if;

  select count(*) into bad from jh_tx x
  where (select count(*) from public.subtopics st join public.topics t on t.id = st.topic_id
           join public.subjects su on su.id = t.subject_id
          where su.course_id = x.course_id and su.is_active and t.is_active and st.is_active) <> 504;
  if bad > 0 then raise exception 'BCS-এ ৫০৪টি সক্রিয় সাব-টপিক থাকা উচিত, পাওয়া গেল %', bad; end if;

  select count(*) into bad
  from public.subtopics st
  join public.topics t on t.id = st.topic_id
  join public.subjects su on su.id = t.subject_id
  join jh_tx x on x.course_id = su.course_id
  where st.is_active and t.is_active and (st.metadata ->> 'priority') is null;
  if bad > 0 then raise exception '%টি সক্রিয় সাব-টপিকে priority নেই', bad; end if;
end $$;
"""

def main():
    subjects = [
        subject_block(slug, marks, i)
        for i, (slug, marks, _topics) in enumerate(DATA, start=1)
    ]
    sql = HEADER
    for token, value in (
        ("__SUBJECTS__", "\n".join(subjects)),
        ("__TOPIC_VALUES__", topic_values()),
        ("__SUBTOPIC_VALUES__", subtopic_values()),
        ("__DETAIL_VALUES__", detail_values()),
        ("__LINK_MAP_VALUES__", link_map_values()),
        ("__CLAIM_VALUES__", claim_block()),
    ):
        sql = sql.replace(token, value)
    out = ROOT / "supabase/migrations/20261214000000_bcs_preliminary_taxonomy.sql"
    out.write_text(sql, encoding="utf-8")
    print(out, len(sql), "bytes")


if __name__ == "__main__":
    main()
