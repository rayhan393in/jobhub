import * as React from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "brand" | "accent" | "success" | "warning" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-[var(--surface-muted)] text-[var(--text-muted)] border-[var(--border)]",
  brand: "bg-[var(--brand-soft)] text-[var(--brand)] border-transparent",
  accent: "bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-900/30 dark:text-violet-200 dark:border-violet-800/50",
  success:
    "bg-mint-50 text-mint-700 border-mint-100 dark:bg-mint-600/15 dark:text-mint-500 dark:border-mint-600/30",
  warning: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25",
  danger: "bg-red-50 text-red-700 border-red-100 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/25",
  info: "bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/25",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  dot,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[0.1875rem] text-[0.6875rem] font-semibold tracking-[0.01em]",
        tones[tone],
        className,
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}

export function LiveDot({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-red-600 dark:text-red-400">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-70" />
        <span className="relative inline-flex size-2 rounded-full bg-red-600" />
      </span>
      {label}
    </span>
  );
}
