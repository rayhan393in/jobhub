import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, displayName, isStaff } from "@/lib/auth";
import { FirstAdminBanner } from "@/components/dashboard/first-admin-banner";
import { HeroSection } from "@/components/dashboard/hero-section";
import { ResumeBanner, LiveExamsBanner, type ResumeAttempt } from "@/components/dashboard/exam-banners";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { RecentResultsCard } from "@/components/dashboard/activity-cards";
import { WeakTopicsCard, UpcomingExamsCard } from "@/components/dashboard/insight-cards";
import { CourseContextBar, QuickActions } from "@/components/dashboard/course-context";
import { AiCoachCard, MasteryCard, StudyCalendarCard } from "@/components/dashboard/v7-cards";
import { ExamCountdownCard } from "@/components/dashboard/exam-countdown-card";
import { WeeklyTrendCard } from "@/components/dashboard/weekly-trend";
import {
  ensureDefaultEnrollment, getStudentAnalytics, isFirstAdminSeatOpen, listCourses,
  listMyActivityDays, listMyEnrollments, listMyResults, listMyRoutineProgress,
  listPublishedSchedules, listRoutines, getOpenAttempts,
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
  const [courseList, targetAnalytics, results, schedules, routines, openAttempts, adminSeatOpen, activityDays] = await Promise.all([
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
    listMyActivityDays(user.id),
  ]);
  const routineProgress = await listMyRoutineProgress(user.id, today);

  // Fallback: a student whose attempts all live outside the target course
  // (or who has no target set) should still see their real history rather
  // than an empty dashboard. Only costs a second RPC in that edge case.
  const analytics =
    targetCourseId && (targetAnalytics?.summary?.attempts ?? 0) === 0
      ? ((await getStudentAnalytics(null)) ?? targetAnalytics)
      : targetAnalytics;

  const names = displayName(user);
  const courseById = new Map(courseList.map((c) => [c.id, c]));
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

  // ---- V7 derived metrics (all from real records) --------------------
  // Daily goals: today's study tasks ticked off via routine_progress.
  const doneRoutineIds = new Set(
    routineProgress.filter((r) => r.status === "done" && r.routineId).map((r) => r.routineId),
  );
  const dailyGoals = todayStudy.slice(0, 6).map((r) => ({
    id: r.id,
    label: `${r.subject_title_bn ?? r.title_bn}${r.topic_title_bn ? ` — ${r.topic_title_bn}` : ""}`,
    done: doneRoutineIds.has(r.id),
  }));

  // Study streak: consecutive active days ending today/yesterday.
  const shiftDay = (key: string, delta: number) => {
    const [y, m, d] = key.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + delta);
    return dt.toISOString().slice(0, 10);
  };
  let streak = 0;
  let cursor = activityDays.has(today) ? today : shiftDay(today, -1);
  while (activityDays.has(cursor)) {
    streak += 1;
    cursor = shiftDay(cursor, -1);
  }
  const activeDays12w = activityDays.size;

  // Readiness: labeled estimate — accuracy (50%) + consistency (30%) +
  // practice volume (20%). null until the student has real attempts.
  const answeredTotal = (summary?.correct ?? 0) + (summary?.wrong ?? 0);
  const readiness = hasData
    ? Math.min(
        100,
        Math.round(
          0.5 * (summary?.avg_accuracy ?? 0) +
            0.3 * Math.min(100, (activeDays12w / 60) * 100) +
            0.2 * Math.min(100, answeredTotal / 10),
        ),
      )
    : null;
  const enrolledTitles = activeEnrolledCourses.map((c) => c.title_bn);

  return (
    <div className="w-full">
      {adminSeatOpen ? <FirstAdminBanner /> : null}

      <HeroSection
        nameBn={names.bn}
        summary={summary}
        hasData={hasData}
        todayStudy={todayStudy}
        liveExam={liveExam}
        todayExam={todayExam}
        enrolledTitles={enrolledTitles}
        goals={dailyGoals}
      />

      <CourseContextBar
        enrolledCourses={activeEnrolledCourses}
        selectedId={targetCourseId}
        defaultId={defaultCourseId}
      />

      <ResumeBanner attempts={openAttempts as unknown as ResumeAttempt[]} courseById={courseById} now={now} />
      <LiveExamsBanner exams={liveExams} />
      <StatsGrid summary={summary} streak={streak} activeDays={activeDays12w} readiness={readiness} />

      {/* Row A — সাপ্তাহিক ট্রেন্ড · দক্ষতা donut (আজকের রুটিন হিরোর Daily Goals-এই থাকে — ডুপ্লিকেট নয়) */}
      <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <WeeklyTrendCard weekly={weekly} hasData={hasData} />
        <MasteryCard subjects={subjects} />
      </div>

      {/* Row B — দুর্বল টপিক · আসন্ন পরীক্ষা · সর্বশেষ ফলাফল · AI কোচ */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
        <WeakTopicsCard weakTopics={weakTopics} almostThere={almostThere} hasData={hasData} />
        <UpcomingExamsCard exams={upcomingExams} />
        <RecentResultsCard results={results} courseById={courseById} />
        <div id="ai-coach" className="scroll-mt-20">
          <AiCoachCard weakTopics={weakTopics} summary={summary} todayRoutineCount={todayStudy.length} />
        </div>
      </div>

      {/* Row C — ক্যালেন্ডার · পরবর্তী পরীক্ষা কাউন্টডাউন · কুইক অ্যাকশন (mockup bottom) */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2 2xl:grid-cols-[1.3fr_1fr_1fr]">
        <div id="calendar" className="scroll-mt-20">
          <StudyCalendarCard activity={activityDays} today={today} />
        </div>
        {upcomingExams[0] ? (
          <ExamCountdownCard
            title={upcomingExams[0].title_bn ?? upcomingExams[0].title_en ?? "লাইভ পরীক্ষা"}
            courseTitle={courseById.get(upcomingExams[0].course_id)?.title_bn ?? null}
            startsAt={upcomingExams[0].starts_at}
            href={`/exams/${upcomingExams[0].id}`}
          />
        ) : null}
        <QuickActions compact />
      </div>
    </div>
  );
}
