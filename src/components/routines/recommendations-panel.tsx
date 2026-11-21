"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Info, Lightbulb, Loader2, RefreshCw, Target, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Study recommendations, rendered with their evidence.
 *
 * Two things this panel refuses to do:
 *
 *   1. Show a suggestion whose evidence is missing. The API returns `blocked`
 *      reasons for every rule that could not run, and those are printed where a
 *      tip would otherwise go: "no exam taken yet" is more useful than a guess.
 *   2. Let a frequency band read as a prediction. The wording says what was
 *      counted ("8 papers, 40 questions"), not what will be asked.
 */

type Recommendation = {
  kind: "frequency" | "weak" | "carry_forward" | "improve";
  topic_id: string;
  topic_bn: string;
  subject_bn: string;
  reason_bn: string;
  evidence_bn: string;
  score: number;
};

type Payload = {
  items: Recommendation[];
  blocked: { kind: Recommendation["kind"]; reason_bn: string }[];
  empty: boolean;
  summary_bn: string;
  sources: {
    frequency_rows: number;
    counted_topics: number;
    attempted_topics: number;
    unfinished_topics: number;
  };
  error?: string;
};

const KIND_META: Record<Recommendation["kind"], { label: string; tone: "brand" | "warning" | "neutral" | "success"; icon: typeof Target }> = {
  carry_forward: { label: "গত সপ্তাহ থেকে", tone: "warning", icon: RefreshCw },
  weak: { label: "দুর্বল টপিক", tone: "brand", icon: Target },
  frequency: { label: "বেশি চাহিদা", tone: "neutral", icon: TrendingUp },
  improve: { label: "ফলাফল অনুযায়ী", tone: "success", icon: Lightbulb },
};

export function RecommendationsPanel({
  courseId,
  initialCourseId,
}: {
  courseId?: string | null;
  initialCourseId?: string | null;
}) {
  const [data, setData] = React.useState<Payload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const activeCourse = courseId ?? initialCourseId ?? null;

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = activeCourse ? `?courseId=${encodeURIComponent(activeCourse)}` : "";
      const response = await fetch(`/api/recommendations${query}`, { cache: "no-store" });
      const payload = (await response.json()) as Payload;
      if (!response.ok) {
        setError(payload.error ?? "পরামর্শ লোড করা যায়নি।");
        setData(null);
        return;
      }
      setData(payload);
    } catch {
      setError("নেটওয়ার্ক সমস্যা।");
    } finally {
      setLoading(false);
    }
  }, [activeCourse]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="jh-card" aria-labelledby="rec-h">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div className="min-w-0">
          <h2 id="rec-h" className="flex items-center gap-2 text-[0.875rem] font-semibold text-[var(--text)]">
            <Lightbulb className="size-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden />
            পড়ার পরামর্শ
          </h2>
          <p className="mt-0.5 text-[0.6875rem] text-[var(--text-subtle)]">
            বিগত পরীক্ষার প্রশ্নগণনা ও আপনার নিজের ফলাফল থেকে — অনুমান নয়।
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void load()}
          loading={loading}
          aria-label="পরামর্শ আবার লোড করুন"
        >
          <RefreshCw className="size-3.5" aria-hidden />
        </Button>
      </div>

      <div className="p-4">
        {loading && !data ? (
          <div className="flex items-center gap-2 py-4 text-[0.75rem] text-[var(--text-subtle)]">
            <Loader2 className="size-3.5 animate-spin" aria-hidden /> হিসাব করা হচ্ছে…
          </div>
        ) : error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-[0.75rem] font-medium text-red-700 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </p>
        ) : data ? (
          <>
            {data.empty ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-500/30 dark:bg-amber-500/10">
                <p className="text-[0.75rem] font-semibold text-amber-900 dark:text-amber-300">
                  এখনই কোনো পরামর্শ দেওয়া যাচ্ছে না
                </p>
                <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-amber-800 dark:text-amber-400">
                  {data.summary_bn}
                </p>
              </div>
            ) : (
              <p className="text-[0.75rem] font-medium text-[var(--text)]">{data.summary_bn}</p>
            )}

            {data.items.length > 0 ? (
              <ol className="mt-3 space-y-2">
                {data.items.map((item, index) => {
                  const meta = KIND_META[item.kind] ?? KIND_META.frequency;
                  const Icon = meta.icon;
                  return (
                    <li
                      key={item.topic_id}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-2.5"
                    >
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-100 text-[0.625rem] font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate text-[0.75rem] font-semibold text-[var(--text)]">{item.topic_bn}</p>
                            <Badge tone={meta.tone}>
                              <Icon className="mr-0.5 size-2.5" aria-hidden />
                              {meta.label}
                            </Badge>
                          </div>
                          {item.subject_bn ? (
                            <p className="mt-0.5 text-[0.625rem] text-[var(--text-subtle)]">{item.subject_bn}</p>
                          ) : null}
                          <p className="mt-1 text-[0.6875rem] leading-relaxed text-[var(--text-muted)]">{item.reason_bn}</p>
                          <p className="mt-0.5 flex items-start gap-1 text-[0.625rem] leading-relaxed text-[var(--text-subtle)]">
                            <Info className="mt-0.5 size-2.5 shrink-0" aria-hidden />
                            {item.evidence_bn}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : null}

            {data.blocked.length > 0 ? (
              <div className="mt-3 rounded-lg border border-dashed border-[var(--border)] p-2.5">
                <p className="text-[0.6875rem] font-semibold text-[var(--text-muted)]">যে পরামর্শ দেওয়া যায়নি</p>
                <ul className="mt-1 space-y-1">
                  {data.blocked.map((row) => (
                    <li key={row.kind} className="flex gap-1.5 text-[0.625rem] leading-relaxed text-[var(--text-subtle)]">
                      <span aria-hidden>·</span>
                      {row.reason_bn}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-2.5">
              <p className="text-[0.5625rem] text-[var(--text-subtle)]">
                ভিত্তি: {data.sources.counted_topics}টি গণনাকৃত টপিক · {data.sources.attempted_topics}টি অনুশীলন করা টপিক ·{" "}
                {data.sources.unfinished_topics}টি অসম্পূর্ণ
              </p>
              <Link
                href="/admin/frequency"
                className="inline-flex items-center gap-0.5 text-[0.625rem] font-semibold text-brand-700 hover:underline dark:text-brand-400"
              >
                ফ্রিকোয়েন্সি দেখুন
                <ArrowUpRight className="size-2.5" aria-hidden />
              </Link>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
