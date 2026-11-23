"use client";

/**
 * A4-ready study-routine sheet — "exam batch" layout.
 *
 * Presentation modelled on the classic coaching-batch routine PDF: a navy
 * banner title, a colour legend for task kinds, then ONE continuous table
 * (তারিখ | দিন নং | টপিকস) where every task of a day appears as a colour-coded
 * chip in the topics cell. The DATA is untouched — same published routine,
 * same dates, same topics; only the presentation is upgraded.
 *
 * Colours are forced through to the PDF with print-color-adjust: exact.
 * Rows never split across pages, Bengali text uses the app's own font stack,
 * and printing waits one beat so the Bengali face is loaded.
 */

import * as React from "react";
import { formatDate, formatNumber } from "@/lib/format";

type PrintRoutine = {
  id: string;
  routine_date: string;
  title_bn: string;
  course_title_bn: string;
  subject_title_bn: string | null;
  topic_titles_bn: string[];
  subtopic_titles_bn: string[];
  minutes: number;
  task_kind: string;
  focus_note_bn: string | null;
};

const TASK_LABELS: Record<string, string> = {
  study: "পড়া",
  practice: "প্র্যাকটিস",
  revision: "রিভিশন",
  exam: "পরীক্ষা",
  rest: "বিশ্রাম",
};

/** Chip + legend palette per task kind (background / border / text). */
const TASK_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  study: { bg: "#c9f0ec", border: "#0d9488", text: "#0f3d3a" },
  practice: { bg: "#e5e0fb", border: "#7c3aed", text: "#3b2b70" },
  revision: { bg: "#fdeec3", border: "#d97706", text: "#6b4304" },
  exam: { bg: "#fcd9e0", border: "#e11d48", text: "#73102a" },
  rest: { bg: "#ececf0", border: "#9ca3af", text: "#374151" },
};

const FALLBACK_STYLE = TASK_STYLES.rest;

const NAVY = "#232e7a";
const HEADER_YELLOW = "#f7d64a";
const DATE_BLUE = "#dbeafe";

export function RoutinePrintSheet({
  routines,
  studentName,
  generatedOn,
}: {
  routines: PrintRoutine[];
  studentName: string;
  generatedOn: string;
}) {
  React.useEffect(() => {
    if (routines.length === 0) return;
    const timer = window.setTimeout(() => window.print(), 600);
    return () => window.clearTimeout(timer);
  }, [routines.length]);

  // The PDF shows the syllabus plan only: generic filler revision rows (no
  // subject, no topics — e.g. "রিভিশন · ভিত্তি ও হাই-প্রায়োরিটি") are kept in
  // the app for progress tracking but omitted here to keep the sheet compact.
  // Targeted revision rows (with a subject/topic) still appear.
  const visible = routines.filter(
    (r) => !(r.task_kind === "revision" && !r.subject_title_bn && r.topic_titles_bn.length === 0),
  );

  const dates = [...new Set(visible.map((r) => r.routine_date))].sort();
  const courseTitles = [...new Set(visible.map((r) => r.course_title_bn).filter(Boolean))];
  const usedKinds = [...new Set(visible.map((r) => r.task_kind))];
  const legend = ["study", "practice", "revision", "exam", "rest"].filter((kind) => usedKinds.includes(kind));

  return (
    <main
      className="mx-auto max-w-[820px] bg-white px-6 py-6 font-bangla text-black print:max-w-none print:px-0 print:py-0"
      style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
    >
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-[0.75rem]">
        <span>প্রিন্ট ডায়ালগে “Save as PDF” বেছে নিলেই PDF ডাউনলোড হবে। রং সহ পেতে “Background graphics” চালু রাখুন।</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md bg-neutral-900 px-3 py-1.5 font-semibold text-white"
          >
            PDF হিসেবে সেভ করুন
          </button>
          <button
            type="button"
            onClick={() => window.close()}
            className="rounded-md border border-neutral-300 px-3 py-1.5"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>

      {/* Navy banner title */}
      <header>
        <div
          className="rounded-t-lg px-4 py-2.5 text-center"
          style={{ backgroundColor: NAVY, border: `2px solid ${NAVY}` }}
        >
          <p className="text-[1.125rem] font-bold tracking-tight text-white">
            JobHub — প্রকাশিত স্টাডি রুটিন
          </p>
          {courseTitles.length > 0 ? (
            <p className="text-[0.75rem] font-semibold text-indigo-100">{courseTitles.join(" · ")}</p>
          ) : null}
        </div>

        {/* Legend + meta strip */}
        <div
          className="flex flex-wrap items-center justify-between gap-2 border-x-2 px-3 py-2"
          style={{ borderColor: NAVY, backgroundColor: "#eef1fb" }}
        >
          <div className="flex flex-wrap gap-1.5">
            {legend.map((kind) => {
              const style = TASK_STYLES[kind] ?? FALLBACK_STYLE;
              return (
                <span
                  key={kind}
                  className="rounded-full px-2.5 py-0.5 text-[0.625rem] font-bold"
                  style={{ backgroundColor: style.bg, border: `1.5px solid ${style.border}`, color: style.text }}
                >
                  {TASK_LABELS[kind] ?? kind}
                </span>
              );
            })}
          </div>
          <div className="text-right text-[0.625rem] leading-snug text-neutral-600">
            {studentName ? <span className="mr-2">শিক্ষার্থী: {studentName}</span> : null}
            <span>
              তৈরি: {formatDate(`${generatedOn}T12:00:00`, "bn", { day: "numeric", month: "long", year: "numeric" })}
            </span>
          </div>
        </div>
      </header>

      {routines.length === 0 ? (
        <p className="mt-6 text-center text-[0.875rem] text-neutral-600">
          এখনো কোনো প্রকাশিত রুটিন নেই — প্রশাসক রুটিন প্রকাশ করলে এখানে দেখা যাবে।
        </p>
      ) : (
        <table
          className="w-full border-collapse text-[0.75rem]"
          style={{ border: `2px solid ${NAVY}` }}
        >
          <thead>
            <tr style={{ backgroundColor: HEADER_YELLOW }}>
              <th className="w-[15%] px-2 py-1.5 text-center text-[0.6875rem] font-bold" style={{ border: `1px solid ${NAVY}` }}>
                তারিখ
              </th>
              <th className="w-[13%] px-2 py-1.5 text-center text-[0.6875rem] font-bold" style={{ border: `1px solid ${NAVY}` }}>
                দিন / পরীক্ষা
              </th>
              <th className="px-2 py-1.5 text-center text-[0.6875rem] font-bold" style={{ border: `1px solid ${NAVY}` }}>
                টপিকস
              </th>
            </tr>
          </thead>
          <tbody>
            {dates.map((date, index) => {
              const items = visible.filter((r) => r.routine_date === date);
              const hasExam = items.some((r) => r.task_kind === "exam");
              return (
                <tr key={date} style={{ breakInside: "avoid" }}>
                  <td
                    className="px-2 py-1.5 text-center align-middle"
                    style={{ border: `1px solid ${NAVY}`, backgroundColor: DATE_BLUE }}
                  >
                    <p className="text-[0.75rem] font-bold leading-tight">
                      {formatDate(`${date}T12:00:00`, "bn", { day: "numeric", month: "numeric", year: "2-digit" })}
                    </p>
                    <p className="text-[0.5625rem] text-neutral-600">
                      {formatDate(`${date}T12:00:00`, "bn", { weekday: "long" })}
                    </p>
                  </td>
                  <td
                    className="px-2 py-1.5 text-center align-middle"
                    style={{ border: `1px solid ${NAVY}` }}
                  >
                    <p className="text-[0.75rem] font-bold leading-tight">D-{formatNumber(index + 1)}</p>
                    {hasExam ? (
                      <p
                        className="mx-auto mt-0.5 w-fit rounded-full px-1.5 text-[0.5625rem] font-bold"
                        style={{
                          backgroundColor: TASK_STYLES.exam.bg,
                          border: `1px solid ${TASK_STYLES.exam.border}`,
                          color: TASK_STYLES.exam.text,
                        }}
                      >
                        পরীক্ষা
                      </p>
                    ) : null}
                  </td>
                  <td className="px-2 py-1.5 align-middle" style={{ border: `1px solid ${NAVY}` }}>
                    <div className="flex flex-wrap gap-1">
                      {items.map((item) => {
                        const style = TASK_STYLES[item.task_kind] ?? FALLBACK_STYLE;
                        const topicText =
                          item.topic_titles_bn.length > 0 ? item.topic_titles_bn.join(", ") : item.title_bn;
                        return (
                          <span
                            key={item.id}
                            className="rounded-md px-2 py-1 text-[0.6875rem] leading-snug"
                            style={{
                              backgroundColor: style.bg,
                              border: `1.5px solid ${style.border}`,
                              color: style.text,
                              breakInside: "avoid",
                            }}
                          >
                            {item.subject_title_bn ? (
                              <strong>{item.subject_title_bn}: </strong>
                            ) : null}
                            {topicText}
                            {item.subtopic_titles_bn.length > 0 ? (
                              <span style={{ opacity: 0.8 }}> ({item.subtopic_titles_bn.join(", ")})</span>
                            ) : null}
                            {item.focus_note_bn ? (
                              <em className="block text-[0.5625rem]" style={{ opacity: 0.85 }}>
                                {item.focus_note_bn}
                              </em>
                            ) : null}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* div, not <footer>: the global print CSS hides footer elements. */}
      <div className="mt-4 border-t border-neutral-300 pt-2 text-center text-[0.625rem] text-neutral-500">
        JobHub — বাংলাদেশের চাকরি ও ভর্তি প্রস্তুতির সাথী · এই রুটিনটি প্রশাসক-প্রকাশিত সময়সূচি থেকে স্বয়ংক্রিয়ভাবে তৈরি
      </div>
    </main>
  );
}
