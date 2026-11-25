import type { Metadata } from "next";
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
import { CourseContextBar, QuickActions } from "@/components/dashboard/course-context";
import {
  ensureDefaultEnrollment, getStudentAnalytics, isFirstAdminSeatOpen, listCourses,
  listMyEnrollments, listMyResults, listPublishedSchedules, listRoutines, getOpenAttempts,
} from "@/lib/queries";
import { dhakaDateKey } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "ড্যাশবোর্ড" };

/**
 * Student dashboard — a thin orchestrator. All data is fetched here in one
 * parallel batch and handed to presentational section components in
 * `@/components/dashboard/*`; no section fetches on its own.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const params = await searchParams;

  const today = dhakaDateKey();
  const defaultCourseId = user.profile?.target_course_id ?? null;
  // Course context (Phase 2): ?course=all → combined view, ?course=<id> →
  // that course, otherwise the persisted default course. The default course
  // in the profile keeps the context across logins without extra state.
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const courseParam = params.course;
  const targetCourseId =
    courseParam === "all" ? null
    : courseParam && UUID.test(courseParam) ? courseParam
    : defaultCourseId;
  let enrollments = await listMyEnrollments(user.id);
  // Existing-student migration: profile has a course but no enrollment row.
  if (enrollments.length === 0 && defaultCourseId) {
    await ensureDefaultEnrollment(user.id, defaultCourseId);
    enrollments = await listMyEnrollments(user.id);
  }
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
  const targetCourse = courseList.find((c) => c.id === (targetCourseId ?? defaultCourseId)) ?? courseList[0];
  const activeEnrolledCourses = enrollments
    .filter((e) => e.status === "active")
    .map((e) => courseById.get(e.course_id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

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

      {activeEnrolledCourses.length > 0 ? (
        <CourseContextBar
          enrolledCourses={activeEnrolledCourses}
          selectedId={targetCourseId}
          defaultId={defaultCourseId}
        />
      ) : null}

      <ResumeBanner attempts={openAttempts as unknown as ResumeAttempt[]} courseById={courseById} now={now} />
      <LiveExamsBanner exams={liveExams} />
      <StatsGrid summary={summary} />

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

      <QuickActions />
    </div>
  );
}
