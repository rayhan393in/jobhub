"use client";

/**
 * A4-ready study-routine sheet — compact course-wise day blocks.
 *
 * Exactly the master format:
 *
 *   দিন N — তারিখ — বার
 *   | বিষয় | টপিক → সাবটপিক |
 *
 * Rules enforced here:
 *   * each course is its OWN routine — separate section, page break between
 *     courses, subjects of different courses never share a block;
 *   * study rows of the same subject on the same day merge into one line
 *     (total minutes, united topic list — the deep-work slots stay one row);
 *   * revision / exam / rest rows carry a small label so they are always
 *     distinguishable from first-study rows;
 *   * the nightly generic "দৈনিক রিভিশন" filler (no subject, no topics) is
 *     kept in the app for tracking but omitted from the sheet by design;
 *   * no decorative cards, timers or charts — just the schedule;
 *   * day blocks never split across pages; Bengali text uses the app's own
 *     font stack and printing waits one beat so the face is loaded.
 */

import * as React from "react";
import { formatDate, formatNumber } from "@/lib/format";
import {
  buildDayLines,
  dayNumber,
  KIND_LABELS,
  type RoutineLineInput,
} from "@/lib/routine-day-lines";

type PrintRoutine = RoutineLineInput;

export type PrintCourse = {
  id: string;
  title_bn: string;
  /** ISO date of the course's day 1 (earliest published routine date). */
  plan_start: string;
  routines: PrintRoutine[];
};

const NAVY = "#232e7a";

export function RoutinePrintSheet({
  courses,
  studentName,
  generatedOn,
}: {
  courses: PrintCourse[];
  studentName: string;
  generatedOn: string;
}) {
  const total = courses.reduce((a, c) => a + c.routines.length, 0);

  React.useEffect(() => {
    if (total === 0) return;
    const timer = window.setTimeout(() => window.print(), 600);
    return () => window.clearTimeout(timer);
  }, [total]);

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

      {total === 0 ? (
        <p className="mt-6 text-center text-[0.875rem] text-neutral-600">
          এখনো কোনো প্রকাশিত রুটিন নেই — প্রশাসক রুটিন প্রকাশ করলে এখানে দেখা যাবে।
        </p>
      ) : (
        courses.map((course, courseIndex) => {
          const dates = [...new Set(course.routines.map((r) => r.routine_date))].sort();
          return (
            <section
              key={course.id}
              style={courseIndex > 0 ? { breakBefore: "page" } : undefined}
            >
              {/* Course banner — one course per routine, never mixed. */}
              <header
                className="rounded-t-lg px-4 py-2.5 text-center"
                style={{ backgroundColor: NAVY, border: `2px solid ${NAVY}` }}
              >
                <p className="text-[1.0625rem] font-bold tracking-tight text-white">
                  {course.title_bn} — প্রকাশিত স্টাডি রুটিন
                </p>
                <p className="text-[0.6875rem] text-indigo-100">
                  {studentName ? <>শিক্ষার্থী: {studentName} · </> : null}
                  তৈরি: {formatDate(`${generatedOn}T12:00:00`, "bn", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </header>

              <div
                className="mb-5 border-x-2 border-b-2 px-2 py-2"
                style={{ borderColor: NAVY }}
              >
                {dates.map((date) => {
                  const lines = buildDayLines(course.routines.filter((r) => r.routine_date === date));
                  if (lines.length === 0) return null;
                  const n = dayNumber(date, course.plan_start);
                  return (
                    <div key={date} className="mb-2" style={{ breakInside: "avoid" }}>
                      {/* দিন N — তারিখ — বার */}
                      <p
                        className="rounded-sm px-2 py-1 text-[0.75rem] font-bold text-white"
                        style={{ backgroundColor: NAVY }}
                      >
                        দিন {formatNumber(n)} — {formatDate(`${date}T12:00:00`, "bn", { day: "numeric", month: "long", year: "numeric" })} — {formatDate(`${date}T12:00:00`, "bn", { weekday: "long" })}
                      </p>
                      <table className="w-full border-collapse text-[0.6875rem]">
                        <tbody>
                          {lines.map((line) => (
                            <tr key={line.key} style={{ breakInside: "avoid" }}>
                              <td
                                className="w-[26%] border border-neutral-400 px-2 py-1 align-top"
                                style={{ backgroundColor: "#f3f4f8" }}
                              >
                                <span className="font-bold">{line.label}</span>
                                {line.kind !== "study" ? (
                                  <span className="ml-1 rounded-sm border border-neutral-500 px-1 text-[0.5625rem] font-semibold">
                                    {KIND_LABELS[line.kind] ?? line.kind}
                                  </span>
                                ) : null}
                                <span className="block text-[0.5625rem] text-neutral-600">
                                  {line.slots.join(", ")}
                                  {line.slots.length > 0 ? " · " : ""}
                                  {formatNumber(line.minutes)} মিনিট
                                </span>
                              </td>
                              <td className="border border-neutral-400 px-2 py-1 align-top leading-snug">
                                {line.topics.length > 0 ? (
                                  line.topics.map((t) => (
                                    <p key={t.topic}>
                                      <span className="font-semibold">{t.topic}</span>
                                      {t.subtopics.length > 0 ? <> → {t.subtopics.join(", ")}</> : null}
                                    </p>
                                  ))
                                ) : line.note ? (
                                  <p>{line.note}</p>
                                ) : (
                                  <p className="text-neutral-600">ওই বিষয়ের চলমান অংশ অনুশীলন ও গভীরভাবে আয়ত্ত করা</p>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}

      {/* div, not <footer>: the global print CSS hides footer elements. */}
      <div className="mt-4 border-t border-neutral-300 pt-2 text-center text-[0.625rem] text-neutral-500">
        JobHub — বাংলাদেশের চাকরি ও ভর্তি প্রস্তুতির সাথী · এই রুটিনটি প্রশাসক-প্রকাশিত সময়সূচি থেকে স্বয়ংক্রিয়ভাবে তৈরি
      </div>
    </main>
  );
}
