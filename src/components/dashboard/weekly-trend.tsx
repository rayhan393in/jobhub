"use client";

import * as React from "react";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/cn";
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
    <section className="jh-card flex h-full flex-col p-4" aria-labelledby="trend-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="trend-h" className="flex items-center gap-2 text-[0.9375rem] font-bold text-[var(--text)]">
          <span className="flex size-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
            <TrendingUp className="size-4" aria-hidden />
          </span>
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
                "rounded-md px-3 py-1 text-[0.6875rem] font-bold transition",
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

      {!hasData ? (
        <div className="mt-3 flex min-h-40 flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] text-center">
          <TrendingUp className="size-5 text-[var(--text-subtle)]" aria-hidden />
          <p className="max-w-[16rem] text-[0.8125rem] leading-relaxed text-[var(--text-subtle)]">
            এখনো কোনো পরীক্ষার ডেটা নেই — প্রথম প্র্যাকটিস দিলেই এখানে দৈনিক ট্রেন্ড আঁকা হবে।
          </p>
          <Link href="/custom-exam" className="text-[0.6875rem] font-bold text-[var(--brand)] hover:underline">
            প্র্যাকটিস শুরু করুন →
          </Link>
        </div>
      ) : (
      <div className="mt-3 flex flex-1 flex-col justify-center">
        <svg viewBox="0 0 280 110" className="max-h-48 w-full" role="img" aria-label="সাপ্তাহিক ট্রেন্ড চার্ট">
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {/* soft horizontal gridlines — the chart sits on a quiet ruled background */}
          {[24, 48, 72, 96].map((y) => (
            <line key={y} x1="0" y1={y} x2="280" y2={y} stroke="#8b5cf6" strokeOpacity="0.12" strokeWidth="1" />
          ))}
          {(() => {
            const n = weekly.length;
            if (n === 0) return null;
            const stepX = 280 / Math.max(1, n - 1);
            const pts = values.map((v, i) => ({
              x: n === 1 ? 140 : i * stepX,
              y: 96 - (v / max) * 72,
            }));
            const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
            const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},104 L${pts[0].x.toFixed(1)},104 Z`;
            return (
              <>
                <path d={area} fill="url(#trendFill)" />
                <path d={line} fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {pts.map((p, i) => (
                  <g key={weekly[i].date}>
                    <circle cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke="#7c3aed" strokeWidth="2">
                      <title>
                        {`${weekly[i].date}: ${metric === "score" ? `গড় স্কোর ${Math.round(weekly[i].score)}` : `${weekly[i].attempts}টি পরীক্ষা`}`}
                      </title>
                    </circle>
                    {values[i] > 0 ? (
                      <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#7c3aed">
                        {Math.round(values[i])}
                      </text>
                    ) : null}
                  </g>
                ))}
              </>
            );
          })()}
        </svg>
        <div className="flex justify-between px-1">
          {weekly.map((day) => (
            <span key={day.date} className="text-[0.75rem] font-semibold text-[var(--text-subtle)]">
              {weekdayBn(day.date)}
            </span>
          ))}
        </div>
      </div>
      )}
    </section>
  );
}
