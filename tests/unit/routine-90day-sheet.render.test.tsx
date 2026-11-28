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
  it("leads each slot row with its own colour-coded label", () => {
    const html = render();
    // the slot leads the row, so the three pillars read as separate things
    expect(html).toContain("Main · P1");
    expect(html).toContain("Second · P2");
    expect(html).toContain("Third · P3/P4");
    // each label carries its own accent colour, not just navy-on-white
    expect(html).toContain("#c62f2f");
    expect(html).toContain("#9c5800");
    expect(html).toContain("#17795c");
  });

  it("shows the subject as a heading and subtopics on their own line", () => {
    const html = render();
    expect(html).toContain("বাংলা ভাষা ও সাহিত্য");
    expect(html).toContain("ধ্বনি ও বর্ণ");
    expect(html).toContain("স্বরধ্বনি · ব্যঞ্জনধ্বনি");
    expect(html).toContain("English Language &amp; Literature");
    expect(html).toContain("Voice");
    expect(html).toContain("Active · Passive");
  });

  it("uses Bengali numerals rather than Latin digits", () => {
    const html = render();
    expect(html).toContain("দিন ১");
    expect(html).toContain("দিন ২");
    // day minutes render as ৩২০ (150+75+45+50), not "320"
    expect(html).toContain("৩২০");
    expect(html).not.toMatch(/দিন\s+1\b/);
  });

  it("shows the MCQ split read from the plan, not a hard-coded one", () => {
    const html = render();
    expect(html).toContain("প্রতিদিনের MCQ ও মূল্যায়ন");
    expect(html).toContain("P1 Main");
    expect(html).toContain("আগে পড়া টপিক");
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
    expect(html).toContain("Phase ১");
    expect(html).toContain("দিন ১–৩০");
  });
});

/**
 * Contrast is the one thing a screenshot review keeps catching, so the tokens
 * the routine leans on are pinned to their measured WCAG AA ratios. Flat
 * #828aae body text on white was 3.39:1 — below AA — which is what made the
 * Bangla look "হালকা ও অস্পষ্ট".
 */
describe("routine contrast (WCAG AA, 4.5:1 for normal text)", () => {
  function luminance(hex: string): number {
    const clean = hex.replace("#", "");
    const channels = [0, 2, 4].map((i) => Number.parseInt(clean.slice(i, i + 2), 16) / 255);
    const linear = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  }
  function contrast(fg: string, bg: string): number {
    const a = luminance(fg);
    const b = luminance(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }

  const pairs: [string, string, string][] = [
    ["subtle text on white", "#68708f", "#ffffff"],
    ["subtle text on muted surface", "#68708f", "#f7f8fc"],
    ["subtle text on table head", "#68708f", "#f4f6fb"],
    ["muted text on white", "#5d6489", "#ffffff"],
    ["P1 pill", "#c62f2f", "#fbe6e6"],
    ["P2 pill", "#9c5800", "#fcecd8"],
    ["P3 pill", "#17795c", "#dcf2e9"],
    ["white on the done button", "#ffffff", "#157a43"],
    ["white on the day header", "#ffffff", "#25306b"],
    ["tracker chip text", "#3f4866", "#eef0f7"],
  ];

  it.each(pairs)("%s clears 4.5:1", (_name, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("rejects the old subtle token it replaced", () => {
    // #828aae on white measured 3.39:1 — this is why the token changed.
    expect(contrast("#828aae", "#ffffff")).toBeLessThan(4.5);
  });
});
