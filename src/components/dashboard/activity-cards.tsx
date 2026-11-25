import Link from "next/link";
import {
  ArrowRight, CalendarCheck2, CalendarDays, CircleCheck, Clock3, Flame,
  Layers, Target, Trophy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatNumber, formatPercent, relativeFromNow } from "@/lib/format";
import type { Course, ResultHistoryRow, Routine, StudentAnalytics } from "@/lib/types";

/** Today's published routine items with per-item minutes and real completion ticks. */
export function TodayRoutineCard({
  routines,
  doneIds,
}: {
  routines: Routine[];
  /** routine ids the student marked done today (routine_progress). */
  doneIds?: Set<string>;
}) {
  const done = doneIds ?? new Set<string>();
  const doneCount = routines.filter((r) => done.has(r.id)).length;
  const pct = routines.length > 0 ? Math.round((doneCount / routines.length) * 100) : 0;
  return (
    <section className="jh-card" aria-labelledby="routine-h">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <h2 id="routine-h" className="flex items-center gap-2 text-[0.9375rem] font-bold text-[var(--text)]">
          <span className="flex size-7 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
            <CalendarDays className="size-4" aria-hidden />
          </span>
          আজকের পড়ার রুটিন
        </h2>
        <Link href="/routines" className="text-[0.75rem] font-bold text-[var(--brand)] hover:underline">
          পুরো রুটিন →
        </Link>
      </div>
      <div className="p-3.5">
        {routines.length === 0 ? (
          <EmptyState
            compact
            icon={<CalendarDays className="size-4" />}
            title="আজকের জন্য প্রকাশিত রুটিন নেই"
            description="প্রশাসক রুটিন প্রকাশ করলে প্রতিদিনের পরিকল্পনা এখানে দেখা যাবে।"
            action={
              <ButtonLink href="/practice" variant="secondary" size="sm">
                প্র্যাকটিস দিয়ে শুরু করুন
              </ButtonLink>
            }
          />
        ) : (
          <ul className="space-y-1.5">
            {routines.slice(0, 4).map((routine) => {
              const isDone = done.has(routine.id);
              const subject = routine.subject_title_bn ?? routine.title_bn ?? "পড়ার পরিকল্পনা";
              const topic = routine.topic_title_bn ?? routine.focus_note_bn;
              return (
                <li
                  key={routine.id}
                  className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 ${
                    isDone
                      ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/25 dark:bg-emerald-500/10"
                      : "border-[var(--border)]"
                  }`}
                >
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded-md border-2 ${
                      isDone
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-[var(--border-strong)]"
                    }`}
                    aria-hidden
                  >
                    {isDone ? <CircleCheck className="size-3.5" /> : null}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-[0.875rem]">
                    <span className={`font-bold ${isDone ? "text-emerald-800 dark:text-emerald-300" : "text-[var(--text)]"}`}>
                      {subject}
                    </span>
                    {topic ? (
                      <span className="text-[0.8125rem] text-[var(--text-muted)]"> · {topic}</span>
                    ) : null}
                  </p>
                  <span className="inline-flex shrink-0 items-center gap-1 text-[0.75rem] font-semibold text-[var(--text-subtle)]">
                    <Clock3 className="size-3.5" aria-hidden />
                    {formatNumber(routine.minutes)} মি.
                  </span>
                  {isDone ? (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[0.6875rem] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      সম্পন্ন
                    </span>
                  ) : (
                    <Link
                      href="/practice"
                      className="shrink-0 rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[0.6875rem] font-bold text-[var(--brand)] hover:underline"
                    >
                      পড়ুন
                    </Link>
                  )}
                </li>
              );
            })}
            {routines.length > 4 ? (
              <li>
                <Link
                  href="/routines"
                  className="block rounded-lg border border-dashed border-[var(--border)] px-2.5 py-1.5 text-center text-[0.75rem] font-bold text-[var(--brand)] hover:bg-[var(--brand-soft)]"
                >
                  +{formatNumber(routines.length - 4)}টি আরও কাজ দেখুন →
                </Link>
              </li>
            ) : null}
          </ul>
        )}
        {routines.length > 0 ? (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[0.75rem] font-bold text-[var(--text-muted)]">
              <span>আজকের অগ্রগতি: {formatNumber(doneCount)}/{formatNumber(routines.length)} সম্পন্ন</span>
              <span className="tabular-nums">{formatNumber(pct)}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Last-7-days bar chart (Dhaka days, matching jh_student_analytics). */
export function WeeklyProgressCard({
  weekly,
  hasData,
}: {
  weekly: StudentAnalytics["weekly"];
  hasData: boolean;
}) {
  const maxWeekly = Math.max(1, ...weekly.map((w) => w.score));
  return (
    <section className="jh-card" aria-labelledby="weekly-h">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3.5">
        <h2 id="weekly-h" className="flex items-center gap-2 text-[0.875rem] font-semibold text-[var(--text)]">
          <Flame className="size-4 text-[var(--brand)]" aria-hidden />
          সাপ্তাহিক অগ্রগতি
        </h2>
        <span className="text-[0.6875rem] text-[var(--text-subtle)]">শেষ ৭ দিন</span>
      </div>
      <div className="p-4">
        <div className="flex h-28 items-end gap-1.5" aria-hidden>
          {weekly.map((day) => {
            const height = Math.max(4, (day.score / maxWeekly) * 100);
            return (
              <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className={`w-full rounded-t-md ${day.attempts > 0 ? "bg-[var(--brand)]" : "bg-[var(--surface-sunken)]"}`}
                    style={{ height: `${day.attempts > 0 ? height : 6}%` }}
                    title={`${day.date}: ${day.attempts} attempts`}
                  />
                </div>
                <span className="text-[0.5625rem] text-[var(--text-subtle)]">
                  {formatDate(`${day.date}T12:00:00`, "bn", { weekday: "narrow" })}
                </span>
              </div>
            );
          })}
        </div>
        {!hasData ? (
          <p className="mt-2 text-center text-[0.6875rem] text-[var(--text-subtle)]">
            পরীক্ষা দিলে এই চার্টে আপনার দৈনিক গড় স্কোর দেখা যাবে।
          </p>
        ) : null}
      </div>
    </section>
  );
}

/** Latest released results with score and accuracy per row. */
export function RecentResultsCard({
  results,
  courseById,
}: {
  results: ResultHistoryRow[];
  courseById: Map<string, Course>;
}) {
  return (
    <section className="jh-card" aria-labelledby="recent-h">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3.5">
        <h2 id="recent-h" className="flex items-center gap-2 text-[0.875rem] font-semibold text-[var(--text)]">
          <Trophy className="size-4 text-[var(--brand)]" aria-hidden />
          সাম্প্রতিক ফলাফল
        </h2>
        <Link href="/analytics" className="text-[0.6875rem] font-semibold text-[var(--brand)] hover:underline">
          বিশ্লেষণ
        </Link>
      </div>
      {results.length === 0 ? (
        <div className="p-4">
          <EmptyState
            compact
            icon={<Trophy className="size-4" />}
            title="এখনো কোনো প্রকাশিত ফলাফল নেই"
            description="পরীক্ষা দিয়ে জমা দিলে ফলাফল প্রকাশের পর এখানে দেখা যাবে।"
          />
        </div>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {results.map((result) => {
            const course = courseById.get(result.course_id);
            return (
              <li key={result.result_id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] font-semibold text-[var(--text)]">
                    {result.title_bn ?? course?.title_bn ?? "পরীক্ষার ফলাফল"}
                  </p>
                  <p className="text-[0.6875rem] text-[var(--text-subtle)]">
                    {result.submitted_at ? relativeFromNow(result.submitted_at) : "—"} ·{" "}
                    {formatNumber(result.correct)} সঠিক · {formatNumber(result.wrong)} ভুল
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[0.875rem] font-bold tabular-nums text-[var(--text)]">
                    {formatNumber(result.score)}
                    <span className="text-[0.6875rem] font-medium text-[var(--text-subtle)]">
                      /{formatNumber(result.total_marks)}
                    </span>
                  </p>
                  <p className="text-[0.625rem] text-mint-600 dark:text-mint-500">
                    {formatPercent(result.accuracy)} নির্ভুলতা
                  </p>
                </div>
                <Link
                  href={`/results/${result.attempt_id}`}
                  className="shrink-0 rounded-lg p-1.5 text-[var(--text-subtle)] hover:text-[var(--brand)]"
                  aria-label="View result"
                >
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Bottom strip: routine count, released results, best score. */
export function LearningActivityCard({
  todayRoutineCount,
  summary,
}: {
  todayRoutineCount: number;
  summary: StudentAnalytics["summary"] | undefined;
}) {
  const items = [
    {
      icon: <CalendarCheck2 className="size-4" />,
      label: "আজকের রুটিন",
      value: `${formatNumber(todayRoutineCount)} আইটেম`,
    },
    {
      icon: <CircleCheck className="size-4" />,
      label: "প্রকাশিত ফলাফল",
      value: `${formatNumber(summary?.released ?? 0)} পরীক্ষা`,
    },
    {
      icon: <Target className="size-4" />,
      label: "সর্বোচ্চ স্কোর",
      value: formatNumber(summary?.best_score ?? 0),
    },
  ];
  return (
    <section className="jh-card mt-5" aria-labelledby="activity-h">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3.5">
        <h2 id="activity-h" className="flex items-center gap-2 text-[0.875rem] font-semibold text-[var(--text)]">
          <Layers className="size-4 text-[var(--brand)]" aria-hidden />
          শেখার কার্যকলাপ
        </h2>
        <Badge tone="neutral">বাস্তব ডেটা</Badge>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2.5 rounded-xl bg-[var(--surface-muted)] px-3 py-2.5">
            <span className="text-[var(--brand)]">{item.icon}</span>
            <div>
              <p className="text-[0.625rem] text-[var(--text-subtle)]">{item.label}</p>
              <p className="text-[0.8125rem] font-semibold text-[var(--text)]">{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
