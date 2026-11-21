import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BarChart3, CircleCheck, CircleX, Info, MinusCircle, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress, Ring } from "@/components/ui/progress";
import { getCurrentUser } from "@/lib/auth";
import { getLeaderboard, getStudentAnalytics, listCourses } from "@/lib/queries";
import { formatDate, formatNumber, formatPercent, relativeFromNow } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "বিশ্লেষণ" };

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [analytics, courses, leaderboard] = await Promise.all([
    getStudentAnalytics(null),
    listCourses(),
    getLeaderboard({ scope: "weekly", limit: 50 }),
  ]);

  const summary = analytics?.summary;
  const hasData = Boolean(summary && summary.attempts > 0);
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const subjects = analytics?.subjects ?? [];
  const topics = analytics?.topics ?? [];
  const weekly = analytics?.weekly ?? [];
  const history = analytics?.history ?? [];
  const myRank = leaderboard.find((r) => r.user_id === user.id);
  const maxWeekly = Math.max(1, ...weekly.map((w) => w.score));

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        eyebrow="বিশ্লেষণ"
        title="আপনার প্রস্তুতির বাস্তব চিত্র"
        description="সব সংখ্যা আপনার জমা দেওয়া উত্তর থেকে সরাসরি গণনা করা — কোনো অনুমান বা কৃত্রিম সুপারিশ নেই।"
      />

      {!hasData ? (
        <EmptyState
          icon={<BarChart3 className="size-5" />}
          title="বিশ্লেষণের জন্য এখনো পর্যাপ্ত ডেটা নেই"
          description="একটি পরীক্ষা দিয়ে জমা দিন। এরপর বিষয়ভিত্তিক নির্ভুলতা, দৈনিক অগ্রগতি ও দুর্বল টপিক এখানে দেখা যাবে।"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href="/practice" size="sm">
                প্র্যাকটিস শুরু করুন
              </ButtonLink>
              <ButtonLink href="/custom-exam" variant="secondary" size="sm">
                কাস্টম পরীক্ষা
              </ButtonLink>
            </div>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "মোট পরীক্ষা", value: formatNumber(summary?.attempts ?? 0), hint: `${formatNumber(summary?.released ?? 0)} প্রকাশিত` },
              { label: "গড় স্কোর", value: formatNumber(summary?.avg_score ?? 0), hint: `সর্বোচ্চ ${formatNumber(summary?.best_score ?? 0)}` },
              { label: "নির্ভুলতা", value: formatPercent(summary?.avg_accuracy ?? 0), hint: "উত্তর দেওয়ার ভিত্তিতে" },
              { label: "সাপ্তাহিক র‍্যাংক", value: myRank ? `#${formatNumber(myRank.rank)}` : "—", hint: myRank ? "প্রকাশিত ফলাফলে" : "এখনো তালিকায় নেই" },
            ].map((card) => (
              <div key={card.label} className="jh-card p-4">
                <p className="text-[0.6875rem] font-medium text-[var(--text-subtle)]">{card.label}</p>
                <p className="mt-1 text-[1.375rem] font-bold tabular-nums tracking-[-0.02em] text-[var(--text)]">
                  {card.value}
                </p>
                <p className="mt-0.5 text-[0.625rem] text-[var(--text-subtle)]">{card.hint}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <section className="jh-card p-5">
              <h2 className="text-[0.875rem] font-semibold text-[var(--text)]">উত্তর বিশ্লেষণ</h2>
              <div className="mt-4 flex justify-center">
                <Ring value={summary?.avg_accuracy ?? 0} size={112} label="Accuracy">
                  <span className="text-[1.25rem] font-bold tabular-nums text-[var(--text)]">
                    {formatPercent(summary?.avg_accuracy ?? 0)}
                  </span>
                </Ring>
              </div>
              <ul className="mt-4 space-y-2 text-[0.75rem]">
                <li className="flex items-center gap-2">
                  <CircleCheck className="size-3.5 text-mint-500" aria-hidden />
                  <span className="text-[var(--text-muted)]">সঠিক</span>
                  <span className="ml-auto font-semibold text-[var(--text)]">{formatNumber(summary?.correct ?? 0)}</span>
                </li>
                <li className="flex items-center gap-2">
                  <CircleX className="size-3.5 text-red-500" aria-hidden />
                  <span className="text-[var(--text-muted)]">ভুল</span>
                  <span className="ml-auto font-semibold text-[var(--text)]">{formatNumber(summary?.wrong ?? 0)}</span>
                </li>
                <li className="flex items-center gap-2">
                  <MinusCircle className="size-3.5 text-[var(--text-subtle)]" aria-hidden />
                  <span className="text-[var(--text-muted)]">অনুত্তরিত</span>
                  <span className="ml-auto font-semibold text-[var(--text)]">{formatNumber(summary?.unanswered ?? 0)}</span>
                </li>
              </ul>
            </section>

            <section className="jh-card p-5">
              <h2 className="flex items-center gap-2 text-[0.875rem] font-semibold text-[var(--text)]">
                <TrendingUp className="size-4 text-[var(--brand)]" aria-hidden />
                দৈনিক অগ্রগতি
              </h2>
              <div className="mt-4 flex h-36 items-end gap-2" aria-hidden>
                {weekly.map((day) => (
                  <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[0.5625rem] font-semibold tabular-nums text-[var(--text-subtle)]">
                      {day.attempts > 0 ? formatNumber(day.score) : ""}
                    </span>
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className={`w-full rounded-t-md ${day.attempts > 0 ? "bg-[var(--brand)]" : "bg-[var(--surface-sunken)]"}`}
                        style={{ height: `${day.attempts > 0 ? Math.max(6, (day.score / maxWeekly) * 100) : 4}%` }}
                      />
                    </div>
                    <span className="text-[0.5625rem] text-[var(--text-subtle)]">
                      {formatDate(`${day.date}T12:00:00`, "bn", { weekday: "narrow" })}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[0.625rem] text-[var(--text-subtle)]">
                প্রতিটি দিবসের গড় স্কোর (শুধু প্রকাশিত ফলাফল দেখানো হয় না — এখানে জমা দেওয়া সব পরীক্ষা)
              </p>
            </section>
          </div>

          <section className="jh-card mt-4 p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[0.875rem] font-semibold text-[var(--text)]">বিষয়ভিত্তিক নির্ভুলতা</h2>
              <Badge tone="neutral">{formatNumber(subjects.length)} বিষয়</Badge>
            </div>
            {subjects.length === 0 ? (
              <p className="mt-2 text-[0.75rem] text-[var(--text-subtle)]">কোনো বিষয়ভিত্তিক ডেটা নেই।</p>
            ) : (
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {subjects.map((subject) => (
                  <li key={subject.subject_id ?? subject.title_en}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[0.75rem] font-medium text-[var(--text)]">{subject.title_bn}</span>
                      <span className="shrink-0 text-[0.6875rem] font-semibold tabular-nums text-[var(--text-muted)]">
                        {formatPercent(subject.accuracy)}
                      </span>
                    </div>
                    <Progress
                      value={subject.accuracy}
                      className="mt-1"
                      tone={subject.accuracy >= 60 ? "success" : subject.accuracy >= 40 ? "brand" : "warning"}
                      label={subject.title_bn}
                    />
                    <p className="mt-0.5 text-[0.5625rem] text-[var(--text-subtle)]">
                      {formatNumber(subject.correct)}/{formatNumber(subject.attempted)} সঠিক
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {topics.length > 0 ? (
            <section className="jh-card mt-4 p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[0.875rem] font-semibold text-[var(--text)]">দুর্বল টপিক</h2>
                <Link href="/practice" className="text-[0.6875rem] font-semibold text-[var(--brand)] hover:underline">
                  অনুশীলন করুন
                </Link>
              </div>
              <ul className="mt-3 divide-y divide-[var(--border)]">
                {topics.slice(0, 6).map((topic) => (
                  <li key={topic.topic_id} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.75rem] font-medium text-[var(--text)]">{topic.title_bn}</p>
                      <p className="text-[0.625rem] text-[var(--text-subtle)]">
                        {topic.subject_bn} · {formatNumber(topic.attempted)} প্রশ্ন
                      </p>
                    </div>
                    <div className="w-24 shrink-0">
                      <Progress
                        value={topic.accuracy}
                        tone={topic.accuracy >= 60 ? "success" : topic.accuracy >= 40 ? "brand" : "warning"}
                        label={topic.title_bn}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right text-[0.6875rem] font-semibold tabular-nums text-[var(--text-muted)]">
                      {formatPercent(topic.accuracy)}
                    </span>
                    <Link
                      href={`/custom-exam?topic=${topic.topic_id}`}
                      className="shrink-0 rounded-lg p-1 text-[var(--text-subtle)] hover:text-[var(--brand)]"
                      aria-label="Practise topic"
                    >
                      <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="jh-card mt-4 p-5">
            <h2 className="text-[0.875rem] font-semibold text-[var(--text)]">ফলাফলের ইতিহাস</h2>
            {history.length === 0 ? (
              <p className="mt-2 text-[0.75rem] text-[var(--text-subtle)]">এখনো প্রকাশিত ফলাফল নেই।</p>
            ) : (
              <ul className="mt-3 divide-y divide-[var(--border)]">
                {history.slice(0, 10).map((result) => (
                  <li key={result.result_id} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.75rem] font-medium text-[var(--text)]">
                        {result.title_bn ?? courseById.get(result.course_id)?.title_bn ?? "পরীক্ষা"}
                      </p>
                      <p className="text-[0.625rem] text-[var(--text-subtle)]">
                        {result.submitted_at ? relativeFromNow(result.submitted_at) : "—"} ·{" "}
                        {result.is_released ? "প্রকाशित" : "প্রকাশের অপেক্ষায়"}
                      </p>
                    </div>
                    <span className="shrink-0 text-[0.75rem] font-semibold tabular-nums text-[var(--text)]">
                      {result.is_released
                        ? `${formatNumber(result.score)}/${formatNumber(result.total_marks)}`
                        : "—"}
                    </span>
                    <Link
                      href={`/results/${result.attempt_id}`}
                      className="shrink-0 rounded-lg p-1 text-[var(--text-subtle)] hover:text-[var(--brand)]"
                      aria-label="Open result"
                    >
                      <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <p className="mt-4 flex items-start gap-1.5 text-[0.625rem] leading-relaxed text-[var(--text-subtle)]">
        <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
        বিশ্লেষণ শুধু আপনার নিজের ডেটা থেকে তৈরি। কোনো AI-উত্পন্ন সুপারিশ বা অনুমানিত পরিসংখ্যান এখানে নেই।
      </p>
    </div>
  );
}
