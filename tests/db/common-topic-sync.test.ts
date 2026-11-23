import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  actAs, actAsService, createDatabase, createPrivilegedUser, createUser,
  expectError, migrate, rows, scalar, uuid,
} from "./harness";

/**
 * Common-topic synchronization across preparation routines.
 *
 * Master-prompt rule: same common topics → same study day; different
 * specialized topics → separate study schedules. Commonality is defined
 * ONLY by canonical taxonomy links, never by name similarity, and moves
 * only land on already-published study slots — nothing is invented.
 */

const ADMIN = uuid(90);
const STUDENT = uuid(91);

// Fixture ids (stable for assertions).
const C1 = uuid(101); // "alpha" course
const C2 = uuid(102); // "beta" course
const S1_EN = uuid(111); // alpha English  (canonical cs-english)
const S2_EN = uuid(112); // beta English   (canonical cs-english)
const S2_SP = uuid(113); // beta specialized subject (no canonical)
const T1_TENSE = uuid(121); // alpha Tense     -> lib-en-tense
const T2_TENSE = uuid(122); // beta TenseWork  -> lib-en-tense (different name!)
const T1_VOCAB = uuid(123); // alpha Vocabulary -> lib-en-vocabulary
const T2_VOCAB = uuid(124); // beta WordStock   -> lib-en-vocabulary
const T2_SPEC = uuid(125); // beta specialized topic (no canonical)
const R1_EN_D1 = uuid(131); // alpha english slot 2026-12-01
const R2_EN_D1 = uuid(132); // beta english slot 2026-12-01
const R2_EN_D3 = uuid(133); // beta english slot 2026-12-03
const R1_EN_D5 = uuid(134); // alpha english slot 2026-12-05
const R2_EN_D4 = uuid(135); // beta english slot 2026-12-04
const R2_SP_D2 = uuid(136); // beta specialized slot 2026-12-02
const S1_MA = uuid(114); // alpha Math (canonical cs-mathematics)
const S2_MA = uuid(115); // beta Math  (canonical cs-mathematics)
const T1_PCT = uuid(126); // alpha Percentage -> lib-math-percentage
const T2_PCT = uuid(127); // beta Shotkora    -> lib-math-percentage
const R1_MA_D4 = uuid(137); // alpha math slot 2026-12-04
const R1_MA_D6 = uuid(138); // alpha math slot 2026-12-06
const R2_MA_D2 = uuid(139); // beta math slot 2026-12-02
const R2_MA_D4 = uuid(140); // beta math slot 2026-12-04

let db: PGlite;

beforeAll(async () => {
  db = await createDatabase();
  await migrate(db);
  await createPrivilegedUser(db, { id: ADMIN, email: "sync-admin@jobhub.test", role: "super_admin", full_name: "Admin" });
  await createUser(db, { id: STUDENT, email: "sync-student@jobhub.test", full_name: "Student" });

  await actAsService(db);

  // Two independent courses.
  await db.exec(`
    insert into public.courses (id, slug, title_en, title_bn, status)
    values ('${C1}', 'sync-alpha', 'Alpha Prep', 'আলফা প্রস্তুতি', 'published'),
           ('${C2}', 'sync-beta',  'Beta Prep',  'বিটা প্রস্তুতি',  'published');

    -- English in BOTH courses, pointing at ONE canonical subject.
    insert into public.subjects (id, course_id, slug, title_en, title_bn, canonical_subject_id)
    values ('${S1_EN}', '${C1}', 'english', 'English', 'ইংরেজি',
            (select id from public.canonical_subjects where slug = 'cs-english')),
           ('${S2_EN}', '${C2}', 'english', 'English', 'ইংরেজি',
            (select id from public.canonical_subjects where slug = 'cs-english')),
           ('${S2_SP}', '${C2}', 'beta-machines', 'Beta Machines', 'বিটা মেশিনস', null),
           ('${S1_MA}', '${C1}', 'math', 'Math', 'গণিত',
            (select id from public.canonical_subjects where slug = 'cs-mathematics')),
           ('${S2_MA}', '${C2}', 'math', 'Math', 'গণিত',
            (select id from public.canonical_subjects where slug = 'cs-mathematics'));

    -- Canonically matching topics carry DIFFERENT display names on purpose:
    -- the link, not the name, is what makes them common.
    insert into public.topics (id, subject_id, slug, title_en, title_bn, canonical_id)
    values ('${T1_TENSE}', '${S1_EN}', 'tense',      'Tense',      'টেন্স',
            (select id from public.canonical_topics where slug = 'lib-en-tense')),
           ('${T2_TENSE}', '${S2_EN}', 'tense-work', 'Tense Work', 'টেন্স চর্চা',
            (select id from public.canonical_topics where slug = 'lib-en-tense')),
           ('${T1_VOCAB}', '${S1_EN}', 'vocabulary', 'Vocabulary', 'ভোকাবুলারি',
            (select id from public.canonical_topics where slug = 'lib-en-vocabulary')),
           ('${T2_VOCAB}', '${S2_EN}', 'word-stock', 'Word Stock', 'শব্দভাণ্ডার',
            (select id from public.canonical_topics where slug = 'lib-en-vocabulary')),
           ('${T2_SPEC}', '${S2_SP}', 'beta-only',  'Beta Only',  'শুধু বিটা', null),
           ('${T1_PCT}', '${S1_MA}', 'percentage', 'Percentage', 'শতকরা',
            (select id from public.canonical_topics where slug = 'lib-math-percentage')),
           ('${T2_PCT}', '${S2_MA}', 'shotkora',   'Shotkora',   'শতকরা অংক',
            (select id from public.canonical_topics where slug = 'lib-math-percentage'));

    -- Published routine skeletons (admin-made; the sync never invents these).
    insert into public.routines (id, course_id, kind, routine_date, title_bn, subject_id, task_kind, status)
    values ('${R1_EN_D1}', '${C1}', 'daily', '2026-12-01', 'ইংরেজি', '${S1_EN}', 'study', 'published'),
           ('${R2_EN_D1}', '${C2}', 'daily', '2026-12-01', 'ইংরেজি', '${S2_EN}', 'study', 'published'),
           ('${R2_EN_D3}', '${C2}', 'daily', '2026-12-03', 'ইংরেজি', '${S2_EN}', 'study', 'published'),
           ('${R1_EN_D5}', '${C1}', 'daily', '2026-12-05', 'ইংরেজি', '${S1_EN}', 'study', 'published'),
           ('${R2_EN_D4}', '${C2}', 'daily', '2026-12-04', 'ইংরেজি', '${S2_EN}', 'study', 'published'),
           ('${R2_SP_D2}', '${C2}', 'daily', '2026-12-02', 'বিটা মেশিনস', '${S2_SP}', 'study', 'published'),
           ('${R1_MA_D4}', '${C1}', 'daily', '2026-12-04', 'গণিত', '${S1_MA}', 'study', 'published'),
           ('${R1_MA_D6}', '${C1}', 'daily', '2026-12-06', 'গণিত', '${S1_MA}', 'study', 'published'),
           ('${R2_MA_D2}', '${C2}', 'daily', '2026-12-02', 'গণিত', '${S2_MA}', 'study', 'published'),
           ('${R2_MA_D4}', '${C2}', 'daily', '2026-12-04', 'গণিত', '${S2_MA}', 'study', 'published');

    -- First-study assignments:
    --  * Tense: alpha studies it 12-01, beta 12-03  -> beta CAN move (slot 12-01 exists).
    --  * Vocabulary: beta studies it 12-04, alpha 12-05 -> anchor 12-04 but alpha
    --    has NO 12-04 slot -> reported, never forced.
    --  * Specialized beta topic on 12-02 -> must never move.
    --  * Percentage: alpha 12-06, beta 12-02; neither matches, but BOTH have a
    --    math slot on 12-04 -> mutual anchor pulls both to 12-04.
    insert into public.study_plan_assignments
      (course_id, subject_id, topic_id, subtopic_id, routine_id, plan_day, first_study_date)
    values ('${C1}', '${S1_EN}', '${T1_TENSE}', null, '${R1_EN_D1}', 1, '2026-12-01'),
           ('${C2}', '${S2_EN}', '${T2_TENSE}', null, '${R2_EN_D3}', 3, '2026-12-03'),
           ('${C1}', '${S1_EN}', '${T1_VOCAB}', null, '${R1_EN_D5}', 5, '2026-12-05'),
           ('${C2}', '${S2_EN}', '${T2_VOCAB}', null, '${R2_EN_D4}', 4, '2026-12-04'),
           ('${C2}', '${S2_SP}', '${T2_SPEC}', null, '${R2_SP_D2}', 2, '2026-12-02'),
           ('${C1}', '${S1_MA}', '${T1_PCT}', null, '${R1_MA_D6}', 6, '2026-12-06'),
           ('${C2}', '${S2_MA}', '${T2_PCT}', null, '${R2_MA_D2}', 2, '2026-12-02');
  `);
});

type Report = {
  dry_run: boolean;
  shared_topics_out_of_sync: number;
  applied: number;
  moves: Array<{
    canonical_topic_bn: string;
    course: string;
    from_date: string;
    to_date: string;
    can_apply: boolean;
  }>;
};

async function runSync(apply: boolean): Promise<Report> {
  const [row] = await rows<{ r: Report }>(
    db,
    `select public.jh_sync_common_topics(array['${C1}','${C2}']::uuid[], $1) as r`,
    [apply],
  );
  return row.r;
}

describe("common-topic synchronization", () => {
  it("dry run proposes moving beta's Tense to alpha's day without changing data", async () => {
    await actAsService(db);
    const report = await runSync(false);
    expect(report.dry_run).toBe(true);
    expect(report.applied).toBe(0);

    const tense = report.moves.find((m) => m.course === "sync-beta" && m.to_date === "2026-12-01");
    expect(tense).toBeDefined();
    expect(tense!.from_date).toBe("2026-12-03");
    expect(tense!.can_apply).toBe(true);

    // Nothing moved yet.
    const date = await scalar<string>(
      db,
      `select first_study_date::text from public.study_plan_assignments where topic_id = '${T2_TENSE}'`,
    );
    expect(date).toBe("2026-12-03");
  });

  it("reports the vocabulary move as not appliable (alpha has no slot on the anchor day)", async () => {
    await actAsService(db);
    const report = await runSync(false);
    const vocab = report.moves.find((m) => m.course === "sync-alpha" && !m.can_apply);
    expect(vocab).toBeDefined();
    expect(vocab!.from_date).toBe("2026-12-05");
    expect(vocab!.to_date).toBe("2026-12-04");
    expect(vocab!.can_apply).toBe(false);
  });

  it("picks a mutual slot date when neither course's current day works for the other", async () => {
    await actAsService(db);
    const report = await runSync(false);
    const pct = report.moves.filter((m) => m.to_date === "2026-12-04" && m.can_apply);
    expect(pct.map((m) => m.course).sort()).toEqual(["sync-alpha", "sync-beta"]);
    expect(pct.map((m) => m.from_date).sort()).toEqual(["2026-12-02", "2026-12-06"]);
  });

  it("apply aligns Tense to the same day in both routines, onto the existing slot", async () => {
    await actAsService(db);
    const report = await runSync(true);
    expect(report.applied).toBe(3); // beta Tense + both Percentage moves

    const [moved] = await rows<{ first_study_date: string; routine_id: string; plan_day: number }>(
      db,
      `select first_study_date::text, routine_id, plan_day
         from public.study_plan_assignments where topic_id = '${T2_TENSE}'`,
    );
    expect(moved.first_study_date).toBe("2026-12-01");
    expect(moved.routine_id).toBe(R2_EN_D1);
    expect(moved.plan_day).toBe(1);

    // Anchor course untouched.
    const anchor = await scalar<string>(
      db,
      `select first_study_date::text from public.study_plan_assignments where topic_id = '${T1_TENSE}'`,
    );
    expect(anchor).toBe("2026-12-01");

    // Percentage landed on the mutual 12-04 slot in BOTH courses.
    const [p1] = await rows<{ first_study_date: string; routine_id: string }>(
      db,
      `select first_study_date::text, routine_id from public.study_plan_assignments where topic_id = '${T1_PCT}'`,
    );
    const [p2] = await rows<{ first_study_date: string; routine_id: string }>(
      db,
      `select first_study_date::text, routine_id from public.study_plan_assignments where topic_id = '${T2_PCT}'`,
    );
    expect(p1.first_study_date).toBe("2026-12-04");
    expect(p1.routine_id).toBe(R1_MA_D4);
    expect(p2.first_study_date).toBe("2026-12-04");
    expect(p2.routine_id).toBe(R2_MA_D4);
  });

  it("never forces the unsyncable vocabulary move", async () => {
    await actAsService(db);
    const date = await scalar<string>(
      db,
      `select first_study_date::text from public.study_plan_assignments where topic_id = '${T1_VOCAB}'`,
    );
    expect(date).toBe("2026-12-05"); // unchanged even after apply
  });

  it("leaves specialized (non-canonical) content completely alone", async () => {
    await actAsService(db);
    const [spec] = await rows<{ first_study_date: string; routine_id: string }>(
      db,
      `select first_study_date::text, routine_id
         from public.study_plan_assignments where topic_id = '${T2_SPEC}'`,
    );
    expect(spec.first_study_date).toBe("2026-12-02");
    expect(spec.routine_id).toBe(R2_SP_D2);
  });

  it("is idempotent: a second apply has nothing left to move for Tense", async () => {
    await actAsService(db);
    const report = await runSync(true);
    expect(report.applied).toBe(0);
    const tenseMoves = report.moves.filter((m) => m.can_apply);
    expect(tenseMoves.length).toBe(0);
  });

  it("mirrors the move into the routine scope (topic_ids)", async () => {
    await actAsService(db);
    const inScope = await scalar<boolean>(
      db,
      `select '${T2_TENSE}' = any(coalesce(topic_ids, '{}')) from public.routines where id = '${R2_EN_D1}'`,
    );
    expect(inScope).toBe(true);
  });

  it("requires routine.manage: a student cannot run the sync", async () => {
    await actAs(db, STUDENT);
    await expectError(
      db.query(`select public.jh_sync_common_topics(array['${C1}','${C2}']::uuid[], false)`),
      /routine.manage/i,
    );
  });

  it("admins with routine.manage CAN run it through the JWT path", async () => {
    await actAs(db, ADMIN);
    const [row] = await rows<{ r: Report }>(
      db,
      `select public.jh_sync_common_topics(array['${C1}','${C2}']::uuid[], false) as r`,
    );
    expect(row.r.dry_run).toBe(true);
  });

  it("rejects a single-course call", async () => {
    await actAsService(db);
    await expectError(
      db.query(`select public.jh_sync_common_topics(array['${C1}']::uuid[], false)`),
      /২টি কোর্স/,
    );
  });
});
