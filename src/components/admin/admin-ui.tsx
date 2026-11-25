import type * as React from "react";
import { ArrowRight, Info } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  action,
  back,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-5">
      {back ? (
        <Link
          href={back.href}
          className="mb-1.5 inline-flex items-center gap-1 text-[0.6875rem] font-medium text-[var(--text-subtle)] hover:text-[var(--brand)]"
        >
          ← {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {eyebrow ? (
            <p className="text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-0.5 text-balance text-[1.25rem] font-bold leading-tight tracking-[-0.03em] text-[var(--text)] sm:text-[1.5rem]">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-pretty text-[0.75rem] leading-relaxed text-[var(--text-muted)]">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

const MINI_STAT_TONES = {
  violet: {
    card: "border-violet-200/70 bg-gradient-to-br from-violet-50 to-violet-100/60 dark:border-violet-500/25 dark:from-violet-500/15 dark:to-violet-500/5",
    icon: "bg-violet-600",
    label: "text-violet-700/80 dark:text-violet-300/80",
  },
  emerald: {
    card: "border-emerald-200/70 bg-gradient-to-br from-emerald-50 to-emerald-100/60 dark:border-emerald-500/25 dark:from-emerald-500/15 dark:to-emerald-500/5",
    icon: "bg-emerald-600",
    label: "text-emerald-700/80 dark:text-emerald-300/80",
  },
  orange: {
    card: "border-orange-200/70 bg-gradient-to-br from-orange-50 to-orange-100/60 dark:border-orange-500/25 dark:from-orange-500/15 dark:to-orange-500/5",
    icon: "bg-orange-500",
    label: "text-orange-700/80 dark:text-orange-300/80",
  },
  sky: {
    card: "border-sky-200/70 bg-gradient-to-br from-sky-50 to-sky-100/60 dark:border-sky-500/25 dark:from-sky-500/15 dark:to-sky-500/5",
    icon: "bg-sky-600",
    label: "text-sky-700/80 dark:text-sky-300/80",
  },
} as const;

export type MiniStatTone = keyof typeof MINI_STAT_TONES;

export function MiniStat({
  icon,
  label,
  value,
  hint,
  tone = "violet",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: MiniStatTone;
}) {
  const t = MINI_STAT_TONES[tone];
  return (
    <div className={cn("rounded-2xl border p-4", t.card)}>
      <div className="flex items-center gap-2">
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl text-white", t.icon)}>
          {icon}
        </span>
        <span className={cn("text-[0.625rem] font-semibold uppercase tracking-[0.08em]", t.label)}>
          {label}
        </span>
      </div>
      <p className="mt-2 text-[1.375rem] font-extrabold tabular-nums tracking-[-0.02em] text-[var(--text)]">
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[0.625rem] text-[var(--text-subtle)]">{hint}</p> : null}
    </div>
  );
}

export function AdminNote({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "warning" | "brand";
}) {
  const style = {
    neutral: "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)]",
    warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
    brand: "border-[var(--brand)]/25 bg-[var(--brand-soft)] text-[var(--text-muted)]",
  }[tone];
  return (
    <p className={cn("flex items-start gap-1.5 rounded-xl border px-3 py-2 text-[0.6875rem] leading-relaxed", style)}>
      <Info className="mt-0.5 size-3 shrink-0 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export function AdminLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-[var(--brand)] hover:underline">
      {children}
      <ArrowRight className="size-3" aria-hidden />
    </Link>
  );
}
