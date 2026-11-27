import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import {
  actAs, actAsService, createDatabase, createPrivilegedUser, createUser, migrate, rows, scalar, uuid,
} from "./harness";

/**
 * 20261215000000_exam_marks_distribution.sql — the marks section.
 *
 * The verified figures for BCS / প্রাথমিক / NTRCA are seeded as data (never as
 * JSON in code), the public can read them for published courses only, staff
 * with `taxonomy.manage` can edit them, and a re-run never duplicates a paper.
 */

let db: PGlite;
const ADMIN = uuid(880);
const STUDENT = uuid(881);
let bcsId: string;
let primaryId: string;
let eeeId: string;

beforeAll(async () => {
  db = await createDatabase();
  await migrate(db);
  await createPrivilegedUser(db, { id: ADMIN, email: "marks-admin@jobhub.test", role: "admin", full_name: "Admin" });
  await createUser(db, { id: STUDENT, email: "marks-student@jobhub.test", full_name: "Student" });
  await actAsService(db);
  bcsId = await scalar<string>(db, `select id from public.courses where slug = 'bcs'`);
  primaryId = await scalar<string>(db, `select id from public.courses where slug = 'primary-teacher'`);
  eeeId = await scalar<string>(db, `select id from public.courses where slug = 'eee'`);
});

describe("exam_marks — seeded marks distribution", () => {
  it("sums BCS preliminary to 200 marks with the official marking rule", async () => {
    await actAsService(db);
    const [row] = await rows<{
      question_count: number; marks_per_question: string; negative_marks: string;
      duration_minutes: number; total_marks: string;
    }>(db, `select * from public.exam_marks where course_id = $1 and stage = 'preliminary'`, [bcsId]);
    expect(row.question_count).toBe(100);
    expect(Number(row.marks_per_question)).toBe(1);
    expect(Number(row.negative_marks)).toBe(0.5);
    expect(Number(row.total_marks)).toBe(200);
    expect(row.duration_minutes).toBe(120);
  });

  it("keeps the BCS written split at 900 general / 1200 with technical / 200 viva", async () => {
    await actAsService(db);
    const general = Number(
      await scalar(db, `select sum(total_marks) from public.exam_marks where course_id = $1 and stage = 'written' and stage_bn = 'লিখিত (সাধারণ)'`, [bcsId]),
    );
    expect(general).toBe(900);
    const both = Number(
      await scalar(db, `select total_marks from public.exam_marks where course_id = $1 and stage = 'total' and paper_bn = 'কারিগরি ও সাধারণ'`, [bcsId]),
    );
    expect(both).toBe(1200);
    const technical = Number(
      await scalar(db, `select total_marks from public.exam_marks where course_id = $1 and stage = 'written' and paper_bn = 'পেশাগত পত্র'`, [bcsId]),
    );
    expect(technical).toBe(200);
    const viva = Number(
      await scalar(db, `select total_marks from public.exam_marks where course_id = $1 and stage = 'viva'`, [bcsId]),
    );
    expect(viva).toBe(200);
  });

  it("seeds প্রাথমিক 80 MCQ + 20 viva and NTRCA 100 + 100", async () => {
    await actAsService(db);
    const primary = await rows<{ stage: string; total_marks: string }>(
      db, `select stage, total_marks from public.exam_marks where course_id = $1 order by sort_order`, [primaryId],
    );
    expect(primary.map((r) => [r.stage, Number(r.total_marks)])).toEqual([
      ["preliminary", 80], ["viva", 20], ["total", 100],
    ]);
    const ntrca = Number(
      await scalar(db, `select sum(total_marks) from public.exam_marks
                          where course_id = (select id from public.courses where slug = 'ntrca') and stage in ('preliminary','written')`),
    );
    expect(ntrca).toBe(200);
  });

  it("invents nothing for courses whose figures are unverified", async () => {
    await actAsService(db);
    expect(Number(await scalar(db, `select count(*) from public.exam_marks where course_id = $1`, [eeeId]))).toBe(0);
  });

  it("never duplicates a paper when the migration is re-run", async () => {
    await actAsService(db);
    const before = Number(await scalar(db, `select count(*) from public.exam_marks`));
    const sql = (await import("node:fs")).readFileSync(
      (await import("node:path")).join(process.cwd(), "supabase", "migrations", "20261215000000_exam_marks_distribution.sql"),
      "utf8",
    );
    await db.exec(`reset role;`);
    await db.exec(sql);
    await actAsService(db);
    expect(Number(await scalar(db, `select count(*) from public.exam_marks`))).toBe(before);
  });

  it("is readable by the public for published courses and writable only by managers", async () => {
    await actAs(db, null, "anon");
    const publicRows = await rows(db, `select id from public.exam_marks where course_id = $1`, [bcsId]);
    expect(publicRows.length).toBeGreaterThan(0);

    // A student's update is filtered by RLS: zero rows change, nothing leaks.
    await actAs(db, STUDENT);
    await db.query(`update public.exam_marks set total_marks = 999 where course_id = $1`, [bcsId]);
    expect(
      Number(await scalar(db, `select count(*) from public.exam_marks where course_id = $1 and total_marks = 999`, [bcsId])),
    ).toBe(0);

    await actAs(db, ADMIN);
    await db.query(`update public.exam_marks set note_bn = 'এডিট' where course_id = $1 and stage = 'viva'`, [bcsId]);
    await actAs(db, null, "anon");
    const [edited] = await rows<{ note_bn: string }>(
      db, `select note_bn from public.exam_marks where course_id = $1 and stage = 'viva'`, [bcsId],
    );
    expect(edited.note_bn).toBe("এডিট");
  });
});
