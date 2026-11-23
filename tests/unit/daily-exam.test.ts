import { describe, expect, it } from "vitest";
import {
  daysBetween, hasCriticalFailure, planSubject, resolveRotation,
  splitNinetyTen, validateDailyPlan, type RotationSlot,
} from "@/lib/daily-exam";

/** The seeded 14-day template, abstracted to ids S1..S10. */
const S = (n: number) => `00000000-0000-4000-8000-00000000000${n.toString(16)}`;
const SLOTS: RotationSlot[] = [
  { position: 1,  main_subject_id: S(1), secondary_subject_id: S(2),  is_grand: false },
  { position: 2,  main_subject_id: S(2), secondary_subject_id: S(3),  is_grand: false },
  { position: 3,  main_subject_id: S(3), secondary_subject_id: S(4),  is_grand: false },
  { position: 4,  main_subject_id: S(4), secondary_subject_id: S(5),  is_grand: false },
  { position: 5,  main_subject_id: S(5), secondary_subject_id: S(6),  is_grand: false },
  { position: 6,  main_subject_id: S(6), secondary_subject_id: S(7),  is_grand: false },
  { position: 7,  main_subject_id: null, secondary_subject_id: null,  is_grand: true },
  { position: 8,  main_subject_id: S(7), secondary_subject_id: S(8),  is_grand: false },
  { position: 9,  main_subject_id: S(8), secondary_subject_id: S(9),  is_grand: false },
  { position: 10, main_subject_id: S(9), secondary_subject_id: S(10), is_grand: false },
  { position: 11, main_subject_id: S(10), secondary_subject_id: S(1), is_grand: false },
  { position: 12, main_subject_id: S(1), secondary_subject_id: S(3),  is_grand: false },
  { position: 13, main_subject_id: S(2), secondary_subject_id: S(6),  is_grand: false },
  { position: 14, main_subject_id: null, secondary_subject_id: null,  is_grand: true },
];
const ANCHOR = "2026-11-23";

describe("rotation engine", () => {
  it("day 1 resolves to slot 1 (বাংলা main / English secondary)", () => {
    const day = resolveRotation(ANCHOR, "2026-11-23", SLOTS);
    expect(day).toMatchObject({ kind: "daily", position: 1, mainSubjectId: S(1), secondarySubjectId: S(2) });
  });

  it("days 7 and 14 are Weekly Grand Exam days, not 90:10 days", () => {
    expect(resolveRotation(ANCHOR, "2026-11-29", SLOTS)).toMatchObject({ kind: "grand", position: 7 });
    expect(resolveRotation(ANCHOR, "2026-12-06", SLOTS)).toMatchObject({ kind: "grand", position: 14 });
  });

  it("continues intelligently after day 14: day 15 wraps to slot 1, day 22 to slot 8", () => {
    expect(resolveRotation(ANCHOR, "2026-12-07", SLOTS)).toMatchObject({ kind: "daily", position: 1 });
    expect(resolveRotation(ANCHOR, "2026-12-14", SLOTS)).toMatchObject({ kind: "daily", position: 8 });
  });

  it("handles dates before the anchor without going negative", () => {
    const day = resolveRotation(ANCHOR, "2026-11-22", SLOTS); // -1 → slot 14
    expect(day).toMatchObject({ kind: "grand", position: 14 });
  });

  it("every subject appears as main at least once across the template (fair rotation)", () => {
    const mains = new Set(SLOTS.filter((slot) => !slot.is_grand).map((slot) => slot.main_subject_id));
    for (let n = 1; n <= 10; n += 1) expect(mains).toContain(S(n));
  });

  it("no slot pairs a subject with itself", () => {
    for (const slot of SLOTS) {
      if (!slot.is_grand) expect(slot.main_subject_id).not.toBe(slot.secondary_subject_id);
    }
  });

  it("an admin override replaces the template pair for that date only", () => {
    const day = resolveRotation(ANCHOR, "2026-11-23", SLOTS, {
      main_subject_id: S(8), secondary_subject_id: S(9),
    });
    expect(day).toMatchObject({ kind: "daily", mainSubjectId: S(8), secondarySubjectId: S(9), overridden: true });
  });

  it("daysBetween is exact across month boundaries", () => {
    expect(daysBetween("2026-11-23", "2026-12-07")).toBe(14);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
  });
});

describe("90:10 split", () => {
  it("standard paper: 100 → 90 + 10", () => {
    expect(splitNinetyTen(100)).toEqual({ main: 90, secondary: 10 });
  });
  it("scaled papers keep the ratio: 50 → 45+5, 60 → 54+6, 30 → 27+3", () => {
    expect(splitNinetyTen(50)).toEqual({ main: 45, secondary: 5 });
    expect(splitNinetyTen(60)).toEqual({ main: 54, secondary: 6 });
    expect(splitNinetyTen(30)).toEqual({ main: 27, secondary: 3 });
  });
  it("secondary never rounds to zero", () => {
    expect(splitNinetyTen(20).secondary).toBeGreaterThanOrEqual(1);
  });
});

describe("subject planning from routine topics", () => {
  it("distributes across eligible topics proportionally and sums exactly", () => {
    const plan = planSubject(S(1), 90, [
      { topicId: "t1", available: 120 },
      { topicId: "t2", available: 40 },
      { topicId: "t3", available: 8 },
    ], 200, false);
    expect(plan.planned).toBe(90);
    expect(plan.items.every((item) => item.subject_id === S(1))).toBe(true);
    // No topic asked for more than its pool.
    const byTopic = Object.fromEntries(plan.items.map((item) => [item.topic_id, item.count]));
    expect(byTopic.t1).toBeLessThanOrEqual(120);
    expect(byTopic.t2).toBeLessThanOrEqual(40);
    expect(byTopic.t3).toBeLessThanOrEqual(8);
  });

  it("comes up short (never invents questions) when the pool is too small", () => {
    const plan = planSubject(S(1), 90, [{ topicId: "t1", available: 25 }], 25, false);
    expect(plan.planned).toBe(25);
    expect(plan.planned).toBeLessThan(plan.requested);
  });

  it("no routine topics + fallback OFF → empty plan (blocks, never whole-subject silently)", () => {
    const plan = planSubject(S(1), 90, [], 300, false);
    expect(plan.planned).toBe(0);
    expect(plan.items).toHaveLength(0);
    expect(plan.usedWholeSubjectFallback).toBe(false);
  });

  it("no routine topics + fallback ON → whole-subject scope, flagged for the admin", () => {
    const plan = planSubject(S(1), 90, [], 300, true);
    expect(plan.planned).toBe(90);
    expect(plan.usedWholeSubjectFallback).toBe(true);
    expect(plan.items).toEqual([{ subject_id: S(1), count: 90 }]);
  });
});

describe("pre-publish validation (spec section 9)", () => {
  const base = {
    questionCount: 100,
    mainSubjectId: S(1),
    secondarySubjectId: S(2),
    subjectsBelongToCourse: true,
    durationMinutes: 60,
    mix: { previous: 0, easy: 30, medium: 50, hard: 20 },
    startsInFuture: true,
  };
  const fullMain = planSubject(S(1), 90, [{ topicId: "t1", available: 200 }], 200, false);
  const fullSecondary = planSubject(S(2), 10, [{ topicId: "t9", available: 40 }], 40, false);

  it("a complete 90+10 plan passes every critical rule", () => {
    const checks = validateDailyPlan({ ...base, mainPlan: fullMain, secondaryPlan: fullSecondary });
    expect(hasCriticalFailure(checks)).toBe(false);
    expect(checks.find((check) => check.rule === "মোট প্রশ্ন")?.ok).toBe(true);
  });

  it("insufficient main-subject questions is a CRITICAL failure with the shortfall shown", () => {
    const shortMain = planSubject(S(1), 90, [{ topicId: "t1", available: 30 }], 30, false);
    const checks = validateDailyPlan({ ...base, mainPlan: shortMain, secondaryPlan: fullSecondary });
    expect(hasCriticalFailure(checks)).toBe(true);
    const rule = checks.find((check) => check.rule === "মূল বিষয়ের ভাগ (৯০%)");
    expect(rule?.ok).toBe(false);
    expect(rule?.detail).toContain("30/90");
  });

  it("same main and secondary subject is a CRITICAL failure", () => {
    const checks = validateDailyPlan({
      ...base, secondarySubjectId: S(1), mainPlan: fullMain, secondaryPlan: fullSecondary,
    });
    expect(checks.find((check) => check.rule === "মূল ও সহ-বিষয় ভিন্ন")?.ok).toBe(false);
    expect(hasCriticalFailure(checks)).toBe(true);
  });

  it("difficulty mix that does not sum to 100 blocks publishing", () => {
    const checks = validateDailyPlan({
      ...base, mix: { previous: 10, easy: 30, medium: 50, hard: 20 },
      mainPlan: fullMain, secondaryPlan: fullSecondary,
    });
    expect(checks.find((check) => check.rule === "কঠিনতা বণ্টন")?.ok).toBe(false);
  });

  it("whole-subject fallback is a visible WARNING, not a silent substitution", () => {
    const fallbackMain = planSubject(S(1), 90, [], 300, true);
    const checks = validateDailyPlan({ ...base, mainPlan: fallbackMain, secondaryPlan: fullSecondary });
    const rule = checks.find((check) => check.rule === "সিলেবাস-ভিত্তিক প্রশ্ন নির্বাচন");
    expect(rule?.ok).toBe(false);
    expect(rule?.critical).toBe(false); // warning — admin explicitly opted in
    expect(hasCriticalFailure(checks)).toBe(false);
  });
});
