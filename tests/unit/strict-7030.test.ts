import { describe, expect, it } from "vitest";
import {
  hasCriticalFailure,
  splitPyqAcrossSections,
  strict7030Checks,
  type PyqAvailability,
} from "@/lib/daily-exam";

/**
 * Strict 70:30 maths + 8-point checklist — the exact logic the admin panel
 * previews and jh_build_paper_7030 enforces.
 */

function availability(overrides: Partial<PyqAvailability> = {}): PyqAvailability {
  return {
    pyq_total: 0, pyq_ready: 0, pyq_missing_meta: 0,
    practice_pool: 0, missing_explanation: 0,
    ...overrides,
  };
}

describe("splitPyqAcrossSections", () => {
  it("splits the standard 90/10 paper into exactly 63 + 7 PYQs", () => {
    expect(splitPyqAcrossSections([90, 10], 70)).toEqual([63, 7]);
  });

  it("keeps the total exact under rounding (largest remainder)", () => {
    const alloc = splitPyqAcrossSections([33, 33, 34], 70);
    expect(alloc.reduce((sum, n) => sum + n, 0)).toBe(70);
    expect(alloc).toEqual([23, 23, 24]);
  });

  it("handles zero quotas and empty inputs", () => {
    expect(splitPyqAcrossSections([90, 10], 0)).toEqual([0, 0]);
    expect(splitPyqAcrossSections([], 70)).toEqual([]);
  });
});

describe("strict7030Checks (8-point pre-publish validation)", () => {
  const baseSections = (mainReady: number, secondaryReady: number) => [
    {
      label: "মূল", count: 90, pyqNeed: 63,
      availability: availability({ pyq_total: mainReady, pyq_ready: mainReady, practice_pool: 40 }),
    },
    {
      label: "সহ", count: 10, pyqNeed: 7,
      availability: availability({ pyq_total: secondaryReady, pyq_ready: secondaryReady, practice_pool: 10 }),
    },
  ];

  it("passes all critical checks when 70 ready PYQs and enough practice exist", () => {
    const checks = strict7030Checks({
      questionCount: 100, pyqCount: 70, practiceCount: 30,
      sections: baseSections(63, 7),
    });
    expect(checks).toHaveLength(8);
    expect(hasCriticalFailure(checks)).toBe(false);
  });

  it("blocks at 69 ready PYQs and SHOWS the real counts — never a fake ratio", () => {
    const checks = strict7030Checks({
      questionCount: 100, pyqCount: 70, practiceCount: 30,
      sections: baseSections(62, 7),
    });
    const pyqCheck = checks.find((check) => check.rule.includes("PYQ কোটা"));
    expect(pyqCheck?.ok).toBe(false);
    expect(pyqCheck?.critical).toBe(true);
    expect(pyqCheck?.detail).toContain("62/63");
    expect(pyqCheck?.detail).toContain("practice প্রশ্ন দিয়ে পূরণ করা হবে না");
    expect(hasCriticalFailure(checks)).toBe(true);
  });

  it("flags a practice shortfall as critical too", () => {
    const sections = baseSections(63, 7);
    sections[0].availability.practice_pool = 20; // needs 27
    const checks = strict7030Checks({
      questionCount: 100, pyqCount: 70, practiceCount: 30, sections,
    });
    const practiceCheck = checks.find((check) => check.rule.includes("Practice"));
    expect(practiceCheck?.ok).toBe(false);
    expect(practiceCheck?.detail).toContain("20/27");
  });

  it("surfaces metadata-less PYQs as a warning (not counted, not substituted)", () => {
    const sections = baseSections(63, 7);
    sections[0].availability.pyq_missing_meta = 12;
    const checks = strict7030Checks({
      questionCount: 100, pyqCount: 70, practiceCount: 30, sections,
    });
    const metaCheck = checks.find((check) => check.rule.includes("মেটাডাটা"));
    expect(metaCheck?.ok).toBe(false);
    expect(metaCheck?.critical).toBe(false); // warning: the ready-count checks stay authoritative
    expect(metaCheck?.detail).toContain("12");
  });

  it("fails the sum check when pyq + practice ≠ total", () => {
    const checks = strict7030Checks({
      questionCount: 100, pyqCount: 70, practiceCount: 29,
      sections: baseSections(63, 7),
    });
    expect(checks[0].ok).toBe(false);
    expect(hasCriticalFailure(checks)).toBe(true);
  });
});
