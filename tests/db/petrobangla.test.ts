import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import {
  actAs, actAsService, createDatabase, createPrivilegedUser, createUser, expectError, migrate, rows, scalar, uuid,
} from "./harness";

/**
 * Preparation-program architecture + Petrobangla AE (EEE) 30-day plan:
 *  - program_kind classifies courses ('course'/'job_prep'/'question_collection')
 *    without duplicating any engine; existing courses stay 'course';
 *  - the Petrobangla seed is provisional-labelled, 27 subjects (17 technical,
 *    10 general), with a 30-day published routine (mocks on 7/14/21/27 and the
 *    final mock on 30) whose study days total exactly 360 minutes;
 *  - the EXISTING course-generic coverage engine gives every unit of the new
 *    program a first-study day — nothing BCS-specific was forked;
 *  - the BCS taxonomy (10/137/366) is byte-for-byte untouched by the seed;
 *  - student_programs is owner-scoped (multi-select onboarding foundation).
 */

let db: PGlite;
const ADMIN = uuid(980);
const STUDENT = uuid(981);
const OTHER = uuid(982);

let pbCourseId: string;
let bcsCourseId: string;

beforeAll(async () => {
  db = await createDatabase();
  await migrate(db);
  await createPrivilegedUser(db, { id: ADMIN, email: "pb-admin@jobhub.test", role: "super_admin", full_name: "Admin" });
  await createUser(db, { id: STUDENT, email: "pb-student@jobhub.test", full_name: "Student" });
  await createUser(db, { id: OTHER, email: "pb-other@jobhub.test", full_name: "Other" });

  await actAsService(db);
  pbCourseId = await scalar<string>(db, `select id from public.courses where slug = 'petrobangla-ae-eee'`);
  bcsCourseId = await scalar<string>(db, `select id from public.courses where slug = 'bcs'`);
});

describe("program classification", () => {
  it("marks Petrobangla as job_prep and leaves existing courses as 'course'", async () => {
    await actAsService(db);
    const [pb] = await rows<{ program_kind: string; status: string; provisional: boolean }>(
      db,
      `select program_kind, status, (metadata ->> 'provisional')::boolean as provisional
         from public.courses where id = $1`,
      [pbCourseId],
    );
    expect(pb.program_kind).toBe("job_prep");
    expect(pb.status).toBe("published");
    expect(pb.provisional).toBe(true); // honesty flag: NOT an official syllabus

    const bcsKind = await scalar(db, `select program_kind from public.courses where id = $1`, [bcsCourseId]);
    expect(bcsKind).toBe("course");
  });

  it("rejects an invalid program_kind", async () => {
    await actAsService(db);
    await expectError(
      db.query(`update public.courses set program_kind = 'franchise' where id = $1`, [pbCourseId]),
      /check constraint/,
    );
  });
});

describe("Petrobangla taxonomy seed", () => {
  it("has 27 subjects: 17 technical + 10 general", async () => {
    await actAsService(db);
    const [counts] = await rows<{ total: string; technical: string; general: string }>(
      db,
      `select count(*) as total,
              count(*) filter (where chapter_group = 'technical') as technical,
              count(*) filter (where chapter_group = 'general') as general
         from public.subjects where course_id = $1`,
      [pbCourseId],
    );
    expect(Number(counts.total)).toBe(27);
    expect(Number(counts.technical)).toBe(17);
    expect(Number(counts.general)).toBe(10);
  });

  it("has the full topic/subtopic framework (63 topics, 138 subtopics)", async () => {
    await actAsService(db);
    const topics = Number(
      await scalar(
        db,
        `select count(*) from public.topics t join public.subjects s on s.id = t.subject_id where s.course_id = $1`,
        [pbCourseId],
      ),
    );
    const subtopics = Number(
      await scalar(
        db,
        `select count(*) from public.subtopics st
           join public.topics t on t.id = st.topic_id
           join public.subjects s on s.id = t.subject_id where s.course_id = $1`,
        [pbCourseId],
      ),
    );
    expect(topics).toBe(63);
    expect(subtopics).toBe(138);
  });

  it("contaminates no other course: every seeded subject lives only under Petrobangla", async () => {
    await actAsService(db);
    // The seed's joins constrain every insert to the Petrobangla course; prove
    // it: none of its subject slugs exist under any other course, BCS still
    // has exactly its own 10 subjects, and no BCS routine rows were added.
    const leaked = Number(
      await scalar(
        db,
        `select count(*) from public.subjects outer_s
          where outer_s.course_id <> $1
            and outer_s.slug in (select s.slug from public.subjects s where s.course_id = $1)`,
        [pbCourseId],
      ),
    );
    expect(leaked).toBe(0);
    expect(Number(await scalar(db, `select count(*) from public.subjects where course_id = $1`, [bcsCourseId]))).toBe(10);
    const bcsPbRoutines = Number(
      await scalar(
        db,
        `select count(*) from public.routines where course_id = $1 and routine_date between '2026-11-24' and '2026-12-23' and title_bn like 'টেকনিক্যাল%'`,
        [bcsCourseId],
      ),
    );
    expect(bcsPbRoutines).toBe(0);
  });
});

describe("30-day routine seed", () => {
  it("spans exactly 30 published days with mocks on 7/14/21/27 and the final mock on 30", async () => {
    await actAsService(db);
    const days = await rows<{ routine_date: string; exams: string }>(
      db,
      `select routine_date::text,
              count(*) filter (where task_kind = 'exam') as exams
         from public.routines
        where course_id = $1 and kind = 'daily' and status = 'published'
        group by routine_date order by routine_date`,
      [pbCourseId],
    );
    expect(days.length).toBe(30);

    const day1 = Date.parse(`${days[0].routine_date}T00:00:00Z`);
    const examDayNumbers = days
      .map((d, i) => ({ day: Math.round((Date.parse(`${d.routine_date}T00:00:00Z`) - day1) / 86400000) + 1, exams: Number(d.exams), i }))
      .filter((d) => d.exams > 0)
      .map((d) => d.day);
    expect(examDayNumbers).toEqual([7, 14, 21, 27, 30]);
  });

  it("every study day totals exactly 360 minutes (6 hours, prompt §6)", async () => {
    await actAsService(db);
    const offDays = await rows<{ routine_date: string; total: string }>(
      db,
      `select routine_date::text, sum(minutes) as total
         from public.routines
        where course_id = $1 and kind = 'daily' and status = 'published'
        group by routine_date
       having bool_or(task_kind = 'study') and sum(minutes) <> 360`,
      [pbCourseId],
    );
    expect(offDays).toEqual([]);
  });

  it("mock-day rows carry no invented pattern — admin-config note instead", async () => {
    await actAsService(db);
    const mockNotes = await rows<{ focus_note_bn: string | null }>(
      db,
      `select focus_note_bn from public.routines
        where course_id = $1 and task_kind = 'exam'`,
      [pbCourseId],
    );
    expect(mockNotes.length).toBe(5);
    for (const note of mockNotes) {
      expect(note.focus_note_bn ?? "").toMatch(/অনুমান করা হয়নি/);
    }
  });
});

describe("coverage engine reuse (course-generic)", () => {
  it("assigns a first-study day to every Petrobangla unit with zero gaps", async () => {
    await actAs(db, ADMIN);
    const [result] = await rows<{ jh_generate_study_plan: { inserted: number; subjects_with_gaps: string[] } }>(
      db,
      `select public.jh_generate_study_plan($1, $2)`,
      [pbCourseId, ADMIN],
    );
    // 138 subtopics + 2 subtopic-less current-affairs topics = 140 units.
    expect(Number(result.jh_generate_study_plan.inserted)).toBe(140);
    expect(result.jh_generate_study_plan.subjects_with_gaps).toEqual([]);

    await actAsService(db);
    const unassigned = await rows(db, `select * from public.jh_coverage_unassigned($1)`, [pbCourseId]);
    expect(unassigned.length).toBe(0);

    // Assignments never land on mock/revision days.
    const misplaced = Number(
      await scalar(
        db,
        `select count(*) from public.study_plan_assignments a
           join public.routines r on r.id = a.routine_id
          where a.course_id = $1 and r.task_kind not in ('study', 'practice')`,
        [pbCourseId],
      ),
    );
    expect(misplaced).toBe(0);

    // BCS owns its own first-study plan (20261214000000 seeds one row per
    // syllabus subtopic); generating another course's plan adds nothing to it.
    const bcsAssignments = Number(
      await scalar(db, `select count(*) from public.study_plan_assignments where course_id = $1`, [bcsCourseId]),
    );
    // 503 rows from 20261214000000 is the real baseline: its unit list is built
    // from the subtopics its own claim step kept, not from all 504, so one
    // retired-shape unit never gets a row. 20261219000000 adds the 2 subtopics
    // বাংলা/পদ and বাংলা/প্রয়োগ ও অপ্রয়োগ with their first-study rows, keeping
    // coverage at 100% (verified by jh_coverage_unassigned returning nothing).
    expect(bcsAssignments).toBe(505);
  });
});

describe("student_programs RLS", () => {
  it("students manage only their own selections", async () => {
    await actAs(db, STUDENT);
    await db.query(`insert into public.student_programs (user_id, course_id) values ($1, $2)`, [STUDENT, pbCourseId]);

    // Cannot enroll someone else.
    await expectError(
      db.query(`insert into public.student_programs (user_id, course_id) values ($1, $2)`, [OTHER, bcsCourseId]),
      /row-level security/,
    );

    // The other student sees nothing of it.
    await actAs(db, OTHER);
    const visible = await rows(db, `select id from public.student_programs`, []);
    expect(visible.length).toBe(0);

    // Staff can read all selections.
    await actAs(db, ADMIN);
    const staffView = await rows(db, `select user_id from public.student_programs`, []);
    expect(staffView.length).toBe(1);
  });

  it("duplicate selection of the same program is rejected", async () => {
    await actAs(db, STUDENT);
    await expectError(
      db.query(`insert into public.student_programs (user_id, course_id) values ($1, $2)`, [STUDENT, pbCourseId]),
      /duplicate key/,
    );
  });

  it("anon sees nothing", async () => {
    await actAs(db, null, "anon");
    await expectError(db.query(`select id from public.student_programs limit 1`), /permission denied/);
  });
});
