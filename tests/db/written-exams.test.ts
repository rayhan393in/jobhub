import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  actAs, actAsService, createDatabase, createPrivilegedUser, createUser,
  expectError, migrate, rows, scalar, uuid,
} from "./harness";

/**
 * Written exam module (লিখিত পরীক্ষা): typed answers + খাতা uploads.
 *
 * Invariants under test:
 *  - eligibility comes from exam_registry written-stage rows (data, not code);
 *  - students see only published exams, get exactly one attempt, can write
 *    answers only while in progress, and can NEVER touch grading fields;
 *  - examiners (staff) grade and finalize;
 *  - uploads are recorded only for own in-progress attempts.
 */

const ADMIN = uuid(150);
const STUDENT = uuid(151);
const OTHER = uuid(152);

const EXAM = uuid(160);      // published exam
const DRAFT = uuid(161);     // draft exam
const Q1 = uuid(162);
const Q2 = uuid(163);

let db: PGlite;
let courseId: string;

beforeAll(async () => {
  db = await createDatabase();
  await migrate(db);
  await createPrivilegedUser(db, { id: ADMIN, email: "written-admin@jobhub.test", role: "super_admin", full_name: "Examiner" });
  await createUser(db, { id: STUDENT, email: "written-student@jobhub.test", full_name: "Student A" });
  await createUser(db, { id: OTHER, email: "written-other@jobhub.test", full_name: "Student B" });

  await actAsService(db);
  courseId = (await scalar<string>(db, `select id from public.courses where slug = 'bcs'`))!;

  await db.exec(`
    insert into public.written_exams (id, course_id, title_bn, mode, duration_minutes, total_marks, status, instructions_bn)
    values ('${EXAM}', '${courseId}', 'বিসিএস লিখিত মডেল টেস্ট', 'both', 180, 50, 'published', 'সব প্রশ্নের উত্তর দিন'),
           ('${DRAFT}', '${courseId}', 'খসড়া লিখিত পরীক্ষা', 'typed', 120, 40, 'draft', null);

    insert into public.written_questions (id, exam_id, question_bn, marks, sort_order)
    values ('${Q1}', '${EXAM}', 'বাংলাদেশের মুক্তিযুদ্ধের তাৎপর্য আলোচনা করুন।', 30, 0),
           ('${Q2}', '${EXAM}', 'সংবিধানের মূলনীতি ব্যাখ্যা করুন।', 20, 1);
  `);
});

describe("written exams", () => {
  it("seeds written-stage registry rows for the tracks that genuinely have one", async () => {
    await actAsService(db);
    const n = await scalar<number>(
      db,
      `select count(*)::int from public.exam_registry
        where exam_stage = 'written' and status = 'published' and course_id = '${courseId}'`,
    );
    expect(n).toBeGreaterThanOrEqual(1);
  });

  it("students see published (and closed) exams but never drafts", async () => {
    await actAs(db, STUDENT);
    const visible = await rows<{ id: string; status: string }>(db, `select id, status from public.written_exams`);
    expect(visible.map((v) => v.id)).toContain(EXAM);
    expect(visible.map((v) => v.id)).not.toContain(DRAFT);
  });

  it("students cannot create written exams", async () => {
    await actAs(db, STUDENT);
    await expectError(
      db.query(
        `insert into public.written_exams (course_id, title_bn) values ('${courseId}', 'ছাত্রের বানানো পরীক্ষা')`,
      ),
    );
  });

  it("a student starts exactly ONE attempt on a published exam", async () => {
    await actAs(db, STUDENT);
    await db.query(`insert into public.written_attempts (exam_id, user_id) values ('${EXAM}', '${STUDENT}')`);
    const status = await scalar<string>(
      db,
      `select status from public.written_attempts where exam_id = '${EXAM}' and user_id = '${STUDENT}'`,
    );
    expect(status).toBe("in_progress");
    await expectError(
      db.query(`insert into public.written_attempts (exam_id, user_id) values ('${EXAM}', '${STUDENT}')`),
    );
  });

  it("no attempt can be started on a draft exam", async () => {
    await actAs(db, STUDENT);
    await expectError(
      db.query(`insert into public.written_attempts (exam_id, user_id) values ('${DRAFT}', '${STUDENT}')`),
    );
  });

  it("the student writes and revises answers while in progress", async () => {
    await actAs(db, STUDENT);
    const attemptId = await scalar<string>(
      db,
      `select id from public.written_attempts where exam_id = '${EXAM}' and user_id = '${STUDENT}'`,
    );
    await db.query(
      `insert into public.written_answers (attempt_id, question_id, answer_text)
       values ('${attemptId}', '${Q1}', 'প্রথম খসড়া উত্তর')`,
    );
    await db.query(
      `update public.written_answers set answer_text = 'সংশোধিত উত্তর'
        where attempt_id = '${attemptId}' and question_id = '${Q1}'`,
    );
    const text = await scalar<string>(
      db,
      `select answer_text from public.written_answers where attempt_id = '${attemptId}' and question_id = '${Q1}'`,
    );
    expect(text).toBe("সংশোধিত উত্তর");
  });

  it("students can NEVER write grading fields (guard trigger)", async () => {
    await actAs(db, STUDENT);
    const attemptId = await scalar<string>(
      db,
      `select id from public.written_attempts where exam_id = '${EXAM}' and user_id = '${STUDENT}'`,
    );
    await expectError(
      db.query(
        `update public.written_answers set awarded_marks = 30
          where attempt_id = '${attemptId}' and question_id = '${Q1}'`,
      ),
      /পরীক্ষক/,
    );
    await expectError(
      db.query(`update public.written_attempts set total_awarded = 50 where id = '${attemptId}'`),
      /পরীক্ষক/,
    );
    await expectError(
      db.query(`update public.written_attempts set status = 'graded' where id = '${attemptId}'`),
      /গ্রেড/,
    );
  });

  it("records খাতা uploads for the own in-progress attempt", async () => {
    await actAs(db, STUDENT);
    const attemptId = await scalar<string>(
      db,
      `select id from public.written_attempts where exam_id = '${EXAM}' and user_id = '${STUDENT}'`,
    );
    await db.query(
      `insert into public.written_uploads (attempt_id, storage_path, file_name, mime_type, size_bytes)
       values ('${attemptId}', '${EXAM}/${attemptId}/page1.jpg', 'page1.jpg', 'image/jpeg', 12345)`,
    );
    const n = await scalar<number>(
      db,
      `select count(*)::int from public.written_uploads where attempt_id = '${attemptId}'`,
    );
    expect(n).toBe(1);
  });

  it("another student sees nothing of that attempt", async () => {
    await actAs(db, OTHER);
    const attempts = await rows(db, `select id from public.written_attempts where user_id = '${STUDENT}'`);
    expect(attempts.length).toBe(0);
    const answers = await rows(db, `select id from public.written_answers`);
    expect(answers.length).toBe(0);
    const uploads = await rows(db, `select id from public.written_uploads`);
    expect(uploads.length).toBe(0);
  });

  it("submit freezes the attempt: no more answers or uploads", async () => {
    await actAs(db, STUDENT);
    const attemptId = await scalar<string>(
      db,
      `select id from public.written_attempts where exam_id = '${EXAM}' and user_id = '${STUDENT}'`,
    );
    await db.query(`update public.written_attempts set status = 'submitted' where id = '${attemptId}'`);
    const submittedAt = await scalar<string | null>(
      db,
      `select submitted_at::text from public.written_attempts where id = '${attemptId}'`,
    );
    expect(submittedAt).not.toBeNull();

    // Frozen for the student now: the update policy matches no rows.
    const res = await db.query(
      `update public.written_answers set answer_text = 'দেরিতে বদলানো'
        where attempt_id = '${attemptId}' and question_id = '${Q1}'`,
    );
    expect(res.affectedRows ?? 0).toBe(0);
    const unchanged = await scalar<string>(
      db,
      `select answer_text from public.written_answers where attempt_id = '${attemptId}' and question_id = '${Q1}'`,
    );
    expect(unchanged).toBe("সংশোধিত উত্তর");
    await expectError(
      db.query(
        `insert into public.written_answers (attempt_id, question_id, answer_text)
         values ('${attemptId}', '${Q2}', 'দেরিতে লেখা')`,
      ),
    );
    await expectError(
      db.query(
        `insert into public.written_uploads (attempt_id, storage_path)
         values ('${attemptId}', '${EXAM}/${attemptId}/late.jpg')`,
      ),
    );
    await expectError(
      db.query(`update public.written_attempts set status = 'in_progress' where id = '${attemptId}'`),
      /পরিবর্তন/,
    );
  });

  it("the examiner grades each answer and finalizes the attempt", async () => {
    await actAs(db, ADMIN);
    const attemptId = await scalar<string>(
      db,
      `select id from public.written_attempts where exam_id = '${EXAM}' and user_id = '${STUDENT}'`,
    );
    await db.query(
      `update public.written_answers set awarded_marks = 22, examiner_note_bn = 'ভালো বিশ্লেষণ'
        where attempt_id = '${attemptId}' and question_id = '${Q1}'`,
    );
    await db.query(
      `update public.written_attempts
          set status = 'graded', graded_at = now(), total_awarded = 22,
              examiner_id = '${ADMIN}', examiner_note_bn = 'উপস্থাপনা আরো গোছানো হতে পারে'
        where id = '${attemptId}'`,
    );
    const [attempt] = await rows<{ status: string; total_awarded: string }>(
      db,
      `select status, total_awarded::text from public.written_attempts where id = '${attemptId}'`,
    );
    expect(attempt.status).toBe("graded");
    expect(Number(attempt.total_awarded)).toBe(22);
  });

  it("the student reads back the graded result but still cannot change it", async () => {
    await actAs(db, STUDENT);
    const [mine] = await rows<{ status: string; total_awarded: string; examiner_note_bn: string }>(
      db,
      `select status, total_awarded::text, examiner_note_bn
         from public.written_attempts where exam_id = '${EXAM}' and user_id = '${STUDENT}'`,
    );
    expect(mine.status).toBe("graded");
    expect(Number(mine.total_awarded)).toBe(22);
    await expectError(
      db.query(
        `update public.written_attempts set total_awarded = 100
          where exam_id = '${EXAM}' and user_id = '${STUDENT}'`,
      ),
    );
  });

  it("anon has no access to any written-exam table", async () => {
    const anonBlocked = await scalar<boolean>(
      db,
      `select not has_table_privilege('anon', 'public.written_exams', 'select')
          and not has_table_privilege('anon', 'public.written_attempts', 'select')
          and not has_table_privilege('anon', 'public.written_answers', 'select')
          and not has_table_privilege('anon', 'public.written_uploads', 'select')`,
    );
    expect(anonBlocked).toBe(true);
  });
});
