"use client";

/**
 * Universal routine sheet for the student /routines page.
 *
 * One component serves every course. What changes per course is configuration,
 * not code: the priority structure comes from `courses.metadata.priorities`
 * (or the course's own slot labels), and the exam instruction bar's marks come
 * from the course's live exam configuration — never from a constant in here.
 * A Petrobangla routine therefore renders its own subject plates, and a course
 * with no verified marks pattern hides the bar instead of showing BCS numbers.
 *
 * Layout follows the approved figure:
 *   overview strip → single-line exam instruction bar → day cards
 *   (navy day header · full-width topic section · priority plates)
 *   → next-day preview → routine history.
 */

import * as React from "react";
import {
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  Layers,
  RotateCcw,
  Target,
  TrendingUp,
} from "lucide-react";
import { formatDate } from "@/lib/format";
import { PHASES, phaseForDay, type RoutineLineInput } from "@/lib/routine-day-lines";
import { priorityOf, type PriorityDef, type PriorityKey } from "@/lib/routine-priorities";
import { bnMarks, type MarksItem } from "@/lib/routine-marks";

const NAVY = "var(--p1-header)";

/** Plate identity per priority key, resolved through theme tokens. */
const PLATE: Record<PriorityKey, { accent: string; tint: string; rule: string; badge: string }> = {
  p1: { accent: "var(--p1-ink)", tint: "var(--p1-tint)", rule: "var(--p1-rule)", badge: "var(--p1-badge)" },
  p2: { accent: "var(--p2-ink)", tint: "var(--p2-tint)", rule: "var(--p2-rule)", badge: "var(--p2-badge)" },
  p3: { accent: "var(--p3-ink)", tint: "var(--p3-tint)", rule: "var(--p3-rule)", badge: "var(--p3-badge)" },
  p4: { accent: "var(--p4-ink)", tint: "var(--p4-tint)", rule: "var(--p4-rule)", badge: "var(--p4-badge)" },
};

export type SheetDay = {
  date: string;
  day_number: number;
  rows: RoutineLineInput[];
};

export type SheetCourse = {
  id: string;
  title_bn: string;
  plan_start: string;
  days: SheetDay[];
  /** Course start/end as published; falls back to the first/last day. */
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
};

export type SheetMarks = { items: MarksItem[]; source: string };

function bn(value: number | string): string {
  return String(value).replace(/\d/g, (digit) => "০১২৩৪৫৬৭৮৯"[Number(digit)]);
}

function longDate(date: string): string {
  return formatDate(`${date}T12:00:00`, "bn", { day: "numeric", month: "long" });
}

function fullDate(date: string): string {
  return formatDate(`${date}T12:00:00`, "bn", { day: "numeric", month: "long", year: "numeric" });
}

function weekday(date: string): string {
  return formatDate(`${date}T12:00:00`, "bn", { weekday: "long" });
}

type Plate = {
  subject: string | null;
  topics: { topic: string; subtopics: string[] }[];
  note: string | null;
};

/** Group one day's rows into plates, merging repeated subjects. */
function plateFor(rows: RoutineLineInput[], key: PriorityKey, priorities: PriorityDef[]): Plate | null {
  const mine = rows.filter((row) => priorityOf(row.slot_label ?? null, priorities) === key);
  if (mine.length === 0) return null;

  const topics: Plate["topics"] = [];
  const notes: string[] = [];
  let subject: string | null = null;

  for (const row of mine) {
    if (!subject && row.subject_title_bn) subject = row.subject_title_bn;
    for (const entry of row.topics) {
      const match = topics.find((candidate) => candidate.topic === entry.topic);
      if (match) {
        match.subtopics.push(...entry.subtopics.filter((sub) => !match.subtopics.includes(sub)));
      } else {
        topics.push({ topic: entry.topic, subtopics: [...entry.subtopics] });
      }
    }
    if (row.topics.length === 0) notes.push(row.focus_note_bn || row.title_bn);
  }

  if (topics.length === 0 && notes.length === 0) return null;
  return { subject, topics, note: notes.length > 0 ? notes.join(" · ") : null };
}

/**
 * The small tag on each plate, describing the kind of work in *that plate*.
 *
 * It must be scoped to the plate's own rows: reading the whole day's rows made
 * every plate say "মূল অধ্যয়ন" whenever any row that day was study, so a
 * revision plate was labelled as first study — visibly wrong next to its green
 * "রিভিশন" accent.
 */
function workTone(rows: RoutineLineInput[]): { label: string; icon: React.ReactNode } {
  const kinds = new Set(rows.map((row) => row.task_kind));
  if (kinds.has("revision")) return { label: "রিভিশন", icon: <RotateCcw className="size-3" aria-hidden /> };
  if (kinds.has("practice")) return { label: "অনুশীলন", icon: <Target className="size-3" aria-hidden /> };
  if (kinds.has("exam")) return { label: "পরীক্ষা", icon: <Target className="size-3" aria-hidden /> };
  return { label: "মূল অধ্যয়ন", icon: <BookOpen className="size-3" aria-hidden /> };
}

export function UniversalRoutineSheet({
  course,
  priorities,
  marks,
  initialCompletedDates,
  today,
  history = [],
  printHref,
}: {
  course: SheetCourse;
  priorities: PriorityDef[];
  marks: SheetMarks;
  initialCompletedDates: string[];
  /** Dhaka date key, so "today" and the day the page opens on agree. */
  today: string;
  history?: { id: string; title_bn: string; start: string; end: string; done: number; total: number }[];
  printHref: string;
}) {
  const [done, setDone] = React.useState<Set<string>>(() => new Set(initialCompletedDates));
  const [pending, setPending] = React.useState<Set<string>>(() => new Set());
  const [saveError, setSaveError] = React.useState<string | null>(null);

  // Which day is open. Opens on the current eligible day — never blindly day 1.
  const [activeDate, setActiveDate] = React.useState<string>(() => {
    const exact = course.days.find((day) => day.date === today);
    if (exact) return exact.date;
    const next = course.days.find((day) => day.date >= today);
    return (next ?? course.days[0])?.date ?? "";
  });

  const activeIndex = course.days.findIndex((day) => day.date === activeDate);
  const activeDay = course.days[activeIndex] ?? null;
  const nextDay = course.days[activeIndex + 1] ?? null;
  const totalDays = course.days.length;
  const completed = course.days.filter((day) => done.has(day.date)).length;
  const percent = totalDays === 0 ? 0 : Math.round((completed / totalDays) * 100);

  const phase = activeDay ? phaseForDay(activeDay.day_number) : null;

  const toggle = React.useCallback(
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
        // A tick that never reached the server must not sit there looking saved.
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

  const startDate = course.start_date ?? course.days[0]?.date ?? "";
  const endDate = course.end_date ?? course.days[totalDays - 1]?.date ?? "";

  function goTo(delta: number) {
    const target = course.days[activeIndex + delta];
    if (target) setActiveDate(target.date);
  }

  function jumpToPhase(index: number) {
    const phaseDef = PHASES[index];
    const target = course.days.find(
      (day) => day.day_number >= phaseDef.from && day.day_number <= phaseDef.to,
    );
    if (target) setActiveDate(target.date);
  }

  return (
    <div className="w-full space-y-4">
      {/* ── overview strip ───────────────────────────────────────────────── */}
      <section aria-label="রুটিন সারসংক্ষেপ" className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row">
          {/* current day — the one card that answers "where am I?" */}
          <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 lg:w-[16.5rem] lg:shrink-0">
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--p1-tint)" }}
            >
              <Target className="size-[1.375rem]" style={{ color: "var(--p1-rule)" }} aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-[0.75rem] font-semibold text-[var(--text-muted)]">বর্তমান দিন</p>
                <StatusPill status={course.status} percent={percent} />
              </div>
              <p className="jh-nums text-[1.1875rem] font-extrabold leading-tight text-[var(--text)]">
                Day {bn(activeDay?.day_number ?? 1)} / {bn(totalDays)}
              </p>
              <p className="jh-nums text-[0.75rem] font-medium text-[var(--text-muted)]">
                {activeDay ? `${longDate(activeDay.date)}, ${weekday(activeDay.date)}` : "—"}
              </p>
            </div>
          </div>

          {/* the four facts + progress, as one card with rules between columns,
              matching the approved figure rather than five loose boxes */}
          <div className="grid flex-1 grid-cols-2 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] sm:grid-cols-3 xl:grid-cols-5">
            <Stat
              label="মোট সময়কাল"
              value={`${bn(totalDays)} দিন`}
              icon={<CalendarRange className="size-[1.125rem]" aria-hidden />}
              tone="p1"
            />
            <Stat
              label="শুরুর তারিখ"
              value={startDate ? longDate(startDate) : "—"}
              icon={<CalendarDays className="size-[1.125rem]" aria-hidden />}
              tone="p1"
            />
            <Stat
              label="শেষ তারিখ"
              value={endDate ? longDate(endDate) : "—"}
              icon={<CalendarCheck className="size-[1.125rem]" aria-hidden />}
              tone="p1"
            />
            <Stat
              label="মোট Subject"
              value={`${bn(uniqueSubjects(course))} টি`}
              icon={<Layers className="size-[1.125rem]" aria-hidden />}
              tone="p2"
            />
            <Stat
              label="পর্যায়"
              value={phase ? `Phase ${bn(PHASES.indexOf(phase) + 1)}` : "—"}
              icon={<GitBranch className="size-[1.125rem]" aria-hidden />}
              tone="p3"
            />

            {/* progress spans the full width on small screens so the bar stays
                readable instead of being squeezed into a half column */}
            <div className="col-span-2 border-t border-[var(--border)] px-4 py-3 sm:col-span-3 xl:col-span-5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="flex items-center gap-2 text-[0.75rem] font-semibold text-[var(--text-muted)]">
                  <TrendingUp className="size-[1.125rem] shrink-0" style={{ color: "var(--p4-rule)" }} aria-hidden />
                  সামগ্রিক অগ্রগতি
                </p>
                <p className="jh-nums text-[0.8125rem] font-extrabold" style={{ color: "var(--done-ink)" }}>
                  {bn(percent)}%
                </p>
              </div>
              <div
                className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="সামগ্রিক অগ্রগতি"
              >
                <div
                  className="h-full rounded-full"
                  style={{ backgroundColor: "var(--done-ink)", width: `${percent}%` }}
                />
              </div>
              <p className="jh-nums mt-1 text-[0.75rem] font-semibold text-[var(--text)]">
                {bn(completed)}/{bn(totalDays)} দিন সম্পন্ন
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── single-line exam instruction bar: MARKS ONLY ─────────────────── */}
      <ExamInstructionBar marks={marks} />

      {saveError ? (
        <p
          role="alert"
          className="rounded-lg border border-[var(--danger)] bg-[var(--surface)] px-3.5 py-2.5 text-[0.8125rem] font-medium text-[var(--danger)]"
        >
          {saveError}
        </p>
      ) : null}

      {/* ── active day card ──────────────────────────────────────────────── */}
      {activeDay ? (
        <article className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {/* A. day header */}
          <header
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2.5"
            style={{ backgroundColor: NAVY }}
          >
            <h3 className="jh-nums flex flex-wrap items-center gap-x-2 text-[0.875rem] font-bold text-white">
              দিন {bn(activeDay.day_number)} — {fullDate(activeDay.date)}, {weekday(activeDay.date)}
              {activeDay.date === today ? (
                <span className="rounded bg-white px-1.5 py-0.5 text-[0.5625rem] font-bold text-[#1e2a63]">
                  আজ
                </span>
              ) : null}
            </h3>

            <div className="flex items-center gap-1.5">
              <label className="sr-only" htmlFor="phase-select">
                পর্যায় নির্বাচন
              </label>
              <select
                id="phase-select"
                value={PHASES.findIndex((p) => p === phase)}
                onChange={(event) => jumpToPhase(Number(event.target.value))}
                className="jh-nums max-w-[11rem] rounded-md border-0 bg-white px-2 py-1 text-[0.6875rem] font-semibold text-[#1e2a63]"
              >
                {PHASES.map((item, index) => (
                  <option key={item.label} value={index}>
                    Phase {bn(index + 1)} — দিন {bn(item.from)}–{bn(item.to)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => goTo(-1)}
                disabled={activeIndex <= 0}
                aria-label="আগের দিন"
                className="flex size-7 items-center justify-center rounded-md bg-white/15 text-white hover:bg-white/25 disabled:opacity-40"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => goTo(1)}
                disabled={activeIndex >= totalDays - 1}
                aria-label="পরের দিন"
                className="flex size-7 items-center justify-center rounded-md bg-white/15 text-white hover:bg-white/25 disabled:opacity-40"
              >
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
          </header>

          {/* B. full-width topic section */}
          <div
            className="px-4 py-2"
            style={{ backgroundColor: "var(--p1-tint)" }}
          >
            <h4 className="flex items-center gap-1.5 text-[0.8125rem] font-bold" style={{ color: "var(--p1-ink)" }}>
              <BookOpen className="size-3.5" aria-hidden />
              আজকের পড়ার বিষয় ও টপিক
            </h4>
          </div>

          {/* C. priority plates — full width, one per priority */}
          <div className="space-y-2 p-3">
            {priorities.map((priority) => {
              const plate = plateFor(activeDay.rows, priority.key, priorities);
              if (!plate) return null;
              const tone = PLATE[priority.key];
              const work = workTone(
                activeDay.rows.filter(
                  (row) => priorityOf(row.slot_label ?? null, priorities) === priority.key,
                ),
              );
              return (
                <div
                  key={priority.key}
                  className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5"
                  style={{
                    backgroundColor: tone.tint,
                    borderLeft: `4px solid ${tone.rule}`,
                  }}
                >
                  {/* badge */}
                  {/* The badge carries white text, so it uses `ink` rather than
                      `rule`: the rule is a non-text edge (3:1 is enough there),
                      while #b8730a under white text is only 3.82:1. */}
                  <div
                    className="flex w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-md px-1 py-1.5 text-white"
                    style={{ backgroundColor: tone.badge }}
                  >
                    <span className="jh-nums text-[0.8125rem] font-bold leading-tight">{priority.badge}</span>
                    <span className="text-[0.625rem] font-semibold leading-tight opacity-90">
                      {priority.label}
                    </span>
                  </div>

                  {/* content — the only place topic detail lives */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                      <p className="min-w-0 text-[0.9375rem] font-bold leading-snug text-[var(--text)]">
                        {plate.subject ?? "—"}
                      </p>
                      <span
                        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[0.625rem] font-semibold"
                        style={{ color: tone.accent }}
                      >
                        {work.icon}
                        {work.label}
                      </span>
                    </div>

                    {plate.topics.map((entry) => (
                      <div key={entry.topic} className="mt-0.5 first:mt-0">
                        <p className="text-[0.8125rem] leading-snug text-[var(--text)]">
                          <span className="font-semibold">টপিক:</span> {entry.topic}
                        </p>
                        {entry.subtopics.length > 0 ? (
                          <p className="text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
                            <span className="font-semibold text-[var(--text)]">উপ-টপিক:</span>{" "}
                            {entry.subtopics.join(", ")}
                          </p>
                        ) : null}
                      </div>
                    ))}
                    {plate.note ? (
                      <p className="text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">{plate.note}</p>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {priorities.every((priority) => !plateFor(activeDay.rows, priority.key, priorities)) ? (
              <p className="px-1 py-3 text-[0.8125rem] text-[var(--text-muted)]">
                এই দিনের জন্য কোনো পড়ার বিষয় প্রকাশ করা হয়নি।
              </p>
            ) : null}
          </div>

          {/* day action */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-2">
            <p className="jh-nums text-[0.75rem] font-medium text-[var(--text-muted)]">
              {phase ? phase.label : "—"}
            </p>
            <button
              type="button"
              disabled={pending.has(activeDay.date)}
              onClick={() => void toggle(activeDay)}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[0.75rem] font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: done.has(activeDay.date) ? "#4b5468" : "var(--done-ink)" }}
            >
              <Check className="size-3.5" aria-hidden />
              {done.has(activeDay.date) ? "টিক তুলুন" : "এই দিন সম্পন্ন করুন"}
            </button>
          </div>
        </article>
      ) : (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-center text-[0.875rem] text-[var(--text-muted)]">
          এই কোর্সের জন্য বর্তমানে কোনো সক্রিয় রুটিন নেই।
        </p>
      )}

      {/* ── next day preview ─────────────────────────────────────────────── */}
      {nextDay ? (
        <section aria-labelledby="next-day-heading" className="space-y-2">
          <h3 id="next-day-heading" className="text-[0.875rem] font-bold text-[var(--text)]">
            পরের দিনের ঝলক
          </h3>
          <article className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-2" style={{ backgroundColor: NAVY }}>
              <p className="jh-nums text-[0.8125rem] font-bold text-white">
                দিন {bn(nextDay.day_number)} — {fullDate(nextDay.date)}, {weekday(nextDay.date)}
              </p>
              <button
                type="button"
                onClick={() => setActiveDate(nextDay.date)}
                className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-1 text-[0.6875rem] font-semibold text-white hover:bg-white/25"
              >
                দেখুন
                <ChevronRight className="size-3" aria-hidden />
              </button>
            </header>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2.5">
              {priorities.map((priority) => {
                const plate = plateFor(nextDay.rows, priority.key, priorities);
                if (!plate) return null;
                return (
                  <li key={priority.key} className="text-[0.75rem] text-[var(--text-muted)]">
                    <span className="jh-nums font-semibold" style={{ color: PLATE[priority.key].accent }}>
                      {priority.badge}
                    </span>
                    {" · "}
                    {plate.subject ?? "—"}
                    {plate.topics[0] ? ` — ${plate.topics[0].topic}` : ""}
                  </li>
                );
              })}
            </ul>
          </article>
        </section>
      ) : null}

      {/* ── routine history ──────────────────────────────────────────────── */}
      <section aria-labelledby="history-heading" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="history-heading" className="text-[0.875rem] font-bold text-[var(--text)]">
            রুটিন ইতিহাস
          </h3>
          <a href={printHref} target="_blank" rel="noreferrer" className="text-[0.75rem] font-semibold" style={{ color: "var(--brand)" }}>
            সম্পূর্ণ রুটিন PDF
          </a>
        </div>
        {history.length === 0 ? (
          <p className="mt-1 text-[0.75rem] text-[var(--text-muted)]">
            এই কোর্সে আগের কোনো সম্পন্ন রুটিন নেই।
          </p>
        ) : (
          <ul className="mt-1.5 divide-y divide-[var(--border)]">
            {history.slice(0, 5).map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span className="text-[0.8125rem] font-semibold text-[var(--text)]">{entry.title_bn}</span>
                <span className="jh-nums text-[0.75rem] text-[var(--text-muted)]">
                  {longDate(entry.start)} – {longDate(entry.end)} · {bn(entry.done)}/{bn(entry.total)} দিন
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * The exam instruction bar: marks only.
 *
 * Deliberately excludes study durations, the study-time breakdown, exam
 * duration, and any question-count panel — the brief is explicit that those
 * belong elsewhere. Items come from the course's configuration, so a course
 * with a different assessment structure shows its own categories, and a course
 * with no marks distribution hides the bar entirely.
 */
function ExamInstructionBar({ marks }: { marks: SheetMarks }) {
  if (marks.items.length === 0) return null;

  return (
    <section
      aria-label="আজকের পরীক্ষার নির্দেশনা — নম্বর বিভাজন"
      className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 sm:flex-row sm:items-stretch"
    >
      <h2
        className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[0.8125rem] font-bold leading-tight text-white sm:max-w-[10rem]"
        style={{ backgroundColor: NAVY }}
      >
        <Target className="size-4 shrink-0" aria-hidden />
        আজকের পরীক্ষার নির্দেশনা
      </h2>

      {/* Four items, each in its own accent colour. The value is bold and the
          label bold-ish, so the bar reads at a glance instead of as grey text —
          the approved figure's whole point. Explicit borders rather than
          divide-x, because the column count changes between 2 and 4. */}
      <dl className="grid flex-1 grid-cols-2 sm:grid-cols-4">
        {marks.items.map((item, index) => {
          const tone = PLATE[(Object.keys(PLATE) as PriorityKey[])[index % 4]];
          return (
            <div
              key={item.label}
              className="flex items-center gap-2 border-[var(--border)] px-3 py-1.5 [&:nth-child(n+3)]:border-t sm:[&:nth-child(n+3)]:border-t-0 sm:[&:not(:first-child)]:border-l"
            >
              <span
                className="h-5 w-1 shrink-0 rounded-full"
                style={{ backgroundColor: tone.rule }}
                aria-hidden
              />
              <dt className="min-w-0 text-[0.8125rem] font-semibold leading-tight" style={{ color: "var(--text)" }}>
                <span style={{ color: tone.accent }}>{item.label}</span>
                {": "}
                <span className="jh-nums font-extrabold" style={{ color: tone.accent }}>
                  {bnMarks(item.marks)}
                </span>{" "}
                নম্বর
              </dt>
              <dd className="sr-only">{bnMarks(item.marks)}</dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

/**
 * Routine status badge. Colour is the signal — green for active, grey-green once
 * finished, amber for a plan that has not started — so a student can tell the
 * routine's state at a glance without reading the dates.
 */
function StatusPill({ status, percent }: { status?: string | null; percent: number }) {
  const finished = percent >= 100;
  const active = (status ?? "active") === "active";
  const label = finished ? "সম্পন্ন" : active ? "সক্রিয় রুটিন" : "ড্রাফট";
  const palette = finished
    ? { fg: "var(--p3-ink)", bg: "var(--p3-tint)", dot: "var(--p3-rule)" }
    : active
      ? { fg: "var(--done-ink)", bg: "#e7f6ee", dot: "var(--done-ink)" }
      : { fg: "var(--p2-ink)", bg: "var(--p2-tint)", dot: "var(--p2-rule)" };

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.625rem] font-bold"
      style={{ backgroundColor: palette.bg, color: palette.fg }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: palette.dot }} aria-hidden />
      {label}
    </span>
  );
}

function Stat({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: PriorityKey;
}) {
  const palette = PLATE[tone];
  return (
    <div className="flex items-start gap-2.5 border-b border-r border-[var(--border)] px-3.5 py-3">
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: palette.tint, color: palette.rule }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[0.6875rem] font-semibold leading-tight text-[var(--text-muted)]">{label}</p>
        <p className="jh-nums mt-0.5 text-[0.9375rem] font-extrabold leading-tight text-[var(--text)]">
          {value}
        </p>
      </div>
    </div>
  );
}

function uniqueSubjects(course: SheetCourse): number {
  const subjects = new Set<string>();
  for (const day of course.days) {
    for (const row of day.rows) {
      if (row.subject_title_bn) subjects.add(row.subject_title_bn);
    }
  }
  return subjects.size;
}
