import * as React from "react";
import { cn } from "@/lib/cn";

export function StatCard({
  label,
  value,
  suffix,
  hint,
  icon,
  tone = "brand",
  className,
}: {
  label: string;
  value: React.ReactNode;
  suffix?: string;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "brand" | "accent" | "success" | "warning" | "neutral";
  className?: string;
}) {
  // Gradient tone cards, matching the admin design system (violet mockup).
  const tones = {
    brand: {
      card: "border-violet-200/70 bg-gradient-to-br from-violet-50 to-violet-100/60 dark:border-violet-500/25 dark:from-violet-500/15 dark:to-violet-500/5",
      icon: "bg-violet-600 text-white",
    },
    success: {
      card: "border-emerald-200/70 bg-gradient-to-br from-emerald-50 to-emerald-100/60 dark:border-emerald-500/25 dark:from-emerald-500/15 dark:to-emerald-500/5",
      icon: "bg-emerald-600 text-white",
    },
    accent: {
      card: "border-orange-200/70 bg-gradient-to-br from-orange-50 to-orange-100/60 dark:border-orange-500/25 dark:from-orange-500/15 dark:to-orange-500/5",
      icon: "bg-orange-500 text-white",
    },
    warning: {
      card: "border-amber-200/70 bg-gradient-to-br from-amber-50 to-amber-100/60 dark:border-amber-500/25 dark:from-amber-500/15 dark:to-amber-500/5",
      icon: "bg-amber-500 text-white",
    },
    neutral: {
      card: "border-sky-200/70 bg-gradient-to-br from-sky-50 to-sky-100/60 dark:border-sky-500/25 dark:from-sky-500/15 dark:to-sky-500/5",
      icon: "bg-sky-600 text-white",
    },
  } as const;

  return (
    <div className={cn("rounded-2xl border p-4 sm:p-5", tones[tone].card, className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.75rem] font-semibold text-[var(--text-muted)]">{label}</p>
        {icon ? (
          <span className={cn("flex size-8 items-center justify-center rounded-xl", tones[tone].icon)} aria-hidden>
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-2.5 flex items-baseline gap-1 text-[1.5rem] font-bold leading-none tracking-[-0.03em] text-[var(--text)]">
        {value}
        {suffix ? <span className="text-[0.8125rem] font-semibold text-[var(--text-subtle)]">{suffix}</span> : null}
      </p>
      {hint ? <p className="mt-2 text-[0.6875rem] leading-relaxed text-[var(--text-subtle)]">{hint}</p> : null}
    </div>
  );
}
