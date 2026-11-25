"use client";

import * as React from "react";
import { formatNumber, toBengaliDigits } from "@/lib/format";
import type { PdfFlags, PerformanceGroup } from "./page";

type Item = {
  position: number;
  statement: string;
  options: string[];
  correctOption: number;
  selectedOption: number | null;
  isCorrect: boolean;
  explanation: string;
  source: string;
  year: number | null;
  difficulty: string;
  examName: string;
  bookChapter: string;
  bookPage: number | null;
};

type Score = {
  scored: number;
  totalMarks: number;
  correct: number;
  wrong: number;
  unanswered: number;
  accuracy: number;
  totalQuestions: number;
};

/**
 * The sheet itself, plus the two things a printed page cannot do: open the print
 * dialog, and let the student choose which sections to include. Toggles here are
 * client-side only — they narrow what is printed, they never widen it beyond the
 * admin's `pdf_downloads` switch.
 */
export function PrintSheet({
  flags,
  meta,
  score,
  subjects,
  topics,
  items,
  optionKeys,
  topicNames,
}: {
  flags: PdfFlags;
  meta: {
    examTitle: string;
    examId: string;
    date: string;
    printedOn: string;
    studentName: string;
    studentEmail: string;
  };
  score: Score;
  subjects: PerformanceGroup[];
  topics: PerformanceGroup[];
  items: Item[];
  optionKeys: string[];
  /** topic_id -> real Bangla title, resolved server-side from the syllabus. */
  topicNames: Record<string, string>;
}) {
  const [includePaper, setIncludePaper] = React.useState(flags.question_paper);
  const [includeKey, setIncludeKey] = React.useState(flags.answer_key);
  const [includeReport, setIncludeReport] = React.useState(flags.performance_report);

  React.useEffect(() => {
    // Give the fonts one frame to load; printing before the Bengali face is
    // ready produces a sheet of empty boxes.
    const timer = window.setTimeout(() => window.print(), 600);
    return () => window.clearTimeout(timer);
  }, []);

  const pct = (value: number) => `${Math.max(0, Math.min(100, value)).toFixed(1)}%`;

  return (
    <main className="mx-auto max-w-[820px] bg-white px-6 py-6 text-black print:max-w-none print:px-0 print:py-0">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-[0.75rem]">
        <div className="flex flex-wrap items-center gap-3">
          {flags.question_paper ? (
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={includePaper} onChange={(e) => setIncludePaper(e.target.checked)} />
              প্রশ্নপত্র
            </label>
          ) : null}
          {flags.answer_key ? (
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={includeKey} onChange={(e) => setIncludeKey(e.target.checked)} />
              উত্তরপত্র
            </label>
          ) : null}
          {flags.performance_report ? (
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={includeReport} onChange={(e) => setIncludeReport(e.target.checked)} />
              পারফরম্যান্স
            </label>
          ) : null}
        </div>
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

      {/* ---------------------------------------------------------------- header */}
      <header className="border-b-2 border-black pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-neutral-500">JobHub</p>
            <h1 className="mt-0.5 font-bangla text-[1.375rem] font-bold leading-tight">{meta.examTitle}</h1>
            <p className="mt-1 font-bangla text-[0.75rem] text-neutral-600">
              পরীক্ষার তারিখ: {meta.date} · প্রিন্ট: {meta.printedOn}
            </p>
            {flags.embed_user_info && meta.studentName ? (
              <p className="mt-0.5 font-bangla text-[0.75rem] text-neutral-600">
                পরীক্ষার্থী: {meta.studentName}
                {meta.studentEmail ? ` (${meta.studentEmail})` : ""}
              </p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="font-bangla text-[0.625rem] text-neutral-500">প্রাপ্ত নম্বর</p>
            <p className="font-bangla text-[1.75rem] font-bold leading-none tabular-nums">
              {toBengaliDigits(Number(score.scored.toFixed(2)).toString())}
              <span className="text-[0.875rem] font-medium text-neutral-500"> / {formatNumber(score.totalMarks)}</span>
            </p>
            {flags.embed_exam_id ? (
              <p className="mt-1 font-mono text-[0.5rem] text-neutral-400">Exam ID: {meta.examId.slice(0, 8)}</p>
            ) : null}
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------------- summary */}
      <section className="mt-4 grid grid-cols-4 gap-2 font-bangla">
        {[
          { label: "সঠিক", value: score.correct, tone: "text-emerald-700" },
          { label: "ভুল", value: score.wrong, tone: "text-red-700" },
          { label: "উত্তর দিইনি", value: score.unanswered, tone: "text-neutral-600" },
          { label: "নির্ভুলতা", value: `${score.accuracy.toFixed(1)}%`, tone: "text-neutral-900" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-md border border-neutral-300 px-2.5 py-1.5">
            <p className="text-[0.5625rem] text-neutral-500">{stat.label}</p>
            <p className={`font-bold ${stat.tone}`} style={{ fontSize: "1rem" }}>
              {typeof stat.value === "number" ? formatNumber(stat.value) : stat.value}
            </p>
          </div>
        ))}
      </section>

      {/* ------------------------------------------------------- accuracy bar */}
      <section className="mt-3 font-bangla">
        <div className="mb-1 flex items-center justify-between text-[0.625rem] text-neutral-600">
          <span>সঠিক বনাম ভুল</span>
          <span>
            {formatNumber(score.correct)} সঠিক · {formatNumber(score.wrong)} ভুল ·{" "}
            {formatNumber(score.unanswered)} বাদ
          </span>
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded-full border border-neutral-300">
          <div className="bg-emerald-500" style={{ width: pct((score.correct / Math.max(1, score.totalQuestions)) * 100) }} />
          <div className="bg-red-500" style={{ width: pct((score.wrong / Math.max(1, score.totalQuestions)) * 100) }} />
          <div className="bg-neutral-200" style={{ width: pct((score.unanswered / Math.max(1, score.totalQuestions)) * 100) }} />
        </div>
      </section>

      {/* --------------------------------------------------------- performance */}
      {includeReport ? (
        <>
          <section className="mt-5">
            <h2 className="font-bangla text-[0.875rem] font-bold">বিষয়ভিত্তিক ফলাফল</h2>
            <table className="mt-1.5 w-full border-collapse font-bangla text-[0.6875rem]">
              <thead>
                <tr className="border-b border-neutral-400 text-left text-neutral-600">
                  <th className="py-1 font-medium">বিষয়</th>
                  <th className="py-1 text-right font-medium">উত্তর</th>
                  <th className="py-1 text-right font-medium">সঠিক</th>
                  <th className="py-1 text-right font-medium">ভুল</th>
                  <th className="py-1 text-right font-medium">নির্ভুলতা</th>
                  <th className="w-28 py-1" />
                </tr>
              </thead>
              <tbody>
                {subjects.map((row) => (
                  <tr key={row.key} className="border-b border-neutral-200">
                    <td className="py-1">{row.label}</td>
                    <td className="py-1 text-right tabular-nums">{formatNumber(row.attempted)}</td>
                    <td className="py-1 text-right tabular-nums text-emerald-700">{formatNumber(row.correct)}</td>
                    <td className="py-1 text-right tabular-nums text-red-700">{formatNumber(row.wrong)}</td>
                    <td className="py-1 text-right tabular-nums">{row.accuracy.toFixed(0)}%</td>
                    <td className="py-1 pl-2">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
                        <div className="h-full bg-emerald-500" style={{ width: pct(row.accuracy) }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="mt-4">
            <h2 className="font-bangla text-[0.875rem] font-bold">টপিকভিত্তিক বিশ্লেষণ</h2>
            <table className="mt-1.5 w-full border-collapse font-bangla text-[0.6875rem]">
              <thead>
                <tr className="border-b border-neutral-400 text-left text-neutral-600">
                  <th className="py-1 font-medium">টপিক</th>
                  <th className="py-1 text-right font-medium">উত্তর</th>
                  <th className="py-1 text-right font-medium">সঠিক</th>
                  <th className="py-1 text-right font-medium">নির্ভুলতা</th>
                  <th className="w-28 py-1" />
                </tr>
              </thead>
              <tbody>
                {topics.map((row) => (
                  <tr key={row.key} className="border-b border-neutral-200">
                    <td className="py-1">{topicNames[row.key] ?? row.label}</td>
                    <td className="py-1 text-right tabular-nums">{formatNumber(row.attempted)}</td>
                    <td className="py-1 text-right tabular-nums text-emerald-700">{formatNumber(row.correct)}</td>
                    <td className="py-1 text-right tabular-nums">{row.accuracy.toFixed(0)}%</td>
                    <td className="py-1 pl-2">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
                        <div
                          className={row.accuracy >= 60 ? "h-full bg-emerald-500" : row.accuracy >= 35 ? "h-full bg-amber-500" : "h-full bg-red-500"}
                          style={{ width: pct(row.accuracy) }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 font-bangla text-[0.5625rem] leading-relaxed text-neutral-500">
              হারের হিসাব শুধু দেওয়া উত্তরগুলোর ওপর — উত্তর দেওয়া না হলে তা নির্ভুলতায় ধরা হয়নি।
            </p>
          </section>
        </>
      ) : null}

      {/* ------------------------------------------------------------ question paper */}
      {includePaper ? (
        <section className="mt-6 break-before-page">
          <h2 className="mb-2 border-b border-neutral-400 pb-1 font-bangla text-[0.875rem] font-bold">
            প্রশ্নপত্র ({formatNumber(items.length)}টি প্রশ্ন)
          </h2>
          {items.map((item) => (
            <div key={item.position} className="mb-3 break-inside-avoid font-bangla text-[0.75rem]">
              <p className="font-semibold leading-snug">
                {formatNumber(item.position)}. {item.statement}
              </p>
              <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 pl-1">
                {item.options.map((option, index) => (
                  <p key={index} className="leading-snug">
                    <span className="font-semibold text-neutral-500">{optionKeys[index]}.</span> {option}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {/* ------------------------------------------------------------ answer key */}
      {includeKey ? (
        <section className="mt-6 break-before-page">
          <h2 className="mb-2 border-b border-neutral-400 pb-1 font-bangla text-[0.875rem] font-bold">
            উত্তরপত্র ও ব্যাখ্যা
          </h2>
          {items.map((item) => (
            <div key={item.position} className="mb-3 break-inside-avoid font-bangla text-[0.6875rem]">
              <p className="font-semibold">
                {formatNumber(item.position)}. {item.statement}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="rounded border border-emerald-600 px-1.5 py-0.5 font-semibold text-emerald-700">
                  সঠিক: {optionKeys[item.correctOption]}
                </span>
                {item.selectedOption === null ? (
                  <span className="rounded border border-neutral-400 px-1.5 py-0.5 text-neutral-600">উত্তর দেওয়া হয়নি</span>
                ) : (
                  <span
                    className={
                      item.isCorrect
                        ? "rounded border border-emerald-600 px-1.5 py-0.5 font-semibold text-emerald-700"
                        : "rounded border border-red-600 px-1.5 py-0.5 font-semibold text-red-700"
                    }
                  >
                    আপনার উত্তর: {optionKeys[item.selectedOption]}
                  </span>
                )}
                <span className="text-[0.5625rem] text-neutral-500">{item.options[item.correctOption]}</span>
              </div>
              {item.explanation ? (
                <p className="mt-1 leading-relaxed text-neutral-700">{item.explanation}</p>
              ) : (
                <p className="mt-1 text-[0.5625rem] italic text-neutral-500">এই প্রশ্নের ব্যাখ্যা এখনো যোগ করা হয়নি।</p>
              )}
              {item.examName || item.year || item.bookChapter ? (
                <p className="mt-0.5 text-[0.5625rem] text-neutral-500">
                  {[
                    item.examName ? `পরীক্ষা: ${item.examName}` : null,
                    item.year ? formatNumber(item.year) : null,
                    item.bookChapter || null,
                    item.bookPage ? `পৃষ্ঠা ${formatNumber(item.bookPage)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      <footer className="mt-6 border-t border-neutral-300 pt-2 font-bangla text-[0.5625rem] text-neutral-500">
        JobHub · এই শীটটি {meta.printedOn} তারিখে তৈরি
        {flags.embed_exam_id ? ` · পরীক্ষা ${meta.examId.slice(0, 8)}` : ""}
      </footer>
    </main>
  );
}
