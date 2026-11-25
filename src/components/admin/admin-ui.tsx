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
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--brand)]">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-0.5 text-balance text-[1.5rem] font-bold leading-tight tracking-[-0.03em] text-[var(--text)] sm:text-[1.875rem]">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 max-w-3xl text-pretty text-sm leading-relaxed text-[var(--text-muted)]">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

export function MiniStat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="jh-card p-4">
      <div className="flex items-center gap-1.5 text-[var(--brand)]">
        {icon}
        <span className="text-xs font-medium uppercase tracking-[0.06em] text-[var(--text-subtle)]">
          {label}
        </span>
      </div>
      <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-[-0.02em] text-[var(--text)]">
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-[var(--text-subtle)]">{hint}</p> : null}
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
    <p className={cn("flex items-start gap-1.5 rounded-xl border px-4 py-3 text-sm leading-relaxed", style)}>
      <Info className="mt-0.5 size-3 shrink-0 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export function AdminLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--brand)] hover:underline">
      {children}
      <ArrowRight className="size-3" aria-hidden />
    </Link>
  );
}
