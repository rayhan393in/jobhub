import { describe, expect, it } from "vitest";
import { parseCsvRows } from "@/lib/routines/parse";
import { validateEvidenceCsv, type MatchedQuestion } from "@/lib/evidence/validate";

/**
 * Evidence CSV import — the validation rules the data-quality spec demands:
 * exam name + year are mandatory and never inferred; matched rows attach
 * evidence only; unmatched rows create drafts only with a full body;
 * duplicates inside a file are rejected.
 */

const HEADER =
  "exam_name,exam_year,question,subject,topic,source_ref,source_url,option_a,option_b,option_c,option_d,correct_option,explanation,match_kind";

const EXISTING = "What is the plural form of 'ox'?";
const bank = new Map<string, MatchedQuestion>([
  [EXISTING, { id: "11111111-1111-4111-8111-111111111111", source_type: "previous" }],
]);

function run(lines: string[], map = bank) {
  return validateEvidenceCsv(parseCsvRows([HEADER, ...lines].join("\n")), map);
}

describe("evidence CSV validation", () => {
  it("accepts a valid row matching an existing question (evidence only, no draft)", () => {
    const result = run([`৪০তম বিসিএস প্রিলিমিনারি,2018,${EXISTING},English,Parts of Speech,৪০তম প্রশ্নপত্র,,,,,,,,exact`]);
    expect(result.summary).toEqual({ total: 1, matched: 1, drafts: 0, errors: 0 });
    expect(result.evidenceInserts).toHaveLength(1);
    expect(result.evidenceInserts[0]).toMatchObject({
      question_id: "11111111-1111-4111-8111-111111111111",
      exam_name: "৪০তম বিসিএস প্রিলিমিনারি",
      exam_year: 2018,
      match_kind: "exact",
    });
    expect(result.draftInserts).toHaveLength(0);
  });

  it("rejects a row with a missing exam name — never inferred", () => {
    const result = run([`,2018,${EXISTING},,,,,,,,,,,`]);
    expect(result.summary.errors).toBe(1);
    expect(result.verdicts[0].outcome).toBe("error");
    expect(result.verdicts[0].detail).toContain("exam_name");
  });

  it("rejects a row with a missing year — never inferred from question text", () => {
    const result = run([`৪০তম বিসিএস,,${EXISTING} (১৯৭২ সালে গৃহীত),,,,,,,,,,,`]);
    expect(result.summary.errors).toBe(1);
    expect(result.verdicts[0].detail).toContain("exam_year");
    // The year inside the question text must NOT be picked up.
    expect(result.evidenceInserts).toHaveLength(0);
  });

  it("rejects out-of-range and non-numeric years", () => {
    const bad = run([
      `৪০তম বিসিএস,1950,${EXISTING},,,,,,,,,,,`,
      `৪০তম বিসিএস,20X8,${EXISTING},,,,,,,,,,,`,
      `৪০তম বিসিএস,2150,${EXISTING},,,,,,,,,,,`,
    ]);
    expect(bad.summary.errors).toBe(3);
  });

  it("missing source reference is allowed but recorded as null (optional metadata)", () => {
    const result = run([`৪০তম বিসিএস,2018,${EXISTING},,,,,,,,,,,`]);
    expect(result.summary.matched).toBe(1);
    expect(result.evidenceInserts[0].source_ref).toBeNull();
  });

  it("detects duplicate rows inside one file (same question+exam+year)", () => {
    const line = `৪০তম বিসিএস,2018,${EXISTING},,,,,,,,,,,`;
    const result = run([line, line]);
    expect(result.summary.matched).toBe(1);
    expect(result.summary.errors).toBe(1);
    expect(result.verdicts[1].detail).toContain("ডুপ্লিকেট");
  });

  it("same question in two different exams/years is two evidence rows, not a duplicate", () => {
    const result = run([
      `৪০তম বিসিএস,2018,${EXISTING},,,,,,,,,,,`,
      `৪১তম বিসিএস,2019,${EXISTING},,,,,,,,,,,`,
    ]);
    expect(result.summary.matched).toBe(2);
    expect(result.summary.errors).toBe(0);
  });

  it("unmatched row WITHOUT a full body is rejected, not auto-created", () => {
    const result = run([`৪০তম বিসিএস,2018,এই প্রশ্নটি ব্যাংকে নেই কোথাও,,,,,,,,,,,`]);
    expect(result.summary.errors).toBe(1);
    expect(result.draftInserts).toHaveLength(0);
    expect(result.verdicts[0].detail).toContain("অসম্পূর্ণ");
  });

  it("unmatched row WITH options + correct answer becomes an UNVERIFIED draft", () => {
    const result = run([
      `৪০তম বিসিএস,2018,এই প্রশ্নটি ব্যাংকে নেই কোথাও,,,উৎস বই,,বিকল্প ক,বিকল্প খ,বিকল্প গ,বিকল্প ঘ,b,ব্যাখ্যা,exact`,
    ]);
    expect(result.summary.drafts).toBe(1);
    const draft = result.draftInserts[0].question;
    expect(draft.status).toBe("draft");
    expect(draft.is_verified).toBe(false);
    expect(draft.source_type).toBe("previous");
    expect(draft.correct_option).toBe(1);
    expect(result.draftInserts[0].evidence.exam_year).toBe(2018);
  });

  it("rejects an invalid correct answer on an unmatched row", () => {
    const result = run([
      `৪০তম বিসিএস,2018,এই প্রশ্নটি ব্যাংকে নেই কোথাও,,,,,ক,খ,গ,ঘ,z,,exact`,
    ]);
    expect(result.summary.errors).toBe(1);
  });

  it("normalises whitespace before matching so trivial spacing differences still match", () => {
    const result = run([`৪০তম বিসিএস,2018,"What  is the plural   form of 'ox'?",,,,,,,,,,,`]);
    expect(result.summary.matched).toBe(1);
  });

  it("falls back to exact match_kind when the column holds garbage", () => {
    const result = run([`৪০তম বিসিএস,2018,${EXISTING},,,,,,,,,,,definitely_wrong`]);
    expect(result.evidenceInserts[0].match_kind).toBe("exact");
  });
});
