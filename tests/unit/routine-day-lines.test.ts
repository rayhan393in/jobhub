import { describe, expect, it } from "vitest";
import {
  buildDayLines,
  dayNumber,
  topicsForRoutine,
  type RoutineLineInput,
} from "@/lib/routine-day-lines";

const base: Omit<RoutineLineInput, "id" | "title_bn"> = {
  routine_date: "2026-11-22",
  subject_title_bn: null,
  minutes: 90,
  slot_label: null,
  task_kind: "study",
  focus_note_bn: null,
  topics: [],
};

describe("buildDayLines (shared by /routines web view and the PDF sheet)", () => {
  it("merges same-subject study slots into one line with united topics", () => {
    const lines = buildDayLines([
      {
        ...base,
        id: "a",
        title_bn: "দিন ১ — বাংলা",
        subject_title_bn: "বাংলা",
        minutes: 120,
        slot_label: "সকাল ৭:০০–৯:০০",
        topics: [{ topic: "ধ্বনি ও বর্ণ", subtopics: ["ধ্বনিবিজ্ঞান"] }],
      },
      {
        ...base,
        id: "b",
        title_bn: "দিন ১ — বাংলা",
        subject_title_bn: "বাংলা",
        minutes: 90,
        slot_label: "সকাল ৯:১৫–১০:৪৫",
        topics: [{ topic: "ধ্বনি ও বর্ণ", subtopics: ["ধ্বনিবিজ্ঞান", "ধ্বনির উচ্চারণ"] }],
      },
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0].minutes).toBe(210);
    expect(lines[0].slots).toEqual(["সকাল ৭:০০–৯:০০", "সকাল ৯:১৫–১০:৪৫"]);
    expect(lines[0].topics).toEqual([
      { topic: "ধ্বনি ও বর্ণ", subtopics: ["ধ্বনিবিজ্ঞান", "ধ্বনির উচ্চারণ"] },
    ]);
  });

  it("keeps different task kinds of the same subject separate", () => {
    const lines = buildDayLines([
      { ...base, id: "a", title_bn: "পড়া", subject_title_bn: "গণিত", task_kind: "study" },
      { ...base, id: "b", title_bn: "রিভিশন", subject_title_bn: "গণিত", task_kind: "revision" },
    ]);
    expect(lines).toHaveLength(2);
  });

  it("drops the nightly দৈনিক রিভিশন filler but keeps weekly revision", () => {
    const lines = buildDayLines([
      { ...base, id: "a", title_bn: "দৈনিক রিভিশন — দিন ২", task_kind: "revision" },
      { ...base, id: "b", title_bn: "সাপ্তাহিক রিভিশন — সপ্তাহ ১", task_kind: "revision" },
      { ...base, id: "c", title_bn: "সাপ্তাহিক পরীক্ষা — সপ্তাহ ১", task_kind: "exam", minutes: 120 },
    ]);
    expect(lines.map((l) => l.label)).toEqual([
      "সাপ্তাহিক রিভিশন — সপ্তাহ ১",
      "সাপ্তাহিক পরীক্ষা — সপ্তাহ ১",
    ]);
  });
});

describe("topicsForRoutine", () => {
  it("prefers study_plan_assignments pairs when present", () => {
    const assigned = new Map([["নেটওয়ার্ক উপপাদ্য", ["থেভেনিন ও নর্টন", "সুপারপজিশন"]]]);
    expect(topicsForRoutine(assigned, ["পুরনো টপিক"], ["পুরনো সাব"])).toEqual([
      { topic: "নেটওয়ার্ক উপপাদ্য", subtopics: ["থেভেনিন ও নর্টন", "সুপারপজিশন"] },
    ]);
  });

  it("falls back to row arrays, pairing subtopics only for a single topic", () => {
    expect(topicsForRoutine(undefined, ["ক"], ["১", "২"])).toEqual([
      { topic: "ক", subtopics: ["১", "২"] },
    ]);
    expect(topicsForRoutine(undefined, ["ক", "খ"], ["১"])).toEqual([
      { topic: "ক", subtopics: [] },
      { topic: "খ", subtopics: [] },
    ]);
  });
});

describe("dayNumber", () => {
  it("counts from the course's first published date", () => {
    expect(dayNumber("2026-11-22", "2026-11-22")).toBe(1);
    expect(dayNumber("2026-12-05", "2026-11-22")).toBe(14);
  });
});
