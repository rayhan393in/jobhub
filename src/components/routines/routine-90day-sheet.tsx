"use client";

/**
 * ৯০ দিনের BCS Preliminary রুটিন — the dated plan, one card per day.
 *
 * Each day is a card whose rows are the three study slots (P1 / P2 / P3-P4),
 * each row led by its own colour-coded pill. The slot leads the row — not the
 * subject — so the three pillars read as separate things at a glance and the
 * topic column is free to use the full width instead of being boxed at ~30%.
 *
 * Everything shown comes from the published routine rows: cells, subject
 * prefixes, slot minutes and the MCQ split are all read off the plan, never
 * re-typed. The tracker writes through the same `routine_progress` API the
 * weekly planner uses, so a tick is genuinely saved and an untouched day stays
 * empty rather than being optimistically painted green.
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

const NAVY = "#25306b";
const GREEN = "#157a43";

export type SheetDay = {
  date: string;
  day_number: number;
  /** The day's routine rows, unchanged — rows are grouped by slot. */
  rows: RoutineLineInput[];
};

export type SheetCourse = {
  id: string;
  title_bn: string;
  plan_start: string;
  days: SheetDay[];
};

type GridSlotKey = (typeof GRID_SLOTS)[number]["slot"];

/** Per-slot chrome. The colour carries the identity, the pill carries the name. */
const SLOT_STYLE: Record<
  GridSlotKey,
  { accent: string; soft: string; pill: string; label: string }
> = {
  p1: { accent: "#c62f2f", soft: "#fdf4f4", pill: "#fbe6e6", label: "Main · P1" },
  p2: { accent: "#9c5800", soft: "#fdf8f1", pill: "#fcecd8", label: "Second · P2" },
  p3: { accent: "#17795c", soft: "#f3faf7", pill: "#dcf2e9", label: "Third · P3/P4" },
};

type Cell = { subject: string | null; text: string; topics: { topic: string; subtopics: string[] }[] };

function cellFrom(rows: RoutineLineInput[]): Cell | null {
  if (rows.length === 0) return null;
  const topics: { topic: string; subtopics: string[] }[] = [];
  const notes: string[] = [];
  let subject: string | null = null;

  for (const row of rows) {
    if (!subject && row.subject_title_bn) subject = row.subject_title_bn;
    if (row.topics.length > 0) {
      for (const entry of row.topics) {
        const existing = topics.find((candidate) => candidate.topic === entry.topic);
        if (existing) existing.subtopics.push(...entry.subtopics.filter((s) => !existing.subtopics.includes(s)));
        else topics.push({ topic: entry.topic, subtopics: [...entry.subtopics] });
      }
    } else {
      notes.push(row.focus_note_bn || row.title_bn);
    }
  }

  if (topics.length === 0 && notes.length === 0) return null;
  return { subject, text: notes.join(" · "), topics };
}

function bn(value: number | string): string {
  return String(value).replace(/\d/g, (digit) => "০১২৩৪৫৬৭৮৯"[Number(digit)]);
}

function dayRange(day: SheetDay): string {
  return formatDate(`${day.date}T12:00:00`, "bn", { day: "numeric", month: "long" });
}

export function Routine90DaySheet({
  course,
  initialCompletedDates,
}: {
  course: SheetCourse;
  initialCompletedDates: string[];
}) {
  const [showAll, setShowAll] = React.useState(false);
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  const [done, setDone] = React.useState<Set<string>>(() => new Set(initialCompletedDates));
  const [pending, setPending] = React.useState<Set<string>>(() => new Set());
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const toggleDay = React.useCallback(
    async (day: SheetDay) => {
      if (pending.has(day.date)) return;
      const next = done.has(day.date) ? "pending" : "done";
      const anchor =
        day.rows.find((row) => (row.slot_label ?? "").startsWith("P1 Main")) ?? day.rows[0];
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

  const firstPending = course.days.findIndex((day) => !done.has(day.date));
  const windowStart = showAll ? 0 : Math.max(0, firstPending === -1 ? 0 : firstPending);
  const windowEnd = showAll ? course.days.length : Math.min(course.days.length, windowStart + 14);
  const visible = course.days.slice(windowStart, windowEnd);

  return (
    <div className="space-y-6">
      {/* ── header ───────────────────────────────────────────────────────── */}
      <header className="jh-card overflow-hidden">
        <div className="px-5 pt-5 pb-4" style={{ background: "linear-gradient(180deg, #f7f8fd, #ffffff)" }}>
          <p className="jh-nums text-center text-[1.25rem] font-bold tracking-tight text-[var(--text)]">
            {firstDay && lastDay ? (
              <>
                দিন {bn(firstDay.day_number)} · {dayRange(firstDay)}
                <span className="mx-2 text-[var(--text-subtle)]">—</span>
                দিন {bn(lastDay.day_number)} · {dayRange(lastDay)}
              </>
            ) : (
              "৯০ দিনের রুটিন"
            )}
          </p>
          <p className="mt-1 text-center text-[0.8125rem] text-[var(--text-muted)]">
            মোট {bn(course.days.length)} দিন · P1 + P2 + P3/P4
          </p>
        </div>

        <dl className="mx-5 grid gap-2 border-t border-[var(--border)] py-4 text-[0.8125rem] sm:grid-cols-2">
          {(
            [
              ["শুরু", firstDay],
              ["শেষ", lastDay],
            ] as const
          ).map(([label, day]) => (
            <div key={label} className="flex gap-2">
              <dt className="font-semibold text-[var(--text)]">{label}:</dt>
              <dd className="text-[var(--text-muted)]">
                {day
                  ? formatDate(`${day.date}T12:00:00`, "bn", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "—"}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mx-5 border-t border-[var(--border)] py-4">
          <p className="mb-2 text-[0.8125rem] font-semibold text-[var(--text)]">
            প্রতিদিনের সময় অপরিবর্তিত
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {GRID_SLOTS.map((slot) => {
              const style = SLOT_STYLE[slot.slot];
              return (
                <li key={slot.slot} className="flex items-center gap-2 text-[0.8125rem]">
                  <span
                    className="inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[0.6875rem] font-bold"
                    style={{ backgroundColor: style.pill, color: style.accent }}
                  >
                    {style.label}
                  </span>
                  <span className="jh-nums text-[var(--text-muted)]">
                    {bn(slotMinutes[slot.slot] ?? slot.minutes)} মিনিট
                  </span>
                </li>
              );
            })}
            <li className="flex items-center gap-2 text-[0.8125rem]">
              <span className="inline-flex shrink-0 items-center rounded bg-[#eceef4] px-1.5 py-0.5 text-[0.6875rem] font-bold text-[#4a5372]">
                MCQ · মূল্যায়ন
              </span>
              <span className="jh-nums text-[var(--text-muted)]">{bn(mcqRow?.minutes ?? 50)} মিনিট</span>
            </li>
          </ul>
        </div>

        <p className="mx-5 border-t border-[var(--border)] py-3 text-[0.75rem] text-[var(--text-muted)]">
          প্রতিটি দিনের কার্ডে তিনটি স্লট আলাদা রঙে সাজানো। টপিকের নিচে ছোট করে subtopics দেখানো হয়েছে।
        </p>
      </header>

      {saveError ? (
        <p
          role="alert"
          className="rounded-lg border border-[#e8b6b6] bg-[#fdf3f3] px-3.5 py-2.5 text-[0.8125rem] font-medium text-[#8f2424]"
        >
          {saveError}
        </p>
      ) : null}

      {/* ── day cards ────────────────────────────────────────────────────── */}
      <div className="space-y-4">
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
          const extras = day.rows.filter((row) => gridSlotFor(row.slot_label ?? null) === null);

          return (
            <React.Fragment key={day.date}>
              {startsPhase && phase ? (
                <div className="flex items-center gap-3 pt-3">
                  <span
                    className="rounded-md px-2 py-1 text-[0.75rem] font-bold text-white"
                    style={{ backgroundColor: NAVY }}
                  >
                    Phase {bn(PHASES.indexOf(phase) + 1)}
                  </span>
                  <span className="text-[0.8125rem] font-semibold text-[var(--text)]">
                    দিন {bn(phase.from)}–{bn(phase.to)}
                  </span>
                  <span className="h-px flex-1 bg-[var(--border)]" />
                </div>
              ) : null}

              <section
                className="overflow-hidden rounded-xl border bg-[var(--surface)] shadow-[0_1px_2px_rgba(22,26,51,0.05)]"
                style={{ borderColor: isDone ? "#bfe3cf" : "#dfe3f0" }}
              >
                {/* day header */}
                <div
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
                  style={{ backgroundColor: NAVY }}
                >
                  <div className="flex items-center gap-2">
                    {isDone ? (
                      <span
                        className="flex size-5 items-center justify-center rounded-full"
                        style={{ backgroundColor: "#3fbf7f" }}
                      >
                        <Check className="size-3 text-white" aria-hidden />
                      </span>
                    ) : null}
                    <h3 className="jh-nums text-[0.9375rem] font-bold text-white">
                      দিন {bn(day.day_number)}
                      <span className="mx-1.5 font-normal text-white/50">—</span>
                      {dayRange(day)}
                      <span className="mx-1.5 font-normal text-white/50">—</span>
                      <span className="font-semibold">
                        {formatDate(`${day.date}T12:00:00`, "bn", { weekday: "long" })}
                      </span>
                    </h3>
                  </div>
                  <span className="jh-nums rounded-full bg-white/15 px-2.5 py-0.5 text-[0.6875rem] font-semibold text-white">
                    {bn(day.rows.reduce((sum, row) => sum + row.minutes, 0))} মিনিট
                  </span>
                </div>

                {/* three study slots — one row each, colour-led */}
                <div className="divide-y divide-[var(--border)]">
                  {GRID_SLOTS.map((slot) => {
                    const style = SLOT_STYLE[slot.slot];
                    const cell = cellFrom(bySlot.get(slot.slot) ?? []);
                    return (
                      <div key={slot.slot} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-4">
                        <div className="flex shrink-0 items-start gap-2 sm:w-[9.5rem] sm:flex-col sm:gap-1">
                          <span
                            className="inline-flex items-center rounded px-1.5 py-0.5 text-[0.6875rem] font-bold whitespace-nowrap"
                            style={{ backgroundColor: style.pill, color: style.accent }}
                          >
                            {style.label}
                          </span>
                          <span className="jh-nums text-[0.75rem] text-[var(--text-subtle)]">
                            {bn(slotMinutes[slot.slot] ?? slot.minutes)} মিনিট
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          {cell ? (
                            <>
                              {cell.subject ? (
                                <p className="text-[0.875rem] font-bold text-[var(--text)]">
                                  {cell.subject}
                                </p>
                              ) : null}
                              {cell.topics.map((entry) => (
                                <div key={entry.topic} className="mt-1 first:mt-0">
                                  <p className="text-[0.875rem] font-semibold leading-snug text-[var(--text)]">
                                    {entry.topic}
                                  </p>
                                  {entry.subtopics.length > 0 ? (
                                    <p className="mt-0.5 text-[0.75rem] leading-relaxed text-[var(--text-muted)]">
                                      {entry.subtopics.join(" · ")}
                                    </p>
                                  ) : null}
                                </div>
                              ))}
                              {cell.text ? (
                                <p className="text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
                                  {cell.text}
                                </p>
                              ) : null}
                            </>
                          ) : (
                            <p className="text-[0.8125rem] text-[var(--text-subtle)]">
                              এই দিনে এই স্লটে কিছু নেই
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* footnote: MCQ split + day actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2">
                  <button
                    type="button"
                    onClick={() => setOpen((current) => ({ ...current, [day.date]: !isOpen }))}
                    aria-expanded={isOpen}
                    className="inline-flex items-center gap-1 text-[0.75rem] font-semibold text-[var(--text-muted)] hover:text-[var(--text)]"
                  >
                    {isOpen ? <ChevronDown className="size-3.5" aria-hidden /> : <ChevronRight className="size-3.5" aria-hidden />}
                    MCQ {bn(mcqRow?.minutes ?? 50)} মিনিট
                    {isOpen ? " — লুকান" : " — বিস্তারিত"}
                  </button>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void toggleDay(day)}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[0.75rem] font-semibold text-white transition-opacity disabled:opacity-60"
                    style={{ backgroundColor: isDone ? "#5b6478" : GREEN }}
                  >
                    <Check className="size-3" aria-hidden />
                    {isDone ? "সম্পন্ন — টিক তুলুন" : "সম্পন্ন করুন"}
                  </button>
                </div>

                {isOpen ? (
                  <div className="border-t border-[var(--border)] px-4 py-3">
                    <p className="text-[0.75rem] font-semibold text-[var(--text)]">
                      দিনের বাকি কাজ
                    </p>
                    <ul className="mt-1.5 space-y-1.5">
                      {extras.length === 0 ? (
                        <li className="text-[0.75rem] text-[var(--text-subtle)]">অতিরিক্ত কিছু নেই</li>
                      ) : (
                        extras.map((row) => (
                          <li key={row.id} className="text-[0.75rem] leading-relaxed text-[var(--text-muted)]">
                            <span className="font-semibold text-[var(--text)]">{row.title_bn}</span>
                            {row.focus_note_bn ? <> — {row.focus_note_bn}</> : null}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                ) : null}
              </section>
            </React.Fragment>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="jh-nums text-[0.75rem] text-[var(--text-muted)]">
          {showAll
            ? `${bn(course.days.length)} দিনের সব দেখানো হচ্ছে`
            : `দিন ${bn(visible[0]?.day_number ?? 1)}–${bn(visible[visible.length - 1]?.day_number ?? 1)} দেখানো হচ্ছে`}
        </p>
        <button
          type="button"
          onClick={() => setShowAll((current) => !current)}
          className="rounded-lg border border-[var(--border-strong)] px-3.5 py-2 text-[0.8125rem] font-semibold text-[var(--text)] hover:bg-[var(--surface-muted)]"
        >
          {showAll ? "শুধু সামনের ১৪ দিন" : `সব ${bn(course.days.length)} দিন দেখুন`}
        </button>
      </div>

      {/* ── প্রতিদিনের MCQ ও মূল্যায়ন ─────────────────────────────────────── */}
      <section className="jh-card p-5">
        <h3 className="mb-3 text-[1rem] font-bold" style={{ color: NAVY }}>
          প্রতিদিনের MCQ ও মূল্যায়ন
        </h3>
        <table className="w-full border-collapse text-[0.8125rem]">
          <thead>
            <tr className="bg-[#f4f6fb]">
              {["বিভাগ", "প্রশ্ন", "নম্বর"].map((heading) => (
                <th key={heading} className="border border-[#dbe0ee] px-2.5 py-1.5 text-left font-bold text-[var(--text)]">
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
                ["আগে পড়া টপিক", mcqSplit.revisit],
              ] as const
            ).map(([label, value]) => (
              <tr key={label}>
                <td className="border border-[#dbe0ee] px-2.5 py-1.5 text-[var(--text)]">{label}</td>
                <td className="jh-nums border border-[#dbe0ee] px-2.5 py-1.5 text-[var(--text-muted)]">{bn(value)}</td>
                <td className="jh-nums border border-[#dbe0ee] px-2.5 py-1.5 text-[var(--text-muted)]">{bn(value)}</td>
              </tr>
            ))}
            <tr className="bg-[#f7f8fd] font-bold">
              <td className="border border-[#dbe0ee] px-2.5 py-1.5 text-[var(--text)]">মোট</td>
              <td className="jh-nums border border-[#dbe0ee] px-2.5 py-1.5 text-[var(--text)]">{bn(mcqTotal)}</td>
              <td className="jh-nums border border-[#dbe0ee] px-2.5 py-1.5 text-[var(--text)]">{bn(mcqTotal)}</td>
            </tr>
          </tbody>
        </table>
        <ul className="mt-3 space-y-1 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
          <li>• সময়: {bn(mcqRow?.minutes ?? 50)} মিনিট।</li>
          <li>• সঠিক উত্তর: +১।</li>
          <li>• ভুল উত্তর: −০.২৫।</li>
          <li>• উত্তর না দিলে: ০।</li>
          <li>• পরীক্ষার পর ভুল প্রশ্ন Error Notebook-এ লিখবে।</li>
        </ul>
      </section>

      {/* ── ৯০ দিনের Progress Tracker ─────────────────────────────────────── */}
      <section className="jh-card p-5">
        <h3 className="mb-1 text-[1rem] font-bold" style={{ color: NAVY }}>
          ৯০ দিনের Progress Tracker
        </h3>
        <p className="jh-nums text-[0.8125rem] font-semibold text-[var(--text)]">
          Daily completion — {bn(completedCount)}/{bn(course.days.length)} দিন
        </p>
        <div
          className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]"
          role="progressbar"
          aria-valuenow={completedCount}
          aria-valuemin={0}
          aria-valuemax={course.days.length}
        >
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{
              backgroundColor: GREEN,
              width: `${course.days.length === 0 ? 0 : Math.round((completedCount / course.days.length) * 100)}%`,
            }}
          />
        </div>

        <div className="mt-4 space-y-3">
          {PHASES.map((phase, phaseIndex) => {
            const inPhase = course.days.filter(
              (day) => day.day_number >= phase.from && day.day_number <= phase.to,
            );
            const phaseDone = inPhase.filter((day) => done.has(day.date)).length;
            return (
              <div key={phase.label}>
                <p className="jh-nums text-[0.75rem] font-semibold text-[var(--text)]">
                  Phase {bn(phaseIndex + 1)} — {phase.label.split(" · ")[1]} — {bn(phaseDone)}/
                  {bn(inPhase.length)}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {inPhase.map((day) => {
                    const isDone = done.has(day.date);
                    return (
                      <button
                        key={day.date}
                        type="button"
                        disabled={pending.has(day.date)}
                        onClick={() => void toggleDay(day)}
                        title={`দিন ${bn(day.day_number)} · ${dayRange(day)}`}
                        aria-pressed={isDone}
                        aria-label={`দিন ${bn(day.day_number)} ${isDone ? "সম্পন্ন" : "সম্পন্ন নয়"}`}
                        className="jh-nums flex size-7 items-center justify-center rounded-md text-[0.6875rem] font-semibold transition-colors disabled:opacity-60"
                        style={{
                          backgroundColor: isDone ? GREEN : "#eef0f7",
                          color: isDone ? "#ffffff" : "#3f4866",
                        }}
                      >
                        {bn(day.day_number)}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[0.75rem] text-[var(--text-muted)]">
          সবুজ = সম্পন্ন। কোনো সংখ্যায় টিক দিলে সেটি সেভ হয় এবং রুটিন পেজের বাকি অংশেও সম্পন্ন হিসেবে দেখায়।
        </p>
      </section>
    </div>
  );
}
