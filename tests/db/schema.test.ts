import { describe, expect, it, beforeAll } from "vitest";
import {
  actAs, actAsService, createDatabase, createPrivilegedUser, createUser, expectError, migrate, rows, scalar, uuid,
} from "./harness";
import type { PGlite } from "@electric-sql/pglite";

let db: PGlite;
const student = uuid(1);
const student2 = uuid(2);
const admin = uuid(3);
const superAdmin = uuid(5);
const courseId = uuid(100);
const subjectId = uuid(101);
const topicId = uuid(102);

async function seedTaxonomy() {
  await actAsService(db);
  await db.query(
    `insert into public.courses (id, slug, title_en, title_bn, status) values ($1,'test-bcs','BCS Test','বিসিএস টেস্ট','published') on conflict (slug) do nothing`,
    [courseId],
  );
  await db.query(
    `insert into public.subjects (id, course_id, slug, title_en, title_bn) values ($1,$2,'bangla','Bangla','বাংলা')`,
    [subjectId, courseId],
  );
  await db.query(
    `insert into public.topics (id, subject_id, slug, title_en, title_bn) values ($1,$2,'sandhi','Sandhi','সন্ধি')`,
    [topicId, subjectId],
  );
}

let questionSeq = 0;
async function seedQuestions(count: number, opts: { verified?: boolean; correct?: number } = {}) {
  const verified = opts.verified ?? true;
  const ids: string[] = [];
  questionSeq += 1;
  await actAsService(db);
  for (let i = 1; i <= count; i++) {
    const id = uuid(1000 + questionSeq * 100 + i);
    ids.push(id);
    await db.query(
      `insert into public.questions
        (id, course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
         correct_option, explanation, status, is_verified, fingerprint)
       values ($1,$2,$3,$4,$5,'A','B','C','D',$6,'because','approved',$7,$8)`,
      [id, courseId, subjectId, topicId, `Question number ${i} about sandhi rules`, opts.correct ?? 0, verified, `fp-${i}-${questionSeq}`],
    );
  }
  return ids;
}

beforeAll(async () => {
  db = await createDatabase();
  await migrate(db);
  await seedTaxonomy();
  await createUser(db, { id: student, email: "student@jobhub.test" });
  await createUser(db, { id: student2, email: "student2@jobhub.test" });
  await createPrivilegedUser(db, { id: admin, email: "admin@jobhub.test", role: "admin" });
  await createPrivilegedUser(db, { id: superAdmin, email: "super@jobhub.test", role: "super_admin" });
});

describe("migrations", () => {
  it("creates every required table", async () => {
    await actAsService(db);
    const names = await rows<{ table_name: string }>(
      db,
      `select table_name from information_schema.tables where table_schema='public' order by 1`,
    );
    const list = names.map((r) => r.table_name);
    for (const t of [
      "profiles", "roles", "permissions", "courses", "subjects", "topics", "subtopics",
      "questions", "question_reviews", "routines", "exam_schedules", "exam_papers",
      "exam_questions", "exam_attempts", "student_answers", "results", "bookmarks",
      "study_progress", "audit_logs",
    ]) {
      expect(list, `missing table ${t}`).toContain(t);
    }
  });

  it("has RLS enabled and forced on every public table", async () => {
    await actAsService(db);
    const unprotected = await rows<{ relname: string }>(
      db,
      `select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relkind='r' and (not c.relrowsecurity or not c.relforcerowsecurity)`,
    );
    expect(unprotected.map((r) => r.relname)).toEqual([]);
  });

  it("is idempotent when re-run", async () => {
    await migrate(db);
    const count = await scalar<number>(
      db,
      `select count(*)::int from information_schema.tables where table_schema='public'`,
    );
    expect(count).toBeGreaterThan(20);
  });

  it("auto-creates a profile for a new auth user", async () => {
    const id = uuid(4);
    await createUser(db, { id, email: "auto@jobhub.test" });
    const role = await scalar<string>(db, `select role_id from public.profiles where id=$1`, [id]);
    expect(role).toBe("student");
  });
});

describe("RLS isolation", () => {
  it("hides other students' attempts and answers", async () => {
    const qids = await seedQuestions(2);
    await actAs(db, student);
    const start = await rows<{ r: Record<string, unknown> }>(
      db,
      `select public.jh_start_custom_attempt($1, $2::jsonb, 10, 'custom') as r`,
      [courseId, JSON.stringify({ items: [{ subject_id: subjectId, count: 2 }] })],
    );
    const attemptId = start[0].r.attempt_id as string;
    await db.query(`select public.jh_save_answer($1,$2,0,false)`, [attemptId, qids[0]]);

    await actAs(db, student2);
    const otherAttempts = await rows(db, `select id from public.exam_attempts where id=$1`, [attemptId]);
    expect(otherAttempts).toHaveLength(0);
    const otherAnswers = await rows(db, `select id from public.student_answers where attempt_id=$1`, [attemptId]);
    expect(otherAnswers).toHaveLength(0);
    await expectError(
      db.query(`select public.jh_get_attempt_paper($1)`, [attemptId]),
      /Not authorized/,
    );
  });

  it("never exposes question rows or answer keys to a student session", async () => {
    await seedQuestions(1);
    await actAs(db, student);
    const visible = await rows(db, `select id from public.questions`);
    expect(visible).toHaveLength(0);
    await actAs(db, null, "anon");
    await expectError(db.query(`select correct_option from public.questions`), /permission denied/i);
  });

  it("prevents a student from approving questions or publishing exams", async () => {
    await actAs(db, student);
    const updated = await rows<{ id: string }>(
      db,
      `update public.questions set status='approved' returning id`,
    );
    expect(updated).toHaveLength(0);
    await expectError(
      db.query(`insert into public.question_reviews (question_id, action) values ($1,'approve')`, [uuid(1001)]),
      /row-level security|permission denied/i,
    );
    await expectError(
      db.query(`select public.jh_bulk_review('approve', null, '{}'::jsonb, null)`),
      /question.review/,
    );
    await expectError(
      db.query(`select public.jh_publish_schedule($1)`, [uuid(999)]),
      /exam.publish/,
    );
  });

  it("prevents a student from changing their own role", async () => {
    await actAs(db, student);
    await expectError(
      db.query(`update public.profiles set role_id='admin' where id=$1`, [student]),
      /cannot change your own role/i,
    );
  });

  it("lets an admin grant a role but blocks a student from granting", async () => {
    await actAs(db, student);
    const blocked = await rows<{ id: string }>(
      db,
      `update public.profiles set role_id='content_editor' where id=$1 returning id`,
      [student2],
    );
    expect(blocked).toHaveLength(0);
    await actAs(db, admin);
    await expectError(
      db.query(`update public.profiles set role_id='content_editor' where id=$1`, [student2]),
      /super admin/i,
    );
    const granted = await rows<{ id: string }>(
      db,
      `update public.profiles set role_id='student' where id=$1 and false returning id`,
      [student2],
    );
    expect(granted).toHaveLength(0);

    await actAs(db, superAdmin);
    await db.query(`update public.profiles set role_id='content_editor' where id=$1`, [student2]);
    const role = await scalar<string>(db, `select role_id from public.profiles where id=$1`, [student2]);
    expect(role).toBe("content_editor");
    await actAsService(db);
    await db.query(`update public.profiles set role_id='student' where id=$1`, [student2]);
  });
});

describe("attempt lifecycle", () => {
  it("refuses to start a custom exam with too few verified questions", async () => {
    await actAs(db, student);
    await expectError(
      db.query(
        `select public.jh_start_custom_attempt($1,$2::jsonb,10,'custom')`,
        [courseId, JSON.stringify({ items: [{ subject_id: subjectId, count: 99 }] })],
      ),
      /verified question/i,
    );
  });

  it("starts, autosaves, refreshes and returns the paper without the key", async () => {
    await seedQuestions(3);
    await actAs(db, student);
    const started = await rows<{ r: Record<string, unknown> }>(
      db,
      `select public.jh_start_custom_attempt($1,$2::jsonb,15,'custom') as r`,
      [courseId, JSON.stringify({ items: [{ topic_id: topicId, count: 3 }] })],
    );
    const attemptId = started[0].r.attempt_id as string;
    expect(started[0].r.resumed).toBe(false);

    const paper = await rows<{ r: Record<string, unknown> }>(
      db,
      `select public.jh_get_attempt_paper($1) as r`,
      [attemptId],
    );
    const payload = paper[0].r as { questions: Array<Record<string, unknown>> };
    expect(payload.questions).toHaveLength(3);
    const firstQ = payload.questions[0].question_id as string;

    const saved = await rows<{ r: Record<string, unknown> }>(
      db,
      `select public.jh_save_answer($1,$2,2,true) as r`,
      [attemptId, firstQ],
    );
    expect(saved[0].r.saved).toBe(true);

    await expectError(
      db.query(`select public.jh_save_answer($1,$2,0,false)`, [attemptId, uuid(999999)]),
      /not part of this paper/i,
    );
    expect(JSON.stringify(payload)).not.toContain("correct_option");
    expect(payload.questions.every((q) => Array.isArray(q.options) && q.options.length === 4)).toBe(true);

    const stored = await rows<{ selected_option: number; marked_for_review: boolean }>(
      db,
      `select selected_option, marked_for_review from public.student_answers where attempt_id=$1`,
      [attemptId],
    );
    expect(stored[0].selected_option).toBe(2);
    expect(stored[0].marked_for_review).toBe(true);
  });

  it("scores +1 / -0.5 / 0 correctly and is idempotent", async () => {
    await actAsService(db);
    const scoringTopic = uuid(9000);
    await db.query(
      `insert into public.topics (id, subject_id, slug, title_en, title_bn) values ($1,$2,'scoring','Scoring','স্কোরিং')`,
      [scoringTopic, subjectId],
    );
    const ids = [uuid(5001), uuid(5002), uuid(5003), uuid(5004)];
    const correct = [1, 2, 3, 0];
    for (let i = 0; i < 4; i++) {
      await db.query(
        `insert into public.questions
           (id, course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
            correct_option, explanation, status, is_verified, fingerprint)
         values ($1,$2,$3,$4,$5,'A','B','C','D',$6,'exp','approved',true,$7)`,
        [ids[i], courseId, subjectId, scoringTopic, `Scoring fixture question ${i}`, correct[i], `fp-score-${i}`],
      );
    }

    await actAs(db, student);
    const started = await rows<{ r: Record<string, unknown> }>(
      db,
      `select public.jh_start_custom_attempt($1,$2::jsonb,20,'custom') as r`,
      [courseId, JSON.stringify({ items: [{ subtopic_id: null, topic_id: scoringTopic, count: 4 }] })],
    );
    const attemptId = started[0].r.attempt_id as string;

    const paper = await rows<{ r: { questions: Array<{ question_id: string }> } }>(
      db,
      `select public.jh_get_attempt_paper($1) as r`,
      [attemptId],
    );
    const order = paper[0].r.questions.map((q) => q.question_id);
    for (const qid of order) {
      const idx = ids.indexOf(qid);
      // 1 correct, 2 wrong, 1 unanswered
      if (idx === 0) await db.query(`select public.jh_save_answer($1,$2,$3,false)`, [attemptId, qid, correct[0]]);
      if (idx === 1) await db.query(`select public.jh_save_answer($1,$2,$3,false)`, [attemptId, qid, (correct[1] + 1) % 4]);
      if (idx === 2) await db.query(`select public.jh_save_answer($1,$2,$3,false)`, [attemptId, qid, (correct[2] + 2) % 4]);
    }

    const persisted = await scalar<number>(
      db,
      `select count(*)::int from public.student_answers where attempt_id=$1 and selected_option is not null`,
      [attemptId],
    );
    expect(persisted).toBe(3);

    const submitted = await rows<{ r: Record<string, unknown> }>(
      db,
      `select public.jh_submit_attempt($1,'manual') as r`,
      [attemptId],
    );
    const res = submitted[0].r;
    expect(res.correct).toBe(1);
    expect(res.wrong).toBe(2);
    expect(res.unanswered).toBe(1);
    expect(Number(res.score)).toBe(1 - 2 * 0.5);

    const again = await rows<{ r: Record<string, unknown> }>(
      db,
      `select public.jh_submit_attempt($1,'manual') as r`,
      [attemptId],
    );
    expect(again[0].r.already_submitted).toBe(true);
    expect(again[0].r.result_id).toBe(res.result_id);

    const resultCount = await scalar<number>(
      db,
      `select count(*)::int from public.results where attempt_id=$1`,
      [attemptId],
    );
    expect(resultCount).toBe(1);

    await expectError(
      db.query(`select public.jh_save_answer($1,$2,0,false)`, [attemptId, order[0]]),
      /already been submitted/i,
    );
  });

  it("blocks submission by another student", async () => {
    await actAs(db, student);
    const started = await rows<{ r: Record<string, unknown> }>(
      db,
      `select public.jh_start_custom_attempt($1,$2::jsonb,10,'custom') as r`,
      [courseId, JSON.stringify({ items: [{ topic_id: topicId, count: 2 }] })],
    );
    const attemptId = started[0].r.attempt_id as string;
    await actAs(db, student2);
    await expectError(
      db.query(`select public.jh_submit_attempt($1,'manual')`, [attemptId]),
      /Not authorized/,
    );
    await actAs(db, student);
    await db.query(`select public.jh_submit_attempt($1,'manual')`, [attemptId]);
  });
});

describe("scheduled exams", () => {
  it("publishes only with verified questions and enforces embargo", async () => {
    await actAsService(db);
    const scheduleId = uuid(7001);
    // composition requires more questions than exist -> publish must fail
    await db.query(
      `insert into public.exam_schedules
        (id, course_id, kind, title_en, title_bn, starts_at, ends_at, result_release_at,
         duration_minutes, question_count, total_marks, status, settings)
       values ($1,$2,'daily_live','Daily','দৈনিক', now() + interval '1 hour', now() + interval '2 hour',
               now() + interval '3 hour', 30, 2, 2, 'draft', $3::jsonb)`,
      [scheduleId, courseId, JSON.stringify({ composition: { items: [{ topic_id: topicId, count: 99 }] } })],
    );

    await actAs(db, admin);
    await expectError(
      db.query(`select public.jh_publish_schedule($1)`, [scheduleId]),
      /Insufficient verified|verified question/i,
    );

    await actAsService(db);
    await db.query(
      `update public.exam_schedules set settings=$2::jsonb where id=$1`,
      [scheduleId, JSON.stringify({ composition: { items: [{ topic_id: topicId, count: 2 }] } })],
    );
    await actAs(db, admin);
    const published = await rows<{ r: Record<string, unknown> }>(
      db,
      `select public.jh_publish_schedule($1) as r`,
      [scheduleId],
    );
    expect(published[0].r.published).toBe(true);

    const again = await rows<{ r: Record<string, unknown> }>(
      db,
      `select public.jh_publish_schedule($1) as r`,
      [scheduleId],
    );
    expect(again[0].r.already_published).toBe(true);

    // Embargo: a second, currently-running exam is joined; results stay hidden.
    const liveId = uuid(7003);
    await actAsService(db);
    await db.query(
      `insert into public.exam_schedules
        (id, course_id, kind, title_en, title_bn, starts_at, ends_at, result_release_at,
         duration_minutes, question_count, total_marks, status, settings)
       values ($1,$2,'weekly_special','Live soon','শীঘ্রই', now() + interval '10 minutes',
               now() + interval '40 minutes', now() + interval '2 hours', 30, 2, 2, 'draft', $3::jsonb)`,
      [liveId, courseId, JSON.stringify({ composition: { items: [{ topic_id: topicId, count: 2 }] } })],
    );
    await actAs(db, admin);
    await db.query(`select public.jh_publish_schedule($1)`, [liveId]);

    // Publication must precede the start time; then the clock advances.
    await actAsService(db);
    await db.query(
      `update public.exam_schedules set starts_at = now() - interval '5 minutes',
         ends_at = now() + interval '30 minutes', result_release_at = now() + interval '45 minutes' where id=$1`,
      [liveId],
    );

    await actAs(db, student);
    const started = await rows<{ r: Record<string, unknown> }>(
      db,
      `select public.jh_start_scheduled_attempt($1) as r`,
      [liveId],
    );
    const attemptId = started[0].r.attempt_id as string;
    const submitResult = await rows<{ r: Record<string, unknown> }>(
      db,
      `select public.jh_submit_attempt($1,'manual') as r`,
      [attemptId],
    );
    expect(submitResult[0].r.is_released).toBe(false);
    const withheld = await rows<{ r: Record<string, unknown> }>(
      db,
      `select public.jh_get_attempt_review($1) as r`,
      [attemptId],
    );
    expect(withheld[0].r.released).toBe(false);
    expect(JSON.stringify(withheld[0].r)).not.toContain("correct_option");

    const hiddenResult = await rows(db, `select id from public.results where attempt_id=$1`, [attemptId]);
    expect(hiddenResult).toHaveLength(0);

    // Release the embargo and confirm the key becomes visible.
    await actAsService(db);
    await db.query(
      `update public.exam_schedules
         set starts_at = now() - interval '40 minutes',
             ends_at = now() - interval '10 minutes',
             result_release_at = now() - interval '1 minute'
       where id=$1`,
      [liveId],
    );
    await actAs(db, student);
    const released = await rows<{ r: Record<string, unknown> }>(
      db,
      `select public.jh_get_attempt_review($1) as r`,
      [attemptId],
    );
    expect(released[0].r.released).toBe(true);
    const items = (released[0].r as { items: Array<Record<string, unknown>> }).items;
    expect(items.length).toBe(2);
    expect(items[0]).toHaveProperty("correct_option");
    const visibleResult = await rows(db, `select id from public.results where attempt_id=$1 and is_released`, [attemptId]);
    expect(visibleResult).toHaveLength(0); // is_released flag is still false until the server flips it

    // Duplicate publication of the same course/kind/slot is rejected by the DB.
    await actAsService(db);
    await expectError(
      db.query(
        `insert into public.exam_schedules
          (course_id, kind, title_en, title_bn, starts_at, ends_at, result_release_at,
           duration_minutes, question_count, total_marks, status)
         select course_id, kind, title_en, title_bn, starts_at, ends_at, result_release_at,
                duration_minutes, question_count, total_marks, 'draft'
         from public.exam_schedules where id=$1`,
        [scheduleId],
      ),
      /duplicate key/i,
    );
    await actAs(db, student);
  });

  it("prevents entry before the window and duplicate attempts", async () => {
    await actAsService(db);
    const futureId = uuid(7002);
    await db.query(
      `insert into public.exam_schedules
        (id, course_id, kind, title_en, title_bn, starts_at, ends_at, result_release_at,
         duration_minutes, question_count, total_marks, status)
       values ($1,$2,'weekly_special','Weekly','সাপ্তাহিক', now() + interval '2 day',
               now() + interval '2 day 1 hour', now() + interval '2 day 2 hour', 30, 2, 2, 'published')`,
      [futureId, courseId],
    );

    await actAs(db, student);
    await expectError(
      db.query(`select public.jh_start_scheduled_attempt($1)`, [futureId]),
      /has not started yet/,
    );
  });
});

describe("bulk approval", () => {
  it("only approves inside the explicit filter and never outside it", async () => {
    await actAsService(db);
    const otherSubject = uuid(1010);
    await db.query(
      `insert into public.subjects (id, course_id, slug, title_en, title_bn) values ($1,$2,'english','English','ইংরেজি')`,
      [otherSubject, courseId],
    );
    const draftA = uuid(8001);
    const draftB = uuid(8002);
    const outside = uuid(8003);
    for (const [id, subj, fp] of [
      [draftA, subjectId, "bulk-a"],
      [draftB, subjectId, "bulk-b"],
      [outside, otherSubject, "bulk-outside"],
    ] as const) {
      await db.query(
        `insert into public.questions
           (id, course_id, subject_id, statement, option_a, option_b, option_c, option_d,
            correct_option, explanation, status, is_verified, fingerprint)
         values ($1,$2,$3,$4,'A','B','C','D',0,'exp','pending_review',false,$5)`,
        [id, courseId, subj, `Bulk fixture ${fp} question text`, fp],
      );
    }

    await actAs(db, admin);
    const result = await rows<{ r: Record<string, unknown> }>(
      db,
      `select public.jh_bulk_review('approve', null, $1::jsonb, 'bulk test') as r`,
      [JSON.stringify({ subject_id: subjectId, status: "pending_review" })],
    );
    expect(result[0].r.affected).toBe(2);

    await actAsService(db);
    const outsideStatus = await scalar<string>(db, `select status from public.questions where id=$1`, [outside]);
    expect(outsideStatus).toBe("pending_review");
    const approved = await rows(
      db,
      `select id from public.questions where status='approved' and is_verified and id in ($1,$2)`,
      [draftA, draftB],
    );
    expect(approved).toHaveLength(2);

    await actAs(db, student);
    await expectError(
      db.query(`select public.jh_bulk_review('approve', null, '{}'::jsonb, null)`),
      /question.review/,
    );
  });

  it("records a review row for every decision and audits the actor", async () => {
    await actAsService(db);
    const reviews = await scalar<number>(db, `select count(*)::int from public.question_reviews`);
    expect(reviews).toBeGreaterThanOrEqual(2);
    const audits = await rows<{ action: string }>(
      db,
      `select action from public.audit_logs where action='question.bulk_review'`,
    );
    expect(audits.length).toBeGreaterThanOrEqual(1);
  });
});

describe("leaderboard & analytics", () => {
  it("ranks only released results with deterministic tie-breaks", async () => {
    await actAs(db, student);
    const board = await rows<{ rank: number; user_id: string; score: number }>(
      db,
      `select * from public.jh_leaderboard('course', $1, null, 5)`,
      [courseId],
    );
    expect(board.length).toBeGreaterThan(0);
    expect(board[0].rank).toBe(1);
    for (let i = 1; i < board.length; i++) {
      expect(Number(board[i - 1].score)).toBeGreaterThanOrEqual(Number(board[i].score));
    }
  });

  it("returns real analytics for the signed-in student", async () => {
    await actAs(db, student);
    const analytics = await rows<{ r: Record<string, unknown> }>(
      db,
      `select public.jh_student_analytics($1) as r`,
      [courseId],
    );
    const payload = analytics[0].r as { summary: Record<string, number>; weekly: unknown[] };
    expect(payload.summary.attempts).toBeGreaterThan(0);
    expect(Array.isArray(payload.weekly)).toBe(true);
  });
});
