import { describe, expect, it, beforeAll } from "vitest";
import { actAsService, createDatabase, migrate, rows, scalar } from "./harness";
import type { PGlite } from "@electric-sql/pglite";

let db: PGlite;
beforeAll(async () => {
  db = await createDatabase();
  await migrate(db);
});

describe("seed catalogue", () => {
  it("creates 8 published courses", async () => {
    await actAsService(db);
    const n = await scalar<number>(db, `select count(*)::int from public.courses where status='published'`);
    expect(n).toBe(8);
  });

  it("preserves the 10 BCS subjects in order", async () => {
    await actAsService(db);
    const subs = await rows<{ title_bn: string }>(
      db,
      `select su.title_bn from public.subjects su join public.courses c on c.id=su.course_id
       where c.slug='bcs' order by su.sort_order`,
    );
    expect(subs.map((s) => s.title_bn)).toEqual([
      "বাংলা ভাষা ও সাহিত্য",
      "English Language & Literature",
      "বাংলাদেশ বিষয়াবলি",
      "আন্তর্জাতিক বিষয়াবলি",
      "ভূগোল, পরিবেশ ও দুর্যোগ",
      "সাধারণ বিজ্ঞান",
      "কম্পিউটার ও তথ্যপ্রযুক্তি",
      "গাণিতিক যুক্তি",
      "মানসিক দক্ষতা",
      "নৈতিকতা, মূল্যবোধ ও সুশাসন",
    ]);
  });

  it("preserves the 15 EEE subjects", async () => {
    await actAsService(db);
    const n = await scalar<number>(
      db,
      `select count(*)::int from public.subjects su join public.courses c on c.id=su.course_id where c.slug='eee'`,
    );
    expect(n).toBe(15);
  });

  it("keeps the subject -> topic -> subtopic hierarchy populated", async () => {
    await actAsService(db);
    expect(await scalar<number>(db, `select count(*)::int from public.topics`)).toBeGreaterThanOrEqual(200);
    expect(await scalar<number>(db, `select count(*)::int from public.subtopics`)).toBeGreaterThanOrEqual(100);
    const orphans = await scalar<number>(
      db,
      `select count(*)::int from public.topics t where not exists (select 1 from public.subjects s where s.id=t.subject_id)`,
    );
    expect(orphans).toBe(0);
  });
});

describe("seed content", () => {
  it("seeds editorial questions as pending_review and unverified", async () => {
    await actAsService(db);
    const total = await scalar<number>(db, `select count(*)::int from public.questions`);
    expect(total).toBeGreaterThanOrEqual(48);
    const approved = await scalar<number>(db, `select count(*)::int from public.questions where status='approved'`);
    expect(approved).toBe(0);
    const verified = await scalar<number>(db, `select count(*)::int from public.questions where is_verified`);
    expect(verified).toBe(0);
  });

  it("attaches every question to a subject and a topic", async () => {
    await actAsService(db);
    const unlinked = await scalar<number>(
      db,
      `select count(*)::int from public.questions where subject_id is null or topic_id is null`,
    );
    expect(unlinked).toBe(0);
  });

  it("publishes no exams", async () => {
    await actAsService(db);
    expect(await scalar<number>(db, `select count(*)::int from public.exam_schedules`)).toBe(0);
  });

  it("remains idempotent on re-run", async () => {
    await actAsService(db);
    const before = await scalar<number>(db, `select count(*)::int from public.questions`);
    await migrate(db);
    const after = await scalar<number>(db, `select count(*)::int from public.questions`);
    expect(after).toBe(before);
  });
});
