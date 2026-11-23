import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import {
  actAs, actAsService, createDatabase, createPrivilegedUser, expectError, migrate, rows, scalar, uuid,
} from "./harness";

/**
 * Strict 70:30 (PYQ : practice) engine — master-prompt core rules, DB side:
 *  - jh_pyq_availability counts only FULL-metadata PYQs as "ready"
 *    (exam_name + year + question_type + source reference);
 *  - jh_build_paper_7030 blocks with the REAL counts when even one PYQ is
 *    missing (the spec's "69 PYQ" test), and practice questions NEVER fill
 *    the gap — metadata-less PYQs don't either;
 *  - at exactly 70 ready PYQs the paper builds with exactly 70 + 30 and no
 *    duplicates;
 *  - the revision queue seeds 0/1/3/7/15-day items from real attempt data,
 *    owner-only;
 *  - config CHECK forces pyq + practice = total in strict mode;
 *  - mock_pattern_config is empty by design and locked away from students.
 */

let db: PGlite;
const ADMIN = uuid(960);
const STUDENT = uuid(961);
const OTHER = uuid(962);

let courseId: string;
let mainSubjectId: string;
let secondarySubjectId: string;
let mainTopicId: string;
let secondaryTopicId: string;

let seedTag = 0;

async function seedQuestion(options: {
  subjectId: string;
  topicId: string;
  pyq: boolean;
  fullMeta?: boolean;
}) {
  seedTag += 1;
  const fullMeta = options.fullMeta ?? true;
  await db.query(
    `insert into public.questions
      (course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
       correct_option, explanation, difficulty, source_type, status, is_verified,
       verified_by, verified_at, fingerprint, exam_name, year, question_type, source_url, source)
     values ($1,$2,$3,$4,'ক','খ','গ','ঘ',$5,'ব্যাখ্যা','medium',$6,'approved',true,$7,now(),$8,$9,$10,$11,$12,$13)`,
    [
      courseId, options.subjectId, options.topicId,
      `৭০:৩০ ফিক্সচার ${seedTag} — নমুনা প্রশ্ন।`,
      seedTag % 4,
      options.pyq ? "previous" : "manual",
      ADMIN,
      `strict-7030-${seedTag}`,
      options.pyq && fullMeta ? "৪৫তম বিসিএস প্রিলিমিনারি" : null,
      options.pyq && fullMeta ? 2023 : null,
      "mcq",
      options.pyq && fullMeta ? "https://bpsc.example.org/45th-prelim.pdf" : null,
      options.pyq && fullMeta ? "BPSC ৪৫তম প্রিলি প্রশ্নপত্র" : "ফিক্সচার উৎস",
    ],
  );
}

async function seedMany(count: number, options: Parameters<typeof seedQuestion>[0]) {
  for (let index = 0; index < count; index += 1) await seedQuestion(options);
}

function sections() {
  return JSON.stringify([
    { subject_id: mainSubjectId, count: 90, topic_ids: [mainTopicId] },
    { subject_id: secondarySubjectId, count: 10, topic_ids: [secondaryTopicId] },
  ]);
}

async function buildPaper(): Promise<string> {
  return scalar<string>(
    db,
    `select public.jh_build_paper_7030(
       $1, $2::jsonb, 70, 30,
       'Daily 70:30', 'দৈনিক ৭০:৩০', 60, 100, 0.5, $3, 'scheduled', null)`,
    [courseId, sections(), ADMIN],
  );
}

beforeAll(async () => {
  db = await createDatabase();
  await migrate(db);
  await createPrivilegedUser(db, { id: ADMIN, email: "s7030-admin@jobhub.test", role: "super_admin", full_name: "Admin" });
  await createPrivilegedUser(db, { id: STUDENT, email: "s7030-student@jobhub.test", role: "student", full_name: "Student" });
  await createPrivilegedUser(db, { id: OTHER, email: "s7030-other@jobhub.test", role: "student", full_name: "Other" });

  await actAsService(db);
  courseId = await scalar<string>(db, `select id from public.courses where slug = 'bcs'`);
  const subjects = await rows<{ id: string }>(
    db, `select id from public.subjects where course_id = $1 order by sort_order limit 2`, [courseId],
  );
  mainSubjectId = subjects[0].id;
  secondarySubjectId = subjects[1].id;
  mainTopicId = await scalar<string>(
    db, `select id from public.topics where subject_id = $1 order by sort_order limit 1`, [mainSubjectId],
  );
  secondaryTopicId = await scalar<string>(
    db, `select id from public.topics where subject_id = $1 order by sort_order limit 1`, [secondarySubjectId],
  );

  // Deterministic fixtures: nothing pre-seeded stays approved.
  await db.query(
    `update public.questions set status = 'pending_review', is_verified = false where course_id = $1`,
    [courseId],
  );

  // Main section needs 63 PYQs — give it 62 ready + 5 metadata-less PYQs +
  // ample practice. Secondary needs 7 — give it exactly 7 + practice.
  await seedMany(62, { subjectId: mainSubjectId, topicId: mainTopicId, pyq: true });
  await seedMany(5, { subjectId: mainSubjectId, topicId: mainTopicId, pyq: true, fullMeta: false });
  await seedMany(40, { subjectId: mainSubjectId, topicId: mainTopicId, pyq: false });
  await seedMany(7, { subjectId: secondarySubjectId, topicId: secondaryTopicId, pyq: true });
  await seedMany(10, { subjectId: secondarySubjectId, topicId: secondaryTopicId, pyq: false });
});

describe("jh_pyq_availability", () => {
  it("counts ready vs metadata-missing PYQs and the practice pool honestly", async () => {
    await actAsService(db);
    const [availability] = await rows<{
      pyq_total: string; pyq_ready: string; pyq_missing_meta: string; practice_pool: string;
    }>(
      db,
      `select * from public.jh_pyq_availability($1, $2, array[$3]::uuid[])`,
      [courseId, mainSubjectId, mainTopicId],
    );
    expect(Number(availability.pyq_total)).toBe(67);
    expect(Number(availability.pyq_ready)).toBe(62);
    expect(Number(availability.pyq_missing_meta)).toBe(5);
    expect(Number(availability.practice_pool)).toBe(40);
  });
});

describe("jh_build_paper_7030 — the 69-PYQ block", () => {
  it("blocks the build with real counts when only 69 of 70 PYQs exist (62+7)", async () => {
    await actAsService(db);
    const message = await expectError(buildPaper());
    // The real numbers, named: 62 ready for a 63 quota. Practice and
    // metadata-less PYQs are plentiful but must NOT be substituted.
    expect(message).toMatch(/PYQ ঘাটতি/);
    expect(message).toMatch(/62/);
    expect(message).toMatch(/63/);
    const papers = await scalar<number>(
      db, `select count(*)::int from public.exam_papers where course_id = $1 and composition ->> 'mode' = '70_30_strict'`,
      [courseId],
    );
    expect(Number(papers)).toBe(0);
  });

  it("builds exactly 70 PYQ + 30 practice with no duplicates once the 70th ready PYQ exists", async () => {
    await actAsService(db);
    await seedQuestion({ subjectId: mainSubjectId, topicId: mainTopicId, pyq: true }); // 63rd ready
    const paperId = await buildPaper();

    const [composition] = await rows<{ mode: string; pyq_total: string; practice_total: string }>(
      db,
      `select composition ->> 'mode' as mode,
              composition ->> 'pyq_total' as pyq_total,
              composition ->> 'practice_total' as practice_total
       from public.exam_papers where id = $1`,
      [paperId],
    );
    expect(composition.mode).toBe("70_30_strict");
    expect(Number(composition.pyq_total)).toBe(70);
    expect(Number(composition.practice_total)).toBe(30);

    const [counts] = await rows<{ total: string; distinct_q: string; pyq: string; practice: string; bad_meta: string }>(
      db,
      `select count(*) as total,
              count(distinct eq.question_id) as distinct_q,
              count(*) filter (where q.source_type = 'previous') as pyq,
              count(*) filter (where q.source_type is distinct from 'previous') as practice,
              count(*) filter (where q.source_type = 'previous'
                                 and (q.exam_name is null or q.year is null)) as bad_meta
       from public.exam_questions eq
       join public.questions q on q.id = eq.question_id
       where eq.paper_id = $1`,
      [paperId],
    );
    expect(Number(counts.total)).toBe(100);
    expect(Number(counts.distinct_q)).toBe(100); // no duplicates
    expect(Number(counts.pyq)).toBe(70);          // exact ratio, never faked
    expect(Number(counts.practice)).toBe(30);
    expect(Number(counts.bad_meta)).toBe(0);      // metadata-less PYQs never selected
  });

  it("rejects a section/ratio mismatch loudly", async () => {
    await actAsService(db);
    const message = await expectError(
      db.query(
        `select public.jh_build_paper_7030($1, $2::jsonb, 70, 29, 'x', 'x', 60, 99, 0.5, $3)`,
        [courseId, sections(), ADMIN],
      ),
    );
    expect(message).toMatch(/must equal/i);
  });
});

describe("daily_exam_config strict CHECK", () => {
  it("forces pyq + practice = question_count in strict mode", async () => {
    await actAsService(db);
    const message = await expectError(
      db.query(
        `update public.daily_exam_config
         set strict_pyq_validation = true, pyq_count = 70, practice_count = 29, question_count = 100
         where course_id = $1`,
        [courseId],
      ),
    );
    expect(message).toMatch(/daily_exam_config_strict_sum|check/i);
  });

  it("BCS ships strict 70:30 at 100 questions (user decision)", async () => {
    await actAsService(db);
    const [config] = await rows<{ question_count: number; pyq_count: number; practice_count: number; strict: boolean }>(
      db,
      `select question_count, pyq_count, practice_count, strict_pyq_validation as strict
       from public.daily_exam_config where course_id = $1`,
      [courseId],
    );
    expect(config.question_count).toBe(100);
    expect(config.pyq_count).toBe(70);
    expect(config.practice_count).toBe(30);
    expect(config.strict).toBe(true);
  });
});

describe("revision queue", () => {
  let attemptId: string;
  let wrongQuestionId: string;
  let unansweredQuestionId: string;

  beforeAll(async () => {
    await actAsService(db);
    // A tiny paper: 3 questions — one answered wrong, one unanswered, one right.
    const questionIds = await rows<{ id: string; correct_option: number }>(
      db,
      `select id, correct_option from public.questions
       where course_id = $1 and subject_id = $2 and status = 'approved' order by fingerprint limit 3`,
      [courseId, mainSubjectId],
    );
    const paperId = await scalar<string>(
      db,
      `insert into public.exam_papers (course_id, paper_type, title_bn, question_count, duration_minutes, total_marks)
       values ($1, 'practice', 'রিভিশন ফিক্সচার', 3, 10, 3) returning id`,
      [courseId],
    );
    for (let index = 0; index < 3; index += 1) {
      await db.query(
        `insert into public.exam_questions (paper_id, question_id, position, marks) values ($1,$2,$3,1)`,
        [paperId, questionIds[index].id, index + 1],
      );
    }
    attemptId = await scalar<string>(
      db,
      `insert into public.exam_attempts
         (user_id, paper_id, course_id, mode, status, deadline_at, submitted_at, total_questions, total_marks)
       values ($1, $2, $3, 'custom', 'submitted', now() + interval '1 hour', now(), 3, 3) returning id`,
      [STUDENT, paperId, courseId],
    );
    wrongQuestionId = questionIds[0].id;
    unansweredQuestionId = questionIds[1].id;
    await db.query(
      `insert into public.student_answers (attempt_id, question_id, selected_option)
       values ($1, $2, $3), ($1, $4, $5)`,
      [
        attemptId,
        wrongQuestionId, (questionIds[0].correct_option + 1) % 4, // wrong
        questionIds[2].id, questionIds[2].correct_option,          // right
      ],
    );
  });

  it("seeds 0/1/3/7/15-day items from incorrect + unattempted answers only", async () => {
    await actAs(db, STUDENT);
    const inserted = await scalar<number>(
      db, `select public.jh_seed_revision_from_attempt($1)`, [attemptId],
    );
    expect(Number(inserted)).toBe(10); // 2 questions × 5 intervals

    await actAsService(db);
    const items = await rows<{ question_id: string; reason: string; interval_step: number; offset_days: number }>(
      db,
      `select question_id, reason, interval_step, (due_date - current_date) as offset_days
       from public.revision_items where user_id = $1 order by question_id, interval_step`,
      [STUDENT],
    );
    expect(items).toHaveLength(10);
    const offsets = [...new Set(items.map((item) => Number(item.offset_days)))].sort((a, b) => a - b);
    expect(offsets).toEqual([0, 1, 3, 7, 15]);
    expect(items.some((item) => item.question_id === wrongQuestionId && item.reason === "incorrect")).toBe(true);
    expect(items.some((item) => item.question_id === unansweredQuestionId && item.reason === "unattempted")).toBe(true);
    // The correctly-answered question is NOT declared a weakness.
    expect(items.filter((item) => item.reason === "incorrect")).toHaveLength(5);
  });

  it("is idempotent and owner-only", async () => {
    await actAs(db, STUDENT);
    const again = await scalar<number>(db, `select public.jh_seed_revision_from_attempt($1)`, [attemptId]);
    expect(Number(again)).toBe(0); // no duplicates on re-run

    await actAs(db, OTHER);
    const message = await expectError(
      db.query(`select public.jh_seed_revision_from_attempt($1)`, [attemptId]),
    );
    expect(message).toMatch(/not your attempt/i);
  });

  it("students see and update only their own queue", async () => {
    await actAs(db, OTHER);
    const foreign = await rows(db, `select id from public.revision_items`);
    expect(foreign).toHaveLength(0);

    await actAs(db, STUDENT);
    const mine = await rows<{ id: string }>(db, `select id from public.revision_items limit 1`);
    await db.query(`update public.revision_items set status = 'done', updated_at = now() where id = $1`, [mine[0].id]);
    const status = await scalar<string>(db, `select status from public.revision_items where id = $1`, [mine[0].id]);
    expect(status).toBe("done");
  });
});

describe("mock_pattern_config", () => {
  it("ships EMPTY (the official pattern is never guessed) and hides from students", async () => {
    await actAsService(db);
    const count = await scalar<number>(db, `select count(*)::int from public.mock_pattern_config`);
    expect(Number(count)).toBe(0);

    await actAs(db, STUDENT);
    const message = await expectError(db.query(`select * from public.mock_pattern_config`));
    expect(message).toMatch(/permission denied/i);
  });

  it("requires a non-empty source URL and version", async () => {
    await actAsService(db);
    const message = await expectError(
      db.query(
        `insert into public.mock_pattern_config (course_id, pattern, source_url, source_version)
         values ($1, '[]'::jsonb, '', 'v1')`,
        [courseId],
      ),
    );
    expect(message).toMatch(/check/i);
  });
});

describe("jh_question_usage", () => {
  it("is admin-only (pre-start papers must not leak) but serves admins", async () => {
    await actAs(db, STUDENT);
    const message = await expectError(db.query(`select * from public.jh_question_usage($1)`, [courseId]));
    expect(message).toMatch(/exam.publish permission required/i);

    await actAs(db, ADMIN);
    const usage = await rows<{ question_id: string; use_count: string }>(
      db, `select * from public.jh_question_usage($1)`, [courseId],
    );
    // The built 70:30 paper + the revision fixture paper both recorded usage.
    expect(usage.length).toBeGreaterThanOrEqual(100);
  });
});

describe("topic backfill", () => {
  it("left no approved question topicless where a same-subject primary link exists", async () => {
    await actAsService(db);
    const count = await scalar<number>(
      db,
      `select count(*)::int
       from public.questions q
       join public.question_topic_links l on l.question_id = q.id and coalesce(l.is_primary, true)
       join public.topics t on t.id = l.topic_id and t.subject_id = q.subject_id
       where q.topic_id is null and q.status = 'approved'`,
    );
    expect(Number(count)).toBe(0);
  });
});
