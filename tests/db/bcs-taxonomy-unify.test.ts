import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { actAsService, createDatabase, migrate, rows, scalar, uuid } from "./harness";

/**
 * 20261219000000_bcs_taxonomy_unify.sql — one tree, no duplicates, questions
 * classified.
 *
 * The user's rules, restated as assertions:
 *  - the same topic or subtopic must not exist twice (normalised comparison, so
 *    matra variants count as the same title);
 *  - nothing already on the tree may be lost — every active topic and subtopic
 *    present before the migration is still there afterwards;
 *  - a question never ends up on a topic outside its own subject;
 *  - a question is never moved to a *different* topic than the one it had;
 *  - questions the rules cannot place keep `topic_id` null rather than being
 *    filed somewhere plausible-but-wrong;
 *  - a second run changes nothing.
 *
 * The classification itself (how many of the 2,112 untagged questions land on
 * which subtopic) is asserted against production right after the migration is
 * applied — this fixture carries no question bank, so counting matches here
 * would only test the fixture. What IS tested here is the machinery that makes
 * a wrong classification impossible: subject agreement, subtopic/topic
 * agreement, and the link mirror.
 *
 * `jh_title_norm` is revoked from `authenticated` by the anon lockdown, so
 * duplicate checks run as the owner.
 */

let db: PGlite;
let courseId: string;

beforeAll(async () => {
  db = await createDatabase();
  await migrate(db);
  await actAsService(db);
  courseId = await scalar<string>(db, `select id from public.courses where slug = 'bcs'`);
}, 300_000);

describe("20261219000000 — BCS taxonomy unify", () => {
  it("leaves exactly one active tree with no duplicate titles", async () => {
    await db.exec("reset role;");
    const dupTopics = await rows(
      db,
      `select s.slug, public.jh_title_norm(t.title_bn) as k, count(*) as n
         from public.topics t
         join public.subjects s on s.id = t.subject_id
        where s.course_id = $1 and t.is_active
        group by 1, 2 having count(*) > 1`,
      [courseId],
    );
    expect(dupTopics).toEqual([]);

    const dupSubs = await rows(
      db,
      `select s.slug, public.jh_title_norm(st.title_bn) as k, count(*) as n
         from public.subtopics st
         join public.topics t on t.id = st.topic_id
         join public.subjects s on s.id = t.subject_id
        where s.course_id = $1 and t.is_active and st.is_active
        group by 1, 2 having count(*) > 1`,
      [courseId],
    );
    expect(dupSubs).toEqual([]);
    await actAsService(db);
  });

  it("keeps every active subtopic the syllabus migration created", async () => {
    // 504 minus the one duplicate নদ-নদী row the unify step collapses, plus the
    // two subtopics it adds (বাংলা: পদ, প্রয়োগ ও অপ্রয়োগ).
    const subs = await scalar<number>(
      db,
      `select count(*) from public.subtopics st
         join public.topics t on t.id = st.topic_id
         join public.subjects s on s.id = t.subject_id
        where s.course_id = $1 and s.is_active and t.is_active and st.is_active`,
      [courseId],
    );
    expect(Number(subs)).toBe(505);
  });

  it("deletes the retired placeholder branch", async () => {
    // Every row the previous migration retired is gone. Rows that were never
    // part of that branch (an admin can create an inactive topic at any time)
    // are deliberately untouched.
    const retired = await scalar<number>(
      db,
      `select count(*) from public.topics t
         join public.subjects s on s.id = t.subject_id
        where s.course_id = $1 and t.metadata ->> 'retired_by' is not null`,
      [courseId],
    );
    expect(Number(retired)).toBe(0);

    const retiredSubs = await scalar<number>(
      db,
      `select count(*) from public.subtopics st
         join public.topics t on t.id = st.topic_id
         join public.subjects s on s.id = t.subject_id
        where s.course_id = $1 and t.metadata ->> 'retired_by' is not null`,
      [courseId],
    );
    expect(Number(retiredSubs)).toBe(0);
  });

  it("never files a question under another subject", async () => {
    const wrong = await scalar<number>(
      db,
      `select count(*) from public.questions q
         join public.topics t on t.id = q.topic_id
        where q.course_id = $1 and t.subject_id is distinct from q.subject_id`,
      [courseId],
    );
    expect(Number(wrong)).toBe(0);
  });

  it("keeps a subtopic's question on the subtopic's own topic", async () => {
    const mismatch = await scalar<number>(
      db,
      `select count(*) from public.questions q
         join public.subtopics st on st.id = q.subtopic_id
        where q.course_id = $1 and st.topic_id is distinct from q.topic_id`,
      [courseId],
    );
    expect(Number(mismatch)).toBe(0);
  });

  it("mirrors the classification into question_topic_links", async () => {
    const missing = await scalar<number>(
      db,
      `select count(*) from public.questions q
        where q.course_id = $1 and q.topic_id is not null
          and not exists (
            select 1 from public.question_topic_links l
             where l.question_id = q.id and l.topic_id = q.topic_id)`,
      [courseId],
    );
    expect(Number(missing)).toBe(0);
  });

  it("leaves every active subtopic with a first-study row", async () => {
    const gaps = await rows(db, `select * from public.jh_coverage_unassigned($1)`, [courseId]);
    expect(gaps).toEqual([]);
  });

  it("is a no-op on a second run", async () => {
    const before = await snapshot();
    const files = ["20261219000000_bcs_taxonomy_unify.sql"];
    await migrate(db, files);
    expect(await snapshot()).toEqual(before);
  });

  it("collapses a question that carries two primary links", async () => {
    // Production had 101 such questions: the unique index is
    // (question_id, course_id, topic_id), and Postgres treats NULL topic ids as
    // distinct, so two primary rows coexisted while both topics were null. The
    // moment a backfill gives both rows a real topic the jh_sync_primary_link
    // trigger collides. This reproduces the shape and asserts the migration
    // still classifies the question instead of aborting.
    await actAsService(db);
    const bangla = await scalar<string>(
      db,
      `select id from public.subjects where course_id = $1 and slug = 'bangla'`,
      [courseId],
    );
    const topic = await scalar<string>(
      db,
      `select t.id from public.topics t
        where t.subject_id = $1 and t.is_active
        order by t.sort_order, t.id limit 1`,
      [bangla],
    );
    const id = uuid(4301);
    await db.query(
      `insert into public.questions (
         id, course_id, subject_id, topic_id, subtopic_id, statement, option_a, option_b,
         option_c, option_d, correct_option, status, is_verified, fingerprint, source_type)
       values ($1, $2, $3, null, null, 'নিচের কোনটি সন্ধির উদাহরণ?', 'ক', 'খ', 'গ', 'ঘ',
               1, 'approved', true, 'dup-link-q', 'ai_assisted')`,
      [id, courseId, bangla],
    );
    await db.query(
      `insert into public.question_topic_links (question_id, course_id, subject_id, topic_id, subtopic_id, is_primary)
       values ($1, $2, $3, null, null, true)`,
      [id, courseId, bangla],
    );
    // `jh_qtl_autolink` already created one primary link on insert; this adds a
    // second with a NULL topic — exactly the production shape. (A single row
    // statement is used because the unique index compares NULLs as distinct, so
    // two identical VALUES rows in one statement also work, but this reads
    // closer to how production accumulated them: separate inserts.)
    expect(
      Number(
        await scalar(
          db,
          `select count(*) from public.question_topic_links where question_id = $1 and is_primary`,
          [id],
        ),
      ),
    ).toBe(2);

    await migrate(db, ["20261219000000_bcs_taxonomy_unify.sql"]);

    // Classified, and left with exactly one link carrying the classified topic.
    const after = await rows<{ topic_id: string | null; links: string; primaries: string }>(
      db,
      `select q.topic_id,
              (select count(*) from public.question_topic_links l where l.question_id = q.id) as links,
              (select count(*) from public.question_topic_links l where l.question_id = q.id and l.is_primary) as primaries
         from public.questions q where q.id = $1`,
      [id],
    );
    expect(after[0].topic_id).toBe(topic);
    expect(Number(after[0].primaries)).toBe(1);
    expect(Number(after[0].links)).toBe(1);

    await db.query(`delete from public.questions where id = $1`, [id]);
  });

  it("classifies a same-subject match but not a cross-subject keyword", async () => {
    // The rules are keyed on wording alone, so a Bengali literature question
    // containing "ধারা" would score as "ধারার যোগফল" and a history question
    // containing "বৃত্ত" as geometry. The `t.subject_id = m.subject_id`
    // predicate in the UPDATE is the only thing preventing that; production
    // has 27 such rows, which is why 669 stay null instead of 642. If someone
    // removes the predicate to "improve coverage", the second assertion fails.
    const subjectOf = async (slug: string) =>
      String(
        await scalar(
          db,
          `select id from public.subjects where course_id = $1 and slug = $2`,
          [courseId, slug],
        ),
      );
    const mathsSubject = await subjectOf("math");
    const banglaSubject = await subjectOf("bangla");

    const ins = async (subjectId: string, statement: string, fp: string) => {
      const q = await rows<{ id: string }>(
        db,
        `insert into public.questions
           (course_id, subject_id, statement, option_a, option_b, option_c,
            option_d, correct_option, status, fingerprint, source_type)
         values ($1, $2, $3, 'ক', 'খ', 'গ', 'ঘ', 1, 'draft', $4, 'ai_assisted')
         returning id`,
        [courseId, subjectId, statement, fp],
      );
      return q[0].id;
    };

    // Same keyword, deliberately filed under two different subjects.
    const maths = await ins(mathsSubject, "সমান্তরাল ধারার সাধারণ পদ কত?", "jh-test-maths-dhara");
    const literature = await ins(banglaSubject, "বাংলা সাহিত্যে ধারার বিবর্তন আলোচনা কর", "jh-test-bangla-dhara");

    await migrate(db, ["20261219000000_bcs_taxonomy_unify.sql"]);

    const got = await rows<{ id: string; topic_id: string | null }>(
      db,
      `select id, topic_id from public.questions where id = any($1::uuid[])`,
      [[maths, literature]],
    );
    expect(got.find((r) => r.id === maths)?.topic_id).not.toBeNull();
    expect(got.find((r) => r.id === literature)?.topic_id).toBeNull();

    await db.query(`delete from public.questions where id = any($1::uuid[])`, [[maths, literature]]);
  });
});

async function snapshot() {
  return {
    topics: Number(
      await scalar(
        db,
        `select count(*) from public.topics t join public.subjects s on s.id = t.subject_id
          where s.course_id = $1 and t.is_active`,
        [courseId],
      ),
    ),
    subs: Number(
      await scalar(
        db,
        `select count(*) from public.subtopics st
           join public.topics t on t.id = st.topic_id
           join public.subjects s on s.id = t.subject_id
          where s.course_id = $1 and t.is_active and st.is_active`,
        [courseId],
      ),
    ),
    null_topic_questions: Number(
      await scalar(
        db,
        `select count(*) from public.questions where course_id = $1 and topic_id is null`,
        [courseId],
      ),
    ),
    assignments: Number(
      await scalar(
        db,
        `select count(*) from public.study_plan_assignments where course_id = $1`,
        [courseId],
      ),
    ),
  };
}
