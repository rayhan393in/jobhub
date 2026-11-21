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
  const tones = {
    brand: "bg-[var(--brand-soft)] text-[var(--brand)]",
    accent:
      "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-200",
    success: "bg-mint-50 text-mint-700 dark:bg-mint-600/15 dark:text-mint-500",
    warning: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    neutral: "bg-[var(--surface-sunken)] text-[var(--text-muted)]",
  } as const;

  return (
    <div className={cn("jh-card p-4 sm:p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.75rem] font-medium text-[var(--text-muted)]">{label}</p>
        {icon ? (
          <span className={cn("flex size-8 items-center justify-center rounded-lg", tones[tone])} aria-hidden>
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
