import { CircleCheck, Flame, Gauge, Layers, Target, TrendingUp } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import type { StudentAnalytics } from "@/lib/types";

/**
 * V7 performance summary — six compact cards per the mockup:
 * exams, average score, accuracy, questions attempted, study streak and an
 * estimated readiness. Every number derives from real records; readiness is
 * a labeled estimate combining accuracy, consistency and practice volume.
 */
export function StatsGrid({
  summary,
  streak,
  activeDays,
  readiness,
}: {
  summary: StudentAnalytics["summary"] | undefined;
  /** Consecutive active study days (from exam_attempts). */
  streak: number;
  /** Active days in the last 12 weeks. */
  activeDays: number;
  /** Estimated readiness 0–100 (null until there is enough data). */
  readiness: number | null;
}) {
  const answered = (summary?.correct ?? 0) + (summary?.wrong ?? 0) + (summary?.unanswered ?? 0);
  const cards = [
    {
      label: "মোট পরীক্ষা",
      value: formatNumber(summary?.attempts ?? 0),
      hint: summary?.released ? `${formatNumber(summary.released)}টি ফলাফল প্রকাশিত` : "প্রথম পরীক্ষা দিন",
      icon: CircleCheck,
      tone: "border-violet-200/70 from-violet-50 to-violet-100/60 dark:border-violet-500/20 dark:from-violet-500/10 dark:to-violet-500/5",
      iconBg: "bg-violet-600",
      num: "text-violet-900 dark:text-violet-200",
    },
    {
      label: "গড় নম্বর",
      value: formatNumber(summary?.avg_score ?? 0, "bn"),
      hint: summary?.best_score ? `সর্বোচ্চ ${formatNumber(summary.best_score)}` : "এখনো স্কোর নেই",
      icon: TrendingUp,
      tone: "border-amber-200/70 from-amber-50 to-amber-100/60 dark:border-amber-500/20 dark:from-amber-500/10 dark:to-amber-500/5",
      iconBg: "bg-amber-500",
      num: "text-amber-900 dark:text-amber-200",
    },
    {
      label: "সর্বিক সঠিকতা",
      value: `${formatNumber(summary?.avg_accuracy ?? 0)}%`,
      hint: summary?.correct ? `${formatNumber(summary.correct)}টি সঠিক উত্তর` : "উত্তরের ভিত্তিতে",
      icon: Target,
      tone: "border-emerald-200/70 from-emerald-50 to-emerald-100/60 dark:border-emerald-500/20 dark:from-emerald-500/10 dark:to-emerald-500/5",
      iconBg: "bg-emerald-600",
      num: "text-emerald-900 dark:text-emerald-200",
    },
    {
      label: "মোট প্রশ্ন অনুশীলন",
      value: formatNumber(answered),
      hint: summary
        ? `সঠিক: ${formatNumber(summary.correct)} · ভুল: ${formatNumber(summary.wrong)}`
        : "এখনো উত্তর নেই",
      icon: Layers,
      tone: "border-sky-200/70 from-sky-50 to-sky-100/60 dark:border-sky-500/20 dark:from-sky-500/10 dark:to-sky-500/5",
      iconBg: "bg-sky-600",
      num: "text-sky-900 dark:text-sky-200",
    },
    {
      label: "স্টাডি স্ট্রিক",
      value: `${formatNumber(streak)} দিন`,
      hint: `${formatNumber(activeDays)} দিন সক্রিয় (১২ সপ্তাহ)`,
      icon: Flame,
      tone: "border-orange-200/70 from-orange-50 to-orange-100/60 dark:border-orange-500/20 dark:from-orange-500/10 dark:to-orange-500/5",
      iconBg: "bg-orange-500",
      num: "text-orange-900 dark:text-orange-200",
    },
    {
      label: "প্রস্তুতি সম্পন্নতা",
      value: readiness === null ? "—" : `${formatNumber(readiness)}%`,
      hint: readiness === null ? "আরও অনুশীলনে হিসাব হবে" : "আনুমানিক (সঠিকতা+ধারাবাহিকতা)",
      icon: Gauge,
      tone: "border-fuchsia-200/70 from-fuchsia-50 to-fuchsia-100/60 dark:border-fuchsia-500/20 dark:from-fuchsia-500/10 dark:to-fuchsia-500/5",
      iconBg: "bg-fuchsia-600",
      num: "text-fuchsia-900 dark:text-fuchsia-200",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className={cn("rounded-2xl border bg-gradient-to-br p-3", card.tone)}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[0.75rem] font-semibold text-[var(--text-muted)]">{card.label}</p>
              <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg text-white shadow-sm", card.iconBg)}>
                <Icon className="size-3.5" aria-hidden />
              </span>
            </div>
            <p className={cn("mt-1 text-[1.5rem] font-extrabold tabular-nums leading-tight xl:text-[1.75rem]", card.num)}>
              {card.value}
            </p>
            <p className="mt-0.5 truncate text-[0.6875rem] font-medium text-[var(--text-subtle)]">{card.hint}</p>
          </div>
        );
      })}
    </div>
  );
}