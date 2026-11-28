import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { UniversalRoutineSheet, type SheetCourse } from "@/components/routines/universal-routine-sheet";
import { BCS_PRIORITIES, type PriorityDef } from "@/lib/routine-priorities";
import { BCS_PRIORITY_MARKS } from "@/lib/routine-marks";
import type { RoutineLineInput } from "@/lib/routine-day-lines";

/**
 * Rendered shape of the universal sheet. The brief pins several things as hard
 * UI restrictions — the instruction bar carries marks only, topic cards use the
 * full width, and no duplicate subject checklist survives — so they are asserted
 * against real markup rather than trusted to review.
 */

function row(overrides: Partial<RoutineLineInput> & { id: string; slot_label: string }): RoutineLineInput {
  return {
    routine_date: "2026-11-28",
    title_bn: "দিন ১",
    subject_title_bn: "বাংলা",
    minutes: 150,
    task_kind: "study",
    focus_note_bn: null,
    topics: [],
    ...overrides,
  };
}

const course: SheetCourse = {
  id: "599509ae-c4c3-440a-9463-802a4efc7a0c",
  title_bn: "BCS Preliminary",
  plan_start: "2026-11-28",
  start_date: "2026-11-28",
  end_date: "2026-11-29",
  status: "active",
  days: [
    {
      date: "2026-11-28",
      day_number: 1,
      rows: [
        row({
          id: "p1",
          slot_label: "P1 Main · সকাল ৭:০০–৯:৩০",
          subject_title_bn: "বাংলা Grammar",
          topics: [{ topic: "ধ্বনি ও বর্ণ", subtopics: ["স্বরধ্বনি", "ব্যঞ্জনধ্বনি"] }],
        }),
        row({
          id: "p2",
          slot_label: "P2 Second · সকাল ১০:০০–১১:১৫",
          subject_title_bn: "English",
          minutes: 75,
          topics: [{ topic: "Voice", subtopics: ["Active", "Passive"] }],
        }),
        row({
          id: "p3",
          slot_label: "P3/P4 Third · বিকাল ৫:০০–৫:৪৫",
          subject_title_bn: "বাংলা",
          minutes: 45,
          task_kind: "revision",
          topics: [{ topic: "শব্দার্থ", subtopics: ["সমার্থক", "বিপরীতার্থক"] }],
        }),
        row({
          id: "mcq",
          slot_label: "MCQ ও ভুল বিশ্লেষণ · রাত ৮:০০–৮:৫০",
          title_bn: "MCQ",
          subject_title_bn: null,
          minutes: 50,
          task_kind: "practice",
          focus_note_bn: "P1 50 + P2 25 + P3/P4 15 + পূর্বে-পড়া 10 = ১০০ প্রশ্ন",
        }),
      ],
    },
    {
      date: "2026-11-29",
      day_number: 2,
      rows: [
        row({
          id: "p1b",
          slot_label: "P1 Main · সকাল ৭:০০",
          topics: [{ topic: "শব্দ ও পদ", subtopics: [] }],
        }),
      ],
    },
  ],
};

function render(
  overrides: Partial<React.ComponentProps<typeof UniversalRoutineSheet>> = {},
): string {
  return renderToStaticMarkup(
    React.createElement(UniversalRoutineSheet, {
      course,
      priorities: BCS_PRIORITIES,
      marks: { items: BCS_PRIORITY_MARKS, source: "bcs" },
      initialCompletedDates: [],
      today: "2026-11-28",
      printHref: "/routines/print?course=x",
      ...overrides,
    }),
  );
}

/** Strip tags and React's text separators to read what a student reads. */
function text(html: string): string {
  return html.replace(/<!--[^>]*-->/g, "").replace(/<[^>]+>/g, "");
}

describe("UniversalRoutineSheet", () => {
  it("opens on today's day, not day 1", () => {
    const html = render({ today: "2026-11-29" });
    const body = text(html);
    expect(body).toContain("Day ২ / ২");
    expect(body).toContain("দিন ২ — ২৯ নভেম্বর, ২০২৬");
  });

  it("shows the day header with number, full date and weekday", () => {
    const body = text(render());
    expect(body).toContain("দিন ১ — ২৮ নভেম্বর, ২০২৬, শনিবার");
  });

  it("renders one full-width plate per priority with subject, topic and subtopics", () => {
    const body = text(render());
    expect(body).toContain("বাংলা Grammar");
    expect(body).toContain("ধ্বনি ও বর্ণ");
    expect(body).toContain("স্বরধ্বনি, ব্যঞ্জনধ্বনি");
    expect(body).toContain("English");
    expect(body).toContain("Voice");
    expect(body).toContain("Active, Passive");
    expect(body).toContain("শব্দার্থ");
    // each subject appears once in the day section — no duplicate checklist
    expect(body.match(/বাংলা Grammar/g)).toHaveLength(1);
  });

  it("renders the topic section heading the figure specifies", () => {
    expect(text(render())).toContain("আজকের পড়ার বিষয় ও টপিক");
  });

  it("keeps the exam instruction bar to marks only", () => {
    const body = text(render());
    expect(body).toContain("আজকের পরীক্ষার নির্দেশনা");
    expect(body).toContain("P1: ৫০ নম্বর");
    expect(body).toContain("P2: ২৫ নম্বর");
    expect(body).toContain("P3/P4: ১৫ নম্বর");
    expect(body).toContain("পূর্ববর্তী/রিভিশন: ১০ নম্বর");

    // …and nothing else. These are the exclusions the brief calls critical.
    const barStart = body.indexOf("আজকের পরীক্ষার নির্দেশনা");
    const barEnd = body.indexOf("রুটিন সারসংক্ষেপ" + "", barStart);
    const bar = body.slice(barStart, barEnd > barStart ? barEnd : barStart + 200);
    expect(bar).not.toContain("মিনিট"); // no study or exam duration
    expect(bar).not.toContain("ঘণ্টা"); // no study hours
    expect(bar).not.toContain("প্রশ্ন"); // no question count
  });

  it("hides the instruction bar when a course has no marks distribution", () => {
    const html = render({ marks: { items: [], source: "none" } });
    expect(text(html)).not.toContain("আজকের পরীক্ষার নির্দেশনা");
    // the rest of the sheet still renders
    expect(text(html)).toContain("আজকের পড়ার বিষয় ও টপিক");
  });

  it("shows a course's own priority labels instead of P1/P2/P3", () => {
    const priorities: PriorityDef[] = [
      { key: "p1", badge: "E", label: "Electrical Engineering", match: "Electrical Engineering" },
      { key: "p2", badge: "El", label: "Electronics", match: "Electronics" },
    ];
    const otherCourse: SheetCourse = {
      ...course,
      id: "petrobangla",
      days: [
        {
          date: "2026-11-28",
          day_number: 1,
          rows: [
            row({
              id: "e1",
              slot_label: "Electrical Engineering · সকাল ৭:০০",
              subject_title_bn: "Electrical Engineering",
              topics: [{ topic: "Circuit Theory", subtopics: ["KVL"] }],
            }),
          ],
        },
      ],
    };
    const body = text(render({ course: otherCourse, priorities, marks: { items: [], source: "none" } }));
    expect(body).toContain("Electrical Engineering");
    expect(body).toContain("Circuit Theory");
    expect(body).not.toContain("আজকের পরীক্ষার নির্দেশনা");
  });

  it("shows real progress and never invents it", () => {
    expect(text(render())).toContain("০/২ দিন সম্পন্ন");
    expect(text(render({ initialCompletedDates: ["2026-11-28"] }))).toContain("১/২ দিন সম্পন্ন");
    // the percentage reads as its own bold figure, not buried in the sentence
    expect(text(render())).toContain("০%");
    expect(text(render({ initialCompletedDates: ["2026-11-28"] }))).toContain("৫০%");
  });

  it("exposes progress to assistive tech", () => {
    expect(render()).toContain('role="progressbar"');
  });

  it("offers previous/next navigation and a phase selector", () => {
    const html = render({ today: "2026-11-29" });
    expect(html).toContain('aria-label="আগের দিন"');
    expect(html).toContain('aria-label="পরের দিন"');
    expect(html).toContain("<select");
    expect(html).toContain("Phase ১ — দিন ১–৩০");
  });

  it("previews the next day after the active one", () => {
    const body = text(render());
    expect(body).toContain("পরের দিনের ঝলক");
    expect(body).toContain("দিন ২ — ২৯ নভেম্বর, ২০২৬");
  });

  it("renders routine history when earlier routines exist", () => {
    const html = render({
      history: [
        { id: "h1", title_bn: "১ অক্টোবর – ৩০ অক্টোবর", start: "2026-10-01", end: "2026-10-30", done: 12, total: 30 },
      ],
    });
    const body = text(html);
    expect(body).toContain("রুটিন ইতিহাস");
    expect(body).toContain("১ অক্টোবর – ৩০ অক্টোবর");
    expect(body).toContain("১২/৩০ দিন");
  });

  it("says so honestly when there is no history", () => {
    expect(text(render())).toContain("এই কোর্সে আগের কোনো সম্পন্ন রুটিন নেই।");
  });

  it("shows no separate MCQ question-count panel", () => {
    // The brief lists it as an explicit exclusion: question counts and study
    // durations belong to the exam config, not to this page.
    const body = text(render());
    expect(body).not.toContain("প্রতিদিনের MCQ");
    expect(body).not.toContain("১০০ প্রশ্ন");
  });

  /**
   * The strip used to render every fact as thin grey text on white with an
   * identical grey icon, which is why it looked washed out beside the approved
   * figure. Colour and weight are the fix, so they are pinned.
   */
  it("gives each overview fact a tinted icon tile and a bold value", () => {
    const html = render();
    // coloured tiles, not one repeated grey glyph
    expect(html).toContain("var(--p1-tint)");
    expect(html).toContain("var(--p2-tint)");
    expect(html).toContain("var(--p3-tint)");
    // values are extra-bold
    expect(html).toContain("font-extrabold");
    // and the four facts share one ruled card instead of five loose boxes
    expect(html).toContain("border-r border-[var(--border)]");
  });

  it("colours each marks-bar item with its own accent", () => {
    const html = render();
    expect(html).toContain("var(--p1-rule)");
    expect(html).toContain("var(--p2-rule)");
    expect(html).toContain("var(--p3-rule)");
    expect(html).toContain("var(--p4-rule)");
    // the label and the number are coloured, not grey
    expect(html).toContain("var(--p2-ink)");
    expect(html).toContain("var(--p4-ink)");
  });

  it("labels each plate with the kind of work in that plate alone", () => {
    // The revision row (P3/P4) must say রিভিশন; the study rows say মূল অধ্যয়ন.
    // Reading the whole day's rows made every plate say মূল অধ্যয়ন.
    const body = text(render());
    const p3 = body.indexOf("শব্দার্থ");
    expect(p3).toBeGreaterThan(-1);
    // the work tag renders just before the subject inside the same plate
    expect(body.slice(Math.max(0, p3 - 120), p3)).toContain("রিভিশন");
    // and a first-study plate is not mislabelled as revision
    const p1 = body.indexOf("ধ্বনি ও বর্ণ");
    expect(body.slice(Math.max(0, p1 - 140), p1)).toContain("মূল অধ্যয়ন");
  });

  it("shows a coloured status pill for the routine", () => {
    expect(text(render())).toContain("সক্রিয় রুটিন");
    expect(text(render({ course: { ...course, status: "draft" } }))).toContain("ড্রাফট");
  });

  it("drops the old duplicate-checklist and empty-column patterns", () => {
    const html = render();
    // no leftover left column or short-list panel from the previous design
    expect(html).not.toContain("আজকের মূল বিষয়সমূহ");
    expect(html).not.toContain("সংক্ষিপ্ত");
    // plates span the full width of the card
    expect(html).toContain("w-full");
  });
});

/**
 * Bengali body text must clear WCAG AA. #828aae (the old subtle token) was
 * 3.39:1 on white, which is what made প্রতিদিন pale and hard to read.
 */
describe("universal sheet contrast (WCAG AA)", () => {
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

  const lightPairs: [string, string, string][] = [
    ["subtle text on white", "#68708f", "#ffffff"],
    ["subtle text on muted surface", "#68708f", "#f7f8fc"],
    ["muted text on white", "#5d6489", "#ffffff"],
    ["P1 ink on tint", "#1e2a63", "#eef1fa"],
    ["P2 ink on tint", "#8a4a00", "#fdf3e4"],
    ["P3 ink on tint", "#0f6046", "#e8f6f0"],
    ["P4 ink on tint", "#5b21b6", "#f3ecfd"],
    ["white on P1 badge", "#ffffff", "#2c3d8f"],
    ["white on P2 badge", "#ffffff", "#8a4a00"],
    ["white on P3 badge", "#ffffff", "#17795c"],
    ["white on P4 badge", "#ffffff", "#6d28d9"],
    ["white on the day header", "#ffffff", "#1e2a63"],
  ];

  it.each(lightPairs)("%s clears 4.5:1", (_name, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  const darkPairs: [string, string, string][] = [
    ["dark P1 ink on tint", "#b9c4f5", "#232a4f"],
    ["dark P2 ink on tint", "#f5c47f", "#3a2a12"],
    ["dark P3 ink on tint", "#7fdcb6", "#123028"],
    ["dark P4 ink on tint", "#c4b5fd", "#2a2150"],
    ["dark muted text", "#a6adcf", "#191d34"],
    ["dark subtle text", "#959dc2", "#191d34"],
  ];

  it.each(darkPairs)("%s clears 4.5:1", (_name, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("records why the P2 rule cannot be the badge fill", () => {
    // The rule is a 4px non-text edge (3:1 suffices), but using it behind white
    // badge text measured 3.82:1 — below AA. Hence --p2-badge.
    expect(contrast("#ffffff", "#b8730a")).toBeLessThan(4.5);
  });
});
