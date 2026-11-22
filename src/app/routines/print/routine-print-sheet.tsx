"use client";

/**
 * A4-ready study-routine sheet.
 *
 * Pure content: JobHub branding, the student's name, then each date exactly
 * once with every task of that day beneath it. Rows never split across pages
 * (break-inside rules live in globals.css), Bengali text uses the app's own
 * font stack, and printing waits one beat so the Bengali face is loaded.
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

  const dates = [...new Set(routines.map((r) => r.routine_date))].sort();
  const courseTitles = [...new Set(routines.map((r) => r.course_title_bn).filter(Boolean))];

  return (
    <main className="mx-auto max-w-[820px] bg-white px-6 py-6 font-bangla text-black print:max-w-none print:px-0 print:py-0">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-[0.75rem]">
        <span>প্রিন্ট ডায়ালগে “Save as PDF” বেছে নিলেই PDF ডাউনলোড হবে।</span>
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

      {/* Branded header */}
      <header className="border-b-2 border-neutral-900 pb-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[1.375rem] font-bold tracking-tight">
              Job<span className="text-indigo-600">Hub</span>
            </p>
            <p className="mt-0.5 text-[0.8125rem] font-semibold">প্রকাশিত স্টাডি রুটিন</p>
          </div>
          <div className="text-right text-[0.6875rem] leading-relaxed text-neutral-600">
            {studentName ? <p>শিক্ষার্থী: {studentName}</p> : null}
            {courseTitles.length > 0 ? <p>কোর্স: {courseTitles.join(", ")}</p> : null}
            <p>তৈরির তারিখ: {formatDate(`${generatedOn}T12:00:00`, "bn", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
        </div>
      </header>

      {routines.length === 0 ? (
        <p className="mt-6 text-center text-[0.875rem] text-neutral-600">
          এখনো কোনো প্রকাশিত রুটিন নেই — প্রশাসক রুটিন প্রকাশ করলে এখানে দেখা যাবে।
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {dates.map((date) => {
            const items = routines.filter((r) => r.routine_date === date);
            const totalMinutes = items.reduce((sum, r) => sum + r.minutes, 0);
            return (
              <section key={date} style={{ breakInside: "avoid" }}>
                <div className="flex items-baseline justify-between border-b border-neutral-400 pb-1">
                  <h2 className="text-[0.9375rem] font-bold">
                    {formatDate(`${date}T12:00:00`, "bn", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </h2>
                  <span className="text-[0.6875rem] text-neutral-600">
                    মোট {formatNumber(totalMinutes)} মিনিট
                  </span>
                </div>
                <table className="mt-1.5 w-full border-collapse text-[0.75rem]">
                  <thead>
                    <tr className="text-left text-[0.625rem] uppercase tracking-wide text-neutral-500">
                      <th className="w-[26%] py-1 pr-2 font-semibold">বিষয়</th>
                      <th className="py-1 pr-2 font-semibold">টপিক ও নির্দেশনা</th>
                      <th className="w-[12%] py-1 pr-2 font-semibold">ধরন</th>
                      <th className="w-[12%] py-1 text-right font-semibold">সময়</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-t border-neutral-200 align-top">
                        <td className="py-1.5 pr-2 font-semibold">
                          {item.subject_title_bn ?? item.title_bn}
                        </td>
                        <td className="py-1.5 pr-2">
                          {item.topic_titles_bn.length > 0 ? (
                            <span>{item.topic_titles_bn.join(", ")}</span>
                          ) : (
                            <span>{item.title_bn}</span>
                          )}
                          {item.subtopic_titles_bn.length > 0 ? (
                            <span className="text-neutral-600"> ({item.subtopic_titles_bn.join(", ")})</span>
                          ) : null}
                          {item.focus_note_bn ? (
                            <p className="mt-0.5 text-[0.6875rem] italic text-neutral-600">{item.focus_note_bn}</p>
                          ) : null}
                        </td>
                        <td className="py-1.5 pr-2">{TASK_LABELS[item.task_kind] ?? item.task_kind}</td>
                        <td className="py-1.5 text-right">{formatNumber(item.minutes)} মিনিট</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            );
          })}
        </div>
      )}

      <footer className="mt-6 border-t border-neutral-300 pt-2 text-center text-[0.625rem] text-neutral-500">
        JobHub — বাংলাদেশের চাকরি ও ভর্তি প্রস্তুতির সাথী · এই রুটিনটি প্রশাসক-প্রকাশিত সময়সূচি থেকে স্বয়ংক্রিয়ভাবে তৈরি
      </footer>
    </main>
  );
}
