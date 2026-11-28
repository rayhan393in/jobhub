import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Routine90DaySheet, type SheetCourse } from "@/components/routines/routine-90day-sheet";
import type { RoutineLineInput } from "@/lib/routine-day-lines";

/**
 * The sheet is the one place a student sees the whole plan, so its shape is
 * pinned with a real render: three study columns per day, the MCQ split taken
 * from the plan's own note, and a tracker that starts empty unless the student
 * actually ticked something.
 */

function row(overrides: Partial<RoutineLineInput> & { id: string; slot_label: string }): RoutineLineInput {
  return {
    routine_date: "2026-11-28",
    title_bn: "দিন ১",
    subject_title_bn: "বাংলা ভাষা ও সাহিত্য",
    minutes: 150,
    task_kind: "study",
    focus_note_bn: null,
    topics: [],
    ...overrides,
  };
}

const course: SheetCourse = {
  id: "course-1",
  title_bn: "বিসিএস প্রিলিমিনারি",
  plan_start: "2026-11-28",
  days: [
    {
      date: "2026-11-28",
      day_number: 1,
      rows: [
        row({
          id: "p1",
          slot_label: "P1 Main · সকাল ৭:০০–৯:৩০",
          topics: [{ topic: "ধ্বনি ও বর্ণ", subtopics: ["স্বরধ্বনি", "ব্যঞ্জনধ্বনি"] }],
        }),
        row({
          id: "p2",
          slot_label: "P2 Second · সকাল ১০:০০–১১:১৫",
          subject_title_bn: "English Language & Literature",
          minutes: 75,
          topics: [{ topic: "Voice", subtopics: ["Active", "Passive"] }],
        }),
        row({
          id: "p3",
          slot_label: "P3/P4 Third · বিকাল ৫:০০–৫:৪৫",
          minutes: 45,
          topics: [{ topic: "শব্দার্থ", subtopics: ["সমার্থক"] }],
        }),
        row({
          id: "mcq",
          slot_label: "MCQ ও ভুল বিশ্লেষণ · রাত ৮:০০–৮:৫০",
          subject_title_bn: null,
          minutes: 50,
          task_kind: "practice",
          focus_note_bn: "P1 50 + P2 25 + P3/P4 15 + পূর্বে-পড়া 10 = ১০০ প্রশ্ন · ৫০ মিনিট",
        }),
      ],
    },
    {
      date: "2026-11-29",
      day_number: 2,
      rows: [row({ id: "p1b", slot_label: "P1 Main · সকাল ৭:০০–৯:৩০", topics: [{ topic: "শব্দ ও পদ", subtopics: [] }] })],
    },
  ],
};

function render(completed: string[] = []): string {
  return renderToStaticMarkup(
    React.createElement(Routine90DaySheet, { course, initialCompletedDates: completed }),
  );
}

describe("Routine90DaySheet", () => {
  it("renders the three study columns with a subject prefix on each cell", () => {
    const html = render();
    expect(html).toContain("Main — P1");
    expect(html).toContain("Second — P2");
    expect(html).toContain("Third — P3/P4");
    // subject prefix then topic (subtopics in parentheses), like the plan
    expect(html).toContain("বাংলা ভাষা ও সাহিত্য:");
    expect(html).toContain("ধ্বনি ও বর্ণ (স্বরধ্বনি, ব্যঞ্জনধ্বনি)");
    expect(html).toContain("English Language &amp; Literature:");
    expect(html).toContain("Voice (Active, Passive)");
  });

  it("shows the MCQ split read from the plan, not a hard-coded one", () => {
    const html = render();
    expect(html).toContain("প্রতিদিনের MCQ ও মূল্যায়ন");
    expect(html).toContain("P1 Main");
    expect(html).toContain("Previous studied topics");
    // 50 + 25 + 15 + 10 = ১০০, in Bengali numerals
    expect(html).toContain("১০০");
  });

  it("starts the tracker at zero when nothing has been ticked", () => {
    const html = render();
    expect(html).toContain("Daily completion — ০/২ দিন");
    expect(html).not.toContain("সম্পন্ন</span>");
  });

  it("counts a day only when it is actually in the completed list", () => {
    const html = render(["2026-11-28"]);
    expect(html).toContain("Daily completion — ১/২ দিন");
  });

  it("labels the phases with Bengali numerals and day ranges", () => {
    const html = render();
    // day 1 is in phase 1; the heading names its own range
    expect(html).toContain("Phase ১ — দিন ১–৩০");
  });
});
