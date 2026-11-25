"use client";

import * as React from "react";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import type { StudentAnalytics } from "@/lib/types";

type Metric = "score" | "attempts";

const WEEKDAYS_BN = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহ", "শুক্র", "শনি"];

function weekdayBn(dateKey: string): string {
  return WEEKDAYS_BN[new Date(`${dateKey}T12:00:00+06:00`).getDay()] ?? dateKey.slice(8);
}

/**
 * সাপ্তাহিক পারফরম্যান্স ট্রেন্ড — switchable views (V7 mockup):
 * নম্বর (daily average score) or প্রশ্ন সংখ্যা (attempt count), from the
 * last-7-Dhaka-days series of jh_student_analytics. Client-side toggle only;
 * the data itself arrives server-rendered.
 */
export function WeeklyTrendCard({
  weekly,
  hasData,
}: {
  weekly: StudentAnalytics["weekly"];
  hasData: boolean;
}) {
  const [metric, setMetric] = React.useState<Metric>("score");
  const values = weekly.map((d) => (metric === "score" ? d.score : d.attempts));
  const max = Math.max(1, ...values);

  return (
    <section className="jh-card p-4" aria-labelledby="trend-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="trend-h" className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-[var(--text)]">
          <TrendingUp className="size-4 text-[var(--brand)]" aria-hidden />
          সাপ্তাহিক পারফরম্যান্স ট্রেন্ড
        </h2>
        <div className="flex rounded-lg border border-[var(--border)] p-0.5" role="tablist" aria-label="মেট্রিক নির্বাচন">
          {([
            { id: "score", label: "নম্বর" },
            { id: "attempts", label: "প্রশ্ন সংখ্যা" },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={metric === tab.id}
              onClick={() => setMetric(tab.id)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[0.625rem] font-bold transition",
                metric === tab.id
                  ? "bg-[var(--brand)] text-white"
                  : "text-[var(--text-subtle)] hover:text-[var(--text)]",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex h-32 items-end gap-1.5">
        {weekly.map((day, i) => {
          const value = values[i];
          const height = Math.max(4, (value / max) * 100);
          return (
            <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
              {value > 0 ? (
                <span className="text-[0.5625rem] font-bold tabular-nums text-[var(--brand)]">
                  {formatNumber(Math.round(value))}
                </span>
              ) : null}
              <div className="flex w-full flex-1 items-end">
                <div
                  className={cn(
                    "w-full rounded-t-md transition-all",
                    day.attempts > 0
                      ? "bg-gradient-to-t from-violet-600 to-fuchsia-500"
                      : "bg-[var(--surface-sunken)]",
                  )}
                  style={{ height: `${day.attempts > 0 ? height : 6}%` }}
                  title={`${day.date}: ${metric === "score" ? `গড় স্কোর ${Math.round(day.score)}` : `${day.attempts}টি পরীক্ষা`}`}
                />
              </div>
              <span className="text-[0.5625rem] text-[var(--text-subtle)]">{weekdayBn(day.date)}</span>
            </div>
          );
        })}
      </div>
      {!hasData ? (
        <p className="mt-2 text-center text-[0.6875rem] text-[var(--text-subtle)]">
          পরীক্ষা দিলে এই চার্টে দৈনিক পারফরম্যান্স দেখা যাবে।
        </p>
      ) : null}
    </section>
  );
}
