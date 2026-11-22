import { BookOpenCheck, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatNumber, formatPercent } from "@/lib/format";
import type { SectionStat, TopicStat } from "@/lib/result-breakdown";
import { cn } from "@/lib/cn";

/**
 * Subject (main 90 / secondary 10) and topic breakdown of a released result.
 * Server-rendered: all numbers are computed on the server from the review
 * payload, nothing here recalculates scores.
 */
export function SectionBreakdown({
  sections,
  topics,
  weak,
  subjectTitles,
  topicTitles,
}: {
  sections: SectionStat[];
  topics: TopicStat[];
  weak: TopicStat[];
  subjectTitles: Map<string, string>;
  topicTitles: Map<string, string>;
}) {
  if (sections.length === 0) return null;

  const roleLabel = (role: SectionStat["role"]) =>
    role === "main" ? "মূল বিষয় · ৯০%" : role === "secondary" ? "সহ-বিষয় · ১০%" : null;

  return (
    <div className="mt-4 space-y-3">
      <section className="jh-card p-4">
        <h2 className="flex items-center gap-1.5 text-[0.875rem] font-bold text-[var(--text)]">
          <BookOpenCheck className="size-4 text-[var(--brand)]" aria-hidden />
          বিষয়ভিত্তিক ফলাফল
        </h2>
        <div className="mt-3 space-y-3">
          {sections.map((section) => {
            const label = roleLabel(section.role);
            return (
              <div key={section.id} className="rounded-lg border border-[var(--border)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-[0.8125rem] font-semibold text-[var(--text)]">
                      {subjectTitles.get(section.id) ?? "অন্যান্য"}
                    </p>
                    {label ? <Badge tone={section.role === "main" ? "brand" : "neutral"}>{label}</Badge> : null}
                  </div>
                  <p className="text-[0.8125rem] font-bold tabular-nums text-[var(--text)]">
                    {formatNumber(section.marks)}
                    <span className="text-[0.6875rem] font-medium text-[var(--text-subtle)]">
                      /{formatNumber(section.maxMarks)}
                    </span>
                  </p>
                </div>
                <div className="mt-2">
                  <Progress value={section.maxMarks > 0 ? Math.max(0, (section.marks / section.maxMarks) * 100) : 0} />
                </div>
                <p className="mt-1.5 text-[0.6875rem] text-[var(--text-muted)]">
                  সঠিক {formatNumber(section.correct)} · ভুল {formatNumber(section.wrong)} · অনুত্তরিত{" "}
                  {formatNumber(section.unanswered)} · নির্ভুলতা {formatPercent(section.accuracy)}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {topics.length > 0 ? (
        <section className="jh-card p-4">
          <h2 className="text-[0.875rem] font-bold text-[var(--text)]">টপিকভিত্তিক বিশ্লেষণ</h2>
          <ul className="mt-2 space-y-0.5 text-[0.6875rem]">
            {topics.map((topic) => {
              const isWeak = weak.some((weakTopic) => weakTopic.id === topic.id);
              return (
                <li
                  key={topic.id}
                  className="flex items-center gap-2 rounded px-1.5 py-1 odd:bg-[var(--surface-muted)]"
                >
                  <span className="min-w-0 flex-1 truncate font-medium text-[var(--text)]">
                    {topicTitles.get(topic.id) ?? "টপিক"}
                    <span className="ml-1.5 text-[var(--text-subtle)]">
                      ({subjectTitles.get(topic.subjectId ?? "") ?? "—"})
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-[var(--text-muted)]">
                    {formatNumber(topic.correct)}/{formatNumber(topic.total)}
                  </span>
                  <span
                    className={cn(
                      "w-14 shrink-0 text-right font-semibold tabular-nums",
                      isWeak ? "text-red-600 dark:text-red-400" : "text-mint-700 dark:text-mint-400",
                    )}
                  >
                    {formatPercent(topic.accuracy)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {weak.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <h2 className="flex items-center gap-1.5 text-[0.875rem] font-bold text-amber-900 dark:text-amber-300">
            <TrendingDown className="size-4" aria-hidden />
            দুর্বল টপিক — আগে এগুলো রিভিশন করুন
          </h2>
          <ul className="mt-2 space-y-1 text-[0.75rem] leading-relaxed text-amber-900/90 dark:text-amber-200/90">
            {weak.map((topic) => (
              <li key={topic.id}>
                <strong className="font-semibold">{topicTitles.get(topic.id) ?? "টপিক"}</strong> — {formatNumber(topic.total)}
                টির মধ্যে {formatNumber(topic.correct)}টি সঠিক
                {topic.unanswered > 0 ? ` (${formatNumber(topic.unanswered)}টি অনুত্তরিত)` : ""}। অনুশীলন মোডে এই টপিক
                আবার চর্চা করুন।
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
