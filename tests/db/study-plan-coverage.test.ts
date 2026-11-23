import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import {
  actAs, actAsService, createDatabase, createPrivilegedUser, expectError, migrate, rows, scalar, uuid,
} from "./harness";

/**
 * Subtopic-level coverage engine (master-prompt Phase 3–4), DB side:
 *  - a "unit" is every subtopic plus every topic without subtopics — the
 *    coverage summary must account for 100% of them, nothing invented;
 *  - jh_generate_study_plan places every unit on a REAL published study day
 *    of its own subject, refuses to run without a published routine, and
 *    never overwrites existing assignments (admin edits survive re-runs);
 *  - the unique index makes a second first-study row for the same unit
 *    impossible — revision rows can never masquerade as first-study;
 *  - jh_coverage_unassigned returns the exact missing items (publish block);
 *  - jh_coverage_integrity flags syllabus-reference mismatches;
 *  - permission: students can read the plan but cannot write or generate.
 */

let db: PGlite;
const ADMIN = uuid(970);
const STUDENT = uuid(971);

let courseId: string;
let subjectIds: string[] = [];
let expectedUnits = 0;
let expectedSubtopics = 0;

beforeAll(async () => {
  db = await createDatabase();
  await migrate(db);
  await createPrivilegedUser(db, { id: ADMIN, email: "cov-admin@jobhub.test", role: "super_admin", full_name: "Admin" });
  await createPrivilegedUser(db, { id: STUDENT, email: "cov-student@jobhub.test", role: "student", full_name: "Student" });

  await actAsService(db);
  courseId = await scalar<string>(db, `select id from public.courses where slug = 'bcs'`);
  subjectIds = (
    await rows<{ id: string }>(db, `select id from public.subjects where course_id = $1 order by sort_order`, [courseId])
  ).map((row) => row.id);

  // Ground truth from the seeded taxonomy itself — never hardcoded.
  expectedSubtopics = Number(
    await scalar(
      db,
      `select count(*) from public.subtopics st
        join public.topics t on t.id = st.topic_id
        join public.subjects s on s.id = t.subject_id
       where s.course_id = $1`,
      [courseId],
    ),
  );
  expectedUnits =
    expectedSubtopics +
    Number(
      await scalar(
        db,
        `select count(*) from public.topics t
          join public.subjects s on s.id = t.subject_id
         where s.course_id = $1
           and not exists (select 1 from public.subtopics st where st.topic_id = t.id)`,
        [courseId],
      ),
    );
});

describe("jh_coverage_summary — before any assignment", () => {
  it("counts every subtopic and every subtopic-less topic as an unassigned unit", async () => {
    await actAsService(db);
    const summary = await rows<{ units_total: string; units_assigned: string; units_unassigned: string }>(
      db,
      `select * from public.jh_coverage_summary($1)`,
      [courseId],
    );
    const units = summary.reduce((sum, row) => sum + Number(row.units_total), 0);
    const assigned = summary.reduce((sum, row) => sum + Number(row.units_assigned), 0);
    expect(units).toBe(expectedUnits);
    expect(units).toBeGreaterThanOrEqual(expectedSubtopics);
    expect(assigned).toBe(0);
  });
});

describe("jh_generate_study_plan", () => {
  it("refuses to run when the course has no published daily routine", async () => {
    await actAs(db, ADMIN);
    await expectError(
      db.query(`select public.jh_generate_study_plan($1, $2)`, [courseId, ADMIN]),
      /প্রকাশিত দৈনিক রুটিন নেই/,
    );
  });

  it("is forbidden for students", async () => {
    await actAs(db, STUDENT);
    await expectError(
      db.query(`select public.jh_generate_study_plan($1, $2)`, [courseId, STUDENT]),
      /routine.manage permission required/,
    );
  });

  it("assigns every unit to a real published study day of its own subject", async () => {
    // One published study day per subject (D1..Dn), plus a revision day and a
    // draft day that must NOT receive first-study assignments.
    await actAsService(db);
    for (let index = 0; index < subjectIds.length; index += 1) {
      const date = new Date(Date.UTC(2026, 10, 23 + index)).toISOString().slice(0, 10);
      await db.query(
        `insert into public.routines (course_id, kind, routine_date, title_bn, subject_id, task_kind, status, created_by)
         values ($1,'daily',$2,'অধ্যয়ন',$3,'study','published',$4)`,
        [courseId, date, subjectIds[index], ADMIN],
      );
    }
    await db.query(
      `insert into public.routines (course_id, kind, routine_date, title_bn, subject_id, task_kind, status, created_by)
       values ($1,'daily','2026-12-20','রিভিশন',$2,'revision','published',$3)`,
      [courseId, subjectIds[0], ADMIN],
    );
    await db.query(
      `insert into public.routines (course_id, kind, routine_date, title_bn, subject_id, task_kind, status, created_by)
       values ($1,'daily','2026-12-21','খসড়া',$2,'study','draft',$3)`,
      [courseId, subjectIds[0], ADMIN],
    );

    await actAs(db, ADMIN);
    const [result] = await rows<{ jh_generate_study_plan: { inserted: number; subjects_with_gaps: string[] } }>(
      db,
      `select public.jh_generate_study_plan($1, $2)`,
      [courseId, ADMIN],
    );
    expect(Number(result.jh_generate_study_plan.inserted)).toBe(expectedUnits);
    expect(result.jh_generate_study_plan.subjects_with_gaps).toEqual([]);

    await actAsService(db);
    // Full coverage, zero unassigned.
    const unassigned = await rows(db, `select * from public.jh_coverage_unassigned($1)`, [courseId]);
    expect(unassigned.length).toBe(0);

    // Every assignment sits on a published STUDY day of its own subject —
    // never the revision day, never the draft day.
    const misplaced = Number(
      await scalar(
        db,
        `select count(*) from public.study_plan_assignments a
          left join public.routines r on r.id = a.routine_id
         where a.course_id = $1
           and (r.id is null or r.status <> 'published'
                or r.task_kind not in ('study','practice')
                or r.subject_id <> a.subject_id
                or r.routine_date <> a.first_study_date)`,
        [courseId],
      ),
    );
    expect(misplaced).toBe(0);

    // No syllabus-reference mismatches.
    const integrity = await rows(db, `select * from public.jh_coverage_integrity($1)`, [courseId]);
    expect(integrity.length).toBe(0);
  });

  it("re-running inserts nothing and keeps existing assignments untouched", async () => {
    await actAs(db, ADMIN);
    const before = await scalar(db, `select count(*) from public.study_plan_assignments where course_id = $1`, [courseId]);
    const [result] = await rows<{ jh_generate_study_plan: { inserted: number } }>(
      db,
      `select public.jh_generate_study_plan($1, $2)`,
      [courseId, ADMIN],
    );
    expect(Number(result.jh_generate_study_plan.inserted)).toBe(0);
    const after = await scalar(db, `select count(*) from public.study_plan_assignments where course_id = $1`, [courseId]);
    expect(after).toEqual(before);
  });
});

describe("first-study uniqueness — revision can never double-count", () => {
  it("rejects a second first-study row for the same subtopic", async () => {
    await actAsService(db);
    const existing = await rows<{ subject_id: string; topic_id: string; subtopic_id: string | null; routine_id: string }>(
      db,
      `select subject_id, topic_id, subtopic_id, routine_id
         from public.study_plan_assignments where course_id = $1 and subtopic_id is not null limit 1`,
      [courseId],
    );
    await expectError(
      db.query(
        `insert into public.study_plan_assignments
           (course_id, subject_id, topic_id, subtopic_id, routine_id, plan_day, first_study_date)
         values ($1,$2,$3,$4,$5, 59, '2027-01-20')`,
        [courseId, existing[0].subject_id, existing[0].topic_id, existing[0].subtopic_id, existing[0].routine_id],
      ),
      /duplicate key/,
    );
  });

  it("rejects a second first-study row for the same subtopic-less topic", async () => {
    await actAsService(db);
    const existing = await rows<{ subject_id: string; topic_id: string }>(
      db,
      `select subject_id, topic_id
         from public.study_plan_assignments where course_id = $1 and subtopic_id is null limit 1`,
      [courseId],
    );
    if (existing.length === 0) return; // taxonomy has no subtopic-less topics
    await expectError(
      db.query(
        `insert into public.study_plan_assignments
           (course_id, subject_id, topic_id, subtopic_id, plan_day, first_study_date)
         values ($1,$2,$3,null, 59, '2027-01-20')`,
        [courseId, existing[0].subject_id, existing[0].topic_id],
      ),
      /duplicate key/,
    );
  });
});

describe("jh_coverage_unassigned — the exact publish-blocking list", () => {
  it("names the precise unit after an assignment is deleted", async () => {
    await actAsService(db);
    const [victim] = await rows<{ id: string; topic_id: string; subtopic_id: string | null }>(
      db,
      `select id, topic_id, subtopic_id from public.study_plan_assignments
        where course_id = $1 and subtopic_id is not null limit 1`,
      [courseId],
    );
    await db.query(`delete from public.study_plan_assignments where id = $1`, [victim.id]);

    const missing = await rows<{ topic_id: string; subtopic_id: string | null }>(
      db,
      `select * from public.jh_coverage_unassigned($1)`,
      [courseId],
    );
    expect(missing.length).toBe(1);
    expect(missing[0].topic_id).toBe(victim.topic_id);
    expect(missing[0].subtopic_id).toBe(victim.subtopic_id);

    // Restore full coverage for later tests.
    await actAs(db, ADMIN);
    await db.query(`select public.jh_generate_study_plan($1, $2)`, [courseId, ADMIN]);
    await actAsService(db);
    expect((await rows(db, `select * from public.jh_coverage_unassigned($1)`, [courseId])).length).toBe(0);
  });
});

describe("jh_coverage_integrity", () => {
  it("flags a topic-level assignment for a topic that actually has subtopics", async () => {
    await actAsService(db);
    const [row] = await rows<{ id: string; subject_id: string; topic_id: string }>(
      db,
      `select a.id, a.subject_id, a.topic_id from public.study_plan_assignments a
        where a.course_id = $1 and a.subtopic_id is not null limit 1`,
      [courseId],
    );
    // Corrupt it: drop the subtopic reference (bypassing the API guard).
    // Use a throwaway duplicate-safe update: delete+insert as topic-level.
    await db.query(`delete from public.study_plan_assignments where id = $1`, [row.id]);
    const subtopicLessConflict = await rows(
      db,
      `select 1 from public.study_plan_assignments
        where course_id = $1 and topic_id = $2 and subtopic_id is null`,
      [courseId, row.topic_id],
    );
    expect(subtopicLessConflict.length).toBe(0);
    await db.query(
      `insert into public.study_plan_assignments
         (course_id, subject_id, topic_id, subtopic_id, plan_day, first_study_date)
       values ($1,$2,$3,null, 1, '2026-11-23')`,
      [courseId, row.subject_id, row.topic_id],
    );

    const issues = await rows<{ problem: string }>(db, `select * from public.jh_coverage_integrity($1)`, [courseId]);
    expect(issues.some((issue) => /topic-level assignment/.test(issue.problem))).toBe(true);

    // Clean up and restore.
    await db.query(
      `delete from public.study_plan_assignments
        where course_id = $1 and topic_id = $2 and subtopic_id is null`,
      [courseId, row.topic_id],
    );
    await actAs(db, ADMIN);
    await db.query(`select public.jh_generate_study_plan($1, $2)`, [courseId, ADMIN]);
  });
});

describe("jh_sync_routine_scope — routines mirror the allocation", () => {
  it("writes the assigned topic/subtopic ids onto each routine row", async () => {
    await actAsService(db);
    const mismatches = Number(
      await scalar(
        db,
        `select count(*) from public.routines r
          where r.course_id = $1
            and exists (select 1 from public.study_plan_assignments a where a.routine_id = r.id)
            and (
              coalesce(cardinality(r.subtopic_ids), 0) <>
                (select count(distinct a.subtopic_id) from public.study_plan_assignments a
                  where a.routine_id = r.id and a.subtopic_id is not null)
              or coalesce(cardinality(r.topic_ids), 0) <>
                (select count(distinct a.topic_id) from public.study_plan_assignments a
                  where a.routine_id = r.id)
            )`,
        [courseId],
      ),
    );
    expect(mismatches).toBe(0);
  });

  it("is forbidden for students", async () => {
    await actAs(db, STUDENT);
    await expectError(
      db.query(`select public.jh_sync_routine_scope($1, null)`, [courseId]),
      /routine.manage permission required/,
    );
  });
});

describe("RLS on study_plan_assignments", () => {
  it("students can read the plan but cannot write it", async () => {
    await actAs(db, STUDENT);
    const visible = await rows(db, `select id from public.study_plan_assignments limit 5`, []);
    expect(visible.length).toBeGreaterThan(0);

    const [any] = await rows<{ id: string }>(db, `select id from public.study_plan_assignments limit 1`, []);
    const updated = await db.query(
      `update public.study_plan_assignments set minutes = 60 where id = $1`,
      [any.id],
    );
    expect(updated.affectedRows ?? 0).toBe(0);
  });

  it("anon sees nothing", async () => {
    await actAs(db, null, "anon");
    await expectError(db.query(`select id from public.study_plan_assignments limit 1`), /permission denied/);
  });
});
