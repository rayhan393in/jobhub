import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenCheck, Bookmark, CalendarDays, Layers } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentUser, displayName, isStaff } from "@/lib/auth";
import { FirstAdminBanner } from "@/components/dashboard/first-admin-banner";
import { HeroSection } from "@/components/dashboard/hero-section";
import { ResumeBanner, LiveExamsBanner, type ResumeAttempt } from "@/components/dashboard/exam-banners";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import {
  TodayRoutineCard, WeeklyProgressCard, RecentResultsCard, LearningActivityCard,
} from "@/components/dashboard/activity-cards";
import {
  AccuracyCard, SubjectPerformanceCard, WeakTopicsCard, UpcomingExamsCard, TargetCourseCard,
} from "@/components/dashboard/insight-cards";
import {
  getStudentAnalytics, isFirstAdminSeatOpen, listCourses, listMyResults, listPublishedSchedules,
  listRoutines, getOpenAttempts,
} from "@/lib/queries";
import { dhakaDateKey } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "ড্যাশবোর্ড" };

/**
 * Student dashboard — a thin orchestrator. All data is fetched here in one
 * parallel batch and handed to presentational section components in
 * `@/components/dashboard/*`; no section fetches on its own.
 */
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

  return (
    <div className="mx-auto w-full max-w-7xl">
      {adminSeatOpen ? <FirstAdminBanner /> : null}

      <HeroSection
        nameBn={names.bn}
        summary={summary}
        hasData={hasData}
        todayStudy={todayStudy}
        liveExam={liveExam}
        todayExam={todayExam}
      />

      <ResumeBanner attempts={openAttempts as unknown as ResumeAttempt[]} courseById={courseById} now={now} />
      <LiveExamsBanner exams={liveExams} />
      <StatsGrid summary={summary} />

      <section className="mt-5" aria-labelledby="student-quick-actions">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="student-quick-actions" className="text-[0.875rem] font-semibold text-[var(--text)]">
              দ্রুত শুরু করুন
            </h2>
            <p className="mt-0.5 text-[0.6875rem] text-[var(--text-subtle)]">
              {targetCourse ? `${targetCourse.title_bn} প্রস্তুতির জন্য প্রয়োজনীয় শর্টকাট` : "আপনার প্রস্তুতির প্রয়োজনীয় শর্টকাট"}
            </p>
          </div>
          {targetCourse ? (
            <Link href="/my-courses" className="text-[0.6875rem] font-semibold text-[var(--brand)] hover:underline">
              কোর্স পরিবর্তন বা দেখুন
            </Link>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Link href="/practice" className="group flex min-h-24 flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 transition hover:border-[var(--brand)] hover:shadow-sm">
            <span className="flex size-8 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]"><BookOpenCheck className="size-4" aria-hidden /></span>
            <span className="mt-2 text-[0.75rem] font-semibold text-[var(--text)]">প্র্যাকটিস</span>
          </Link>
          <Link href="/custom-exam" className="group flex min-h-24 flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 transition hover:border-[var(--brand)] hover:shadow-sm">
            <span className="flex size-8 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]"><Layers className="size-4" aria-hidden /></span>
            <span className="mt-2 text-[0.75rem] font-semibold text-[var(--text)]">কাস্টম পরীক্ষা</span>
          </Link>
          <Link href="/routines" className="group flex min-h-24 flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 transition hover:border-[var(--brand)] hover:shadow-sm">
            <span className="flex size-8 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]"><CalendarDays className="size-4" aria-hidden /></span>
            <span className="mt-2 text-[0.75rem] font-semibold text-[var(--text)]">স্টাডি রুটিন</span>
          </Link>
          <Link href="/bookmarks" className="group flex min-h-24 flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 transition hover:border-[var(--brand)] hover:shadow-sm">
            <span className="flex size-8 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]"><Bookmark className="size-4" aria-hidden /></span>
            <span className="mt-2 text-[0.75rem] font-semibold text-[var(--text)]">বুকমার্ক</span>
          </Link>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <TodayRoutineCard routines={todayRoutines} />
          <WeeklyProgressCard weekly={weekly} hasData={hasData} />
          <RecentResultsCard results={results} courseById={courseById} />
        </div>

        <div className="space-y-5">
          <AccuracyCard summary={summary} />
          <SubjectPerformanceCard subjects={subjects} />
          <WeakTopicsCard weakTopics={weakTopics} almostThere={almostThere} hasData={hasData} />
          <UpcomingExamsCard exams={upcomingExams} />
          <TargetCourseCard course={targetCourse} />
        </div>
      </div>

      <LearningActivityCard todayRoutineCount={todayRoutines.length} summary={summary} />
    </div>
  );
}
