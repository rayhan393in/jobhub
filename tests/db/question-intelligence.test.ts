import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import {
  actAs, actAsService, createDatabase, createPrivilegedUser, expectError, migrate, rows, scalar, uuid,
} from "./harness";

/**
 * QA for the question-intelligence layer (migration 20261124000000):
 * evidence engine constraints, the previous-source guard, canonical merge
 * apply/revert integrity, duplicate detection, RLS + privilege lockdown, and
 * frequency-engine readiness (missing evidence ≠ zero frequency).
 */

let db: PGlite;
const ADMIN = uuid(910);
const STUDENT = uuid(911);

let courseId: string;
let subjectId: string;
let topicId: string;
let questionA: string;
let questionB: string;

beforeAll(async () => {
  db = await createDatabase();
  await migrate(db);

  await createPrivilegedUser(db, { id: ADMIN, email: "qa-admin@jobhub.test", role: "super_admin", full_name: "QA Admin" });
  await createPrivilegedUser(db, { id: STUDENT, email: "qa-student@jobhub.test", role: "student", full_name: "QA Student" });

  await actAsService(db);
  courseId = await scalar<string>(db, `select id from public.courses where slug = 'bcs'`);
  subjectId = await scalar<string>(db, `select id from public.subjects where course_id = $1 order by sort_order limit 1`, [courseId]);
  topicId = await scalar<string>(db, `select id from public.topics where subject_id = $1 order by sort_order limit 1`, [subjectId]);

  async function addQuestion(statement: string, fingerprint: string): Promise<string> {
    const r = await rows<{ id: string }>(
      db,
      `insert into public.questions
         (course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
          correct_option, explanation, difficulty, source, source_type, status, is_verified, fingerprint, created_by)
       values ($1,$2,$3,$4,'ক','খ','গ','ঘ',0,'','medium','fixture','manual','draft',false,$5,$6)
       returning id`,
      [courseId, subjectId, topicId, statement, fingerprint, ADMIN],
    );
    return r[0].id;
  }
  questionA = await addQuestion("বাংলাদেশের সংবিধান কার্যকর হয় কোন তারিখে? — QA fixture", "qa-evidence-a");
  questionB = await addQuestion("বাংলাদেশের সংবিধান কার্যকর হয় কত তারিখে? — QA fixture", "qa-evidence-b");
});

describe("A. evidence engine (DB rules)", () => {
  it("backfill linked every pre-existing question exactly once as primary", async () => {
    await actAsService(db);
    const orphans = await scalar<number>(
      db,
      `select count(*)::int from public.questions q
       where q.created_at < (select min(created_at) from public.question_topic_links)
         and not exists (select 1 from public.question_topic_links l where l.question_id = q.id and l.is_primary)`,
    );
    expect(orphans).toBe(0);
  });

  it("a question created AFTER the migration is auto-linked into the central bank", async () => {
    await actAsService(db);
    const link = await rows<{ is_primary: boolean; topic_id: string }>(
      db,
      `select is_primary, topic_id from public.question_topic_links where question_id = $1`,
      [questionA],
    );
    expect(link).toHaveLength(1);
    expect(link[0].is_primary).toBe(true);
    expect(link[0].topic_id).toBe(topicId);
  });

  it("editing a question's placement keeps its primary link in sync", async () => {
    await actAsService(db);
    const otherTopic = await scalar<string>(
      db,
      `select id from public.topics where subject_id = $1 and id <> $2 order by sort_order limit 1`,
      [subjectId, topicId],
    );
    await db.query(`update public.questions set topic_id = $1 where id = $2`, [otherTopic, questionB]);
    const linked = await scalar<string>(
      db,
      `select topic_id from public.question_topic_links where question_id = $1 and is_primary`,
      [questionB],
    );
    expect(linked).toBe(otherTopic);
    // restore
    await db.query(`update public.questions set topic_id = $1 where id = $2`, [topicId, questionB]);
  });

  it("rejects evidence without an exam year (NOT NULL — years are never inferred)", async () => {
    await actAsService(db);
    await expectError(
      db.query(`insert into public.evidence_records (question_id, exam_name, exam_year) values ($1, '৪০তম বিসিএস', null)`, [questionA]),
      /null|not-null/i,
    );
  });

  it("rejects an invalid match_kind", async () => {
    await expectError(
      db.query(`insert into public.evidence_records (question_id, exam_name, exam_year, match_kind) values ($1,'৪০তম বিসিএস',2018,'guessed')`, [questionA]),
      /check|match_kind/i,
    );
  });

  it("accepts valid evidence, rejects an exact duplicate (question+exam+year unique)", async () => {
    await actAsService(db);
    await db.query(
      `insert into public.evidence_records (question_id, exam_name, exam_year, match_kind, source_ref, verified_by)
       values ($1,'৪০তম বিসিএস প্রিলিমিনারি',2018,'exact','৪০তম প্রশ্নপত্র',$2)`,
      [questionA, ADMIN],
    );
    await expectError(
      db.query(
        `insert into public.evidence_records (question_id, exam_name, exam_year) values ($1,'৪০তম বিসিএস প্রিলিমিনারি',2018)`,
        [questionA],
      ),
      /duplicate|unique/i,
    );
    // Same question in a DIFFERENT exam/year is a second legitimate record.
    await db.query(
      `insert into public.evidence_records (question_id, exam_name, exam_year, match_kind, verified_by)
       values ($1,'৪১তম বিসিএস প্রিলিমিনারি',2019,'same_concept',$2)`,
      [questionA, ADMIN],
    );
    const count = await scalar<number>(db, `select count(*)::int from public.evidence_records where question_id = $1`, [questionA]);
    expect(count).toBe(2);
  });

  it("guard trigger: a question cannot BECOME previous-year without evidence", async () => {
    await actAsService(db);
    await expectError(
      db.query(`update public.questions set source_type = 'previous' where id = $1`, [questionB]),
      /evidence/i,
    );
    const untouched = await scalar<string>(db, `select source_type from public.questions where id = $1`, [questionB]);
    expect(untouched).toBe("manual");
  });

  it("guard trigger: the transition succeeds once evidence exists", async () => {
    await db.query(
      `insert into public.evidence_records (question_id, exam_name, exam_year, verified_by) values ($1,'৪২তম বিসিএস',2021,$2)`,
      [questionB, ADMIN],
    );
    await db.query(`update public.questions set source_type = 'previous' where id = $1`, [questionB]);
    const flipped = await scalar<string>(db, `select source_type from public.questions where id = $1`, [questionB]);
    expect(flipped).toBe("previous");
  });

  it("deleting (rejecting) evidence never deletes the original question", async () => {
    await db.query(`delete from public.evidence_records where question_id = $1 and exam_name = '৪২তম বিসিএস'`, [questionB]);
    const stillThere = await scalar<number>(db, `select count(*)::int from public.questions where id = $1`, [questionB]);
    expect(stillThere).toBe(1);
  });

  it("unverified (draft) questions are invisible to students even when tagged previous", async () => {
    // questionB is now source_type='previous' but status='draft', is_verified=false.
    await actAs(db, STUDENT);
    const visible = await scalar<number>(
      db,
      `select count(*)::int from public.questions where id = $1`,
      [questionB],
    );
    expect(visible).toBe(0); // RLS: students only read approved questions
  });
});

describe("B. merge management (apply / reject / rollback)", () => {
  let canonicalId: string;
  let mergeId: string;
  let topicX: string;
  let topicY: string;
  let questionCountBefore: number;

  it("setup: two same-name topics in different courses + a proposal", async () => {
    await actAsService(db);
    const otherCourse = await scalar<string>(db, `select id from public.courses where slug <> 'bcs' order by sort_order limit 1`);
    const otherSubject = await rows<{ id: string }>(
      db,
      `insert into public.subjects (course_id, slug, title_en, title_bn, sort_order) values ($1,'qa-subj','QA Subject','কিউএ বিষয়',99) returning id`,
      [otherCourse],
    );
    const tx = await rows<{ id: string }>(
      db,
      `insert into public.topics (subject_id, slug, title_en, title_bn, sort_order) values ($1,'qa-shotokora-x','শতকরা','শতকরা',98) returning id`,
      [subjectId],
    );
    const ty = await rows<{ id: string }>(
      db,
      `insert into public.topics (subject_id, slug, title_en, title_bn, sort_order) values ($1,'qa-shotokora-y','শতকরা','শতকরা',99) returning id`,
      [otherSubject[0].id],
    );
    topicX = tx[0].id;
    topicY = ty[0].id;

    const merge = await rows<{ id: string }>(
      db,
      `insert into public.taxonomy_merges (kind, member_ids, status, reason)
       values ('topic', array[$1,$2]::uuid[], 'proposed', 'QA: same normalized name') returning id`,
      [topicX, topicY],
    );
    mergeId = merge[0].id;
    questionCountBefore = await scalar<number>(db, `select count(*)::int from public.questions`);
    expect(mergeId).toBeTruthy();
  });

  it("approve: links members to one canonical topic without touching questions", async () => {
    const canonical = await rows<{ id: string }>(
      db,
      `insert into public.canonical_topics (slug, title_bn, title_en, subject_group, approval_status)
       values ('qa-ct-shotokora','শতকরা','শতকরা','qa','approved') returning id`,
    );
    canonicalId = canonical[0].id;
    await db.query(`update public.topics set canonical_id = $1 where id = any(array[$2,$3]::uuid[])`, [canonicalId, topicX, topicY]);
    await db.query(`update public.taxonomy_merges set status='applied', canonical_id=$1, decided_at=now(), merged_by=$2 where id=$3`, [canonicalId, ADMIN, mergeId]);

    const linked = await scalar<number>(db, `select count(*)::int from public.topics where canonical_id = $1`, [canonicalId]);
    expect(linked).toBe(2);
    const members = await scalar<number>(db, `select count(*)::int from public.v_canonical_topic_members where canonical_topic_id = $1`, [canonicalId]);
    expect(members).toBe(2);
    expect(await scalar<number>(db, `select count(*)::int from public.questions`)).toBe(questionCountBefore);
  });

  it("rollback (revert): clears the link, preserves topics, questions and FKs", async () => {
    await db.query(`update public.topics set canonical_id = null where id = any(array[$1,$2]::uuid[])`, [topicX, topicY]);
    await db.query(`update public.taxonomy_merges set status='reverted', reverted_at=now() where id=$1`, [mergeId]);

    expect(await scalar<number>(db, `select count(*)::int from public.topics where id = any(array[$1,$2]::uuid[])`, [topicX, topicY])).toBe(2);
    expect(await scalar<number>(db, `select count(*)::int from public.topics where canonical_id = $1`, [canonicalId])).toBe(0);
    // Question placements (FKs) are untouched by linking or reverting.
    expect(await scalar<number>(db, `select count(*)::int from public.questions where topic_id is not null and topic_id not in (select id from public.topics)`)).toBe(0);
    expect(await scalar<number>(db, `select count(*)::int from public.questions`)).toBe(questionCountBefore);
    const status = await scalar<string>(db, `select status from public.taxonomy_merges where id = $1`, [mergeId]);
    expect(status).toBe("reverted");
  });

  it("reject: a rejected proposal leaves every member topic unlinked and intact", async () => {
    const merge = await rows<{ id: string }>(
      db,
      `insert into public.taxonomy_merges (kind, member_ids, status, reason)
       values ('topic', array[$1,$2]::uuid[], 'proposed', 'QA: ambiguous scope') returning id`,
      [topicX, topicY],
    );
    await db.query(`update public.taxonomy_merges set status='rejected', decided_at=now() where id=$1`, [merge[0].id]);
    expect(await scalar<number>(db, `select count(*)::int from public.topics where canonical_id is not null and id = any(array[$1,$2]::uuid[])`, [topicX, topicY])).toBe(0);
  });

  it("duplicate detection reports pairs but never deletes or merges questions", async () => {
    await actAsService(db);
    const before = await scalar<number>(db, `select count(*)::int from public.questions`);
    const found = await scalar<number>(db, `select public.jh_detect_similar_questions(0.80)`);
    expect(found).toBeGreaterThanOrEqual(1); // questionA vs questionB differ by one word
    const after = await scalar<number>(db, `select count(*)::int from public.questions`);
    expect(after).toBe(before);
    const pair = await scalar<number>(
      db,
      `select count(*)::int from public.question_similarity
       where (question_id = $1 and similar_question_id = $2) or (question_id = $2 and similar_question_id = $1)`,
      [questionA, questionB],
    );
    expect(pair).toBe(1);
  });
});

describe("C. security: privileges + RLS on the new tables", () => {
  it("anon can neither read nor write evidence_records", async () => {
    await actAs(db, null, "anon");
    await expectError(db.query(`select * from public.evidence_records`), /denied|permission/i);
    await expectError(
      db.query(`insert into public.evidence_records (question_id, exam_name, exam_year) values ($1,'hack',2020)`, [questionA]),
      /denied|permission/i,
    );
  });

  it("anon cannot read the admin read-model views (owner-rights bypass closed)", async () => {
    await actAs(db, null, "anon");
    await expectError(db.query(`select * from public.v_question_bank limit 1`), /denied|permission/i);
    await expectError(db.query(`select * from public.v_topic_frequency limit 1`), /denied|permission/i);
    await expectError(db.query(`select * from public.v_evidence_coverage limit 1`), /denied|permission/i);
  });

  it("an authenticated student cannot write evidence, merges or priorities", async () => {
    await actAs(db, STUDENT);
    await expectError(
      db.query(`insert into public.evidence_records (question_id, exam_name, exam_year) values ($1,'hack',2020)`, [questionA]),
      /denied|permission/i,
    );
    await expectError(db.query(`insert into public.taxonomy_merges (kind, member_ids) values ('topic', '{}')`), /denied|permission/i);
    await expectError(db.query(`update public.topic_priorities set priority_level = 'high'`), /denied|permission/i);
    await expectError(db.query(`delete from public.question_topic_links`), /denied|permission/i);
  });

  it("an authenticated user may read links and priorities (read-only policies)", async () => {
    await actAs(db, STUDENT);
    const links = await scalar<number>(db, `select count(*)::int from public.question_topic_links`);
    expect(links).toBeGreaterThan(0);
    await db.query(`select count(*) from public.topic_priorities`); // must not throw
  });

  it("even a super_admin JWT cannot bypass: writes go through the service role only", async () => {
    await actAs(db, ADMIN);
    await expectError(
      db.query(`insert into public.evidence_records (question_id, exam_name, exam_year) values ($1,'direct',2020)`, [questionA]),
      /denied|permission/i,
    );
  });
});

describe("E. frequency engine readiness", () => {
  it("v_topic_frequency reports verified counts, exams, years and match kinds", async () => {
    await actAsService(db);
    const freq = await rows<{
      evidence_count: number; distinct_exams: number; distinct_years: number;
      distinct_exam_years: number; exact_matches: number; concept_matches: number;
    }>(db, `select evidence_count::int, distinct_exams::int, distinct_years::int, distinct_exam_years::int, exact_matches::int, concept_matches::int from public.v_topic_frequency where topic_id = $1`, [topicId]);
    // questionA carries 2 evidence rows (2018 exact + 2019 same_concept) on this topic.
    expect(freq[0].evidence_count).toBe(2);
    expect(freq[0].distinct_exams).toBe(2);
    expect(freq[0].distinct_years).toBe(2);
    expect(freq[0].distinct_exam_years).toBe(2);
    expect(freq[0].exact_matches).toBe(1);
    expect(freq[0].concept_matches).toBe(1);
  });

  it("a topic with ZERO evidence reads 0 — not 1 — exam-years (missing ≠ low)", async () => {
    const zero = await rows<{ evidence_count: number; distinct_exam_years: number }>(
      db,
      `select evidence_count::int, distinct_exam_years::int from public.v_topic_frequency
       where evidence_count = 0 limit 1`,
    );
    expect(zero.length).toBe(1);
    expect(zero[0].distinct_exam_years).toBe(0);
  });

  it("recompute marks evidence-less topics insufficient_evidence, evidenced ones scored", async () => {
    await scalar(db, `select public.jh_recompute_topic_priorities()`);
    const evidenced = await scalar<string>(db, `select priority_level from public.topic_priorities where topic_id = $1`, [topicId]);
    expect(["low", "medium", "high"]).toContain(evidenced); // 2 exam-years → low
    const wrongZero = await scalar<number>(
      db,
      `select count(*)::int from public.topic_priorities tp
       join public.v_topic_frequency f on f.topic_id = tp.topic_id
       where f.evidence_count = 0 and tp.priority_level <> 'insufficient_evidence'`,
    );
    expect(wrongZero).toBe(0);
  });

  it("a manual override survives recompute", async () => {
    await db.query(`update public.topic_priorities set priority_level='high', is_manual_override=true where topic_id=$1`, [topicId]);
    await scalar(db, `select public.jh_recompute_topic_priorities()`);
    const kept = await scalar<string>(db, `select priority_level from public.topic_priorities where topic_id = $1`, [topicId]);
    expect(kept).toBe("high");
  });
});
