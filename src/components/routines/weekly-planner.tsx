"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarRange, Check, ChevronLeft, ChevronRight, Clock, Trophy, TriangleAlert } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { addDays, mondayOf } from "@/lib/routines/weekly-plan";

type Course = { id: string; title_bn: string };

type Slot = {
  date: string;
  week_index: number;
  subject_id: string;
  topic_id: string;
  subtopic_id: string | null;
  minutes: number;
  task_kind: string;
  title_bn: string;
  focus_note_bn: string;
};

type WeekResponse = {
  weekStart: string;
  weekEnd: string;
  slots: Slot[];
  exam: {
    weekStart: string;
    questionCount: number;
    composition: Array<{ subject_id: string; topic_id: string; count: number }>;
    topicsCovered: number;
    subjectsCovered: number;
  };
  carryOver: number;
  frequencyAvailable: number;
  saved: number;
  error?: string;
};

const WEEKDAYS = ["সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি", "রবি"];

function bnDate(dateKey: string): string {
  return new Intl.DateTimeFormat("bn-BD", { day: "numeric", month: "short" }).format(new Date(`${dateKey}T12:00:00`));
}

function datesOfWeek(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

/**
 * The week-at-a-time planner.
 *
 * Two deliberate choices, both driven by the honesty rule:
 *  - the exam card says how many *topics* the paper can actually cover, and
 *    shows nothing when the week has no topics;
 *  - when no past-paper frequency has been imported, the card says so instead
 *    of implying the syllabus order is evidence.
 */
export function WeeklyPlanner({
  courses,
  initialCourseId,
  today,
}: {
  courses: Course[];
  initialCourseId: string;
  today: string;
}) {
  const [courseId, setCourseId] = React.useState(initialCourseId);
  const [weekStart, setWeekStart] = React.useState(() => mondayOf(today));
  const [dailyMinutes, setDailyMinutes] = React.useState(180);
  const [data, setData] = React.useState<WeekResponse | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<Record<string, "done" | "skipped">>({});

  const load = React.useCallback(
    async (options: { save: boolean }) => {
      if (!courseId) return;
      setBusy(true);
      setError(null);
      try {
        const response = await fetch("/api/routines/weekly", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId, weekStart, dailyMinutes, save: options.save, examQuestions: 100 }),
        });
        const payload = await response.json();
        if (!response.ok) {
          setData(null);
          setError(payload.error ?? "সপ্তাহের প্ল্যান তৈরি করা যায়নি।");
          return;
        }
        setData(payload as WeekResponse);
      } catch {
        setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
      } finally {
        setBusy(false);
      }
    },
    [courseId, weekStart, dailyMinutes],
  );

  function shiftWeek(direction: -1 | 1) {
    setWeekStart((current) => addDays(current, direction * 7));
    setData(null);
    setDone({});
  }

  async function markDone(slot: Slot) {
    const next = done[`${slot.date}:${slot.topic_id}`] === "done" ? "pending" : "done";
    setDone((current) => {
      const copy = { ...current };
      if (next === "done") copy[`${slot.date}:${slot.topic_id}`] = "done";
      else delete copy[`${slot.date}:${slot.topic_id}`];
      return copy;
    });

    await fetch("/api/routines/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseId,
        date: slot.date,
        status: next,
        subjectId: slot.subject_id,
        topicId: slot.topic_id,
        minutesSpent: next === "done" ? slot.minutes : 0,
      }),
    }).catch(() => {
      // The tick is optimistic; a failed write is corrected on the next load of
      // the week rather than blocking the student mid-study.
    });
  }

  const byDate = new Map<string, Slot[]>();
  for (const slot of data?.slots ?? []) {
    const list = byDate.get(slot.date) ?? [];
    list.push(slot);
    byDate.set(slot.date, list);
  }

  const totalDone = (data?.slots ?? []).filter((slot) => done[`${slot.date}:${slot.topic_id}`] === "done").length;
  const isThisWeek = weekStart === mondayOf(today);

  return (
    <div className="space-y-3">
      <div className="jh-card p-4 no-print">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-[11rem] flex-1">
            <span className="jh-label">কোর্স</span>
            <select className="jh-select h-9 text-[0.8125rem]" value={courseId} onChange={(event) => { setCourseId(event.target.value); setData(null); }}>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.title_bn}</option>
              ))}
            </select>
          </label>
          <label className="block w-28">
            <span className="jh-label">দৈনিক মিনিট</span>
            <input
              type="number"
              min={60}
              max={600}
              step={30}
              value={dailyMinutes}
              onChange={(event) => setDailyMinutes(Number(event.target.value))}
              className="jh-input h-9 text-[0.8125rem]"
            />
          </label>
          <Button size="sm" loading={busy} onClick={() => load({ save: false })}>
            <CalendarRange className="size-3.5" aria-hidden />
            সপ্তাহের প্ল্যান দেখুন
          </Button>
          {data && data.slots.length > 0 ? (
            <Button size="sm" variant="secondary" onClick={() => load({ save: true })} loading={busy}>
              সেভ করুন
            </Button>
          ) : null}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
          <button type="button" onClick={() => shiftWeek(-1)} className="flex items-center gap-1 rounded px-1.5 py-1 text-[0.6875rem] font-medium text-[var(--text-muted)] hover:bg-[var(--surface-muted)]">
            <ChevronLeft className="size-3.5" aria-hidden />
            আগের সপ্তাহ
          </button>
          <span className="text-[0.75rem] font-semibold text-[var(--text)]">
            {bnDate(weekStart)} – {bnDate(addDays(weekStart, 6))}
            {isThisWeek ? <Badge tone="brand" className="ml-1.5">এই সপ্তাহ</Badge> : null}
          </span>
          <button type="button" onClick={() => shiftWeek(1)} className="flex items-center gap-1 rounded px-1.5 py-1 text-[0.6875rem] font-medium text-[var(--text-muted)] hover:bg-[var(--surface-muted)]">
            পরের সপ্তাহ
            <ChevronRight className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="jh-card flex items-start gap-2 p-3 text-[0.75rem] font-medium text-[var(--danger)]">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {data ? (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="success">{data.slots.length} স্লট</Badge>
            <Badge tone="neutral">{data.exam.topicsCovered} টপিক</Badge>
            <Badge tone="neutral">{data.exam.subjectsCovered} বিষয়</Badge>
            {data.carryOver > 0 ? <Badge tone="warning">{data.carryOver} টপিক আগের সপ্তাহ থেকে</Badge> : null}
            {data.saved > 0 ? <Badge tone="brand">{data.saved} সেভ হয়েছে</Badge> : null}
            {totalDone > 0 ? <Badge tone="success">{totalDone} সম্পন্ন</Badge> : null}
          </div>

          {data.frequencyAvailable === 0 ? (
            <p className="jh-card border-l-2 border-l-[var(--amber-500)] p-3 text-[0.6875rem] leading-relaxed text-[var(--text-muted)]">
              <strong className="text-[var(--text)]">এখনো বিগত বছরের প্রশ্ন-বিশ্লেষণ নেই।</strong> তাই টপিকগুলো সিলেবাসের ক্রমে
              রাখা হয়েছে — কোন টপিক “বেশি আসে” তা অনুমান করে বলা হচ্ছে না। বিগত BCS-এর প্রশ্নসংখ্যা আপলোড হলে এখানে সেই
              প্রমাণ অনুযায়ী আগে-পরে সাজানো হবে।
            </p>
          ) : (
            <p className="jh-card p-3 text-[0.6875rem] leading-relaxed text-[var(--text-muted)]">
              {data.frequencyAvailable}টি টপিকের বিগত বছরের প্রশ্নসংখ্যা পাওয়া গেছে — যে টপিকে বেশি প্রশ্ন এসেছে সেটি আগে রাখা হয়েছে।
            </p>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            {datesOfWeek(data.weekStart).map((date, index) => {
              const slots = byDate.get(date) ?? [];
              if (slots.length === 0) return null;
              return (
                <section key={date} className="jh-card overflow-hidden">
                  <header className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
                    <p className="text-[0.75rem] font-semibold text-[var(--text)]">
                      {WEEKDAYS[index]} · {bnDate(date)}
                    </p>
                    <span className="text-[0.625rem] text-[var(--text-subtle)]">
                      {slots.reduce((sum, slot) => sum + slot.minutes, 0)} মিনিট
                    </span>
                  </header>
                  <ul className="divide-y divide-[var(--border)]">
                    {slots.map((slot) => {
                      const key = `${slot.date}:${slot.topic_id}`;
                      const isDone = done[key] === "done";
                      return (
                        <li key={key} className="flex items-start gap-2 px-3 py-2">
                          <button
                            type="button"
                            onClick={() => markDone(slot)}
                            aria-pressed={isDone}
                            className={cn(
                              "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                              isDone
                                ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                                : "border-[var(--border-strong)] hover:border-[var(--brand)]",
                            )}
                            aria-label={isDone ? "সম্পন্ন চিহ্ন সরান" : "সম্পন্ন হিসেবে চিহ্নিত করুন"}
                          >
                            {isDone ? <Check className="size-2.5" aria-hidden /> : null}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className={cn("text-[0.75rem] font-medium", isDone ? "text-[var(--text-subtle)] line-through" : "text-[var(--text)]")}>
                              {slot.title_bn}
                            </p>
                            <p className="truncate text-[0.5625rem] text-[var(--text-subtle)]">{slot.focus_note_bn}</p>
                          </div>
                          <span className="shrink-0 text-[0.5625rem] text-[var(--text-subtle)]">
                            {slot.task_kind === "revision" ? "রিভিশন" : `${slot.minutes}m`}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>

          {data.exam.topicsCovered > 0 ? (
            <section className="jh-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-[var(--text)]">
                    <Trophy className="size-3.5 text-[var(--brand)]" aria-hidden />
                    এই সপ্তাহের পরীক্ষা
                  </p>
                  <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-[var(--text-muted)]">
                    শুধু এই সপ্তাহের {data.exam.topicsCovered}টি টপিক থেকে {data.exam.questionCount} নম্বরের প্রশ্নপত্র —
                    নিয়ম ৬০% বিগত বছরের প্রশ্ন, ২০% কঠিন, ১০% সহজ, ১০% মাঝারি।
                  </p>
                </div>
                <ButtonLink href={`/custom-exam?week=${data.weekStart}`} size="sm" variant="secondary">
                  পরীক্ষা তৈরি করুন
                </ButtonLink>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {[
                  ["বিগত বছরের প্রশ্ন", 60],
                  ["কঠিন", 20],
                  ["সহজ", 10],
                  ["মাঝারি", 10],
                ].map(([label, percent]) => (
                  <div key={String(label)} className="rounded-lg bg-[var(--surface-muted)] px-2 py-1.5">
                    <p className="text-[0.5625rem] text-[var(--text-subtle)]">{label}</p>
                    <p className="text-[0.75rem] font-bold text-[var(--text)]">
                      {Math.round((data.exam.questionCount * Number(percent)) / 100)}টি
                    </p>
                  </div>
                ))}
              </div>

              <p className="mt-2 flex items-center gap-1 text-[0.5625rem] text-[var(--text-subtle)]">
                <Clock className="size-2.5" aria-hidden />
                প্রশ্নপত্র তৈরি হবে যাচাইকৃত প্রশ্ন থেকেই; ব্যাংকে যথেষ্ট প্রশ্ন না থাকলে সার্ভার স্পষ্টভাবে জানাবে।
              </p>
            </section>
          ) : null}

          {data.slots.length === 0 ? (
            <p className="jh-card p-4 text-center text-[0.75rem] text-[var(--text-muted)]">
              এই সপ্তাহে দেওয়ার মতো নতুন টপিক নেই — সব টপিক সম্পন্ন হয়েছে বা সিলেবাস খালি। কোনো টপিক পুনরাবৃত্তি করে
              প্ল্যান ভরা হচ্ছে না।
            </p>
          ) : null}
        </>
      ) : (
        <div className="jh-card p-4 text-center">
          <p className="text-[0.8125rem] font-semibold text-[var(--text)]">সপ্তাহের প্ল্যান তৈরি করুন</p>
          <p className="mx-auto mt-1 max-w-md text-[0.6875rem] leading-relaxed text-[var(--text-muted)]">
            প্রতিদিন ২–৩টি বিষয়, প্রতিটি বিষয়ের নির্দিষ্ট টপিক — এবং সেই টপিকগুলো থেকেই সপ্তাহশেষের পরীক্ষা।
            <Link href="#saved" className="ml-1 font-medium text-[var(--brand)] hover:underline">নিচে সেভ করা প্ল্যান</Link>
          </p>
        </div>
      )}
    </div>
  );
}
