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
import { getCurrentUser, displayName, isStaff } from "@/lib/auth";
import { FirstAdminBanner } from "@/components/dashboard/first-admin-banner";
import { AttemptCountdown } from "@/components/dashboard/attempt-countdown";
import {
  getStudentAnalytics, isFirstAdminSeatOpen, listCourses, listMyResults, listPublishedSchedules,
  listRoutines, getOpenAttempts,
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
  const targetCourseId = user.profile?.target_course_id ?? null;
  const [courseList, targetAnalytics, results, schedules, routines, openAttempts, adminSeatOpen] = await Promise.all([
    listCourses(),
    // Scope analytics to the student's target course so BCS and Petrobangla
    // numbers never blend into one misleading average.
    getStudentAnalytics(targetCourseId),
    listMyResults(user.id, 5),
    // Server-side date filter: only exams that have not ended yet. Without it
    // the ascending limit-20 window fills with past schedules late in a season
    // and today's live exam silently drops off the dashboard.
    listPublishedSchedules({ userId: user.id, limit: 20, from: new Date().toISOString() }),
    // Routines scoped to the target course so another course's plan never
    // leaks into this student's hero chips.
    listRoutines({ fromDate: today, courseId: targetCourseId ?? undefined, limit: 10 }),
    getOpenAttempts(user.id),
    // Only query this for non-staff: it is a cheap check but pointless for staff.
    isStaff(user.role) ? Promise.resolve(false) : isFirstAdminSeatOpen(),
  ]);

  // Fallback: a student whose attempts all live outside the target course
  // (or who has no target set) should still see their real history rather
  // than an empty dashboard. Only costs a second RPC in that edge case.
  const analytics =
    targetCourseId && (targetAnalytics?.summary?.attempts ?? 0) === 0
      ? ((await getStudentAnalytics(null)) ?? targetAnalytics)
      : targetAnalytics;

  const names = displayName(user);
  const courseById = new Map(courseList.map((c) => [c.id, c]));
  const targetCourse = courseList.find((c) => c.id === user.profile?.target_course_id) ?? courseList[0];

  const now = Date.now();
  const liveExams = schedules.filter(
    (s) => new Date(s.starts_at).getTime() <= now && new Date(s.ends_at).getTime() > now,
  );
  const upcomingExams = schedules.filter((s) => new Date(s.starts_at).getTime() > now).slice(0, 3);
  const todayRoutines = routines.filter((r) => r.routine_date === today);
  const todayStudy = todayRoutines.filter((r) => r.task_kind !== "exam");
  const liveExam = liveExams[0] ?? null;
  const todayExam =
    liveExam ??
    schedules.find(
      (s) => dhakaDateKey(new Date(s.starts_at)) === today && new Date(s.ends_at).getTime() > now,
    ) ??
    null;

  const summary = analytics?.summary;
  // A topic only counts as "weak" with at least 3 attempted questions —
  // one wrong answer out of one question is noise, not a diagnosis. Topics
  // already arrive sorted by accuracy ascending from the RPC.
  const WEAK_TOPIC_MIN_ATTEMPTS = 3;
  const weakTopics = (analytics?.topics ?? [])
    .filter((t) => t.attempted >= WEAK_TOPIC_MIN_ATTEMPTS && t.accuracy < 80)
    .slice(0, 3);
  // How many more answers until the suggestion engine has enough signal.
  const almostThere = (analytics?.topics ?? []).some(
    (t) => t.attempted >= 1 && t.attempted < WEAK_TOPIC_MIN_ATTEMPTS,
  );
  const subjects = analytics?.subjects ?? [];
  const hasData = Boolean(summary && summary.attempts > 0);
  const weekly = analytics?.weekly ?? [];
  const maxWeekly = Math.max(1, ...weekly.map((w) => w.score));

  return (
    <div className="mx-auto w-full max-w-7xl">
      {adminSeatOpen ? <FirstAdminBanner /> : null}

      {/* Hero: greeting + today's plan + quick actions */}
      <section
        aria-labelledby="hero-h"
        className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[#1e1856] via-[#171242] to-[#0d0a2b] text-white shadow-[0_24px_50px_-20px_rgba(23,18,66,0.65)]"
      >
        {/* Colored light: depth without noise — a violet sun top-right, an indigo ember bottom-left. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-32 size-[26rem] rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.35),transparent_65%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-36 -left-24 size-[24rem] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.4),transparent_65%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/3 top-0 h-px w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent"
        />
        <HeroBooksArt />
        <div className="relative z-10 max-w-3xl px-5 py-6 sm:px-8 sm:py-8">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-violet-200">
            <CalendarDays className="size-3" aria-hidden />
            {formatDate(new Date(), "bn", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 id="hero-h" className="font-bangla mt-2.5 text-[1.375rem] font-bold leading-snug sm:text-[1.625rem]">
            {greeting("bn")}, <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-amber-200 bg-clip-text text-transparent">{names.bn}</span>
          </h1>
          <p className="font-bangla mt-1.5 max-w-xl text-[0.8125rem] leading-relaxed text-indigo-100/95">
            {hasData
              ? `আপনি এখন পর্যন্ত ${formatNumber(summary?.attempts ?? 0)}টি পরীক্ষা সম্পন্ন করেছেন। গড় নির্ভুলতা ${formatPercent(summary?.avg_accuracy ?? 0)}।`
              : "আপনার প্রস্তুতির যাত্রা শুরু হোক। প্রথম পরীক্ষা দিলেই এখানে বাস্তব বিশ্লেষণ দেখা যাবে।"}
          </p>

          {/* আজ যা পড়বেন */}
          <div className="mt-4">
            <p className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-white">
              <BookOpenCheck className="size-3.5 text-amber-300" aria-hidden />
              আজ যা পড়বেন
            </p>
            {todayStudy.length === 0 ? (
              <p className="mt-1.5 text-[0.75rem] text-indigo-200/90">
                আজকের জন্য প্রকাশিত রুটিন নেই — প্র্যাকটিস দিয়ে প্রস্তুতি চালিয়ে যান।
              </p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {todayStudy.slice(0, 4).map((routine) => (
                  <li
                    key={routine.id}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.14] px-3 py-1 text-[0.75rem] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-sm"
                  >
                    <span className="size-1.5 shrink-0 rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400" aria-hidden />
                    <span className="truncate">
                      {routine.subject_title_bn ?? routine.title_bn ?? "পড়ার পরিকল্পনা"}
                      {routine.topic_title_bn ? ` — ${routine.topic_title_bn}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Quick actions */}
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <Link
              href="/practice"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-[0.8125rem] font-bold text-[#171242] shadow-[0_8px_20px_-8px_rgba(255,255,255,0.5)] transition hover:-translate-y-0.5 hover:bg-violet-50"
            >
              <Play className="size-3.5" aria-hidden />
              প্র্যাকটিস শুরু
            </Link>
            {liveExam ? (
              <Link
                href={liveExam.my_attempt_id ? `/exam/${liveExam.my_attempt_id}` : `/exams/${liveExam.id}`}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-red-500 px-4 py-2.5 text-[0.8125rem] font-bold text-white shadow-[0_8px_20px_-8px_rgba(244,63,94,0.7)] transition hover:-translate-y-0.5 hover:brightness-110"
              >
                <span className="relative flex size-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-white" />
                </span>
                লাইভ পরীক্ষা চলছে — অংশ নিন
              </Link>
            ) : todayExam ? (
              <Link
                href={`/exams/${todayExam.id}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300/50 bg-amber-400/15 px-4 py-2.5 text-[0.8125rem] font-bold text-amber-200 backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-amber-400/25"
              >
                <Radio className="size-3.5" aria-hidden />
                আজকের লাইভ পরীক্ষা · {formatTime(todayExam.starts_at)} থেকে
              </Link>
            ) : (
              <Link
                href="/exams"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/[0.12] px-4 py-2.5 text-[0.8125rem] font-bold text-white backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white/20"
              >
                <Radio className="size-3.5" aria-hidden />
                পরীক্ষা কেন্দ্র
              </Link>
            )}
          </div>
        </div>
      </section>

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
                      <AttemptCountdown deadline={attempt.deadline_at as string} />
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
                {almostThere
                  ? "প্রতি টপিকে অন্তত ৩টি প্রশ্নের উত্তর দিলে নির্ভরযোগ্য দুর্বলতা-বিশ্লেষণ এখানে দেখা যাবে — আর অল্প কিছু প্রশ্ন বাকি!"
                  : hasData
                    ? "দারুণ! এখন পর্যন্ত কোনো টপিকে উল্লেখযোগ্য দুর্বলতা ধরা পড়েনি। অনুশীলন চালিয়ে যান।"
                    : "আরও প্রশ্নের উত্তর দিলে আপনার দুর্বল টপিকগুলো এখানে দেখা যাবে — কোনো অনুমান নয়, শুধু আপনার নিজের ফলাফলের ভিত্তিতে।"}
              </p>
            ) : (
              <>
                <ul className="mt-3 space-y-2">
                  {weakTopics.map((topic) => (
                    <li key={topic.topic_id} className="rounded-xl bg-[var(--surface-muted)] px-3 py-2">
                      <p className="truncate text-[0.75rem] font-semibold text-[var(--text)]">{topic.title_bn}</p>
                      <p className="text-[0.625rem] text-[var(--text-subtle)]">
                        {topic.subject_bn} · {formatNumber(topic.attempted)}টির মধ্যে{" "}
                        {formatNumber(topic.correct)}টি সঠিক ({formatPercent(topic.accuracy)})
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

/** Decorative book/study illustration on the right side of the hero (inline SVG, no external assets). */
function HeroBooksArt() {
  return (
    <svg
      viewBox="0 0 520 360"
      aria-hidden
      className="pointer-events-none absolute -right-6 bottom-0 hidden h-full w-auto select-none md:block"
      fill="none"
    >
      {/* soft glow circles */}
      <circle cx="400" cy="90" r="150" fill="white" fillOpacity="0.08" />
      <circle cx="430" cy="300" r="190" fill="white" fillOpacity="0.09" />
      <circle cx="320" cy="60" r="60" fill="white" fillOpacity="0.1" />
      {/* stacked books */}
      <g opacity="0.9">
        <rect x="258" y="268" width="196" height="30" rx="7" fill="white" fillOpacity="0.65" />
        <rect x="272" y="236" width="168" height="30" rx="7" fill="white" fillOpacity="0.65" />
        <rect x="286" y="204" width="140" height="30" rx="7" fill="white" fillOpacity="0.65" />
        <rect x="300" y="248" width="8" height="18" rx="2" fill="#a78bfa" fillOpacity="0.55" />
        <rect x="330" y="216" width="8" height="18" rx="2" fill="#a78bfa" fillOpacity="0.55" />
        <rect x="290" y="280" width="8" height="18" rx="2" fill="#a78bfa" fillOpacity="0.55" />
      </g>
      {/* open book */}
      <g opacity="0.95">
        <path
          d="M268 160c28-14 62-18 88-10v46c-26-8-60-4-88 10v-46z"
          fill="white"
          fillOpacity="0.7"
        />
        <path
          d="M444 160c-28-14-62-18-88-10v46c26-8 60-4 88 10v-46z"
          fill="white"
          fillOpacity="0.4"
        />
        <path d="M356 150v46" stroke="white" strokeOpacity="0.85" strokeWidth="3" strokeLinecap="round" />
        <path d="M282 166c20-8 44-11 62-7M282 180c20-8 44-11 62-7" stroke="#a78bfa" strokeOpacity="0.6" strokeWidth="3" strokeLinecap="round" />
        <path d="M430 166c-20-8-44-11-62-7M430 180c-20-8-44-11-62-7" stroke="#a78bfa" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round" />
      </g>
      {/* graduation cap */}
      <g opacity="0.9">
        <path d="M356 74l62 24-62 24-62-24 62-24z" fill="white" fillOpacity="0.75" />
        <path d="M332 108v22c0 7 11 13 24 13s24-6 24-13v-22" stroke="white" strokeOpacity="0.7" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d="M414 100v26" stroke="white" strokeOpacity="0.75" strokeWidth="4" strokeLinecap="round" />
        <circle cx="414" cy="132" r="5" fill="white" fillOpacity="0.85" />
      </g>
      {/* pencil */}
      <g opacity="0.75">
        <rect x="200" y="226" width="64" height="12" rx="4" transform="rotate(-32 200 226)" fill="white" fillOpacity="0.55" />
        <path d="M196 232l-10 14 17-3-7-11z" fill="white" fillOpacity="0.75" />
      </g>
      {/* sparkles */}
      <path d="M250 96l3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8z" fill="white" fillOpacity="0.65" />
      <path d="M470 196l2.5 6.5 6.5 2.5-6.5 2.5-2.5 6.5-2.5-6.5-6.5-2.5 6.5-2.5 2.5-6.5z" fill="white" fillOpacity="0.55" />
    </svg>
  );
}
