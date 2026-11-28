/**
 * The BCS Written taxonomy (supabase/migrations/20261218000000_…sql) must:
 *   * land 8 compulsory papers / 900 marks / the full topic+subtopic tree;
 *   * leave the existing Preliminary course completely untouched — same subject
 *     uuids, same topic and subtopic counts, same activity — because Written is
 *     a separate paper, not a re-shaping of the MCQ syllabus;
 *   * be idempotent: a second run refreshes rows without duplicating one or
 *     changing a uuid, so question/routine links cannot be lost;
 *   * carry the priority provenance, since P1–P4 is a study order and NOT an
 *     official BPSC ranking (BPSC does not rank Written topics).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createDatabase, migrate } from "./harness";

const SQL = readFileSync(
  path.join(process.cwd(), "supabase", "migrations", "20261218000000_bcs_written_taxonomy.sql"),
  "utf8",
);

type Tree = {
  subjects: number;
  topics: number;
  subtopics: number;
  marks: number;
  inactive: number;
};

async function writtenTree(db: {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
}): Promise<Tree> {
  const { rows } = await db.query(`
    select
      (select count(*)::int from public.subjects s join public.courses c on c.id = s.course_id
        where c.slug = 'bcs-written' and s.is_active) as subjects,
      (select count(*)::int from public.topics t join public.subjects s on s.id = t.subject_id
        join public.courses c on c.id = s.course_id
        where c.slug = 'bcs-written' and t.is_active) as topics,
      (select count(*)::int from public.subtopics st join public.topics t on t.id = st.topic_id
        join public.subjects s on s.id = t.subject_id
        join public.courses c on c.id = s.course_id
        where c.slug = 'bcs-written' and st.is_active) as subtopics,
      (select coalesce(sum((s.metadata->>'marks')::int), 0)::int from public.subjects s
        join public.courses c on c.id = s.course_id
        where c.slug = 'bcs-written' and s.is_active) as marks,
      (select count(*)::int from public.topics t join public.subjects s on s.id = t.subject_id
        join public.courses c on c.id = s.course_id
        where c.slug = 'bcs-written' and not t.is_active) as inactive
  `);
  return rows[0] as Tree;
}

async function prelimFingerprint(db: {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
}) {
  const { rows } = await db.query(`
    select
      (select count(*)::int from public.subjects s join public.courses c on c.id = s.course_id
        where c.slug = 'bcs') as subjects,
      (select count(*)::int from public.topics t join public.subjects s on s.id = t.subject_id
        join public.courses c on c.id = s.course_id
        where c.slug = 'bcs') as topics,
      (select md5(string_agg(s.id::text || ':' || s.slug, ',' order by s.slug)) from public.subjects s
        join public.courses c on c.id = s.course_id where c.slug = 'bcs') as subject_ids
  `);
  return rows[0];
}

describe("BCS Written taxonomy", () => {
  it("lands 8 papers / 900 marks / the full tree, as a separate course", async () => {
    const db = await createDatabase();
    await migrate(db);
    const before = await prelimFingerprint(db as never);

    await db.exec(SQL);

    const tree = await writtenTree(db as never);
    expect(tree.subjects).toBe(8);
    expect(tree.marks).toBe(900);
    expect(tree.topics).toBe(89);
    expect(tree.subtopics).toBe(419);
    expect(tree.inactive).toBe(0);

    // The Preliminary syllabus is untouched: same subjects, same uuids.
    expect(await prelimFingerprint(db as never)).toEqual(before);

    // Marks per paper, straight from the official written syllabus table.
    const { rows: papers } = await db.query<{ slug: string; weight: number; topics: number }>(`
      select s.slug, (s.metadata->>'marks')::int as weight,
             (select count(*)::int from public.topics t where t.subject_id = s.id and t.is_active) as topics
        from public.subjects s join public.courses c on c.id = s.course_id
       where c.slug = 'bcs-written' and s.is_active
       order by s.sort_order
    `);
    expect(papers.map((p) => [p.slug, p.weight])).toEqual([
      ["bangla-1", 100],
      ["bangla-2", 100],
      ["english", 200],
      ["bd-affairs", 200],
      ["international-affairs", 100],
      ["math-reasoning", 50],
      ["mental-ability", 50],
      ["general-science", 100],
    ]);
  });

  it("marks P1-P4 as a proposed study priority, never as an official ranking", async () => {
    const db = await createDatabase();
    await migrate(db);
    await db.exec(SQL);

    const { rows } = await db.query<{ total: number; wrong: number }>(`
      select count(*)::int as total,
             count(*) filter (
               where t.metadata->>'priority_source' is distinct from 'proposed-study-priority'
                  or t.metadata->>'priority' not in ('P1','P2','P3','P4')
             )::int as wrong
        from public.topics t
        join public.subjects s on s.id = t.subject_id
        join public.courses c on c.id = s.course_id
       where c.slug = 'bcs-written'
    `);
    expect(rows[0].total).toBe(89);
    expect(rows[0].wrong).toBe(0);

    // Study order inside each paper: every P1 topic precedes every P2 topic,
    // and so on. sort_order restarts per paper, so rank within the subject.
    const { rows: outOfOrder } = await db.query<{ n: number }>(`
      with ranked as (
        select s.slug as subject,
               t.sort_order,
               row_number() over (
                 partition by s.slug
                 order by case t.metadata->>'priority'
                            when 'P1' then 1 when 'P2' then 2 when 'P3' then 3 else 4 end,
                          t.sort_order
               ) as expected
          from public.topics t
          join public.subjects s on s.id = t.subject_id
          join public.courses c on c.id = s.course_id
         where c.slug = 'bcs-written'
      )
      select count(*)::int as n from ranked where sort_order <> expected
    `);
    expect(outOfOrder[0].n).toBe(0);

    // The one section the user flagged as unverified is labelled as such.
    const { rows: provisional } = await db.query<{ n: number }>(`
      select count(*)::int as n
        from public.topics t
        join public.subjects s on s.id = t.subject_id
        join public.courses c on c.id = s.course_id
       where c.slug = 'bcs-written' and s.slug = 'general-science'
         and (t.metadata->>'provisional')::boolean
    `);
    expect(provisional[0].n).toBe(1);
  });

  it("is idempotent and changes no uuid on a second run", async () => {
    const db = await createDatabase();
    await migrate(db);
    await db.exec(SQL);
    const first = await writtenTree(db as never);

    const { rows: idsBefore } = await db.query<{ digest: string }>(`
      select md5(string_agg(t.id::text, ',' order by t.slug)) as digest
        from public.topics t
        join public.subjects s on s.id = t.subject_id
        join public.courses c on c.id = s.course_id
       where c.slug = 'bcs-written'
    `);

    await db.exec(SQL);

    expect(await writtenTree(db as never)).toEqual(first);
    const { rows: idsAfter } = await db.query<{ digest: string }>(`
      select md5(string_agg(t.id::text, ',' order by t.slug)) as digest
        from public.topics t
        join public.subjects s on s.id = t.subject_id
        join public.courses c on c.id = s.course_id
       where c.slug = 'bcs-written'
    `);
    expect(idsAfter[0].digest).toBe(idsBefore[0].digest);
  });
});
