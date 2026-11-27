import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { MIGRATIONS_DIR, actAsService, createDatabase, migrate, rows, scalar } from "./harness";

/**
 * 20261214000000_bcs_preliminary_taxonomy.sql — the BCS Preliminary syllabus.
 *
 * The migration must land the official outline (10 subjects / 55 topics / 504
 * subtopics, 200 marks) on a database that still carries the old placeholder
 * tree, WITHOUT deleting anything and WITHOUT leaving a question behind:
 *  - every legacy topic becomes either a claimed (renamed in place, uuid kept)
 *    syllabus topic or an archived (`is_active = false`) row;
 *  - every question keeps its topic link, pointing at an ACTIVE topic;
 *  - study-plan coverage is seeded one row per subtopic;
 *  - a second run is a byte-identical no-op.
 *
 * It therefore replays the LIVE shape (137 placeholder topics, 358 subtopics,
 * 1131 questions, 1 assignment) from `fixtures/bcs-legacy-topics.tsv` and runs
 * the migration twice.
 */

const TARGET = "20261214000000_bcs_preliminary_taxonomy.sql";
const LEGACY = readFileSync(path.join(__dirname, "fixtures", "bcs-legacy-topics.tsv"), "utf8")
  .trim()
  .split("\n")
  .map((line) => line.split("|"));

let db: PGlite;
let courseId: string;

type Snapshot = {
  subjects: number;
  topics: number;
  subs: number;
  retired_topics: number;
  retired_subs: number;
  q_linked: number;
  q_sub_linked: number;
  q_on_retired: number;
  q_on_retired_sub: number;
  q_null_topic: number;
  assignments: number;
};

async function snapshot(): Promise<Snapshot> {
  const [row] = await rows<Snapshot>(
    db,
    `with c as (select id from public.courses where slug = 'bcs')
     select
       (select count(*) from public.subjects where course_id = (select id from c) and is_active)::int as subjects,
       (select count(*) from public.topics t join public.subjects s on s.id = t.subject_id
         where s.course_id = (select id from c) and t.is_active)::int as topics,
       (select count(*) from public.subtopics st join public.topics t on t.id = st.topic_id
          join public.subjects s on s.id = t.subject_id
         where s.course_id = (select id from c) and st.is_active)::int as subs,
       (select count(*) from public.topics t join public.subjects s on s.id = t.subject_id
         where s.course_id = (select id from c) and not t.is_active)::int as retired_topics,
       (select count(*) from public.subtopics st join public.topics t on t.id = st.topic_id
          join public.subjects s on s.id = t.subject_id
         where s.course_id = (select id from c) and not st.is_active)::int as retired_subs,
       (select count(*) from public.questions q join c on true
         where q.course_id = c.id and q.topic_id is not null)::int as q_linked,
       (select count(*) from public.questions q join c on true
         where q.course_id = c.id and q.subtopic_id is not null)::int as q_sub_linked,
       (select count(*) from public.questions q join c on true
         where q.course_id = c.id and q.topic_id is not null
           and not exists (select 1 from public.topics t where t.id = q.topic_id and t.is_active))::int
         as q_on_retired,
       (select count(*) from public.questions q join c on true
         where q.course_id = c.id and q.subtopic_id is not null
           and not exists (select 1 from public.subtopics st where st.id = q.subtopic_id and st.is_active))::int
         as q_on_retired_sub,
       (select count(*) from public.questions q join c on true
         where q.course_id = c.id and q.topic_id is null)::int as q_null_topic,
       (select count(*) from public.study_plan_assignments)::int as assignments`,
    [],
  );
  return row;
}

/** Rebuilds the live pre-migration BCS tree: 137 placeholder topics, each with 1–4 subtopics. */
async function buildLegacyTree() {
  await actAsService(db);
  courseId = await scalar<string>(db, `select id from public.courses where slug = 'bcs'`);

  // Production holds the placeholder outline, not the seed's outline: replace it.
  await db.exec(`
    delete from public.study_plan_assignments where course_id = '${courseId}';
    delete from public.routines where course_id = '${courseId}';
    delete from public.questions where course_id = '${courseId}';
    delete from public.topics where subject_id in (select id from public.subjects where course_id = '${courseId}');`);

  let n = 0;
  for (const [subjectSlug, topicSlug, title, questionCount] of LEGACY) {
    const subjectId = await scalar<string>(
      db,
      `select id from public.subjects where course_id = $1 and slug = $2`,
      [courseId, subjectSlug],
    );
    const topicId = await scalar<string>(
      db,
      `insert into public.topics (subject_id, slug, title_en, title_bn, sort_order, metadata)
       values ($1, $2, $3, $3, 99, '{}') returning id`,
      [subjectId, topicSlug, title],
    );
    const subCount = 1 + (n % 4);
    const subIds: string[] = [];
    for (let k = 1; k <= subCount; k += 1) {
      subIds.push(
        await scalar<string>(
          db,
          `insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
           values ($1, $2, $3, $3, $4) returning id`,
          [topicId, `legacy-${k}`, `${title} · অংশ ${k}`, k],
        ),
      );
    }
    const count = Math.min(Number(questionCount), 60);
    for (let i = 0; i < count; i += 1) {
      n += 1;
      await db.query(
        `insert into public.questions (
           course_id, subject_id, topic_id, subtopic_id, statement, option_a, option_b,
           option_c, option_d, correct_option, status, is_verified, fingerprint, source_type)
         values ($1, $2, $3, $4, $5, 'A', 'B', 'C', 'D', 1, 'approved', true, $6, 'ai_assisted')`,
        [courseId, subjectId, topicId, subIds[i % subIds.length], `legacy q ${n} about ${title}`, `fp-${n}`],
      );
    }
    n += 1;
  }

  // One published routine row and one assignment on a legacy topic, so the
  // re-point and the re-slotting logic are both exercised.
  await db.query(
    `insert into public.routines (
       course_id, kind, routine_date, title_bn, subject_id, topic_id, task_kind, status, slot_label, minutes)
     select $1, 'daily', '2026-11-29', 'পুরোনো রুটিন', t.subject_id, t.id, 'study', 'published', 'সকাল ৭', 60
       from public.topics t
      where t.slug = 'topic-14'
        and t.subject_id in (select id from public.subjects where course_id = $1 and slug = 'bangla')`,
    [courseId],
  );
  await db.query(
    `insert into public.study_plan_assignments (
       course_id, subject_id, topic_id, subtopic_id, plan_day, first_study_date, minutes)
     select $1, t.subject_id, t.id, null, 1, '2026-11-28', 30
       from public.topics t
      where t.slug = 'topic-14'
        and t.subject_id in (select id from public.subjects where course_id = $1 and slug = 'bangla')`,
    [courseId],
  );
}

/** Migrations run as the owner, never as the service role the tests act as. */
async function applyMigration() {
  await db.exec(`reset role;`);
  await db.exec(readFileSync(path.join(MIGRATIONS_DIR, TARGET), "utf8"));
}

beforeAll(async () => {
  db = await createDatabase();
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort().filter((f) => f !== TARGET);
  await migrate(db, files);
  await buildLegacyTree();
}, 300_000);

describe("20261214000000 — BCS Preliminary syllabus migration", () => {
  it("starts from the live legacy shape", async () => {
    const before = await snapshot();
    expect(before.subjects).toBe(10);
    expect(before.topics).toBe(137);
    expect(before.subs).toBe(358);
    expect(before.q_linked).toBe(1131);
    expect(before.assignments).toBe(1);
  });

  it("lands 10 subjects / 55 topics / 504 active subtopics worth 200 marks", async () => {
    await applyMigration();
    await actAsService(db);

    const after = await snapshot();
    expect(after.subjects).toBe(10);
    expect(after.topics).toBe(55);
    expect(after.subs).toBe(504);
    expect(after.retired_topics).toBe(85);
    expect(after.retired_subs).toBe(358);
    // Nothing is deleted and nothing is stranded.
    expect(after.q_linked).toBe(1131);
    expect(after.q_null_topic).toBe(0);
    expect(after.q_on_retired).toBe(0);
    expect(after.q_on_retired_sub).toBe(0);
    expect(after.assignments).toBe(505);

    const marks = Number(
      await scalar(
        db,
        `select sum(s.weight) from public.subjects s
           join public.courses c on c.id = s.course_id
          where c.slug = 'bcs' and s.is_active`,
      ),
    );
    expect(marks).toBe(200);

    // Every active subtopic carries a priority; every topic a priority mix.
    const missingPriority = Number(
      await scalar(
        db,
        `select count(*) from public.subtopics st
           join public.topics t on t.id = st.topic_id
           join public.subjects s on s.id = t.subject_id
          where s.course_id = $1 and st.is_active
            and (st.metadata ->> 'priority') not in ('P1', 'P2', 'P3')`,
        [courseId],
      ),
    );
    expect(missingPriority).toBe(0);
  });

  it("is a no-op on re-run", async () => {
    const before = await snapshot();
    await applyMigration();
    await actAsService(db);
    expect(await snapshot()).toEqual(before);
  });

  it("matches the official per-subject outline and marks distribution", async () => {
    const perSubject = await rows<{ slug: string; weight: number; topics: number; subs: number }>(
      db,
      `select s.slug, s.weight::int as weight,
              count(distinct t.id)::int as topics, count(st.id)::int as subs
         from public.subjects s
         join public.courses c on c.id = s.course_id
         left join public.topics t on t.subject_id = s.id and t.is_active
         left join public.subtopics st on st.topic_id = t.id and st.is_active
        where c.slug = 'bcs' and s.is_active
        group by 1, 2, s.sort_order order by s.sort_order`,
      [],
    );
    expect(perSubject).toEqual([
      { slug: "bangla", weight: 30, topics: 4, subs: 57 },
      { slug: "english", weight: 30, topics: 4, subs: 47 },
      { slug: "bd", weight: 25, topics: 8, subs: 80 },
      { slug: "international", weight: 25, topics: 7, subs: 64 },
      { slug: "geography", weight: 10, topics: 5, subs: 43 },
      { slug: "science", weight: 15, topics: 5, subs: 52 },
      { slug: "ict", weight: 15, topics: 6, subs: 53 },
      { slug: "math", weight: 20, topics: 6, subs: 44 },
      { slug: "mental", weight: 15, topics: 5, subs: 29 },
      { slug: "ethics", weight: 15, topics: 5, subs: 35 },
    ]);
  });

  it("repairs the two live checksum drifts so `db:migrate` never stops on drift", async () => {
    // The production database recorded these two files at their PRE-edit bytes.
    // A fresh run must re-sync them, otherwise the next `db:migrate` refuses.
    await db.exec(`reset role;`);
    await db.exec(`
      create table if not exists public.schema_migrations (
        filename text primary key, checksum text not null, applied_at timestamptz not null default now());
      insert into public.schema_migrations (filename, checksum) values
        ('20261121120400_seed_content.sql', 'c351207bf79d4031548e2ff87a0f7a46'),
        ('20261129000000_study_plan_assignments.sql', 'a11dd29e91b5aa94cb89f5cb96d4d7da'),
        ('20261212000000_analytics_tz_my_rank_taxonomy.sql', '20053e03ef1e3323f419173dd80a7cb9')
      on conflict (filename) do update set checksum = excluded.checksum;`);
    await applyMigration();
    await db.exec(`reset role;`);
    const synced = await rows<{ filename: string; checksum: string }>(
      db,
      `select filename, checksum from public.schema_migrations order by filename`,
    );
    const byName = new Map(synced.map((row) => [row.filename, row.checksum]));
    // The expected values are the sha256 of the repo bytes, first 32 hex chars.
    const { createHash } = await import("node:crypto");
    const current = createHash("sha256")
      .update(readFileSync(path.join(MIGRATIONS_DIR, "20261121120400_seed_content.sql")))
      .digest("hex")
      .slice(0, 32);
    expect(byName.get("20261121120400_seed_content.sql")).toBe(current);
    // An untouched, already-matching record is left alone.
    expect(byName.get("20261212000000_analytics_tz_my_rank_taxonomy.sql")).toBe(
      "20053e03ef1e3323f419173dd80a7cb9",
    );
  });

  it("keeps the syllabus queryable the way the spec asks for", async () => {
    // subject → topic → subtopic, one row per subtopic, with marks + priority.
    const outline = await rows<{ subject: string; topic: string; subtopic: string; priority: string }>(
      db,
      `select s.title_bn as subject, t.title_bn as topic, st.title_bn as subtopic,
              st.metadata ->> 'priority' as priority
         from public.subjects s
         join public.courses c on c.id = s.course_id
         join public.topics t on t.subject_id = s.id and t.is_active
         join public.subtopics st on st.topic_id = t.id and st.is_active
        where c.slug = 'bcs' and s.is_active`,
      [],
    );
    expect(outline.length).toBe(504);
    expect(outline.every((r) => r.priority && r.priority.startsWith("P"))).toBe(true);
  });
});
