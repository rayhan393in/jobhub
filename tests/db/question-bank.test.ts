import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import {
  actAs, actAsService, createDatabase, createPrivilegedUser, expectError, migrate, rows, scalar, uuid,
} from "./harness";

/**
 * QA for the question-bank layer (migration 20261207000000):
 * verified-previous-year (PYQ) definition, collection counts, exam-wise
 * listing, browse filters + pagination, single-question practice and
 * PYQ-scoped paper building. The invariant under test: unverified, pending,
 * rejected, archived or non-previous questions NEVER surface as previous
 * year questions, and browse never returns the answer key.
 */

let db: PGlite;
const ADMIN = uuid(920);
const STUDENT = uuid(921);

let courseId: string;
let subjectA: string;
let subjectB: string;
let topicA: string;
let topicB: string;
let previousId: string;
let pendingId: string;

const FP = (n: string) => `qb-test-${n}`;

beforeAll(async () => {
  db = await createDatabase();
  await migrate(db);

  await createPrivilegedUser(db, { id: ADMIN, email: "qb-admin@jobhub.test", role: "super_admin", full_name: "QB Admin" });
  await createPrivilegedUser(db, { id: STUDENT, email: "qb-student@jobhub.test", role: "student", full_name: "QB Student" });

  await actAsService(db);
  courseId = await scalar<string>(db, `select id from public.courses where slug = 'bcs'`);
  subjectA = await scalar<string>(db, `select id from public.subjects where course_id = $1 order by sort_order limit 1`, [courseId]);
  subjectB = await scalar<string>(
    db,
    `select id from public.subjects where course_id = $1 and id <> $2 order by sort_order limit 1`,
    [courseId, subjectA],
  );
  topicA = await scalar<string>(db, `select id from public.topics where subject_id = $1 order by sort_order limit 1`, [subjectA]);
  topicB = await scalar<string>(db, `select id from public.topics where subject_id = $1 order by sort_order limit 1`, [subjectB]);

  async function addMcq(
    statement: string,
    fingerprint: string,
    opts: {
      sourceType?: string;
      status?: string;
      verified?: boolean;
      examName?: string | null;
      year?: number | null;
      subjectId?: string | null;
      topicId?: string | null;
      archived?: boolean;
      explanation?: string;
    } = {},
  ): Promise<string> {
    const r = await rows<{ id: string }>(
      db,
      `insert into public.questions
         (course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
          correct_option, explanation, difficulty, source, source_type, exam_name, year,
          question_type, status, is_verified, fingerprint, created_by, archived_at)
       values ($1,$2,$3,$4,'ক','খ','গ','ঘ',0,$9,'medium','fixture',$5,$6,$7,'mcq',$8,$10,$11,$12,
               case when $13::boolean then now() else null end)
       returning id`,
      [
        courseId,
        opts.subjectId ?? subjectA,
        opts.topicId ?? topicA,
        statement,
        opts.sourceType ?? "manual",
        opts.examName ?? null,
        opts.year ?? null,
        opts.status ?? "draft",
        opts.explanation ?? "ব্যাখ্যা",
        opts.verified ?? false,
        fingerprint,
        ADMIN,
        opts.archived ?? false,
      ],
    );
    return r[0].id;
  }

  // Approved + verified previous-year questions across two BCS exams.
  await addMcq("৪২তম BCS পরীক্ষার প্রশ্ন — আর্থ-সামাজিক: বাংলাদেশের রাজধানী কোথায়?", FP("bcs42-1"), {
    sourceType: "previous", status: "approved", verified: true, examName: "৪২তম BCS (প্রিলিমিনারি)", year: 2021,
    subjectId: subjectA, topicId: topicA,
  });
  await addMcq("৪২তম BCS পরীক্ষার প্রশ্ন — বাংলাদেশের জাতীয় পাখি কোনটি?", FP("bcs42-2"), {
    sourceType: "previous", status: "approved", verified: true, examName: "৪২তম BCS (প্রিলিমিনারি)", year: 2021,
    subjectId: subjectB, topicId: topicB,
  });
  await addMcq("৪৩তম BCS পরীক্ষার প্রশ্ন — মুক্তিযুদ্ধ কবে শুরু হয়?", FP("bcs43-1"), {
    sourceType: "previous", status: "approved", verified: true, examName: "৪৩তম BCS (প্রিলিমিনারি)", year: 2021,
    subjectId: subjectA, topicId: topicA,
  });
  // Verified body of regular (non-previous) questions — counts as total, never as PYQ.
  await addMcq("সাধারণ অনুশীলন প্রশ্ন — বাংলাদেশের মুদ্রার নাম কী?", FP("practice-1"), {
    status: "approved", verified: true, subjectId: subjectA, topicId: topicA,
  });
  // --- pollution fixtures that must NEVER count as PYQ ---
  await addMcq("রিভিউ অপেক্ষায় থাকা পূর্ববর্তী বছরের প্রশ্ন — রঙিন সাইকেল", FP("pending-1"), {
    sourceType: "previous", status: "pending_review", verified: false, examName: "৪২তম BCS (প্রিলিমিনারি)", year: 2021,
  });
  await addMcq("ড্রাফট অবস্থায় থাকা পূর্ববর্তী বছরের প্রশ্ন — রূপালী পানকৌড়ি", FP("unverified-1"), {
    sourceType: "previous", status: "draft", verified: false, examName: "৪২তম BCS (প্রিলিমিনারি)", year: 2021,
  });
  await addMcq("বাতিল হয়ে যাওয়া পূর্ববর্তী বছরের প্রশ্ন — ভূতের বাজার", FP("rejected-1"), {
    sourceType: "previous", status: "rejected", verified: false, examName: "৪২তম BCS (প্রিলিমিনারি)", year: 2021,
  });
  await addMcq("আর্কাইভ করা পূর্ববর্তী বছরের প্রশ্ন — লুকানো পাতা", FP("archived-1"), {
    sourceType: "previous", status: "approved", verified: true, examName: "৪২তম BCS (প্রিলিমিনারি)", year: 2021,
    archived: true,
  });
  await addMcq("AI-সহায়তায় তৈরি প্রশ্ন — কিন্তু যাচাইকৃত, পূর্ববর্তী নয়", FP("ai-1"), {
    sourceType: "ai_assisted", status: "approved", verified: true, examName: null, year: null,
  });
  await addMcq("যাচাইকৃত কিন্তু অচিহ্নিত পূর্ববর্তী প্রশ্ন — মূল পরীক্ষা-বছর নেই", FP("bcs-unlabeled-1"), {
    sourceType: "previous", status: "approved", verified: true, examName: null, year: null,
    subjectId: subjectB, topicId: topicB,
  });

  // Students cannot read `questions` directly (RLS) — capture fixture ids now,
  // as the service role, for the practice tests below.
  previousId = await scalar<string>(db, `select id from public.questions where fingerprint = $1`, [FP("bcs43-1")]);
  pendingId = await scalar<string>(db, `select id from public.questions where fingerprint = $1`, [FP("pending-1")]);
});

describe("collection counts", () => {
  it("counts only approved + verified, split by previous-year, for published courses", async () => {
    await actAs(db, STUDENT);
    const raw = await scalar<string>(db, `select public.jh_qb_collections()::text`);
    const rowsOut = JSON.parse(raw) as Array<{
      slug: string; total_verified: number; previous_verified: number;
    }>;
    const bcs = rowsOut.find((r) => r.slug === "bcs");
    expect(bcs).toBeDefined();
    // 4 PYQ + 1 practice + 1 AI + 1 unlabeled PYQ = 6 approved+verified; only 4 are previous.
    expect(bcs!.total_verified).toBe(6);
    expect(bcs!.previous_verified).toBe(4);
  });
});

describe("exam-wise listing", () => {
  it("groups verified previous-year questions per exam with counts", async () => {
    await actAs(db, STUDENT);
    const raw = await scalar<string>(db, `select public.jh_qb_exams('bcs')::text`);
    const exams = JSON.parse(raw) as Array<{ exam_name: string; year: number | null; question_count: number; subject_count: number }>;
    const bcs42 = exams.find((e) => e.exam_name === "৪২তম BCS (প্রিলিমিনারি)");
    const bcs43 = exams.find((e) => e.exam_name === "৪৩তম BCS (প্রিলিমিনারি)");
    const bucket = exams.find((e) => e.exam_name === null);
    expect(bcs42?.question_count).toBe(2);
    expect(bcs42?.subject_count).toBe(2);
    expect(bcs43?.question_count).toBe(1);
    // the unlabeled bucket surfaces the 254-style gap honestly instead of hiding it
    expect(bucket?.question_count).toBe(1);
    expect(exams).toHaveLength(3);
  });
});

describe("PYQ browse list", () => {
  it("returns rows without the answer key and marks them as previous-year", async () => {
    await actAs(db, STUDENT);
    const raw = await scalar<string>(db, `select public.jh_qb_pyq_list('bcs', null, null, null, null, null, null, null, null, 'year', 1, 10)::text`);
    const data = JSON.parse(raw) as { total: number; rows: Array<Record<string, unknown>> };
    expect(data.total).toBe(4);
    expect(data.rows).toHaveLength(4);
    for (const row of data.rows) {
      expect(row).not.toHaveProperty("correct_option");
      expect(row).not.toHaveProperty("explanation");
      expect(row.classification).toBe("pyq");
    }
  });

  it("never ships collection provenance to students", async () => {
    await actAs(db, STUDENT);
    const raw = await scalar<string>(db, `select public.jh_qb_pyq_list('bcs', null, null, null, null, null, null, null, null, 'year', 1, 10)::text`);
    const data = JSON.parse(raw) as { rows: Array<Record<string, unknown>> };
    expect(data.rows.length).toBeGreaterThan(0);
    for (const row of data.rows) {
      // Where a question was collected from is admin-only; the student sees
      // exam attribution (exam_name + year) and nothing else.
      expect(row).not.toHaveProperty("source");
      expect(row).not.toHaveProperty("source_title");
    }
  });

  it("filters by exam name + year and by subject", async () => {
    await actAs(db, STUDENT);
    const raw = await scalar<string>(
      db,
      `select public.jh_qb_pyq_list('bcs', $1, $2, null, null, null, null, null, null, 'year', 1, 10)::text`,
      ["৪২তম BCS (প্রিলিমিনারি)", 2021],
    );
    expect(JSON.parse(raw).total).toBe(2);
    const rawSubject = await scalar<string>(
      db,
      `select public.jh_qb_pyq_list('bcs', null, null, $1, null, null, null, null, null, 'year', 1, 10)::text`,
      [subjectB],
    );
    const bySubject = JSON.parse(rawSubject) as { total: number; rows: Array<{ subject_id: string }> };
    expect(bySubject.total).toBe(2);
    for (const row of bySubject.rows) expect(row.subject_id).toBe(subjectB);
  });

  it("search is wildcard-escaped and finds the matching statement only", async () => {
    await actAs(db, STUDENT);
    const raw = await scalar<string>(db, `select public.jh_qb_pyq_list('bcs', null, null, null, null, null, null, null, $1, 'year', 1, 10)::text`, ["মুক্তিযুদ্ধ"]);
    const data = JSON.parse(raw) as { total: number; rows: Array<{ statement: string }> };
    expect(data.total).toBe(1);
    expect(data.rows[0].statement).toContain("মুক্তিযুদ্ধ");
    const rawWildcard = await scalar<string>(db, `select public.jh_qb_pyq_list('bcs', null, null, null, null, null, null, null, $1, 'year', 1, 10)::text`, ["%"]);
    expect(JSON.parse(rawWildcard).total).toBe(0);
  });

  it("paginates: page_size is capped and totals stay exact", async () => {
    await actAs(db, STUDENT);
    const raw = await scalar<string>(db, `select public.jh_qb_pyq_list('bcs', null, null, null, null, null, null, null, null, 'year', 1, 2)::text`);
    const page1 = JSON.parse(raw) as { total: number; total_pages: number; rows: unknown[] };
    expect(page1.rows).toHaveLength(2);
    expect(page1.total).toBe(4);
    expect(page1.total_pages).toBe(2);
    const raw2 = await scalar<string>(db, `select public.jh_qb_pyq_list('bcs', null, null, null, null, null, null, null, null, 'year', 2, 2)::text`);
    expect(JSON.parse(raw2).rows).toHaveLength(2);
  });
});

describe("practice attempts from the question bank", () => {
  it("single-question practice starts only for approved + verified questions", async () => {
    await actAs(db, STUDENT);
    const started = await scalar<string>(
      db,
      `select public.jh_start_single_question($1::uuid, 5)::text`,
      [previousId],
    );
    const parsed = JSON.parse(started) as { attempt_id: string; status: string };
    expect(parsed.attempt_id).toBeTruthy();
    expect(parsed.status).toBe("in_progress");

    await expectError(
      db.query(`select public.jh_start_single_question($1::uuid, 5)`, [pendingId]),
      /not available/i,
    );
  });

  it("an exam-scoped composition builds a paper with ONLY that exam's verified PYQs", async () => {
    await actAs(db, STUDENT);
    const raw = await scalar<string>(
      db,
      `select public.jh_start_custom_attempt(
         $1::uuid,
         $2::jsonb,
         20,
         'timed_mock',
         'QB mock',
         'প্রশ্নব্যাংক মক'
       )::text`,
      [
        courseId,
        JSON.stringify({
          items: [{ exam_name: "৪২তম BCS (প্রিলিমিনারি)", exam_year: 2021, count: 2 }],
        }),
      ],
    );
    const started = JSON.parse(raw) as { attempt_id: string };
    await actAsService(db); // students can't read questions/exam_questions — inspect as service
    const questions = await rows<{ source_type: string; exam_name: string; status: string }>(
      db,
      `select q.source_type, q.exam_name, q.status
       from public.exam_questions eq
       join public.exam_attempts a on a.paper_id = eq.paper_id
       join public.questions q on q.id = eq.question_id
       where a.id = $1::uuid`,
      [started.attempt_id],
    );
    expect(questions).toHaveLength(2);
    for (const question of questions) {
      expect(question.source_type).toBe("previous");
      expect(question.exam_name).toBe("৪২তম BCS (প্রিলিমিনারি)");
      expect(question.status).toBe("approved");
    }
  });

  it("an exam-scoped composition fails loudly when the verified bank is too small", async () => {
    await actAs(db, STUDENT);
    await expectError(
      db.query(
        `select public.jh_start_custom_attempt($1::uuid, $2::jsonb, 20, 'custom', 'x', 'y')`,
        [courseId, JSON.stringify({ items: [{ exam_name: "৪৩তম BCS (প্রিলিমিনারি)", exam_year: 2021, count: 5 }] })],
      ),
      /Only 1 verified previous-year/i,
    );
  });
});
