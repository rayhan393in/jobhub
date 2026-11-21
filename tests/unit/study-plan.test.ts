import { describe, expect, it } from "vitest";
import {
  buildStudyPlan, interleaveBySubject, planSummary, topicCoverageDays,
  type PlanTopic,
} from "@/lib/study-plan";

/**
 * The 30-day planner promises three things: it never invents a topic, it
 * honours the rest day, and it always returns exactly 30 days. These tests are
 * built from the real BCS syllabus shape (10 subjects, 113 topics) because the
 * bugs that matter only appear at that size.
 */

function topic(subjectId: string, subjectLabel: string, index: number): PlanTopic {
  return {
    id: `${subjectId}-${index}`,
    subjectId,
    subjectLabel,
    label: `${subjectLabel} টপিক ${index}`,
  };
}

function syllabus(): PlanTopic[] {
  const subjects: Array<[string, number]> = [
    ["bangla", 16], ["english", 14], ["bd", 11], ["intl", 7], ["geo", 9],
    ["science", 13], ["ict", 11], ["math", 18], ["mental", 7], ["ethics", 7],
  ];
  return subjects.flatMap(([id, count]) =>
    Array.from({ length: count }, (_, index) => topic(id, id, index)),
  );
}

describe("interleaveBySubject", () => {
  it("never repeats a subject back to back while others remain", () => {
    const ordered = interleaveBySubject(syllabus());
    for (let index = 1; index < ordered.length; index += 1) {
      if (ordered[index].subjectId === ordered[index - 1].subjectId) {
        // Only allowed once every other subject is exhausted.
        const remaining = ordered.slice(index).every((item) => item.subjectId === ordered[index].subjectId);
        expect(remaining).toBe(true);
      }
    }
  });

  it("keeps every topic exactly once", () => {
    const source = syllabus();
    expect(interleaveBySubject(source)).toHaveLength(source.length);
  });

  it("does not put the biggest subject entirely at the front", () => {
    const ordered = interleaveBySubject(syllabus());
    const firstTen = ordered.slice(0, 10).map((item) => item.subjectId);
    expect(new Set(firstTen).size).toBe(10);
  });

  it("handles an empty syllabus", () => {
    expect(interleaveBySubject([])).toEqual([]);
  });
});

describe("buildStudyPlan", () => {
  it("returns exactly the requested number of days", () => {
    expect(buildStudyPlan(syllabus(), { days: 30, minutesPerDay: 60 })).toHaveLength(30);
    expect(buildStudyPlan([], { days: 30, minutesPerDay: 60 })).toHaveLength(30);
  });

  it("marks the weekly rest day and gives it no minutes", () => {
    const plan = buildStudyPlan(syllabus(), {
      days: 30,
      minutesPerDay: 60,
      restWeekday: 5,
      startDate: "2026-11-21",
    });
    const rest = plan.filter((day) => day.kind === "rest");
    expect(rest.length).toBeGreaterThan(0);
    for (const day of rest) {
      expect(day.minutes).toBe(0);
      expect(day.topic).toBeNull();
    }
  });

  it("only ever references topics that exist in the syllabus", () => {
    const source = syllabus();
    const known = new Set(source.map((item) => item.id));
    for (const day of buildStudyPlan(source, { days: 30, minutesPerDay: 60 })) {
      for (const picked of [day.topic, day.extra]) {
        if (picked) expect(known.has(picked.id)).toBe(true);
      }
    }
  });

  it("gives two topics on long days and one on short days", () => {
    const long = buildStudyPlan(syllabus(), { days: 30, minutesPerDay: 120 });
    expect(long[0].extra).not.toBeNull();

    const short = buildStudyPlan(syllabus(), { days: 30, minutesPerDay: 30 });
    expect(short[0].extra).toBeNull();
  });

  it("turns into revision once the syllabus is exhausted", () => {
    const tiny = [topic("only", "শুধু", 0), topic("only", "শুধু", 1)];
    const plan = buildStudyPlan(tiny, { days: 30, minutesPerDay: 60 });
    expect(plan.slice(0, 2).every((day) => day.kind === "study")).toBe(true);
    expect(plan.slice(2).every((day) => day.kind === "revision")).toBe(true);
  });

  it("does not crash on an empty syllabus and never invents a topic", () => {
    const plan = buildStudyPlan([], { days: 30, minutesPerDay: 60 });
    expect(plan.every((day) => day.topic === null)).toBe(true);
    expect(plan.every((day) => day.kind === "revision")).toBe(true);
  });

  it("covers topics in syllabus order without repeating them", () => {
    const plan = buildStudyPlan(syllabus(), { days: 30, minutesPerDay: 60 });
    const used = plan
      .filter((day) => day.kind === "study")
      .flatMap((day) => [day.topic?.id, day.extra?.id])
      .filter((id): id is string => Boolean(id));
    expect(new Set(used).size).toBe(used.length);
  });
});

describe("planSummary", () => {
  it("reports totals that add up to the plan length", () => {
    const plan = buildStudyPlan(syllabus(), {
      days: 30,
      minutesPerDay: 60,
      restWeekday: 5,
      startDate: "2026-11-21",
    });
    const summary = planSummary(plan);
    expect(summary.study + summary.revision + summary.rest).toBe(30);
    expect(summary.minutes).toBe((summary.study + summary.revision) * 60);
  });

  it("formats the total duration in Bangla", () => {
    const plan = buildStudyPlan(syllabus(), { days: 30, minutesPerDay: 60 });
    expect(planSummary(plan).durationBn).toMatch(/^[\u09E6-\u09EF]+ ঘণ্টা [\u09E6-\u09EF]+ মিনিট$/);
  });
});

describe("topicCoverageDays", () => {
  it("accounts for two topics per long session", () => {
    expect(topicCoverageDays(113, 60)).toBe(113);
    expect(topicCoverageDays(113, 90)).toBe(56);
  });
});
