"use client";

/**
 * ৯০ দিনের BCS Preliminary রুটিন — the dated plan sheet.
 *
 * Same four columns as the printed plan, one row per day:
 *
 *   দিন ও তারিখ | 🔴 Main — P1 | 🟠 Second — P2 | 🟢 Third — P3/P4
 *
 * grouped under Phase 1 / 2 / 3 headings, followed by the nightly MCQ split
 * and the 90-day progress tracker.
 *
 * Nothing here re-types the schedule: cells come from the published routine
 * rows, the MCQ split is parsed out of the plan's own MCQ row, and slot
 * minutes are read off the rows rather than hard-coded. The tracker writes
 * through the same `routine_progress` API the weekly planner uses, so a day
 * ticked here is genuinely done — and an untouched day stays empty instead of
 * being optimistically painted green.
 */

import * as React from "react";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/format";
import {
  GRID_SLOTS,
  gridSlotFor,
  parseMcqSplit,
  phaseForDay,
  PHASES,
  type RoutineLineInput,
} from "@/lib/routine-day-lines";

const NAVY = "#232e7a";
const GREEN = "#1f9d55";
const GRID_LINE = "#c7ccdd";

export type SheetDay = {
  date: string;
  day_number: number;
  /** The day's routine rows, unchanged — the grid groups them by slot. */
  rows: RoutineLineInput[];
};

export type SheetCourse = {
  id: string;
  title_bn: string;
  plan_start: string;
  days: SheetDay[];
};

type GridSlotKey = (typeof GRID_SLOTS)[number]["slot"];

/** One cell of the grid: subject-prefixed topic → subtopic text. */
type Cell = { subject: string | null; text: string };

function cellFrom(rows: RoutineLineInput[]): Cell | null {
  if (rows.length === 0) return null;
  const parts: string[] = [];
  let subject: string | null = null;
  for (const row of rows) {
    if (!subject && row.subject_title_bn) subject = row.subject_title_bn;
    if (row.topics.length > 0) {
      for (const topic of row.topics) {
        parts.push(
          topic.subtopics.length > 0
            ? `${topic.topic} (${topic.subtopics.join(", ")})`
            : topic.topic,
        );
      }
    } else {
      parts.push(row.focus_note_bn || row.title_bn);
    }
  }
  return parts.length === 0 ? null : { subject, text: parts.join(" · ") };
}

/** দিন ও তারিখ cell, e.g. "১ · ২৮ Nov". */
function dayLabel(day: SheetDay): string {
  return `${toBengaliDigits(day.day_number)} · ${formatDate(`${day.date}T12:00:00`, "bn", {
    day: "numeric",
    month: "short",
  })}`;
}

export function Routine90DaySheet({
  course,
  initialCompletedDates,
}: {
  course: SheetCourse;
  /** Dates the student already marked done, from routine_progress. */
  initialCompletedDates: string[];
}) {
  const [showAll, setShowAll] = React.useState(false);
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  const [done, setDone] = React.useState<Set<string>>(() => new Set(initialCompletedDates));
  const [pending, setPending] = React.useState<Set<string>>(() => new Set());
  const [saveError, setSaveError] = React.useState<string | null>(null);

  /** Tick/untick a day; writes routine_progress through the shared API. */
  const toggleDay = React.useCallback(
    async (day: SheetDay) => {
      if (pending.has(day.date)) return;
      const next = done.has(day.date) ? "pending" : "done";
      const anchor = day.rows.find((row) => (row.slot_label ?? "").startsWith("P1 Main")) ?? day.rows[0];
      if (!anchor) return;

      setSaveError(null);
      setPending((current) => new Set(current).add(day.date));
      setDone((current) => {
        const copy = new Set(current);
        if (next === "done") copy.add(day.date);
        else copy.delete(day.date);
        return copy;
      });

      try {
        const response = await fetch("/api/routines/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courseId: course.id,
            routineId: anchor.id,
            date: day.date,
            status: next,
            minutesSpent: next === "done" ? anchor.minutes : 0,
          }),
        });
        if (!response.ok) throw new Error("write failed");
      } catch {
        // Roll the optimistic tick back — a tick that never reached the server
        // must not sit there looking saved.
        setDone((current) => {
          const copy = new Set(current);
          if (next === "done") copy.delete(day.date);
          else copy.add(day.date);
          return copy;
        });
        setSaveError("অগ্রগতি সংরক্ষণ হয়নি — ইন্টারনেট দেখে আবার চেষ্টা করুন।");
      } finally {
        setPending((current) => {
          const copy = new Set(current);
          copy.delete(day.date);
          return copy;
        });
      }
    },
    [course.id, done, pending],
  );

  // The MCQ row of the plan: its note carries the official split.
  const mcqRow = React.useMemo(() => {
    for (const day of course.days) {
      const hit = day.rows.find((row) => (row.slot_label ?? "").startsWith("MCQ"));
      if (hit) return hit;
    }
    return null;
  }, [course.days]);

  const mcqSplit = React.useMemo(
    () => parseMcqSplit(mcqRow?.focus_note_bn),
    [mcqRow?.focus_note_bn],
  );
  const mcqTotal = mcqSplit.p1 + mcqSplit.p2 + mcqSplit.p3 + mcqSplit.revisit;

  // Slot minutes come from the rows, not from a constant in this file.
  const slotMinutes = React.useMemo(() => {
    const minutes: Record<GridSlotKey, number | null> = { p1: null, p2: null, p3: null };
    for (const day of course.days) {
      for (const row of day.rows) {
        const slot = gridSlotFor(row.slot_label ?? null);
        if (slot && minutes[slot] === null) minutes[slot] = row.minutes;
      }
    }
    return minutes;
  }, [course.days]);

  const firstDay = course.days[0];
  const lastDay = course.days[course.days.length - 1];
  const completedCount = course.days.filter((day) => done.has(day.date)).length;

  // 90 rows is a lot of scrolling on a phone: start at the first unfinished
  // day and show a fortnight, with one tap to reveal the whole plan.
  const firstPending = course.days.findIndex((day) => !done.has(day.date));
  const windowStart = showAll ? 0 : Math.max(0, firstPending === -1 ? 0 : firstPending);
  const windowEnd = showAll ? course.days.length : Math.min(course.days.length, windowStart + 14);
  const visible = course.days.slice(windowStart, windowEnd);

  return (
    <div className="space-y-5">
      {/* ── header: dates + the four fixed slots ─────────────────────────── */}
      <header className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-center text-[1.0625rem] font-bold tracking-tight text-[var(--text)]">
          {firstDay && lastDay
            ? `${toBengaliDigits(firstDay.day_number)} · ${formatDate(`${firstDay.date}T12:00:00`, "bn", { day: "numeric", month: "short" })} – ${toBengaliDigits(lastDay.day_number)} · ${formatDate(`${lastDay.date}T12:00:00`, "bn", { day: "numeric", month: "short" })}`
            : "৯০ দিনের রুটিন"}
        </p>
        <p className="mt-1 text-center text-[0.75rem] text-[var(--text-muted)]">
          মোট {toBengaliDigits(course.days.length)} দিন · P1 + P2 + P3/P4
        </p>

        <dl className="mt-3 grid gap-1 text-[0.75rem] text-[var(--text-muted)] sm:grid-cols-2">
          <div className="flex gap-1.5">
            <dt className="font-semibold text-[var(--text)]">শুরু:</dt>
            <dd>
              {firstDay
                ? formatDate(`${firstDay.date}T12:00:00`, "bn", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "—"}
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="font-semibold text-[var(--text)]">শেষ:</dt>
            <dd>
              {lastDay
                ? formatDate(`${lastDay.date}T12:00:00`, "bn", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "—"}
            </dd>
          </div>
        </dl>

        <p className="mt-3 text-[0.75rem] font-semibold text-[var(--text)]">
          প্রতিদিনের সময় অপরিবর্তিত:
        </p>
        <ul className="mt-1 grid gap-1 text-[0.75rem] text-[var(--text-muted)] sm:grid-cols-2">
          {GRID_SLOTS.map((slot) => (
            <li key={slot.slot} className="flex items-center gap-1.5">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: slot.dot }} />
              {slot.title} — {toBengaliDigits(slotMinutes[slot.slot] ?? slot.minutes)} মিনিট
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="size-2 shrink-0 rounded-full bg-[#7c8698]" />
            MCQ পরীক্ষা ও ভুল বিশ্লেষণ — {toBengaliDigits(mcqRow?.minutes ?? 50)} মিনিট
          </li>
        </ul>
        <p className="mt-3 border-t border-[var(--border)] pt-2 text-[0.75rem] text-[var(--text-subtle)]">
          নিচে প্রতিদিনের তারিখসহ পূর্ণ রুটিন। Topic-এর শেষে parentheses-এ Subtopics দেখানো হয়েছে।
        </p>
      </header>

      {saveError ? (
        <p role="alert" className="rounded-md border border-[#e5b4b4] bg-[#fdf3f3] px-3 py-2 text-[0.75rem] text-[#a02b2b]">
          {saveError}
        </p>
      ) : null}

      {/* ── the three phase tables ───────────────────────────────────────── */}
      {visible.map((day, index) => {
        const phase = phaseForDay(day.day_number);
        const previous = index === 0 ? null : visible[index - 1];
        const startsPhase =
          phase != null && (previous == null || phaseForDay(previous.day_number) !== phase);
        const isDone = done.has(day.date);
        const isBusy = pending.has(day.date);
        const isOpen = open[day.date] ?? false;

        const bySlot = new Map<GridSlotKey, RoutineLineInput[]>();
        for (const row of day.rows) {
          const slot = gridSlotFor(row.slot_label ?? null);
          if (!slot) continue;
          const list = bySlot.get(slot) ?? [];
          list.push(row);
          bySlot.set(slot, list);
        }

        return (
          <React.Fragment key={day.date}>
            {startsPhase && phase ? (
              <h3 className="pt-2 text-[1rem] font-bold tracking-tight" style={{ color: NAVY }}>
                Phase {toBengaliDigits(PHASES.indexOf(phase) + 1)} — দিন{" "}
                {toBengaliDigits(phase.from)}–{toBengaliDigits(phase.to)}
              </h3>
            ) : null}

            <div className="overflow-hidden rounded-md border" style={{ borderColor: GRID_LINE }}>
              <div className="grid" style={{ gridTemplateColumns: "7rem 1fr 1fr 1fr" }}>
                {(previous == null || startsPhase) && (
                  <>
                    <div
                      className="border-b bg-[#eef0f6] px-2 py-1 text-[0.625rem] font-bold text-[var(--text)]"
                      style={{ borderColor: GRID_LINE }}
                    >
                      দিন ও তারিখ
                    </div>
                    {GRID_SLOTS.map((slot) => (
                      <div
                        key={slot.slot}
                        className="flex items-center justify-center gap-1 border-b border-l bg-[#eef0f6] px-2 py-1 text-[0.625rem] font-bold text-[var(--text)]"
                        style={{ borderColor: GRID_LINE }}
                      >
                        <span className="size-1.5 rounded-full" style={{ backgroundColor: slot.dot }} />
                        {slot.title}
                      </div>
                    ))}
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setOpen((current) => ({ ...current, [day.date]: !isOpen }))}
                  className="flex items-start gap-1 border-b px-2 py-1 text-left text-[0.6875rem] font-semibold text-[var(--text)] hover:bg-[var(--surface-muted)]"
                  style={{ borderColor: GRID_LINE }}
                  aria-expanded={isOpen}
                >
                  {isOpen ? (
                    <ChevronDown className="mt-0.5 size-3 shrink-0" aria-hidden />
                  ) : (
                    <ChevronRight className="mt-0.5 size-3 shrink-0" aria-hidden />
                  )}
                  <span>
                    {dayLabel(day)}
                    {isDone ? (
                      <Check
                        className="ml-1 inline size-3 align-text-bottom"
                        style={{ color: GREEN }}
                        aria-label="সম্পন্ন"
                      />
                    ) : null}
                  </span>
                </button>

                {GRID_SLOTS.map((slot) => {
                  const cell = cellFrom(bySlot.get(slot.slot) ?? []);
                  return (
                    <div
                      key={slot.slot}
                      className="border-b border-l px-2 py-1 text-[0.6875rem] leading-snug text-[var(--text)]"
                      style={{ borderColor: GRID_LINE }}
                    >
                      {cell ? (
                        <>
                          {cell.subject ? <span className="font-semibold">{cell.subject}: </span> : null}
                          {cell.text}
                        </>
                      ) : (
                        <span className="text-[var(--text-subtle)]">—</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* expanded: this day's non-study rows (MCQ, revision notes) */}
              {isOpen ? (
                <div
                  className="border-t bg-[var(--surface-muted)] px-3 py-2"
                  style={{ borderColor: GRID_LINE }}
                >
                  <p className="text-[0.625rem] font-bold text-[var(--text)]">
                    {formatDate(`${day.date}T12:00:00`, "bn", { weekday: "long" })} · দিন{" "}
                    {toBengaliDigits(day.day_number)}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {day.rows
                      .filter((row) => gridSlotFor(row.slot_label ?? null) === null)
                      .map((row) => (
                        <li key={row.id} className="text-[0.6875rem] text-[var(--text-muted)]">
                          <span className="font-semibold text-[var(--text)]">{row.title_bn}</span>
                          {row.focus_note_bn ? <> — {row.focus_note_bn}</> : null}
                        </li>
                      ))}
                  </ul>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void toggleDay(day)}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[0.6875rem] font-semibold text-white disabled:opacity-60"
                    style={{ backgroundColor: isDone ? "#5b6478" : GREEN }}
                  >
                    <Check className="size-3" aria-hidden />
                    {isDone ? "সম্পন্ন টিক তুলুন" : "দিনটি সম্পন্ন করুন"}
                  </button>
                </div>
              ) : null}
            </div>
          </React.Fragment>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.6875rem] text-[var(--text-subtle)]">
          {showAll
            ? `${toBengaliDigits(course.days.length)} দিনের সব দেখানো হচ্ছে`
            : `দিন ${toBengaliDigits(visible[0]?.day_number ?? 1)}–${toBengaliDigits(visible[visible.length - 1]?.day_number ?? 1)} দেখানো হচ্ছে`}
        </p>
        <button
          type="button"
          onClick={() => setShowAll((current) => !current)}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-[0.6875rem] font-semibold text-[var(--text)] hover:bg-[var(--surface-muted)]"
        >
          {showAll ? "শুধু সামনের ১৪ দিন" : `সব ${toBengaliDigits(course.days.length)} দিন দেখুন`}
        </button>
      </div>

      {/* ── প্রতিদিনের MCQ ও মূল্যায়ন ─────────────────────────────────────── */}
      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="mb-2 text-[0.9375rem] font-bold" style={{ color: NAVY }}>
          প্রতিদিনের MCQ ও মূল্যায়ন
        </h3>
        <table className="w-full border-collapse text-[0.75rem]">
          <thead>
            <tr className="bg-[#eef0f6]">
              {["বিভাগ", "প্রশ্ন", "নম্বর"].map((heading) => (
                <th
                  key={heading}
                  className="border px-2 py-1 text-left font-bold"
                  style={{ borderColor: GRID_LINE }}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(
              [
                ["P1 Main", mcqSplit.p1],
                ["P2 Second", mcqSplit.p2],
                ["P3/P4 Third", mcqSplit.p3],
                ["Previous studied topics", mcqSplit.revisit],
              ] as const
            ).map(([label, value]) => (
              <tr key={label}>
                <td className="border px-2 py-1" style={{ borderColor: GRID_LINE }}>{label}</td>
                <td className="border px-2 py-1" style={{ borderColor: GRID_LINE }}>{toBengaliDigits(value)}</td>
                <td className="border px-2 py-1" style={{ borderColor: GRID_LINE }}>{toBengaliDigits(value)}</td>
              </tr>
            ))}
            <tr className="font-bold">
              <td className="border px-2 py-1" style={{ borderColor: GRID_LINE }}>মোট</td>
              <td className="border px-2 py-1" style={{ borderColor: GRID_LINE }}>{toBengaliDigits(mcqTotal)}</td>
              <td className="border px-2 py-1" style={{ borderColor: GRID_LINE }}>{toBengaliDigits(mcqTotal)}</td>
            </tr>
          </tbody>
        </table>
        <ul className="mt-2 space-y-0.5 text-[0.75rem] text-[var(--text-muted)]">
          <li>• সময়: {toBengaliDigits(mcqRow?.minutes ?? 50)} মিনিট।</li>
          <li>• সঠিক উত্তর: +১।</li>
          <li>• ভুল উত্তর: −০.২৫।</li>
          <li>• উত্তর না দিলে: ০।</li>
          <li>• পরীক্ষার পর ভুল প্রশ্ন Error Notebook-এ লিখবে।</li>
        </ul>
      </section>

      {/* ── ৯০ দিনের Progress Tracker ─────────────────────────────────────── */}
      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="mb-1 text-[0.9375rem] font-bold" style={{ color: NAVY }}>
          ৯০ দিনের Progress Tracker
        </h3>
        <p className="text-[0.75rem] font-semibold text-[var(--text)]">
          Daily completion — {toBengaliDigits(completedCount)}/{toBengaliDigits(course.days.length)} দিন
        </p>
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]"
          role="progressbar"
          aria-valuenow={completedCount}
          aria-valuemin={0}
          aria-valuemax={course.days.length}
        >
          <div
            className="h-full rounded-full"
            style={{
              backgroundColor: GREEN,
              width: `${course.days.length === 0 ? 0 : Math.round((completedCount / course.days.length) * 100)}%`,
            }}
          />
        </div>

        <div className="mt-3 space-y-2">
          {PHASES.map((phase, phaseIndex) => {
            const inPhase = course.days.filter(
              (day) => day.day_number >= phase.from && day.day_number <= phase.to,
            );
            const phaseDone = inPhase.filter((day) => done.has(day.date)).length;
            return (
              <div key={phase.label}>
                <p className="text-[0.6875rem] font-semibold text-[var(--text)]">
                  Phase {toBengaliDigits(phaseIndex + 1)} — {phase.label.split(" · ")[1]} —{" "}
                  {toBengaliDigits(phaseDone)}/{toBengaliDigits(inPhase.length)}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {inPhase.map((day) => {
                    const isDone = done.has(day.date);
                    return (
                      <button
                        key={day.date}
                        type="button"
                        disabled={pending.has(day.date)}
                        onClick={() => void toggleDay(day)}
                        title={`দিন ${toBengaliDigits(day.day_number)} · ${dayLabel(day)}`}
                        aria-pressed={isDone}
                        aria-label={`দিন ${toBengaliDigits(day.day_number)} ${isDone ? "সম্পন্ন" : "সম্পন্ন নয়"}`}
                        className="flex size-6 items-center justify-center rounded text-[0.5625rem] font-semibold transition-colors disabled:opacity-60"
                        style={{
                          backgroundColor: isDone ? GREEN : "#eef0f6",
                          color: isDone ? "#ffffff" : "#5b6478",
                        }}
                      >
                        {toBengaliDigits(day.day_number)}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[0.6875rem] text-[var(--text-subtle)]">
          সবুজ = সম্পন্ন। কোনো সংখ্যায় টিক দিলে সেটি সেভ হয় এবং রুটিন পেজের বাকি অংশেও সম্পন্ন হিসেবে দেখায়।
        </p>
      </section>
    </div>
  );
}

/** Bengali numerals, matching the printed plan (১ ২ ৩ …). */
function toBengaliDigits(value: number | string): string {
  return String(value).replace(/\d/g, (digit) => "০১২৩৪৫৬৭৮৯"[Number(digit)]);
}
