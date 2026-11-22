import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import {
  actAs, actAsService, createDatabase, createPrivilegedUser, expectError, migrate, rows, scalar, uuid,
} from "./harness";

/**
 * Daily 90:10 exam system, database side:
 *  - rotation tables locked down (anon/authenticated blocked, service allowed);
 *  - slot CHECK rejects a same-subject pair;
 *  - jh_build_paper_sectioned keeps EXACT per-section counts (the property
 *    jh_build_paper_with_mix cannot guarantee), respects topic restrictions,
 *    never duplicates a question, and fails loudly naming the short section.
 */

let db: PGlite;
const ADMIN = uuid(950);

let courseId: string;
let mainSubjectId: string;
let secondarySubjectId: string;
let mainTopicId: string;
let otherMainTopicId: string | null = null;
let secondaryTopicId: string;

async function seedQuestions(subjectId: string, topicId: string, count: number, tag: string) {
  for (let index = 0; index < count; index += 1) {
    await db.query(
      `insert into public.questions
        (course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
         correct_option, explanation, difficulty, source, source_type, status, is_verified,
         verified_by, verified_at, fingerprint)
       values ($1,$2,$3,$4,'ক','খ','গ','ঘ',$5,'ব্যাখ্যা',$6,'fixture','manual','approved',true,$7,now(),$8)`,
      [
        courseId, subjectId, topicId,
        `দৈনিক পরীক্ষা ফিক্সচার ${tag} ${index} — নমুনা প্রশ্ন।`,
        index % 4,
        index % 3 === 0 ? "easy" : index % 3 === 1 ? "medium" : "hard",
        ADMIN,
        `daily-fixture-${tag}-${index}`,
      ],
    );
  }
}

beforeAll(async () => {
  db = await createDatabase();
  await migrate(db);
  await createPrivilegedUser(db, { id: ADMIN, email: "daily-admin@jobhub.test", role: "super_admin", full_name: "Admin" });

  await actAsService(db);
  courseId = await scalar<string>(db, `select id from public.courses where slug = 'bcs'`);
  const subjects = await rows<{ id: string }>(
    db,
    `select id from public.subjects where course_id = $1 order by sort_order limit 2`,
    [courseId],
  );
  mainSubjectId = subjects[0].id;
  secondarySubjectId = subjects[1].id;
  mainTopicId = await scalar<string>(
    db, `select id from public.topics where subject_id = $1 order by sort_order limit 1`, [mainSubjectId],
  );
  const otherTopics = await rows<{ id: string }>(
    db, `select id from public.topics where subject_id = $1 order by sort_order offset 1 limit 1`, [mainSubjectId],
  );
  otherMainTopicId = otherTopics[0]?.id ?? null;
  secondaryTopicId = await scalar<string>(
    db, `select id from public.topics where subject_id = $1 order by sort_order limit 1`, [secondarySubjectId],
  );

  // Keep fixtures deterministic: only our seeded questions are approved.
  await db.query(`update public.questions set status = 'pending_review', is_verified = false where course_id = $1`, [courseId]);
  await seedQuestions(mainSubjectId, mainTopicId, 20, "main-a");
  if (otherMainTopicId) await seedQuestions(mainSubjectId, otherMainTopicId, 10, "main-b");
  await seedQuestions(secondarySubjectId, secondaryTopicId, 8, "sec");
});

describe("rotation tables", () => {
  it("are invisible to anon and authenticated (privilege lockdown)", async () => {
    await actAs(db, ADMIN); // authenticated role
    for (const table of ["daily_exam_config", "daily_rotation_slots", "daily_rotation_overrides"]) {
      const message = await expectError(db.query(`select * from public.${table}`));
      expect(message).toMatch(/permission denied/i);
    }
  });

  it("service role can configure a course and the slot CHECK rejects a same-subject pair", async () => {
    await actAsService(db);
    await db.query(
      `insert into public.daily_exam_config (course_id, anchor_date) values ($1, date '2026-11-23')
       on conflict (course_id) do nothing`,
      [courseId],
    );
    await db.query(
      `insert into public.daily_rotation_slots (course_id, position, main_subject_id, secondary_subject_id)
       values ($1, 101, $2, $3)`,
      [courseId, mainSubjectId, secondarySubjectId],
    );
    const message = await expectError(
      db.query(
        `insert into public.daily_rotation_slots (course_id, position, main_subject_id, secondary_subject_id)
         values ($1, 102, $2, $2)`,
        [courseId, mainSubjectId],
      ),
    );
    expect(message).toMatch(/check|violat/i);
  });

  it("override primary key enforces one override per course per date", async () => {
    await actAsService(db);
    await db.query(
      `insert into public.daily_rotation_overrides (course_id, exam_date, main_subject_id, secondary_subject_id)
       values ($1, date '2026-12-01', $2, $3)`,
      [courseId, mainSubjectId, secondarySubjectId],
    );
    const message = await expectError(
      db.query(
        `insert into public.daily_rotation_overrides (course_id, exam_date, main_subject_id, secondary_subject_id)
         values ($1, date '2026-12-01', $3, $2)`,
        [courseId, mainSubjectId, secondarySubjectId],
      ),
    );
    expect(message).toMatch(/duplicate key/i);
  });
});

describe("jh_build_paper_sectioned", () => {
  it("keeps EXACT per-section counts — the 90:10 guarantee", async () => {
    await actAs(db, ADMIN);
    const paperId = await scalar<string>(
      db,
      `select public.jh_build_paper_sectioned(
         $1,
         jsonb_build_array(
           jsonb_build_object('subject_id', $2::uuid, 'count', 18),
           jsonb_build_object('subject_id', $3::uuid, 'count', 2)
         ),
         'Daily 90:10', 'দৈনিক ৯০:১০', 60, 20, 0.5, $4,
         '{"previous":0,"easy":30,"medium":50,"hard":20}'::jsonb, 'scheduled', null
       )`,
      [courseId, mainSubjectId, secondarySubjectId, ADMIN],
    );

    await actAsService(db);
    const stats = await rows<{ subject_id: string; n: number }>(
      db,
      `select q.subject_id, count(*)::int as n
       from public.exam_questions eq join public.questions q on q.id = eq.question_id
       where eq.paper_id = $1 group by q.subject_id`,
      [paperId],
    );
    const bySubject = Object.fromEntries(stats.map((row) => [row.subject_id, row.n]));
    expect(bySubject[mainSubjectId]).toBe(18);
    expect(bySubject[secondarySubjectId]).toBe(2);

    const distinct = await scalar<number>(
      db,
      `select count(distinct question_id)::int from public.exam_questions where paper_id = $1`,
      [paperId],
    );
    expect(distinct).toBe(20);

    // Main section occupies the leading positions.
    const lastMain = await scalar<number>(
      db,
      `select max(eq.position)::int from public.exam_questions eq
       join public.questions q on q.id = eq.question_id
       where eq.paper_id = $1 and q.subject_id = $2`,
      [paperId, mainSubjectId],
    );
    expect(lastMain).toBe(18);
  });

  it("honours a topic restriction inside a section", async () => {
    await actAs(db, ADMIN);
    const paperId = await scalar<string>(
      db,
      `select public.jh_build_paper_sectioned(
         $1,
         jsonb_build_array(
           jsonb_build_object('subject_id', $2::uuid, 'count', 10, 'topic_ids', jsonb_build_array($3::uuid))
         ),
         'Topic scoped', 'টপিক সীমিত', 30, 10, 0.5, $4
       )`,
      [courseId, mainSubjectId, mainTopicId, ADMIN],
    );
    await actAsService(db);
    const offTopic = await scalar<number>(
      db,
      `select count(*)::int from public.exam_questions eq
       join public.questions q on q.id = eq.question_id
       where eq.paper_id = $1 and q.topic_id is distinct from $2`,
      [paperId, mainTopicId],
    );
    expect(offTopic).toBe(0);
  });

  it("only approved+verified questions ever enter the paper", async () => {
    await actAs(db, ADMIN);
    const paperId = await scalar<string>(
      db,
      `select public.jh_build_paper_sectioned(
         $1, jsonb_build_array(jsonb_build_object('subject_id', $2::uuid, 'count', 5)),
         'Clean', 'ক্লিন', 30, 5, 0.5, $3
       )`,
      [courseId, secondarySubjectId, ADMIN],
    );
    await actAsService(db);
    const dirty = await scalar<number>(
      db,
      `select count(*)::int from public.exam_questions eq
       join public.questions q on q.id = eq.question_id
       where eq.paper_id = $1 and (q.status <> 'approved' or not q.is_verified)`,
      [paperId],
    );
    expect(dirty).toBe(0);
  });

  it("fails loudly, naming the short section, instead of rebalancing", async () => {
    await actAs(db, ADMIN);
    const message = await expectError(
      db.query(
        `select public.jh_build_paper_sectioned(
           $1, jsonb_build_array(jsonb_build_object('subject_id', $2::uuid, 'count', 500)),
           'Too big', 'অসম্ভব', 60, 500, 0.5, $3
         )`,
        [courseId, secondarySubjectId, ADMIN],
      ),
    );
    expect(message).toMatch(/has only \d+ verified questions, 500 required/i);
  });

  it("rejects a difficulty mix that does not total 100", async () => {
    await actAs(db, ADMIN);
    const message = await expectError(
      db.query(
        `select public.jh_build_paper_sectioned(
           $1, jsonb_build_array(jsonb_build_object('subject_id', $2::uuid, 'count', 2)),
           'Bad mix', 'ভুল মিক্স', 30, 2, 0.5, $3, '{"previous":10,"easy":30,"medium":50,"hard":20}'::jsonb
         )`,
        [courseId, secondarySubjectId, ADMIN],
      ),
    );
    expect(message).toMatch(/mix must total 100/i);
  });
});
