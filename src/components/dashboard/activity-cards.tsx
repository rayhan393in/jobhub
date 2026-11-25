import Link from "next/link";
import {
  ArrowRight, BookOpenCheck, CalendarCheck2, CalendarDays, CircleCheck, Clock3, Flame,
  Layers, Target, Trophy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatNumber, formatPercent, relativeFromNow } from "@/lib/format";
import type { Course, ResultHistoryRow, Routine, StudentAnalytics } from "@/lib/types";

/** Today's published routine items with per-item minutes. */
export function TodayRoutineCard({ routines }: { routines: Routine[] }) {
  return (
    <section className="jh-card" aria-labelledby="routine-h">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3.5">
        <h2 id="routine-h" className="flex items-center gap-2 text-[0.875rem] font-semibold text-[var(--text)]">
          <CalendarDays className="size-4 text-[var(--brand)]" aria-hidden />
          আজকের পড়ার রুটিন
        </h2>
        <Link href="/routines" className="text-[0.6875rem] font-semibold text-[var(--brand)] hover:underline">
          পুরো রুটিন
        </Link>
      </div>
      <div className="p-4">
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
          <ul className="space-y-2">
            {routines.map((routine) => (
              <li
                key={routine.id}
                className="flex items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
                  <BookOpenCheck className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] font-semibold text-[var(--text)]">
                    {routine.subject_title_bn ?? routine.title_bn ?? "পড়ার পরিকল্পনা"}
                  </p>
                  <p className="truncate text-[0.6875rem] text-[var(--text-subtle)]">
                    {routine.topic_title_bn ?? routine.focus_note_bn ?? "—"}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 text-[0.6875rem] font-medium text-[var(--text-subtle)]">
                  <Clock3 className="size-3" aria-hidden />
                  {formatNumber(routine.minutes)} মিনিট
                </span>
              </li>
            ))}
          </ul>
        )}
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
