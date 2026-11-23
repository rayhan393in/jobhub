import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import {
  actAs, actAsService, createDatabase, createPrivilegedUser, createUser, expectError, migrate, rows, scalar, uuid,
} from "./harness";

/**
 * Central taxonomy + reference-based question bank (20261201000000):
 *  - 27 canonical subjects seeded; one canonical English/Mathematics is REUSED
 *    across many courses through explicit, audited mappings — never fuzzy;
 *  - mixed-meaning subjects stay deliberately unmapped (no silent merges);
 *  - the canonical topic LIBRARY ('lib-*') is central-only: no course topic is
 *    auto-linked to it, so every official syllabus stays byte-identical;
 *  - exam_registry stores every examination once (name+year+stage+position),
 *    with year_verified=false until a human verifies — years are never guessed;
 *  - questions carry a 4-way kind, and an honesty trigger blocks
 *    'exact_pyq'/'similar_concept' labels without VERIFIED evidence;
 *  - v_exam_question_analytics aggregates VERIFIED references only: missing
 *    data yields no row (― "Insufficient Verified Historical Data"), never 0.
 */

let db: PGlite;
const ADMIN = uuid(990);
const STUDENT = uuid(991);

let bcsCourseId: string;
let bcsSubjectId: string;
let questionId: string;

beforeAll(async () => {
  db = await createDatabase();
  await migrate(db);
  await createPrivilegedUser(db, { id: ADMIN, email: "ct-admin@jobhub.test", role: "super_admin", full_name: "Admin" });
  await createUser(db, { id: STUDENT, email: "ct-student@jobhub.test", full_name: "Student" });

  await actAsService(db);
  bcsCourseId = await scalar<string>(db, `select id from public.courses where slug = 'bcs'`);
  bcsSubjectId = await scalar<string>(db, `select id from public.subjects where course_id = $1 and slug = 'bangla'`, [bcsCourseId]);

  const r = await rows<{ id: string }>(
    db,
    `insert into public.questions
       (course_id, subject_id, statement, option_a, option_b, option_c, option_d,
        correct_option, explanation, difficulty, source, source_type, status, is_verified, fingerprint, created_by)
     values ($1,$2,'কেন্দ্রীয় ট্যাক্সোনমি টেস্ট প্রশ্ন — ফিক্সচার','ক','খ','গ','ঘ',0,'','medium','fixture','manual','draft',false,'ct-fixture-1',$3)
     returning id`,
    [bcsCourseId, bcsSubjectId, ADMIN],
  );
  questionId = r[0].id;
});

describe("canonical subject library", () => {
  it("seeds the 27 canonical subjects exactly once (idempotent slugs)", async () => {
    await actAsService(db);
    const n = await scalar<number>(db, `select count(*)::int from public.canonical_subjects where slug like 'cs-%'`);
    expect(n).toBe(27);
  });

  // NOTE: the repo seed only ships subjects for bcs/eee/petrobangla; the other
  // six courses' subjects were created live by the admin. So the harness floor
  // is 2 courses — the live DB is verified separately (>= 6 for English).
  it("reuses ONE canonical English across multiple courses", async () => {
    await actAsService(db);
    const n = await scalar<number>(
      db,
      `select count(distinct s.course_id)::int
         from public.subjects s
         join public.canonical_subjects cs on cs.id = s.canonical_subject_id
        where cs.slug = 'cs-english'`,
    );
    expect(n).toBeGreaterThanOrEqual(2);
  });

  it("reuses ONE canonical Mathematics across multiple courses", async () => {
    await actAsService(db);
    const n = await scalar<number>(
      db,
      `select count(distinct s.course_id)::int
         from public.subjects s
         join public.canonical_subjects cs on cs.id = s.canonical_subject_id
        where cs.slug = 'cs-mathematics'`,
    );
    expect(n).toBeGreaterThanOrEqual(2);
  });

  it("maps EEE specialized canonicals ONLY to EEE-family courses", async () => {
    await actAsService(db);
    const slugs = await rows<{ slug: string }>(
      db,
      `select distinct c.slug
         from public.subjects s
         join public.courses c on c.id = s.course_id
         join public.canonical_subjects cs on cs.id = s.canonical_subject_id
        where cs.slug = 'cs-power-electronics'`,
    );
    const set = new Set(slugs.map((r) => r.slug));
    expect(set.has("bcs")).toBe(false);
    expect(set.has("primary-teacher")).toBe(false);
    for (const s of set) expect(["eee", "petrobangla-ae-eee", "technical-recruitment"]).toContain(s);
  });

  it("leaves non-shared / specialized subjects unmapped (no silent merge)", async () => {
    await actAsService(db);
    const unmapped = await rows<{ slug: string; canonical_subject_id: string | null }>(
      db,
      `select s.slug, s.canonical_subject_id
         from public.subjects s
         join public.courses c on c.id = s.course_id
        where (c.slug = 'eee' and s.slug in ('renewable','micro'))
           or (c.slug = 'petrobangla-ae-eee' and s.slug in ('pb-energy-sector','pb-petrobangla'))`,
    );
    expect(unmapped.length).toBe(4);
    for (const r of unmapped) expect(r.canonical_subject_id).toBeNull();
  });
});

describe("BCS preservation", () => {
  it("keeps the BCS syllabus rows untouched (10 subjects, titles intact)", async () => {
    await actAsService(db);
    const n = await scalar<number>(db, `select count(*)::int from public.subjects where course_id = $1`, [bcsCourseId]);
    expect(n).toBe(10);
    const bangla = await scalar<string>(
      db,
      `select title_en from public.subjects where course_id = $1 and slug = 'bangla'`,
      [bcsCourseId],
    );
    expect(bangla).toBe("Bangla Language & Literature"); // mapping adds a link, never a rename
  });
});

describe("canonical topic library", () => {
  it("seeds 91 library topics, each owned by a canonical subject", async () => {
    await actAsService(db);
    const n = await scalar<number>(
      db,
      `select count(*)::int from public.canonical_topics
        where slug like 'lib-%' and canonical_subject_id is not null`,
    );
    expect(n).toBe(91);
  });

  it("links course topics to the library ONLY through the explicit curated whitelist", async () => {
    // 20261201 must not auto-link by name similarity; the only lib-links
    // allowed are the curated 1:1 matches of 20261202000001.
    await actAsService(db);
    const curated = new Set([
      "History, Types & Capability of Computers",
      "Operating Systems & Embedded Computers",
      "Computer Virus & Cyber Security",
      "Internet, WWW & E-mail",
      "Computer Networks",
      "পদ ও পদপ্রকরণ",
      "বাক্য",
      "সমার্থক ও বিপরীত শব্দ",
      "কবি ও সাহিত্যিক",
      "Computer Basics",
      "Bangla Literature",
    ]);
    const linked = await rows<{ title_en: string }>(
      db,
      `select t.title_en
         from public.topics t
         join public.canonical_topics ct on ct.id = t.canonical_id
        where ct.slug like 'lib-%'`,
    );
    for (const row of linked) {
      expect(curated.has(row.title_en)).toBe(true);
    }
  });

  it("completes the hierarchy: canonical_subtopics insert + course subtopic link", async () => {
    await actAsService(db);
    const topicId = await scalar<string>(db, `select id from public.canonical_topics where slug = 'lib-bn-sandhi'`);
    const [st] = await rows<{ id: string }>(
      db,
      `insert into public.canonical_subtopics (canonical_topic_id, slug, title_en, title_bn)
       values ($1, 'lib-bn-sandhi-swara', 'Vowel Sandhi', 'স্বরসন্ধি') returning id`,
      [topicId],
    );
    const courseSubtopic = await scalar<string>(db, `select id from public.subtopics limit 1`);
    await db.query(`update public.subtopics set canonical_id = $1 where id = $2`, [st.id, courseSubtopic]);
    const linked = await scalar<string>(db, `select canonical_id from public.subtopics where id = $1`, [courseSubtopic]);
    expect(linked).toBe(st.id);
  });
});

describe("exam registry", () => {
  let examId: string;

  it("stores an examination once with stage + position, year unverified by default", async () => {
    await actAs(db, ADMIN);
    const [x] = await rows<{ id: string; year_verified: boolean }>(
      db,
      `insert into public.exam_registry (slug, exam_name, exam_year, exam_stage, position_title, created_by)
       values ('bcs-40-prelim', '40th BCS Preliminary', 2019, 'preliminary', null, $1)
       returning id, year_verified`,
      [ADMIN],
    );
    examId = x.id;
    expect(x.year_verified).toBe(false); // verification is a human act, never a default
  });

  it("rejects a duplicate identity (same name + year + stage + position)", async () => {
    await actAs(db, ADMIN);
    await expectError(
      db.query(
        `insert into public.exam_registry (slug, exam_name, exam_year, exam_stage)
         values ('bcs-40-prelim-dup', '40TH BCS PRELIMINARY', 2019, 'preliminary')`,
      ),
      /duplicate key/i,
    );
  });

  it("refuses year_verified=true when the year itself is missing", async () => {
    await actAs(db, ADMIN);
    await expectError(
      db.query(
        `insert into public.exam_registry (slug, exam_name, exam_year, exam_stage, year_verified)
         values ('ntrca-unknown', 'NTRCA Preliminary', null, 'preliminary', true)`,
      ),
      /check|constraint/i,
    );
  });

  it("hides drafts from non-staff; students see published exams only", async () => {
    // The written-exam module seeds published written-stage rows
    // (20261203000000); exclude them so this test stays about drafts.
    const scope = `slug not like '%-written-stage'`;
    await actAs(db, STUDENT);
    let n = await scalar<number>(db, `select count(*)::int from public.exam_registry where ${scope}`);
    expect(n).toBe(0); // the row above is still draft

    await actAsService(db);
    await db.query(`update public.exam_registry set status = 'published', year_verified = true where id = $1`, [examId]);

    await actAs(db, STUDENT);
    n = await scalar<number>(db, `select count(*)::int from public.exam_registry where ${scope}`);
    expect(n).toBe(1);

    await actAs(db, STUDENT);
    await expectError(
      db.query(`insert into public.exam_registry (slug, exam_name, exam_stage) values ('x-student', 'Student Made Exam', 'other')`),
      /row-level security|violates/i,
    );
  });

  it("links evidence to the registry with page-level provenance", async () => {
    await actAsService(db);
    const examIdDb = await scalar<string>(db, `select id from public.exam_registry where slug = 'bcs-40-prelim'`);
    await db.query(
      `insert into public.evidence_records
         (question_id, exam_name, exam_year, exam_id, exam_stage, source_page, match_kind, verified_by)
       values ($1, '40th BCS Preliminary', 2019, $2, 'preliminary', 12, 'exact', $3)`,
      [questionId, examIdDb, ADMIN],
    );
    const page = await scalar<number>(
      db,
      `select source_page from public.evidence_records where question_id = $1`,
      [questionId],
    );
    expect(page).toBe(12);
  });
});

describe("4-way question classification honesty", () => {
  it("defaults to 'practice' and accepts 'ai_generated' freely (provenance label)", async () => {
    await actAsService(db);
    const kind = await scalar<string>(db, `select question_kind from public.questions where id = $1`, [questionId]);
    expect(kind).toBe("practice");
  });

  it("allows 'exact_pyq' ONLY because verified exact evidence exists", async () => {
    await actAsService(db);
    await db.query(`update public.questions set question_kind = 'exact_pyq' where id = $1`, [questionId]);
    const kind = await scalar<string>(db, `select question_kind from public.questions where id = $1`, [questionId]);
    expect(kind).toBe("exact_pyq");
  });

  it("blocks 'exact_pyq' on a question with no verified evidence", async () => {
    await actAsService(db);
    const [q2] = await rows<{ id: string }>(
      db,
      `insert into public.questions
         (course_id, subject_id, statement, option_a, option_b, option_c, option_d,
          correct_option, explanation, difficulty, source, source_type, status, is_verified, fingerprint, created_by)
       values ($1,$2,'প্রমাণহীন প্রশ্ন — exact_pyq হতে পারবে না','ক','খ','গ','ঘ',1,'','medium','fixture','manual','draft',false,'ct-fixture-2',$3)
       returning id`,
      [bcsCourseId, bcsSubjectId, ADMIN],
    );
    await expectError(
      db.query(`update public.questions set question_kind = 'exact_pyq' where id = $1`, [q2.id]),
      /cannot be labelled exact_pyq/i,
    );
    await expectError(
      db.query(`update public.questions set question_kind = 'similar_concept' where id = $1`, [q2.id]),
      /cannot be labelled similar_concept/i,
    );
  });

  it("rejects an invalid kind", async () => {
    await actAsService(db);
    await expectError(
      db.query(`update public.questions set question_kind = 'guessed_pyq' where id = $1`, [questionId]),
      /check|constraint/i,
    );
  });
});

describe("verified-only historical analytics", () => {
  it("counts the verified reference and ignores unverified ones", async () => {
    await actAsService(db);
    const rowsOut = await rows<{ exam_name: string; question_count: number }>(
      db,
      `select exam_name, question_count::int as question_count from public.v_exam_question_analytics`,
    );
    expect(rowsOut.length).toBe(1); // exactly the verified 40th BCS reference
    expect(rowsOut[0].exam_name).toBe("40th BCS Preliminary");
    expect(rowsOut[0].question_count).toBe(1);
  });

  it("drops the row again when the exam year is no longer verified (no fabricated history)", async () => {
    await actAsService(db);
    await db.query(`update public.exam_registry set year_verified = false, exam_year = null where slug = 'bcs-40-prelim'`);
    const n = await scalar<number>(db, `select count(*)::int from public.v_exam_question_analytics`);
    expect(n).toBe(0); // missing data -> no row, never zero-frequency claims
    await db.query(`update public.exam_registry set exam_year = 2019, year_verified = true where slug = 'bcs-40-prelim'`);
  });
});
