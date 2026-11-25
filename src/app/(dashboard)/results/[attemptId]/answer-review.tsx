"use client";

import * as React from "react";
import { Check, ChevronDown, CircleX, ListFilter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatNumber, toBengaliDigits } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { ReviewItem } from "@/lib/types";

const OPTION_KEYS = ["ক", "খ", "গ", "ঘ"];

type FilterKey = "all" | "correct" | "wrong" | "unanswered" | "flagged";

/** Result sheet with a "দেখান" dropdown: সব প্রশ্ন / সঠিক / ভুল উত্তর / অনুত্তরিত / রিভিউ চিহ্নিত. */
export function AnswerReview({ items, flaggedIds }: { items: ReviewItem[]; flaggedIds: string[] }) {
  const [filter, setFilter] = React.useState<FilterKey>("all");
  const flagged = React.useMemo(() => new Set(flaggedIds), [flaggedIds]);

  const counts = React.useMemo(
    () => ({
      all: items.length,
      correct: items.filter((i) => i.selected_option !== null && i.is_correct).length,
      wrong: items.filter((i) => i.selected_option !== null && !i.is_correct).length,
      unanswered: items.filter((i) => i.selected_option === null).length,
      flagged: items.filter((i) => flagged.has(i.question_id)).length,
    }),
    [items, flagged],
  );

  const visible = React.useMemo(() => {
    switch (filter) {
      case "correct":
        return items.filter((i) => i.selected_option !== null && i.is_correct);
      case "wrong":
        return items.filter((i) => i.selected_option !== null && !i.is_correct);
      case "unanswered":
        return items.filter((i) => i.selected_option === null);
      case "flagged":
        return items.filter((i) => flagged.has(i.question_id));
      default:
        return items;
    }
  }, [filter, items, flagged]);

  return (
    <section className="mt-5" aria-labelledby="review-h">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="review-h" className="text-[1rem] font-bold tracking-[-0.02em] text-[var(--text)]">
            উত্তরপত্র ও ব্যাখ্যা
          </h2>
          <span className="text-[0.6875rem] text-[var(--text-subtle)]">
            {formatNumber(visible.length)} / {formatNumber(items.length)} প্রশ্ন
          </span>
        </div>
        <label className="flex items-center gap-2 text-[0.75rem] font-medium text-[var(--text-muted)]">
          <ListFilter className="size-3.5" aria-hidden />
          দেখান
          <span className="relative inline-flex">
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as FilterKey)}
              className="appearance-none rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1.5 pl-3 pr-8 text-[0.75rem] font-semibold text-[var(--text)] shadow-sm outline-none focus:border-[var(--brand)]"
              aria-label="উত্তরপত্র ফিল্টার"
            >
              <option value="all">সব প্রশ্ন ({formatNumber(counts.all)})</option>
              <option value="correct">সঠিক ({formatNumber(counts.correct)})</option>
              <option value="wrong">ভুল উত্তর ({formatNumber(counts.wrong)})</option>
              <option value="unanswered">অনুত্তরিত ({formatNumber(counts.unanswered)})</option>
              <option value="flagged">রিভিউ চিহ্নিত ({formatNumber(counts.flagged)})</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-[var(--text-subtle)]"
              aria-hidden
            />
          </span>
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="jh-card p-8 text-center">
          <p className="text-[0.875rem] font-semibold text-[var(--text)]">এই ফিল্টারে কোনো প্রশ্ন নেই</p>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className="mt-2 text-[0.8125rem] font-semibold text-[var(--brand)] hover:underline"
          >
            সব প্রশ্ন দেখুন
          </button>
        </div>
      ) : (
        <ol className="space-y-3">
          {visible.map((item) => {
            const selected = item.selected_option;
            return (
              <li key={item.question_id} className="jh-card p-4 sm:p-5">
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-[var(--surface-sunken)] px-1.5 text-[0.6875rem] font-bold text-[var(--text-muted)]">
                    {toBengaliDigits(item.position)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {flagged.has(item.question_id) ? <Badge tone="brand">রিভিউ চিহ্নিত</Badge> : null}
                    {item.selected_option === null ? (
                      <Badge tone="neutral">অনুত্তরিত</Badge>
                    ) : item.is_correct ? (
                      <Badge tone="success">সঠিক</Badge>
                    ) : (
                      <Badge tone="danger">ভুল</Badge>
                    )}
                  </span>
                </div>

                <p className="mt-2.5 font-bangla text-[0.9375rem] font-medium leading-[1.8] text-[var(--text)]">
                  {item.statement}
                </p>

                <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                  {item.options.map((option, index) => {
                    const isCorrect = index === item.correct_option;
                    const isPicked = selected === index;
                    return (
                      <li
                        key={index}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[0.8125rem]",
                          isCorrect
                            ? "border-mint-200 bg-mint-50 font-semibold text-mint-800 dark:border-mint-600/40 dark:bg-mint-600/10 dark:text-mint-300"
                            : isPicked
                              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
                              : "border-[var(--border)] text-[var(--text-muted)]",
                        )}
                      >
                        <span className="flex size-5 shrink-0 items-center justify-center rounded text-[0.625rem] font-bold bg-[var(--surface-sunken)]">
                          {OPTION_KEYS[index]}
                        </span>
                        <span className="flex-1">{option}</span>
                        {isCorrect ? <Check className="size-3.5 shrink-0" aria-hidden /> : null}
                        {isPicked && !isCorrect ? <CircleX className="size-3.5 shrink-0" aria-hidden /> : null}
                      </li>
                    );
                  })}
                </ul>

                {item.explanation ? (
                  <div className="mt-3 rounded-xl bg-[var(--surface-muted)] px-3.5 py-3">
                    <p className="text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-subtle)]">
                      ব্যাখ্যা
                    </p>
                    <p className="mt-1 text-[0.8125rem] leading-[1.85] text-[var(--text-muted)]">
                      {item.explanation}
                    </p>
                  </div>
                ) : null}

                {item.exam_name || item.year || item.book_chapter ? (
                  <p className="mt-2 text-[0.625rem] text-[var(--text-subtle)]">
                    {[
                      item.exam_name ? `পরীক্ষা: ${item.exam_name}` : null,
                      item.year ? formatNumber(item.year) : null,
                      item.book_chapter || null,
                      item.book_page ? `পৃষ্ঠা ${formatNumber(item.book_page)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
