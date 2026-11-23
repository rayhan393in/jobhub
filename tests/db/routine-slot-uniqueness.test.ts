import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { actAsService, createDatabase, expectError, migrate, scalar, uuid } from "./harness";

/**
 * Migration 20261204000000 — routine slot uniqueness.
 *
 * The rebuilt course-wise routine legitimately needs:
 *   * the same subject in SEVERAL time slots of one day (technical deep work:
 *     morning + afternoon + night), and
 *   * more than one course-level row (subject_id null) on the same date
 *     (final days: model test + ভুল বিশ্লেষণ).
 *
 * The key is (course, kind, date, subject, topic, slot_label) NULLS NOT
 * DISTINCT: repeating the SAME slot is still an accidental double-insert and
 * must fail.
 */

const COURSE = uuid(700);
const SUBJECT = uuid(701);

let db: PGlite;

beforeAll(async () => {
  db = await createDatabase();
  await migrate(db);
  await actAsService(db);
  await db.exec(`
    insert into public.courses (id, slug, title_en, title_bn, status)
    values ('${COURSE}', 'slot-course', 'Slot Course', 'স্লট কোর্স', 'published');
    insert into public.subjects (id, course_id, slug, title_en, title_bn)
    values ('${SUBJECT}', '${COURSE}', 'machines', 'Machines', 'মেশিন');
  `);
});

describe("routine slot uniqueness", () => {
  it("allows the same subject in multiple slots of the same day", async () => {
    await db.exec(`
      insert into public.routines (course_id, kind, routine_date, title_bn, subject_id, task_kind, status, slot_label, minutes)
      values ('${COURSE}', 'daily', '2026-12-01', 'মেশিন — সকাল', '${SUBJECT}', 'study', 'published', 'সকাল ৯:০০–১০:৩০', 90),
             ('${COURSE}', 'daily', '2026-12-01', 'মেশিন — দুপুর', '${SUBJECT}', 'study', 'published', 'দুপুর ১২:০০–১:৩০', 90),
             ('${COURSE}', 'daily', '2026-12-01', 'মেশিন — রাত', '${SUBJECT}', 'study', 'published', 'রাত ৮:০০–৯:৩০', 90);
    `);
    const count = await scalar<number>(
      db,
      `select count(*)::int from public.routines where course_id = '${COURSE}' and routine_date = '2026-12-01'`,
    );
    expect(count).toBe(3);
  });

  it("allows two course-level rows (null subject) on one date in different slots", async () => {
    await db.exec(`
      insert into public.routines (course_id, kind, routine_date, title_bn, task_kind, status, slot_label, minutes)
      values ('${COURSE}', 'daily', '2026-12-20', 'পূর্ণাঙ্গ মডেল টেস্ট', 'exam', 'published', 'সকাল ৯:০০–১২:০০', 180),
             ('${COURSE}', 'daily', '2026-12-20', 'ভুল বিশ্লেষণ', 'revision', 'published', 'বিকাল ৪:০০–৬:০০', 120);
    `);
    const count = await scalar<number>(
      db,
      `select count(*)::int from public.routines where course_id = '${COURSE}' and routine_date = '2026-12-20'`,
    );
    expect(count).toBe(2);
  });

  it("still rejects an exact duplicate of a slot", async () => {
    await expectError(
      db.exec(`
        insert into public.routines (course_id, kind, routine_date, title_bn, subject_id, task_kind, status, slot_label, minutes)
        values ('${COURSE}', 'daily', '2026-12-01', 'মেশিন — সকাল (ডুপ্লিকেট)', '${SUBJECT}', 'study', 'published', 'সকাল ৯:০০–১০:৩০', 90);
      `),
      /duplicate key|unique/i,
    );
  });

  it("deduplicates all-null slot rows (NULLS NOT DISTINCT survives the rebuild)", async () => {
    await db.exec(`
      insert into public.routines (course_id, kind, routine_date, title_bn, task_kind, status, minutes)
      values ('${COURSE}', 'daily', '2026-12-25', 'বিশ্রাম', 'rest', 'published', 30);
    `);
    await expectError(
      db.exec(`
        insert into public.routines (course_id, kind, routine_date, title_bn, task_kind, status, minutes)
        values ('${COURSE}', 'daily', '2026-12-25', 'বিশ্রাম আবার', 'rest', 'published', 30);
      `),
      /duplicate key|unique/i,
    );
  });
});
