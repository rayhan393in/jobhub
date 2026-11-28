/**
 * The 90-day BCS routine (data/bcs-routine/bcs-routine-90day.sql) must:
 *   * land 360 published rows — 4 slots × 90 days — with the slot minutes the
 *     spec fixes (150 / 75 / 45 / 50);
 *   * resolve each row's subject through subjects.slug, not a title guess, on
 *     the LIVE BCS titles (বাংলা ভাষা ও সাহিত্য, English Language & Literature,
 *     ভূগোল, পরিবেশ ও দুর্যোগ …), which do not match the short routine labels;
 *   * be re-runnable without duplicating a row;
 *   * archive the previous routine rather than deleting rows a progress record
 *     still points at, and delete only genuinely unreferenced ones.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createDatabase, migrate } from "./harness";

const SQL = readFileSync(
  path.join(process.cwd(), "data", "bcs-routine", "bcs-routine-90day.sql"),
  "utf8",
);

type Counts = { rows: number; days: number; subjects: number; minutes: number };

async function snapshot(db: { query: (sql: string) => Promise<{ rows: unknown[] }> }) {
  const { rows } = await db.query(`
    select count(*)::int as rows,
           count(distinct r.routine_date)::int as days,
           count(distinct r.subject_id)::int as subjects,
           coalesce(sum(r.minutes), 0)::int as minutes
    from public.routines r
    join public.courses c on c.id = r.course_id
    where c.slug = 'bcs' and r.status = 'published' and r.archived_at is null
  `);
  return rows[0] as Counts;
}

describe("90-day BCS routine", () => {
  it("lands 4 slots × 90 days and resolves subjects by slug", async () => {
    const db = await createDatabase();
    await migrate(db);
    await db.exec(SQL);

    const counts = await snapshot(db as never);
    expect(counts.rows).toBe(360);
    expect(counts.days).toBe(90);
    // 10 subject slugs appear somewhere in the 90 days (mixed rows have none).
    expect(counts.subjects).toBe(10);

    // Minutes per band, straight from the spec.
    const { rows: bands } = await db.query<{ slot: string; n: number; minutes: number }>(`
      select split_part(r.slot_label, ' ·', 1) as slot, count(*)::int as n, min(r.minutes)::int as minutes
      from public.routines r
      join public.courses c on c.id = r.course_id
      where c.slug = 'bcs'
      group by 1 order by 1
    `);
    const bySlot = new Map(bands.map((b) => [b.slot, b]));
    expect(bySlot.get("P1 Main")).toMatchObject({ n: 90, minutes: 150 });
    expect(bySlot.get("P2 Second")).toMatchObject({ n: 90, minutes: 75 });
    expect(bySlot.get("P3/P4 Third")).toMatchObject({ n: 90, minutes: 45 });
    expect(bySlot.get("MCQ ও ভুল বিশ্লেষণ")).toMatchObject({ n: 90, minutes: 50 });

    // Day 1 = 2026-11-28 and the last day = 2027-02-25.
    const { rows: span } = await db.query<{ first: string; last: string }>(`
      select min(routine_date)::text as first, max(routine_date)::text as last
      from public.routines r join public.courses c on c.id = r.course_id
      where c.slug = 'bcs'
    `);
    expect(span[0]).toEqual({ first: "2026-11-28", last: "2027-02-25" });

    // Day 1's P2 slot is English Voice — a real English subject_id, not বাংলা.
    const { rows: day1 } = await db.query<{ title_bn: string; subject: string | null }>(`
      select r.title_bn, su.slug as subject
      from public.routines r
      join public.courses c on c.id = r.course_id
      left join public.subjects su on su.id = r.subject_id
      where c.slug = 'bcs' and r.routine_date = '2026-11-28'
        and r.slot_label like 'P2 Second%'
    `);
    expect(day1[0].subject).toBe("english");
    expect(day1[0].title_bn).toContain("Voice");
  });

  it("is idempotent on re-run, archiving referenced rows and deleting only orphans", async () => {
    const db = await createDatabase();
    await migrate(db);
    await db.exec(SQL);
    const first = await snapshot(db as never);
    await db.exec(SQL);
    expect(await snapshot(db as never)).toEqual(first);

    // Two stale rows outside the 90-day set: one referenced by a published
    // exam, one referenced by nothing.
    await db.exec(`
      reset role;
      insert into public.routines (course_id, kind, routine_date, title_bn, status, slot_label)
      select id, 'daily', '2026-11-01', 'পুরোনো · রেফারেন্সড', 'published', 'পুরোনো স্লট'
        from public.courses where slug = 'bcs';
      insert into public.routines (course_id, kind, routine_date, title_bn, status, slot_label)
      select id, 'daily', '2026-11-02', 'পুরোনো · এতিম', 'published', 'পুরোনো স্লট'
        from public.courses where slug = 'bcs';

      insert into public.exam_schedules
        (course_id, kind, title_en, title_bn, starts_at, ends_at, result_release_at,
         duration_minutes, question_count, total_marks, status, routine_id)
      select r.course_id, 'daily_live', 'stale', 'stale', '2026-11-01T11:00:00Z',
             '2026-11-01T12:00:00Z', '2026-11-01T12:30:00Z', 60, 100, 100, 'published', r.id
        from public.routines r where r.title_bn = 'পুরোনো · রেফারেন্সড';
    `);

    await db.exec(SQL);

    const { rows: stale } = await db.query<{ title_bn: string; status: string }>(`
      select title_bn, status from public.routines
       where title_bn in ('পুরোনো · রেফারেন্সড', 'পুরোনো · এতিম') order by title_bn
    `);
    // The referenced row survives as archived; the orphan is gone.
    expect(stale).toEqual([{ title_bn: "পুরোনো · রেফারেন্সড", status: "archived" }]);

    // And the fresh 90-day rows are all published.
    expect((await snapshot(db as never)).rows).toBe(360);
  });
});
