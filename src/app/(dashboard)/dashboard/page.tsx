import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, BookOpenCheck, CalendarCheck2, CalendarDays, CircleCheck, Clock3, Flame,
  Layers, Play, Radio, RotateCcw, Target, Trophy, TrendingUp, Sparkles, AlertCircle,
} from "lucide-react";
import { Badge, LiveDot } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress, Ring } from "@/components/ui/progress";
import { StatCard } from "@/components/ui/stat";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { getCurrentUser, displayName } from "@/lib/auth";
import {
  getStudentAnalytics, listCourses, listMyResults, listPublishedSchedules, listRoutines,
  getOpenAttempts,
} from "@/lib/queries";
import {
  dhakaDateKey, formatDate, formatNumber, formatPercent, formatTime, greeting, relativeFromNow,
} from "@/lib/format";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "ড্যাশবোর্ড" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const today = dhakaDateKey();
  const [courseList, analytics, results, schedules, routines, openAttempts] = await Promise.all([
    listCourses(),
    getStudentAnalytics(null),
    listMyResults(user.id, 5),
    listPublishedSchedules({ userId: user.id, limit: 20 }),
    listRoutines({ fromDate: today, limit: 10 }),
    getOpenAttempts(user.id),
  ]);

  const names = displayName(user);
  const courseById = new Map(courseList.map((c) => [c.id, c]));
  const targetCourse = courseList.find((c) => c.id === user.profile?.target_course_id) ?? courseList[0];

  const now = Date.now();
  const liveExams = schedules.filter(
    (s) => new Date(s.starts_at).getTime() <= now && new Date(s.ends_at).getTime() > now,
  );
  const upcomingExams = schedules.filter((s) => new Date(s.starts_at).getTime() > now).slice(0, 3);
  const todayRoutines = routines.filter((r) => r.routine_date === today);

  const summary = analytics?.summary;
  const weakTopics = (analytics?.topics ?? []).filter((t) => t.attempted >= 1).slice(0, 3);
  const subjects = analytics?.subjects ?? [];
  const hasData = Boolean(summary && summary.attempts > 0);
  const weekly = analytics?.weekly ?? [];
  const maxWeekly = Math.max(1, ...weekly.map((w) => w.score));

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        eyebrow={formatDate(new Date(), "bn", { weekday: "long", day: "numeric", month: "long" })}
        title={
          <span className="font-bangla">
            {greeting("bn")}, {names.bn}
          </span>
        }
        description={
          hasData
            ? `আপনি এখন পর্যন্ত ${formatNumber(summary?.attempts ?? 0)}টি পরীক্ষা সম্পন্ন করেছেন। গড় নির্ভুলতা ${formatPercent(summary?.avg_accuracy ?? 0)}।`
            : "আপনার প্রস্তুতির যাত্রা শুরু হোক। প্রথম পরীক্ষা দিলেই এখানে বাস্তব বিশ্লেষণ দেখা যাবে।"
        }
        action={
          <ButtonLink href="/practice" size="md">
            <Play className="size-3.5" aria-hidden />
            প্র্যাকটিস শুরু
          </ButtonLink>
        }
      />

      {/* Resume banner */}
      {openAttempts.length > 0 ? (
        <div className="mb-5">
          {openAttempts.slice(0, 1).map((attempt) => {
            const course = courseById.get(attempt.course_id as string);
            const deadline = new Date(attempt.deadline_at as string).getTime();
            const remaining = Math.max(0, Math.floor((deadline - now) / 1000));
            const alive = remaining > 0;
            return (
              <div
                key={attempt.id as string}
                className="flex flex-col gap-3 rounded-2xl border border-[var(--brand)]/25 bg-[var(--brand-soft)] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)] text-white">
                    <RotateCcw className="size-4" aria-hidden />
                  </span>
                  <div>
                    <p className="text-[0.875rem] font-semibold text-[var(--text)]">
                      অসম্পূর্ণ পরীক্ষা {alive ? "আছে" : "সময় শেষ"}
                    </p>
                    <p className="mt-0.5 text-[0.75rem] text-[var(--text-muted)]">
                      {course?.title_bn ?? "পরীক্ষা"} · {formatNumber(attempt.total_questions as number)} প্রশ্ন ·{" "}
                      {alive ? (
                        <>
                          <span className="font-semibold text-[var(--text)]">
                            {formatNumber(Math.ceil(remaining / 60))} মিনিট বাকি
                          </span>
                        </>
                      ) : (
                        "সময় শেষ — জমা দিন"
                      )}
                    </p>
                  </div>
                </div>
                <ButtonLink href={`/exam/${attempt.id}`} size="sm">
                  {alive ? "চালিয়ে যান" : "জমা দিন ও ফলাফল"}
                  <ArrowRight className="size-3.5" aria-hidden />
                </ButtonLink>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Live exams */}
      {liveExams.length > 0 ? (
        <div className="mb-5 rounded-2xl border border-red-100 bg-red-50/60 p-4 dark:border-red-500/20 dark:bg-red-500/5">
          <div className="flex items-center gap-2">
            <LiveDot label="এখন চলছে" />
          </div>
          <div className="mt-2.5 grid gap-2">
            {liveExams.map((exam) => (
              <div key={exam.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <p className="min-w-0 flex-1 truncate text-[0.875rem] font-semibold text-[var(--text)]">
                  {exam.title_bn}
                </p>
                <span className="text-[0.6875rem] text-[var(--text-muted)]">
                  {formatNumber(exam.question_count)} প্রশ্ন · {formatNumber(exam.duration_minutes)} মিনিট
                </span>
                {exam.my_attempt_id ? (
                  <ButtonLink href={`/exam/${exam.my_attempt_id}`} size="sm" variant="secondary">
                    চালিয়ে যান
                  </ButtonLink>
                ) : (
                  <ButtonLink href={`/exams/${exam.id}`} size="sm">
                    শুরু করুন
                  </ButtonLink>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="সম্পন্ন পরীক্ষা"
          value={formatNumber(summary?.attempts ?? 0)}
          icon={<CircleCheck className="size-4" aria-hidden />}
          hint={summary?.released ? `${formatNumber(summary.released)}টি প্রকাশিত ফলাফল` : "প্রথম পরীক্ষা দিন"}
          tone="brand"
        />
        <StatCard
          label="গড় স্কোর"
          value={formatNumber(summary?.avg_score ?? 0, "bn")}
          icon={<TrendingUp className="size-4" aria-hidden />}
          hint={summary?.best_score ? `সর্বোচ্চ ${formatNumber(summary.best_score)}` : "এখনো কোনো স্কোর নেই"}
          tone="success"
        />
        <StatCard
          label="নির্ভুলতা"
          value={formatNumber(summary?.avg_accuracy ?? 0)}
          suffix="%"
          icon={<Target className="size-4" aria-hidden />}
          hint={summary?.correct ? `${formatNumber(summary.correct)} সঠিক উত্তর` : "উত্তর দেওয়া প্রশ্নের ভিত্তিতে"}
          tone="accent"
        />
        <StatCard
          label="মোট উত্তর"
          value={formatNumber((summary?.correct ?? 0) + (summary?.wrong ?? 0) + (summary?.unanswered ?? 0))}
          icon={<BookOpenCheck className="size-4" aria-hidden />}
          hint={
            summary
              ? `${formatNumber(summary.correct)} সঠিক · ${formatNumber(summary.wrong)} ভুল`
              : "এখনো কোনো উত্তর নেই"
          }
          tone="neutral"
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          {/* Today's routine */}
          <section className="jh-card" aria-labelledby="routine-h">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3.5">
              <h2 id="routine-h" className="flex items-center gap-2 text-[0.875rem] font-semibold text-[var(--text)]">
                <CalendarDays className="size-4 text-[var(--brand)]" aria-hidden />
                আজকের পড়ার রুটিন
              </h2>
              <Link href="/routines" className="text-[0.6875rem] font-semibold text-[var(--brand)] hover:underline">
                পুরো রুটিন
              </Link>
            </div>
            <div className="p-4">
              {todayRoutines.length === 0 ? (
                <EmptyState
                  compact
                  icon={<CalendarDays className="size-4" />}
                  title="আজকের জন্য প্রকাশিত রুটিন নেই"
                  description="প্রশাসক রুটিন প্রকাশ করলে প্রতিদিনের পরিকল্পনা এখানে দেখা যাবে।"
                  action={
                    <ButtonLink href="/practice" variant="secondary" size="sm">
                      প্র্যাকটিস দিয়ে শুরু করুন
                    </ButtonLink>
                  }
                />
              ) : (
                <ul className="space-y-2">
                  {todayRoutines.map((routine) => (
                    <li
                      key={routine.id}
                      className="flex items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
                        <BookOpenCheck className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.8125rem] font-semibold text-[var(--text)]">
                          {routine.subject_title_bn ?? routine.title_bn ?? "পড়ার পরিকল্পনা"}
                        </p>
                        <p className="truncate text-[0.6875rem] text-[var(--text-subtle)]">
                          {routine.topic_title_bn ?? routine.focus_note_bn ?? "—"}
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 text-[0.6875rem] font-medium text-[var(--text-subtle)]">
                        <Clock3 className="size-3" aria-hidden />
                        {formatNumber(routine.minutes)} মিনিট
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Weekly progress */}
          <section className="jh-card" aria-labelledby="weekly-h">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3.5">
              <h2 id="weekly-h" className="flex items-center gap-2 text-[0.875rem] font-semibold text-[var(--text)]">
                <Flame className="size-4 text-[var(--brand)]" aria-hidden />
                সাপ্তাহিক অগ্রগতি
              </h2>
              <span className="text-[0.6875rem] text-[var(--text-subtle)]">শেষ ৭ দিন</span>
            </div>
            <div className="p-4">
              <div className="flex h-28 items-end gap-1.5" aria-hidden>
                {weekly.map((day) => {
                  const height = Math.max(4, (day.score / maxWeekly) * 100);
                  return (
                    <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                      <div className="flex w-full flex-1 items-end">
                        <div
                          className={`w-full rounded-t-md ${day.attempts > 0 ? "bg-[var(--brand)]" : "bg-[var(--surface-sunken)]"}`}
                          style={{ height: `${day.attempts > 0 ? height : 6}%` }}
                          title={`${day.date}: ${day.attempts} attempts`}
                        />
                      </div>
                      <span className="text-[0.5625rem] text-[var(--text-subtle)]">
                        {formatDate(`${day.date}T12:00:00`, "bn", { weekday: "narrow" })}
                      </span>
                    </div>
                  );
                })}
              </div>
              {!hasData ? (
                <p className="mt-2 text-center text-[0.6875rem] text-[var(--text-subtle)]">
                  পরীক্ষা দিলে এই চার্টে আপনার দৈনিক গড় স্কোর দেখা যাবে।
                </p>
              ) : null}
            </div>
          </section>

          {/* Recent results */}
          <section className="jh-card" aria-labelledby="recent-h">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3.5">
              <h2 id="recent-h" className="flex items-center gap-2 text-[0.875rem] font-semibold text-[var(--text)]">
                <Trophy className="size-4 text-[var(--brand)]" aria-hidden />
                সাম্প্রতিক ফলাফল
              </h2>
              <Link href="/analytics" className="text-[0.6875rem] font-semibold text-[var(--brand)] hover:underline">
                বিশ্লেষণ
              </Link>
            </div>
            {results.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  compact
                  icon={<Trophy className="size-4" />}
                  title="এখনো কোনো প্রকাশিত ফলাফল নেই"
                  description="পরীক্ষা দিয়ে জমা দিলে ফলাফল প্রকাশের পর এখানে দেখা যাবে।"
                />
              </div>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {results.map((result) => {
                  const course = courseById.get(result.course_id);
                  return (
                    <li key={result.result_id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.8125rem] font-semibold text-[var(--text)]">
                          {result.title_bn ?? course?.title_bn ?? "পরীক্ষার ফলাফল"}
                        </p>
                        <p className="text-[0.6875rem] text-[var(--text-subtle)]">
                          {result.submitted_at ? relativeFromNow(result.submitted_at) : "—"} ·{" "}
                          {formatNumber(result.correct)} সঠিক · {formatNumber(result.wrong)} ভুল
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[0.875rem] font-bold tabular-nums text-[var(--text)]">
                          {formatNumber(result.score)}
                          <span className="text-[0.6875rem] font-medium text-[var(--text-subtle)]">
                            /{formatNumber(result.total_marks)}
                          </span>
                        </p>
                        <p className="text-[0.625rem] text-mint-600 dark:text-mint-500">
                          {formatPercent(result.accuracy)} নির্ভুলতা
                        </p>
                      </div>
                      <Link
                        href={`/results/${result.attempt_id}`}
                        className="shrink-0 rounded-lg p-1.5 text-[var(--text-subtle)] hover:text-[var(--brand)]"
                        aria-label="View result"
                      >
                        <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-5">
          {/* Accuracy ring */}
          <section className="jh-card p-5">
            <h2 className="text-[0.875rem] font-semibold text-[var(--text)]">সার্বিক নির্ভুলতা</h2>
            <div className="mt-4 flex items-center gap-4">
              <Ring value={summary?.avg_accuracy ?? 0} size={84} label="Accuracy">
                <span className="text-[1rem] font-bold tabular-nums text-[var(--text)]">
                  {formatNumber(Math.round(summary?.avg_accuracy ?? 0))}
                  <span className="text-[0.625rem]">%</span>
                </span>
              </Ring>
              <div className="min-w-0 space-y-1.5 text-[0.75rem]">
                <p className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-mint-500" aria-hidden />
                  <span className="text-[var(--text-muted)]">সঠিক</span>
                  <span className="ml-auto font-semibold text-[var(--text)]">
                    {formatNumber(summary?.correct ?? 0)}
                  </span>
                </p>
                <p className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-red-500" aria-hidden />
                  <span className="text-[var(--text-muted)]">ভুল</span>
                  <span className="ml-auto font-semibold text-[var(--text)]">
                    {formatNumber(summary?.wrong ?? 0)}
                  </span>
                </p>
                <p className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-[var(--border-strong)]" aria-hidden />
                  <span className="text-[var(--text-muted)]">অনুত্তরিত</span>
                  <span className="ml-auto font-semibold text-[var(--text)]">
                    {formatNumber(summary?.unanswered ?? 0)}
                  </span>
                </p>
              </div>
            </div>
          </section>

          {/* Subject performance */}
          <section className="jh-card p-5">
            <h2 className="text-[0.875rem] font-semibold text-[var(--text)]">বিষয়ভিত্তিক পারফরম্যান্স</h2>
            {subjects.length === 0 ? (
              <p className="mt-2 text-[0.75rem] leading-relaxed text-[var(--text-subtle)]">
                উত্তর দেওয়া প্রশ্ন থেকে বিষয়ভিত্তিক নির্ভুলতা তৈরি হবে।
              </p>
            ) : (
              <ul className="mt-3.5 space-y-3">
                {subjects.slice(0, 4).map((subject) => (
                  <li key={subject.subject_id ?? subject.title_en}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[0.75rem] font-medium text-[var(--text)]">
                        {subject.title_bn}
                      </span>
                      <span className="shrink-0 text-[0.6875rem] font-semibold tabular-nums text-[var(--text-muted)]">
                        {formatPercent(subject.accuracy)}
                      </span>
                    </div>
                    <Progress
                      value={subject.accuracy}
                      className="mt-1.5"
                      tone={subject.accuracy >= 60 ? "success" : subject.accuracy >= 40 ? "brand" : "warning"}
                      label={subject.title_bn}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Weak topics / revision */}
          <section className="jh-card p-5">
            <h2 className="flex items-center gap-2 text-[0.875rem] font-semibold text-[var(--text)]">
              <AlertCircle className="size-4 text-[var(--brand)]" aria-hidden />
              রিভিশন প্রস্তাব
            </h2>
            {weakTopics.length === 0 ? (
              <p className="mt-2 text-[0.75rem] leading-relaxed text-[var(--text-subtle)]">
                আরও প্রশ্নের উত্তর দিলে আপনার দুর্বল টপিকগুলো এখানে দেখা যাবে — কোনো অনুমান নয়, শুধু
                আপনার নিজের ফলাফলের ভিত্তিতে।
              </p>
            ) : (
              <>
                <ul className="mt-3 space-y-2">
                  {weakTopics.map((topic) => (
                    <li key={topic.topic_id} className="rounded-xl bg-[var(--surface-muted)] px-3 py-2">
                      <p className="truncate text-[0.75rem] font-semibold text-[var(--text)]">{topic.title_bn}</p>
                      <p className="text-[0.625rem] text-[var(--text-subtle)]">
                        {topic.subject_bn} · {formatNumber(topic.attempted)} প্রশ্নে {formatPercent(topic.accuracy)}
                      </p>
                    </li>
                  ))}
                </ul>
                <ButtonLink
                  href={`/custom-exam?topic=${weakTopics[0].topic_id}`}
                  variant="secondary"
                  size="sm"
                  className="mt-3 w-full"
                >
                  <Sparkles className="size-3.5" aria-hidden />
                  দুর্বল টপিকে অনুশীলন
                </ButtonLink>
              </>
            )}
          </section>

          {/* Upcoming exams */}
          <section className="jh-card p-5">
            <h2 className="flex items-center gap-2 text-[0.875rem] font-semibold text-[var(--text)]">
              <Radio className="size-4 text-[var(--brand)]" aria-hidden />
              আসন্ন পরীক্ষা
            </h2>
            {upcomingExams.length === 0 ? (
              <p className="mt-2 text-[0.75rem] leading-relaxed text-[var(--text-subtle)]">
                এখন কোনো প্রকাশিত আসন্ন পরীক্ষা নেই। প্র্যাকটিস বা কাস্টম পরীক্ষা দিয়ে প্রস্তুতি
                চালিয়ে যান।
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {upcomingExams.map((exam) => (
                  <li key={exam.id} className="rounded-xl border border-[var(--border)] px-3 py-2">
                    <p className="truncate text-[0.75rem] font-semibold text-[var(--text)]">{exam.title_bn}</p>
                    <p className="mt-0.5 text-[0.625rem] text-[var(--text-subtle)]">
                      {formatDate(exam.starts_at)} · {formatTime(exam.starts_at)} থেকে
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <ButtonLink href="/exams" variant="ghost" size="sm" className="mt-2 w-full">
              পরীক্ষা কেন্দ্র
            </ButtonLink>
          </section>

          {targetCourse ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-subtle)]">
                আপনার লক্ষ্য কোর্স
              </p>
              <p className="mt-1 text-[0.875rem] font-semibold text-[var(--text)]">{targetCourse.title_bn}</p>
              <ButtonLink href={`/courses/${targetCourse.slug}`} variant="ghost" size="sm" className="mt-1 -ml-2">
                সিলেবাস দেখুন
                <ArrowRight className="size-3" aria-hidden />
              </ButtonLink>
            </div>
          ) : null}
        </div>
      </div>

      {/* Learning activity */}
      <section className="jh-card mt-5" aria-labelledby="activity-h">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3.5">
          <h2 id="activity-h" className="flex items-center gap-2 text-[0.875rem] font-semibold text-[var(--text)]">
            <Layers className="size-4 text-[var(--brand)]" aria-hidden />
            শেখার কার্যকলাপ
          </h2>
          <Badge tone="neutral">বাস্তব ডেটা</Badge>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          {[
            {
              icon: <CalendarCheck2 className="size-4" />,
              label: "আজকের রুটিন",
              value: `${formatNumber(todayRoutines.length)} আইটেম`,
            },
            {
              icon: <CircleCheck className="size-4" />,
              label: "প্রকাশিত ফলাফল",
              value: `${formatNumber(summary?.released ?? 0)} পরীক্ষা`,
            },
            {
              icon: <Target className="size-4" />,
              label: "সর্বোচ্চ স্কোর",
              value: formatNumber(summary?.best_score ?? 0),
            },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2.5 rounded-xl bg-[var(--surface-muted)] px-3 py-2.5">
              <span className="text-[var(--brand)]">{item.icon}</span>
              <div>
                <p className="text-[0.625rem] text-[var(--text-subtle)]">{item.label}</p>
                <p className="text-[0.8125rem] font-semibold text-[var(--text)]">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
