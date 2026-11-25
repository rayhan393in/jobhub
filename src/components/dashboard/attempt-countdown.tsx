"use client";

import { useEffect, useState } from "react";
import { formatNumber } from "@/lib/format";

/**
 * Live "time remaining" readout for an in-progress exam attempt.
 *
 * The dashboard is server-rendered, so a static "X মিনিট বাকি" goes stale the
 * moment the tab sits open — a student can walk in believing they have ten
 * minutes when the attempt has already expired. This ticks every second once
 * under two minutes (every 15s otherwise) so the number on screen is honest.
 */
export function AttemptCountdown({ deadline }: { deadline: string }) {
  const deadlineMs = new Date(deadline).getTime();
  const [remainingSec, setRemainingSec] = useState(() =>
    Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000)),
  );

  useEffect(() => {
    const tick = () => setRemainingSec(Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000)));
    // Coarse ticks are enough far out; switch to per-second near the end.
    const interval = window.setInterval(tick, remainingSec > 120 ? 15_000 : 1_000);
    return () => window.clearInterval(interval);
  }, [deadlineMs, remainingSec]);

  if (remainingSec <= 0) {
    return <span className="font-semibold text-red-600 dark:text-red-400">সময় শেষ — জমা দিন</span>;
  }

  const label =
    remainingSec >= 120
      ? `${formatNumber(Math.ceil(remainingSec / 60))} মিনিট বাকি`
      : `${formatNumber(Math.floor(remainingSec / 60))}:${formatNumber(remainingSec % 60).padStart(2, "০")} মিনিট বাকি`;

  return (
    <span className="font-semibold text-[var(--text)] tabular-nums" suppressHydrationWarning>
      {label}
    </span>
  );
}
