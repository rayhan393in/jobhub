"use client";

/**
 * Student view of the admin-published routines — one course at a time.
 *
 * A course selector bar sits on top (BCS always first); picking a course
 * shows ONLY that course's schedule in the exact same day-block format as
 * the PDF sheet (দিন N — তারিখ — বার, then | বিষয় | টপিক → সাবটপিক |),
 * built from the same shared `buildDayLines` data — so the web view and the
 * downloaded PDF can never show different topics.
 */

import * as React from "react";
import { FileDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { formatDate, formatNumber } from "@/lib/format";
import { KIND_LABELS, type DayLine } from "@/lib/routine-day-lines";

export type ViewerDay = {
  date: string;
  day_number: number;
  total_minutes: number;
  lines: DayLine[];
};

export type ViewerCourse = {
  id: string;
  title_bn: string;
  total_days: number;
  days: ViewerDay[];
};

const NAVY = "#232e7a";

export function PublishedRoutineViewer({ courses, today }: { courses: ViewerCourse[]; today: string }) {
  const [selectedId, setSelectedId] = React.useState(courses[0]?.id ?? "");
  const course = courses.find((c) => c.id === selectedId) ?? courses[0];
  if (!course) return null;

  return (
    <div>
      {/* Course selector bar — all programs in one place, BCS first. */}
      <div
        role="tablist"
        aria-label="কোর্স বাছাই"
        className="mb-3 flex gap-1.5 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-1.5"
      >
        {courses.map((c) => {
          const active = c.id === course.id;
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelectedId(c.id)}
              className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-[0.75rem] font-semibold transition-colors ${
                active
                  ? "text-white shadow-sm"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
              }`}
              style={active ? { backgroundColor: NAVY } : undefined}
            >
              {c.title_bn}
            </button>
          );
        })}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.75rem] text-[var(--text-subtle)]">
          {formatNumber(course.total_days)} দিনের প্রকাশিত রুটিন · PDF-এ হুবহু এই ফরম্যাটেই নামবে
        </p>
        <ButtonLink href={`/routines/print?course=${course.id}`} variant="secondary" size="sm" target="_blank">
          <FileDown className="size-3.5" aria-hidden />
          এই কোর্সের PDF
        </ButtonLink>
      </div>

      <div className="space-y-3">
        {course.days.map((day) => {
          const isToday = day.date === today;
          return (
            <section key={day.date} className="overflow-hidden rounded-lg border" style={{ borderColor: NAVY }}>
              {/* দিন N — তারিখ — বার */}
              <header
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5"
                style={{ backgroundColor: NAVY }}
              >
                <p className="text-[0.75rem] font-bold text-white">
                  দিন {formatNumber(day.day_number)} —{" "}
                  {formatDate(`${day.date}T12:00:00`, "bn", { day: "numeric", month: "long", year: "numeric" })} —{" "}
                  {formatDate(`${day.date}T12:00:00`, "bn", { weekday: "long" })}
                </p>
                <span className="flex items-center gap-1.5">
                  {isToday ? <Badge tone="warning">আজ</Badge> : null}
                  <span className="text-[0.625rem] font-semibold text-indigo-100">
                    {formatNumber(day.total_minutes)} মিনিট
                  </span>
                </span>
              </header>
              <table className="w-full border-collapse bg-[var(--surface)] text-[0.75rem]">
                <tbody>
                  {day.lines.map((line) => (
                    <tr key={line.key}>
                      <td className="w-[30%] min-w-[7.5rem] border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1.5 align-top sm:w-[26%]">
                        <span className="font-bold text-[var(--text)]">{line.label}</span>
                        {line.kind !== "study" ? (
                          <span className="ml-1 rounded-sm border border-[var(--border)] px-1 text-[0.5625rem] font-semibold text-[var(--text-muted)]">
                            {KIND_LABELS[line.kind] ?? line.kind}
                          </span>
                        ) : null}
                        <span className="block text-[0.625rem] text-[var(--text-subtle)]">
                          {line.slots.join(", ")}
                          {line.slots.length > 0 ? " · " : ""}
                          {formatNumber(line.minutes)} মিনিট
                        </span>
                      </td>
                      <td className="border border-[var(--border)] px-2.5 py-1.5 align-top leading-snug text-[var(--text)]">
                        {line.topics.length > 0 ? (
                          line.topics.map((t) => (
                            <p key={t.topic}>
                              <span className="font-semibold">{t.topic}</span>
                              {t.subtopics.length > 0 ? <> → {t.subtopics.join(", ")}</> : null}
                            </p>
                          ))
                        ) : line.note ? (
                          <p className="text-[var(--text-muted)]">{line.note}</p>
                        ) : (
                          <p className="text-[var(--text-subtle)]">ওই বিষয়ের চলমান অংশ অনুশীলন ও গভীরভাবে আয়ত্ত করা</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>
    </div>
  );
}
