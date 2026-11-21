import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft, Check, Clock3, CircleCheck, CircleX, MinusCircle, RotateCcw, Target, Trophy, Lock, FileDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getCurrentUser } from "@/lib/auth";
import { getAttemptPaper, getAttemptReview } from "@/lib/exam-service";
import { getSystemSettings } from "@/lib/admin-queries";
import { formatDateTime, formatNumber, formatPercent, toBengaliDigits } from "@/lib/format";
import { MODE_LABELS, type AttemptMode } from "@/lib/types";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "ফলাফল" };

const OPTION_KEYS = ["ক", "খ", "গ", "ঘ"];

export default async function ResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { attemptId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) notFound();

  let paper;
  let review;
  try {
    [paper, review] = await Promise.all([getAttemptPaper(attemptId), getAttemptReview(attemptId)]);
  } catch {
    notFound();
  }

  // Requirement 7: the admin decides whether students get a printable sheet.
  const settings = await getSystemSettings();
  const pdfFlags = (settings.pdf_downloads ?? {}) as Record<string, unknown>;
  const pdfEnabled =
    Boolean(review.released) &&
    (pdfFlags.question_paper === true || pdfFlags.answer_key === true || pdfFlags.performance_report === true);

  if (paper.attempt.status === "in_progress") {
    redirect(`/exam/${attemptId}`);
  }

  const mode = (paper.attempt.mode as AttemptMode) ?? "custom";
  const showKey = review.released;
  const answered = (review.correct ?? 0) + (review.wrong ?? 0);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-[var(--text-muted)] hover:text-[var(--brand)]"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        ড্যাশবোর্ড
      </Link>

      {/* Summary */}
      <div className="jh-card mt-3 overflow-hidden">
        <div className="jh-hero-field border-b border-[var(--border)] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge tone="brand">{MODE_LABELS[mode]?.bn ?? "পরীক্ষা"}</Badge>
              <h1 className="mt-2.5 text-[1.375rem] font-bold tracking-[-0.03em] text-[var(--text)]">
                {showKey ? "ফলাফল ও উত্তরপত্র" : "জমা সম্পন্ন হয়েছে"}
              </h1>
              <p className="mt-1 text-[0.75rem] text-[var(--text-muted)]">
                {paper.attempt.submitted_at
                  ? `${formatDateTime(paper.attempt.submitted_at)}-এ জমা দেওয়া হয়েছে`
                  : "জমা দেওয়া হয়েছে"}
              </p>
            </div>
            {showKey ? (
              <div className="text-right">
                <p className="text-[0.625rem] font-medium uppercase tracking-[0.1em] text-[var(--text-subtle)]">
                  আপনার স্কোর
                </p>
                <p className="mt-0.5 flex items-baseline justify-end gap-0.5 text-[2rem] font-extrabold leading-none tracking-[-0.04em] text-[var(--text)]">
                  {formatNumber(review.score ?? 0)}
                  <span className="text-[0.875rem] font-semibold text-[var(--text-subtle)]">
                    /{formatNumber(review.total_marks ?? paper.attempt.total_marks)}
                  </span>
                </p>
                <p className="mt-1 text-[0.6875rem] font-semibold text-[var(--brand)]">
                  {formatPercent(review.accuracy ?? 0)} নির্ভুলতা
                </p>
              </div>
            ) : (
              <div className="max-w-xs rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
                <p className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-[var(--text)]">
                  <Lock className="size-3.5 text-[var(--brand)]" aria-hidden />
                  ফলাফল প্রকাশের অপেক্ষায়
                </p>
                <p className="mt-1 text-[0.6875rem] leading-relaxed text-[var(--text-muted)]">
                  {review.result_release_at
                    ? `${formatDateTime(review.result_release_at)}-এর পরে স্কোর ও উত্তর-ব্যাখ্যা দেখা যাবে।`
                    : "নির্ধারিত সময়ে ফলাফল প্রকাশিত হবে।"}
                </p>
              </div>
            )}
          </div>
        </div>

        {showKey ? (
          <div className="grid grid-cols-2 divide-x divide-y divide-[var(--border)] sm:grid-cols-4 sm:divide-y-0">
            {[
              { icon: <CircleCheck className="size-4" />, label: "সঠিক", value: review.correct ?? 0, tone: "text-mint-600 dark:text-mint-500" },
              { icon: <CircleX className="size-4" />, label: "ভুল", value: review.wrong ?? 0, tone: "text-red-600 dark:text-red-400" },
              { icon: <MinusCircle className="size-4" />, label: "অনুত্তরিত", value: review.unanswered ?? 0, tone: "text-[var(--text-subtle)]" },
              { icon: <Target className="size-4" />, label: "উত্তর দেওয়া", value: answered, tone: "text-[var(--brand)]" },
            ].map((item) => (
              <div key={item.label} className="p-4 text-center">
                <span className="inline-flex items-center gap-1 text-[0.6875rem] font-medium text-[var(--text-muted)]">
                  {item.icon}
                  {item.label}
                </span>
                <p className={cn("mt-1 text-[1.25rem] font-bold tabular-nums", item.tone)}>
                  {formatNumber(item.value)}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {!showKey ? (
        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="flex items-center gap-2 text-[0.9375rem] font-semibold text-[var(--text)]">
            <Clock3 className="size-4 text-[var(--brand)]" aria-hidden />
            জমা সংক্রান্ত তথ্য
          </h2>
          <ul className="mt-2 space-y-1.5 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
            <li>আপনার উত্তর সংরক্ষিত আছে এবং স্কোর সার্ভারে নিরাপদে হিসাব করা হয়েছে।</li>
            <li>ফলাফল প্রকাশের নির্ধারিত সময়ের আগে স্কোর বা সঠিক উত্তর কোথাও দেখানো হয় না।</li>
            <li>প্রকাশের সময় এলে এই পাতাতেই বিস্তারিত ব্যাখ্যা দেখা যাবে।</li>
          </ul>
        </div>
      ) : null}

      {/* Question review */}
      {showKey && review.items.length > 0 ? (
        <section className="mt-5" aria-labelledby="review-h">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="review-h" className="text-[1rem] font-bold tracking-[-0.02em] text-[var(--text)]">
              উত্তরপত্র ও ব্যাখ্যা
            </h2>
            <span className="text-[0.6875rem] text-[var(--text-subtle)]">
              {formatNumber(review.items.length)} প্রশ্ন
            </span>
          </div>
          <ol className="space-y-3">
            {review.items.map((item) => {
              const selected = item.selected_option;
              return (
                <li key={item.question_id} className="jh-card p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-[var(--surface-sunken)] px-1.5 text-[0.6875rem] font-bold text-[var(--text-muted)]">
                      {toBengaliDigits(item.position)}
                    </span>
                    {item.selected_option === null ? (
                      <Badge tone="neutral">অনুত্তরিত</Badge>
                    ) : item.is_correct ? (
                      <Badge tone="success">সঠিক</Badge>
                    ) : (
                      <Badge tone="danger">ভুল</Badge>
                    )}
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

                  {item.exam_name || item.source || item.year || item.book_chapter ? (
                    <p className="mt-2 text-[0.625rem] text-[var(--text-subtle)]">
                      উৎস: {item.exam_name || item.source}
                      {item.year ? ` · ${formatNumber(item.year)}` : ""}
                      {item.book_chapter ? ` · ${item.book_chapter}` : ""}
                      {item.book_page ? ` · পৃষ্ঠা ${formatNumber(item.book_page)}` : ""}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        {pdfEnabled ? (
          <ButtonLink href={`/results/${attemptId}/sheet`} size="md">
            <FileDown className="size-3.5" aria-hidden />
            PDF ডাউনলোড
          </ButtonLink>
        ) : null}
        <ButtonLink href="/practice" size="md">
          <RotateCcw className="size-3.5" aria-hidden />
          আবার অনুশীলন
        </ButtonLink>
        <ButtonLink href="/analytics" variant="secondary" size="md">
          <Trophy className="size-3.5" aria-hidden />
          বিশ্লেষণ দেখুন
        </ButtonLink>
        <ButtonLink href="/dashboard" variant="ghost" size="md">
          ড্যাশবোর্ড
        </ButtonLink>
      </div>

      <div className="mt-4 pb-6">
        <Progress value={review.total_marks ? ((review.score ?? 0) / review.total_marks) * 100 : 0} />
      </div>
    </div>
  );
}
