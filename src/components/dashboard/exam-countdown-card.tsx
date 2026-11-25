"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { formatDateTime, formatNumber } from "@/lib/format";

/**
 * পরবর্তী গুরুত্বপূর্ণ পরীক্ষা — live countdown (V7 mockup bottom row).
 * Pure client ticker over a real upcoming schedule; server passes the data.
 */
export function ExamCountdownCard({
  title,
  courseTitle,
  startsAt,
  href,
}: {
  title: string;
  courseTitle: string | null;
  startsAt: string;
  href: string;
}) {
  const target = React.useMemo(() => new Date(startsAt).getTime(), [startsAt]);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = Math.max(0, target - now);
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  const boxes = [
    { value: days, label: "দিন" },
    { value: hours, label: "ঘণ্টা" },
    { value: minutes, label: "মিনিট" },
    { value: seconds, label: "সেকেন্ড" },
  ];

  return (
    <section className="jh-card p-4" aria-labelledby="countdown-h">
      <h2 id="countdown-h" className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-[var(--text)]">
        <CalendarClock className="size-4 text-[var(--brand)]" aria-hidden />
        পরবর্তী গুরুত্বপূর্ণ পরীক্ষা
      </h2>
      <p className="mt-2 truncate text-[0.8125rem] font-bold text-[var(--text)]">{title}</p>
      <p className="text-[0.6875rem] text-[var(--text-subtle)]">
        {courseTitle ? `${courseTitle} · ` : ""}
        {formatDateTime(startsAt)}
      </p>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {boxes.map((box) => (
          <div
            key={box.label}
            className="rounded-xl bg-gradient-to-b from-violet-600 to-violet-700 py-2 text-center text-white shadow-sm"
          >
            <p className="text-[1.125rem] font-extrabold tabular-nums leading-tight" suppressHydrationWarning>
              {formatNumber(box.value)}
            </p>
            <p className="text-[0.5625rem] font-medium text-violet-200">{box.label}</p>
          </div>
        ))}
      </div>
      <Link
        href={href}
        className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-[var(--brand)] py-2 text-[0.75rem] font-bold text-white transition hover:opacity-90"
      >
        বিস্তারিত ও অংশগ্রহণ →
      </Link>
    </section>
  );
}
