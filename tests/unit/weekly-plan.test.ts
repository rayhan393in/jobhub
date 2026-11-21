import { describe, expect, it } from "vitest";
import {
  addDays, buildWeekPlan, difficultyTargets, mondayOf, rankTopics, weekDates,
  weeklyExamComposition, type SyllabusSubject,
} from "@/lib/routines/weekly-plan";

type TopicSpec = [id: string, title: string, frequency?: number, band?: "high" | "medium" | "low" | "none"];

const subject = (id: string, topics: TopicSpec[]): SyllabusSubject => ({
  id,
  title_bn: `বিষয় ${id}`,
  topics: topics.map(([topicId, title, frequency, band]) => ({
    id: topicId,
    subject_id: id,
    title_bn: title,
    frequency,
    band,
  })),
});

describe("date helpers", () => {
  it("finds the ISO Monday of any date", () => {
    // 2026-11-21 is a Saturday; its ISO week starts Monday 2026-11-16.
    expect(mondayOf("2026-11-21")).toBe("2026-11-16");
    expect(mondayOf("2026-11-16")).toBe("2026-11-16");
    // Sunday belongs to the week that started six days earlier.
    expect(mondayOf("2026-11-22")).toBe("2026-11-16");
    expect(mondayOf("2026-11-23")).toBe("2026-11-23");
  });

  it("produces seven consecutive days", () => {
    const dates = weekDates("2026-11-16");
    expect(dates).toHaveLength(7);
    expect(dates[0]).toBe("2026-11-16");
    expect(dates[6]).toBe("2026-11-22");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("rankTopics", () => {
  it("puts counted high-frequency topics first and unknown ones last", () => {
    const ranked = rankTopics(
      subject("s", [["a", "অজানা"], ["b", "কম", 2, "low"], ["c", "বেশি", 40, "high"], ["d", "মাঝারি", 12, "medium"]]).topics,
    );
    expect(ranked.map((topic) => topic.id)).toEqual(["c", "d", "b", "a"]);
  });

  it("lets carried-over topics outrank even high-frequency ones", () => {
    const topics = subject("s", [["a", "হাই", 90, "high"], ["b", "বাকি", 1, "low"]]).topics;
    const ranked = rankTopics(topics, new Set(["b"]));
    expect(ranked[0].id).toBe("b");
  });

  it("never claims frequency for a topic with no count", () => {
    const ranked = rankTopics(subject("s", [["a", "ক", 0, "none"]]).topics);
    expect(ranked[0].frequency).toBe(0);
  });
});

describe("buildWeekPlan", () => {
  const syllabus = [
    subject("eng", [["e1", "Subject–verb agreement", 30, "high"], ["e2", "Right form of verbs", 20, "high"], ["e3", "Idioms", 5, "low"], ["e4", "Preposition", 8, "medium"]]),
    subject("math", [["m1", "শতকরা", 25, "high"], ["m2", "সুদ", 10, "medium"], ["m3", "অনুপাত", 6, "low"]]),
    subject("gk", [["g1", "বাংলাদেশের সংবিধান", 40, "high"], ["g2", "মুক্তিযুদ্ধ", 22, "high"]]),
  ];

  it("gives every day two or three distinct subjects", () => {
    const plan = buildWeekPlan(syllabus, { weekStart: "2026-11-16", weekIndex: 1, dailyMinutes: 180 });
    const byDate = new Map<string, Set<string>>();
    for (const slot of plan) {
      const set = byDate.get(slot.date) ?? new Set<string>();
      set.add(slot.subject_id);
      byDate.set(slot.date, set);
    }
    for (const [, subjects] of byDate) {
      expect(subjects.size).toBeGreaterThanOrEqual(2);
      expect(subjects.size).toBeLessThanOrEqual(3);
    }
  });

  it("never schedules the same topic twice in a week", () => {
    const plan = buildWeekPlan(syllabus, { weekStart: "2026-11-16", weekIndex: 1, dailyMinutes: 180 });
    const seen = plan.map((slot) => slot.topic_id);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("schedules every available topic exactly once before running dry", () => {
    const plan = buildWeekPlan(syllabus, { weekStart: "2026-11-16", weekIndex: 1, dailyMinutes: 180 });
    // 4 + 3 + 2 = 9 topics, all should appear.
    expect(plan).toHaveLength(9);
    expect(new Set(plan.map((slot) => slot.topic_id)).size).toBe(9);
  });

  it("skips completed topics and puts carried ones first", () => {
    const plan = buildWeekPlan(syllabus, {
      weekStart: "2026-11-16",
      weekIndex: 2,
      dailyMinutes: 180,
      completedTopicIds: ["e1", "e2", "m1"],
      priorityTopicIds: ["g2"],
    });
    const scheduled = plan.map((slot) => slot.topic_id);
    expect(scheduled).not.toContain("e1");
    expect(scheduled).not.toContain("m1");
    expect(scheduled[0]).toBe("g2");
  });

  it("returns an empty week when everything is done — it never invents a topic", () => {
    const all = syllabus.flatMap((entry) => entry.topics.map((topic) => topic.id));
    const plan = buildWeekPlan(syllabus, {
      weekStart: "2026-11-16",
      weekIndex: 3,
      dailyMinutes: 180,
      completedTopicIds: all,
    });
    expect(plan).toEqual([]);
  });

  it("labels the last day as revision and allocates real minutes", () => {
    const plan = buildWeekPlan(syllabus, { weekStart: "2026-11-16", weekIndex: 1, dailyMinutes: 180 });
    const sunday = plan.filter((slot) => slot.date === "2026-11-22");
    for (const slot of sunday) expect(slot.task_kind).toBe("revision");
    for (const slot of plan) expect(slot.minutes).toBeGreaterThanOrEqual(15);
  });

  it("says 'no data' rather than inventing a frequency", () => {
    const plan = buildWeekPlan([subject("x", [["t1", "টপিক"]])], {
      weekStart: "2026-11-16", weekIndex: 1, dailyMinutes: 60,
    });
    expect(plan[0].focus_note_bn).toContain("তথ্য নেই");
  });
});

describe("weeklyExamComposition", () => {
  const slots = [
    { date: "2026-11-16", week_index: 1, subject_id: "eng", topic_id: "e1", subtopic_id: null, minutes: 60, task_kind: "study" as const, title_bn: "", focus_note_bn: "" },
    { date: "2026-11-16", week_index: 1, subject_id: "math", topic_id: "m1", subtopic_id: null, minutes: 60, task_kind: "study" as const, title_bn: "", focus_note_bn: "" },
    { date: "2026-11-17", week_index: 1, subject_id: "eng", topic_id: "e1", subtopic_id: null, minutes: 60, task_kind: "study" as const, title_bn: "", focus_note_bn: "" },
    { date: "2026-11-17", week_index: 1, subject_id: "math", topic_id: "m2", subtopic_id: null, minutes: 30, task_kind: "study" as const, title_bn: "", focus_note_bn: "" },
  ];

  it("distributes the paper across the week's real topics", () => {
    const items = weeklyExamComposition(slots, 100);
    expect(items.reduce((sum, item) => sum + item.count, 0)).toBe(100);
    // e1 was studied twice as long as m2, so it gets more questions.
    const e1 = items.find((item) => item.topic_id === "e1")!;
    const m2 = items.find((item) => item.topic_id === "m2")!;
    expect(e1.count).toBeGreaterThan(m2.count);
  });

  it("keeps the counts summing exactly, including awkward splits", () => {
    for (const count of [7, 13, 37, 99, 100]) {
      const items = weeklyExamComposition(slots, count);
      expect(items.reduce((sum, item) => sum + item.count, 0)).toBe(count);
    }
  });

  it("never asks for more topics than there are questions", () => {
    const items = weeklyExamComposition(slots, 2);
    expect(items).toHaveLength(2);
    expect(items.every((item) => item.count === 1)).toBe(true);
  });

  it("returns nothing for an empty week", () => {
    expect(weeklyExamComposition([], 100)).toEqual([]);
  });
});

describe("difficultyTargets", () => {
  it("splits 100 questions into 60/20/10/10", () => {
    expect(difficultyTargets(100)).toEqual({ previous: 60, hard: 20, easy: 10, medium: 10 });
  });

  it("always sums to the question count", () => {
    for (const count of [1, 3, 7, 20, 50, 99, 100, 137]) {
      const targets = difficultyTargets(count);
      const sum = targets.previous + targets.hard + targets.easy + targets.medium;
      expect(sum).toBe(count);
    }
  });

  it("gives a 10-question paper the closest honest split", () => {
    const targets = difficultyTargets(10);
    expect(targets).toEqual({ previous: 6, hard: 2, easy: 1, medium: 1 });
  });

  it("puts rounding remainder on previous-year questions", () => {
    // 5 questions: floor gives 3/1/0/0 = 4, the fifth goes to 'previous'.
    expect(difficultyTargets(5)).toEqual({ previous: 4, hard: 1, easy: 0, medium: 0 });
  });

  it("rejects a mix that does not total 100", () => {
    expect(() => difficultyTargets(100, { previous: 50, hard: 20, easy: 10, medium: 10 })).toThrow(/must total 100/);
  });
});
