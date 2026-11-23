import { createHash } from "node:crypto";

/**
 * Pure validation core of the evidence CSV importer.
 *
 * Shared by the API route and the test-suite so the exact rules that run in
 * production are the rules under test:
 *  - exam_name AND exam_year are mandatory on every row — a missing value
 *    rejects the row, it is never inferred from the question text;
 *  - a row matching an existing question (same course, same normalised
 *    statement) only ADDS an evidence record;
 *  - an unmatched row may create a DRAFT question (unverified, review-queue
 *    bound) only when it carries four options and a correct answer;
 *  - anything else is reported back with the reason, never guessed.
 */

export type RawRow = Record<string, string>;

export type EvidenceVerdict = {
  row: number;
  examName: string;
  examYear: number | null;
  statement: string;
  outcome: "match" | "create_draft" | "error";
  detail: string;
};

export type MatchedQuestion = { id: string; source_type: string };

export type EvidenceInsert = {
  question_id: string;
  exam_name: string;
  exam_year: number;
  match_kind: string;
  source_ref: string | null;
  source_url: string | null;
  original_text: string;
};

export type DraftInsert = {
  row: number;
  question: {
    statement: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_option: number;
    explanation: string;
    source_type: "previous";
    status: "draft";
    is_verified: false;
    year: number;
    exam_name: string;
    source_title: string | null;
    source_url: string | null;
    fingerprint: string;
  };
  evidence: Omit<EvidenceInsert, "question_id">;
};

export type EvidenceCsvResult = {
  verdicts: EvidenceVerdict[];
  evidenceInserts: EvidenceInsert[];
  draftInserts: DraftInsert[];
  summary: { total: number; matched: number; drafts: number; errors: number };
};

export function normaliseStatement(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function fingerprintOf(statement: string): string {
  return createHash("sha256").update(statement).digest("hex");
}

export function pick(row: RawRow, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value.trim() !== "") return value.trim();
  }
  return "";
}

const CORRECT_MAP: Record<string, number> = {
  a: 0, b: 1, c: 2, d: 3, "0": 0, "1": 1, "2": 2, "3": 3,
  "ক": 0, "খ": 1, "গ": 2, "ঘ": 3,
};

export const STATEMENT_ALIASES = ["question", "statement", "প্রশ্ন", "original_question"];

export function validateEvidenceCsv(
  rawRows: RawRow[],
  byStatement: Map<string, MatchedQuestion>,
): EvidenceCsvResult {
  const verdicts: EvidenceVerdict[] = [];
  const evidenceInserts: EvidenceInsert[] = [];
  const draftInserts: DraftInsert[] = [];
  /** Duplicate guard inside one file: question+exam+year must be unique. */
  const seen = new Set<string>();

  rawRows.forEach((row, index) => {
    const rowNumber = index + 2; // header is row 1
    const examName = pick(row, ["exam_name", "পরীক্ষা", "exam"]);
    const yearRaw = pick(row, ["exam_year", "year", "সাল"]);
    const examYear = /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : null;
    const statement = normaliseStatement(pick(row, STATEMENT_ALIASES));
    const kindRaw = pick(row, ["match_kind", "kind"]).toLowerCase();
    const kind = ["exact", "same_concept", "related"].includes(kindRaw) ? kindRaw : "exact";

    const fail = (detail: string) =>
      verdicts.push({ row: rowNumber, examName, examYear, statement: statement.slice(0, 80), outcome: "error", detail });

    if (examName.length < 2) return fail("exam_name খালি — অনুমান করা হয় না, সারি বাতিল।");
    if (examYear === null || examYear < 1971 || examYear > 2100) {
      return fail("exam_year অনুপস্থিত/অবৈধ (১৯৭১–২১০০) — অনুমান করা হয় না, সারি বাতিল।");
    }
    if (statement.length < 8) return fail("question কলাম খালি বা খুব ছোট।");

    const dupKey = `${statement}::${examName}::${examYear}`;
    if (seen.has(dupKey)) return fail("একই ফাইলে ডুপ্লিকেট সারি (একই প্রশ্ন+পরীক্ষা+সাল)।");
    seen.add(dupKey);

    const sourceRef = pick(row, ["source_ref", "source", "উৎস"]) || null;
    const sourceUrl = pick(row, ["source_url", "url"]) || null;

    const matched = byStatement.get(statement);
    if (matched) {
      verdicts.push({
        row: rowNumber, examName, examYear, statement: statement.slice(0, 80),
        outcome: "match", detail: "বিদ্যমান প্রশ্নের সাথে মিলেছে — এভিডেন্স যুক্ত হবে।",
      });
      evidenceInserts.push({
        question_id: matched.id,
        exam_name: examName,
        exam_year: examYear,
        match_kind: kind,
        source_ref: sourceRef,
        source_url: sourceUrl,
        original_text: statement,
      });
      return;
    }

    const options = [
      pick(row, ["option_a", "a", "ক"]),
      pick(row, ["option_b", "b", "খ"]),
      pick(row, ["option_c", "c", "গ"]),
      pick(row, ["option_d", "d", "ঘ"]),
    ];
    const correctRaw = pick(row, ["correct_option", "correct", "answer", "সঠিক"]).toLowerCase();
    const correct = CORRECT_MAP[correctRaw];

    if (options.some((option) => !option) || correct === undefined) {
      return fail("প্রশ্নব্যাংকে পাওয়া যায়নি এবং অপশন/সঠিক উত্তর অসম্পূর্ণ — আগে ইমপোর্ট করুন বা কলামগুলো পূরণ করুন।");
    }

    verdicts.push({
      row: rowNumber, examName, examYear, statement: statement.slice(0, 80),
      outcome: "create_draft", detail: "নতুন খসড়া প্রশ্ন (অযাচাইকৃত, রিভিউ কিউতে যাবে) + এভিডেন্স।",
    });
    draftInserts.push({
      row: rowNumber,
      question: {
        statement,
        option_a: options[0],
        option_b: options[1],
        option_c: options[2],
        option_d: options[3],
        correct_option: correct,
        explanation: pick(row, ["explanation", "ব্যাখ্যা"]),
        source_type: "previous",
        status: "draft",
        is_verified: false,
        year: examYear,
        exam_name: examName,
        source_title: sourceRef,
        source_url: sourceUrl,
        fingerprint: fingerprintOf(statement),
      },
      evidence: {
        exam_name: examName,
        exam_year: examYear,
        match_kind: kind,
        source_ref: sourceRef,
        source_url: sourceUrl,
        original_text: statement,
      },
    });
  });

  return {
    verdicts,
    evidenceInserts,
    draftInserts,
    summary: {
      total: rawRows.length,
      matched: verdicts.filter((verdict) => verdict.outcome === "match").length,
      drafts: verdicts.filter((verdict) => verdict.outcome === "create_draft").length,
      errors: verdicts.filter((verdict) => verdict.outcome === "error").length,
    },
  };
}
