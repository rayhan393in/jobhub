import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import {
  actAs, actAsService, createDatabase, createPrivilegedUser, expectError, migrate, rows, scalar, uuid,
} from "./harness";

/**
 * End-to-end exercise of the database-side exam engine, with the same
 * security-definer functions the API routes call:
 *   publish schedule -> start attempt -> save answers -> submit -> review
 *   -> leaderboard, plus RLS isolation and duplicate-submission protection.
 */

let db: PGlite;
const ADMIN = uuid(900);
const STUDENT_A = uuid(901);
const STUDENT_B = uuid(902);
const TEACHER = uuid(903);

let courseId: string;
let subjectId: string;
let topicId: string;

const QUESTION_COUNT = 6;

beforeAll(async () => {
  db = await createDatabase();
  await migrate(db);

  await createPrivilegedUser(db, { id: ADMIN, email: "admin@jobhub.test", role: "super_admin", full_name: "Admin" });
  await createPrivilegedUser(db, { id: TEACHER, email: "editor@jobhub.test", role: "content_editor", full_name: "Editor" });
  await createPrivilegedUser(db, { id: STUDENT_A, email: "a@jobhub.test", role: "student", full_name: "Student A" });
  await createPrivilegedUser(db, { id: STUDENT_B, email: "b@jobhub.test", role: "student", full_name: "Student B" });

  await actAsService(db);
  courseId = await scalar<string>(db, `select id from public.courses where slug = 'bcs'`);
  subjectId = await scalar<string>(
    db,
    `select id from public.subjects where course_id = $1 order by sort_order limit 1`,
    [courseId],
  );
  topicId = await scalar<string>(db, `select id from public.topics where subject_id = $1 order by sort_order limit 1`, [
    subjectId,
  ]);

  // Approve the seeded questions so an exam can be built, then add extra
  // verified questions from a "different" origin to exercise availability.
  await db.query(
    `update public.questions set status = 'approved', is_verified = true, verified_by = $1, verified_at = now()
     where course_id = $2`,
    [ADMIN, courseId],
  );
  const existing = await scalar<number>(
    db,
    `select count(*)::int from public.questions where course_id = $1 and status = 'approved' and is_verified`,
    [courseId],
  );
  for (let index = existing; index < QUESTION_COUNT + 10; index += 1) {
    await db.query(
      `insert into public.questions
        (course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
         correct_option, explanation, difficulty, source, source_type, status, is_verified, verified_by, verified_at, fingerprint)
       values ($1,$2,$3,$4,'ক','খ','গ','ঘ',$5,'ব্যাখ্যা','medium','fixture','manual','approved',true,$6, now(), $7)`,
      [
        courseId,
        subjectId,
        topicId,
        `পরীক্ষা ফ্লো প্রশ্ন নম্বর ${index} — সাধারণ জ্ঞান যাচাই।`,
        index % 4,
        ADMIN,
        `fixture-fingerprint-${index}`,
      ],
    );
  }
});

async function createSchedule(offsetMinutes: number, questionCount = QUESTION_COUNT): Promise<string> {
  await actAs(db, ADMIN);
  const row = await db.query<{ id: string }>(
    `insert into public.exam_schedules
      (course_id, kind, title_en, title_bn, starts_at, ends_at, result_release_at,
       duration_minutes, question_count, total_marks, positive_marks, negative_marks, status, created_by)
     values ($1,'daily_live','Flow exam','ফ্লো পরীক্ষা',
             now() + make_interval(mins => $2::int),
             now() + make_interval(mins => ($2::int + 180)),
             now() + make_interval(mins => ($2::int + 190)),
             30, $3::int, $3::numeric, 1, 0.5, 'draft', $4)
     returning id`,
    [courseId, offsetMinutes, questionCount, ADMIN],
  );
  return row.rows[0].id;
}

describe("publishing", () => {
  it("refuses to publish a schedule with a past start time", async () => {
    const scheduleId = await createSchedule(-240);
    await actAs(db, ADMIN);
    const message = await expectError(db.query(`select public.jh_publish_schedule($1)`, [scheduleId]));
    expect(message).toMatch(/Start time must be in the future/i);
  });

  it("refuses to publish without exam.publish permission", async () => {
    const scheduleId = await createSchedule(60);
    await actAs(db, TEACHER);
    const message = await expectError(db.query(`select public.jh_publish_schedule($1)`, [scheduleId]));
    expect(message).toMatch(/permission/i);
  });

  it("refuses to publish when verified questions are insufficient", async () => {
    const scheduleId = await createSchedule(60, 200);
    await actAs(db, ADMIN);
    const message = await expectError(db.query(`select public.jh_publish_schedule($1)`, [scheduleId]));
    expect(message).toMatch(/Insufficient verified questions|verified questions available/i);
    // Nothing leaked into the live feed.
    await actAsService(db);
    const status = await scalar<string>(db, `select status from public.exam_schedules where id = $1`, [scheduleId]);
    expect(status).toBe("draft");
  });

  it("publishes, freezes a paper and marks the schedule published", async () => {
    const scheduleId = await createSchedule(60);
    await actAs(db, ADMIN);
    const result = await db.query<{ jh_publish_schedule: { published: boolean } }>(
      `select public.jh_publish_schedule($1)`,
      [scheduleId],
    );
    expect(result.rows[0].jh_publish_schedule.published).toBe(true);

    await actAsService(db);
    expect(await scalar<string>(db, `select status from public.exam_schedules where id = $1`, [scheduleId])).toBe(
      "published",
    );
    const paper = await scalar<number>(
      db,
      `select count(*)::int from public.exam_questions q join public.exam_papers p on p.id = q.paper_id where p.schedule_id = $1`,
      [scheduleId],
    );
    expect(paper).toBe(QUESTION_COUNT);
    // Publishing is idempotent and audited.
    const audited = await scalar<number>(
      db,
      `select count(*)::int from public.audit_logs where action = 'exam.publish' and entity_id = $1`,
      [scheduleId],
    );
    expect(audited).toBeGreaterThanOrEqual(1);
    await actAs(db, ADMIN);
    const again = await db.query<{ jh_publish_schedule: { already_published: boolean } }>(
      `select public.jh_publish_schedule($1)`,
      [scheduleId],
    );
    expect(again.rows[0].jh_publish_schedule.already_published).toBe(true);
  });
});

describe("attempt lifecycle", () => {
  let scheduleId: string;
  let attemptId: string;
  let questionIds: string[];

  beforeAll(async () => {
    // Publish a future exam, then pull the window open to "live" the same way a
    // scheduler would once the clock reaches the start time.
    scheduleId = await createSchedule(30, 4);
    await actAs(db, ADMIN);
    await db.query(`select public.jh_publish_schedule($1)`, [scheduleId]);
    await actAsService(db);
    await db.query(
      `update public.exam_schedules
         set starts_at = now() - interval '5 minutes',
             ends_at = now() + interval '175 minutes',
             result_release_at = now() + interval '185 minutes'
       where id = $1`,
      [scheduleId],
    );
  });

  it("starts an attempt with a server-authoritative deadline", async () => {
    await actAs(db, STUDENT_A);
    const started = await db.query<{ jh_start_scheduled_attempt: { attempt_id: string; deadline_at: string } }>(
      `select public.jh_start_scheduled_attempt($1)`,
      [scheduleId],
    );
    attemptId = started.rows[0].jh_start_scheduled_attempt.attempt_id;
    expect(attemptId).toBeTruthy();

    const deadline = await scalar<string>(db, `select deadline_at from public.exam_attempts where id = $1`, [attemptId]);
    expect(new Date(deadline).getTime()).toBeGreaterThan(Date.now());
  });

  it("resumes the same attempt instead of creating a duplicate", async () => {
    await actAs(db, STUDENT_A);
    const resumed = await db.query<{ jh_start_scheduled_attempt: { attempt_id: string; resumed: boolean } }>(
      `select public.jh_start_scheduled_attempt($1)`,
      [scheduleId],
    );
    expect(resumed.rows[0].jh_start_scheduled_attempt.attempt_id).toBe(attemptId);
    expect(resumed.rows[0].jh_start_scheduled_attempt.resumed).toBe(true);
  });

  it("never exposes the answer key in the paper", async () => {
    await actAs(db, STUDENT_A);
    const paper = await scalar<Record<string, unknown>>(db, `select public.jh_get_attempt_paper($1) as paper`, [attemptId]);
    const questions = (paper as { questions: Record<string, unknown>[] }).questions;
    expect(questions.length).toBeGreaterThan(0);
    for (const question of questions) {
      expect(question).not.toHaveProperty("correct_option");
      expect(question).not.toHaveProperty("explanation");
      expect(question).not.toHaveProperty("is_correct");
    }
    questionIds = questions.map((question) => question.question_id as string);
  });

  it("persists answers and survives a reload", async () => {
    await actAs(db, STUDENT_A);
    await db.query(`select public.jh_save_answer($1,$2,$3,$4)`, [attemptId, questionIds[0], 1, false]);
    await db.query(`select public.jh_save_answer($1,$2,$3,$4)`, [attemptId, questionIds[1], null, true]);

    await actAsService(db);
    const saved = await rows<{ question_id: string; selected_option: number | null; marked_for_review: boolean }>(
      db,
      `select question_id, selected_option, marked_for_review from public.student_answers where attempt_id = $1 order by question_id`,
      [attemptId],
    );
    expect(saved).toHaveLength(2);
    expect(saved.some((row) => row.marked_for_review)).toBe(true);

    await actAs(db, STUDENT_A);
    const paper = await scalar<{ saved_answers: unknown[] }>(db, `select public.jh_get_attempt_paper($1) as paper`, [
      attemptId,
    ]);
    expect(paper.saved_answers).toHaveLength(2);
  });

  it("blocks a second student from reading someone else's attempt", async () => {
    await actAs(db, STUDENT_B);
    const message = await expectError(db.query(`select public.jh_get_attempt_paper($1)`, [attemptId]));
    expect(message).toMatch(/not found|not authorized|permission|denied/i);
  });

  it("scores server-side with +1 / -0.5 / 0 and releases nothing early", async () => {
    // Compute the expected score from the real key so the assertion is honest.
    await actAsService(db);
    const key = await rows<{ question_id: string; correct_option: number }>(
      db,
      `select q.question_id, qq.correct_option
       from public.exam_questions q join public.questions qq on qq.id = q.question_id
       join public.exam_papers p on p.id = q.paper_id
       where p.schedule_id = $1`,
      [scheduleId],
    );
    const correctOption = new Map(key.map((row) => [row.question_id, row.correct_option]));
    const firstWasRight = correctOption.get(questionIds[0]) === 1;
    const expected = firstWasRight ? 1 : -0.5;

    await actAs(db, STUDENT_A);
    const submitted = await db.query<{ jh_submit_attempt: { score: number; already_submitted: boolean } }>(
      `select public.jh_submit_attempt($1,'manual')`,
      [attemptId],
    );
    expect(submitted.rows[0].jh_submit_attempt.already_submitted).toBe(false);
    expect(Number(submitted.rows[0].jh_submit_attempt.score)).toBeCloseTo(expected, 2);

    await actAsService(db);
    const result = await rows<{ score: number; correct_count: number; wrong_count: number; unanswered_count: number; is_released: boolean }>(
      db,
      `select score, correct_count, wrong_count, unanswered_count, is_released from public.results where attempt_id = $1`,
      [attemptId],
    );
    expect(result).toHaveLength(1);
    expect(Number(result[0].score)).toBeCloseTo(expected, 2);
    expect(result[0].correct_count + result[0].wrong_count + result[0].unanswered_count).toBe(4);
    expect(result[0].is_released).toBe(false);
  });

  it("protects against duplicate submission", async () => {
    await actAs(db, STUDENT_A);
    const again = await db.query<{ jh_submit_attempt: { already_submitted: boolean } }>(
      `select public.jh_submit_attempt($1,'manual')`,
      [attemptId],
    );
    expect(again.rows[0].jh_submit_attempt.already_submitted).toBe(true);
    await actAsService(db);
    expect(await scalar<number>(db, `select count(*)::int from public.results where attempt_id = $1`, [attemptId])).toBe(1);
  });

  it("keeps the review embargoed until the release time", async () => {
    await actAs(db, STUDENT_A);
    const review = await scalar<{ released: boolean; items: unknown[] }>(
      db,
      `select public.jh_get_attempt_review($1) as review`,
      [attemptId],
    );
    expect(review.released).toBe(false);
    expect(review.items).toHaveLength(0);

    // Simulate the release instant passing.
    await actAsService(db);
    await db.query(
      `update public.exam_schedules set ends_at = now() - interval '30 minutes',
        result_release_at = now() - interval '20 minutes', starts_at = now() - interval '200 minutes'
       where id = $1`,
      [scheduleId],
    );
    await db.query(`update public.results set is_released = true where attempt_id = $1`, [attemptId]);

    await actAs(db, STUDENT_A);
    const released = await scalar<{ released: boolean; items: { correct_option: number }[] }>(
      db,
      `select public.jh_get_attempt_review($1) as review`,
      [attemptId],
    );
    expect(released.released).toBe(true);
    expect(released.items.length).toBe(4);
    expect(released.items[0]).toHaveProperty("correct_option");
  });

  it("rejects answers submitted after the deadline", async () => {
    // A fresh attempt whose deadline is forced into the past.
    const expiredSchedule = await createSchedule(30, 2);
    await actAs(db, ADMIN);
    await db.query(`select public.jh_publish_schedule($1)`, [expiredSchedule]);
    await actAsService(db);
    await db.query(
      `update public.exam_schedules
         set starts_at = now() - interval '5 minutes', ends_at = now() + interval '175 minutes',
             result_release_at = now() + interval '185 minutes'
       where id = $1`,
      [expiredSchedule],
    );
    await actAs(db, STUDENT_B);
    const started = await db.query<{ jh_start_scheduled_attempt: { attempt_id: string } }>(
      `select public.jh_start_scheduled_attempt($1)`,
      [expiredSchedule],
    );
    const expiredAttempt = started.rows[0].jh_start_scheduled_attempt.attempt_id;
    await actAsService(db);
    // Pull both timestamps back together: the table requires deadline > started.
    await db.query(
      `update public.exam_attempts
         set started_at = now() - interval '65 minutes',
             deadline_at = now() - interval '5 minutes'
       where id = $1`,
      [expiredAttempt],
    );

    await actAs(db, STUDENT_B);
    const questionId = await scalar<string>(
      db,
      `select q.question_id from public.exam_questions q join public.exam_papers p on p.id=q.paper_id
       where p.schedule_id = $1 limit 1`,
      [expiredSchedule],
    );
    const message = await expectError(db.query(`select public.jh_save_answer($1,$2,0,false)`, [expiredAttempt, questionId]));
    expect(message).toMatch(/time is up|deadline|expired|closed/i);
    // Nothing was written for the late answer.
    await actAsService(db);
    expect(
      await scalar<number>(db, `select count(*)::int from public.student_answers where attempt_id = $1`, [expiredAttempt]),
    ).toBe(0);
    // A timeout submission still closes the attempt cleanly and scores it.
    await actAs(db, STUDENT_B);
    const submitted = await db.query<{ jh_submit_attempt: { already_submitted: boolean } }>(
      `select public.jh_submit_attempt($1,'timeout')`,
      [expiredAttempt],
    );
    expect(submitted.rows[0].jh_submit_attempt.already_submitted).toBe(false);
    await actAsService(db);
    expect(await scalar<string>(db, `select status from public.exam_attempts where id = $1`, [expiredAttempt])).toBe(
      "submitted",
    );
  });
});

describe("RLS isolation", () => {
  it("hides other students' answers and results", async () => {
    await actAs(db, STUDENT_B);
    const visibleAnswers = await scalar<number>(db, `select count(*)::int from public.student_answers`);
    expect(visibleAnswers).toBe(0);
    const visibleResults = await scalar<number>(db, `select count(*)::int from public.results`);
    expect(visibleResults).toBe(0);
  });

  it("stops students from approving questions", async () => {
    await actAs(db, STUDENT_A);
    const message = await expectError(
      db.query(`select public.jh_bulk_review('approve', array[$1]::uuid[], '{}'::jsonb, null)`, [
        await (async () => {
          await actAsService(db);
          return scalar<string>(db, `select id from public.questions limit 1`);
        })(),
      ]),
    );
    expect(message).toMatch(/permission/i);
  });

  it("stops students from changing roles or reading audit logs", async () => {
    await actAs(db, STUDENT_A);
    const auditVisible = await scalar<number>(db, `select count(*)::int from public.audit_logs`);
    expect(auditVisible).toBe(0);
    const message = await expectError(
      db.query(`update public.profiles set role_id = 'admin' where id = $1`, [STUDENT_A]),
      /own role/i,
    );
    expect(message).toMatch(/own role/i);
    await actAsService(db);
    expect(await scalar<string>(db, `select role_id from public.profiles where id = $1`, [STUDENT_A])).toBe("student");
  });

  it("lets students read only published schedules", async () => {
    await actAs(db, STUDENT_A);
    const drafts = await scalar<number>(db, `select count(*)::int from public.exam_schedules where status='draft'`);
    expect(drafts).toBe(0);
    const published = await scalar<number>(db, `select count(*)::int from public.exam_schedules where status='published'`);
    expect(published).toBeGreaterThan(0);
  });
});

describe("leaderboard", () => {
  it("ranks only released results and breaks ties deterministically", async () => {
    await actAsService(db);
    const released = await scalar<number>(db, `select count(*)::int from public.results where is_released`);
    expect(released).toBeGreaterThan(0);

    await actAs(db, STUDENT_A);
    const board = await rows<{ rank: number; score: number; accuracy: number }>(
      db,
      `select rank, score, accuracy from public.jh_leaderboard('course', $1, null, 20)`,
      [courseId],
    );
    expect(board.length).toBeGreaterThan(0);
    expect(board[0].rank).toBe(1);
    for (let index = 1; index < board.length; index += 1) {
      const previous = board[index - 1];
      const current = board[index];
      const ordered =
        Number(previous.score) > Number(current.score) ||
        (Number(previous.score) === Number(current.score) && Number(previous.accuracy) >= Number(current.accuracy));
      expect(ordered).toBe(true);
    }
  });
});
