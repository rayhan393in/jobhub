import "server-only";
import { getServerClient } from "./supabase/server";
import { getAdminClient } from "./supabase/admin";
import { hasServiceRole } from "./supabase/env";
import { flattenEmbeddedTitle } from "./postgrest";
import type {
  Course,
  ExamSchedule,
  Profile,
  Routine,
  StudentAnalytics,
  Subject,
  Topic,
  Subtopic,
  LeaderboardRow,
  MyRank,
  ResultHistoryRow,
} from "./types";

/**
 * Log a PostgREST error without changing the caller's fallback behaviour.
 * Every read in this file degrades to an empty result on failure so pages
 * never crash — but a silent empty state makes outages invisible. This puts
 * the signal in the server logs (Vercel) while keeping the UX graceful.
 */
function logDbError(scope: string, error: { message: string } | null): void {
  if (error) console.error(`[db:${scope}]`, error.message);
}

/** Public catalogue reads (RLS restricts to published courses). */
export async function listCourses(): Promise<Course[]> {
  const supabase = await getServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("courses")
    .select(
      "id, slug, title_en, title_bn, short_en, short_bn, summary_en, summary_bn, description_en, description_bn, level, icon, accent, duration_weeks, price_bdt, status, sort_order, exam_config",
    )
    .eq("status", "published")
    .order("sort_order");
  logDbError("courses", error);
  return (data ?? []) as Course[];
}

export async function getCourseBySlug(slug: string): Promise<Course | null> {
  const supabase = await getServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  logDbError("course-by-slug", error);
  return (data as Course) ?? null;
}

export async function listSubjects(courseId: string): Promise<Subject[]> {
  const supabase = await getServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("subjects")
    .select("id, course_id, slug, title_en, title_bn, chapter_group, sort_order")
    .eq("course_id", courseId)
    .eq("is_active", true)
    .order("sort_order");
  logDbError("subjects", error);
  return (data ?? []) as Subject[];
}

export async function listTopicsWithSubtopics(
  courseId: string,
): Promise<Array<Topic & { subtopics: Subtopic[] }>> {
  const supabase = await getServerClient();
  if (!supabase) return [];

  const { data: subjects, error: subjectsError } = await supabase
    .from("subjects")
    .select("id")
    .eq("course_id", courseId)
    .eq("is_active", true);
  logDbError("taxonomy-subjects", subjectsError);
  if (!subjects?.length) return [];

  const { data: topics, error: topicsError } = await supabase
    .from("topics")
    .select("id, subject_id, slug, title_en, title_bn, chapter, sort_order")
    .in(
      "subject_id",
      subjects.map((s) => s.id),
    )
    .eq("is_active", true)
    .order("sort_order");
  logDbError("taxonomy-topics", topicsError);
  if (!topics?.length) return [];

  const { data: subtopics, error: subtopicsError } = await supabase
    .from("subtopics")
    .select("id, topic_id, slug, title_en, title_bn, sort_order")
    .in(
      "topic_id",
      topics.map((t) => t.id),
    )
    .eq("is_active", true)
    .order("sort_order");
  logDbError("taxonomy-subtopics", subtopicsError);

  return (topics as Topic[]).map((topic) => ({
    ...topic,
    subtopics: ((subtopics ?? []) as Subtopic[]).filter((s) => s.topic_id === topic.id),
  }));
}

export type ScheduleWithCourse = ExamSchedule & {
  course?: { slug: string; title_bn: string; title_en: string };
  my_attempt_id?: string | null;
  my_status?: string | null;
};

/** Published exams with the visitor's own attempt state joined in. */
export async function listPublishedSchedules(options?: {
  courseId?: string;
  from?: string;
  limit?: number;
  userId?: string | null;
}): Promise<ScheduleWithCourse[]> {
  const supabase = await getServerClient();
  if (!supabase) return [];

  let query = supabase
    .from("exam_schedules")
    .select(
      "id, course_id, kind, title_en, title_bn, starts_at, ends_at, result_release_at, duration_minutes, question_count, total_marks, positive_marks, negative_marks, status, routine_id, settings, published_at, course:courses(slug, title_bn, title_en)",
    )
    .in("status", ["published", "completed"])
    .order("starts_at", { ascending: true })
    .limit(options?.limit ?? 60);

  if (options?.courseId) query = query.eq("course_id", options.courseId);
  if (options?.from) query = query.gte("ends_at", options.from);

  const { data, error } = await query;
  logDbError("schedules", error);
  const rows = (data ?? []) as unknown as ScheduleWithCourse[];
  if (!options?.userId || rows.length === 0) return rows;

  const { data: attempts, error: attemptsError } = await supabase
    .from("exam_attempts")
    .select("id, schedule_id, status")
    .eq("user_id", options.userId)
    .in(
      "schedule_id",
      rows.map((r) => r.id),
    );
  logDbError("schedule-attempts", attemptsError);

  const map = new Map((attempts ?? []).map((a) => [a.schedule_id as string, a]));
  return rows.map((row) => {
    const attempt = map.get(row.id);
    return { ...row, my_attempt_id: attempt?.id ?? null, my_status: attempt?.status ?? null };
  });
}

export async function listRoutines(options?: {
  courseId?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}): Promise<Routine[]> {
  const supabase = await getServerClient();
  if (!supabase) return [];
  let query = supabase
    .from("routines")
    .select(
      "id, course_id, kind, routine_date, title_en, title_bn, subject_id, topic_id, subtopic_id, topic_ids, subtopic_ids, minutes, focus_note_bn, status, slot_label, target_bn, task_kind, subject_title_bn:subjects(title_bn), topic_title_bn:topics(title_bn), subtopic_title_bn:subtopics(title_bn)",
    )
    .eq("status", "published")
    .order("routine_date", { ascending: true })
    .order("slot_label", { ascending: true, nullsFirst: false })
    .limit(options?.limit ?? 60);
  if (options?.courseId) query = query.eq("course_id", options.courseId);
  if (options?.fromDate) query = query.gte("routine_date", options.fromDate);
  if (options?.toDate) query = query.lte("routine_date", options.toDate);
  const { data, error } = await query;
  logDbError("routines", error);

  // Multi-topic rows carry id arrays; resolve all names in two batched lookups.
  const extraTopicIds = new Set<string>();
  const extraSubtopicIds = new Set<string>();
  for (const row of data ?? []) {
    for (const id of (row.topic_ids as string[] | null) ?? []) extraTopicIds.add(id);
    for (const id of (row.subtopic_ids as string[] | null) ?? []) extraSubtopicIds.add(id);
  }
  const topicNames = new Map<string, string>();
  const subtopicNames = new Map<string, string>();
  if (extraTopicIds.size > 0) {
    const { data: rows, error: err } = await supabase.from("topics").select("id, title_bn").in("id", [...extraTopicIds]);
    logDbError("routine-topic-names", err);
    for (const row of rows ?? []) topicNames.set(row.id, row.title_bn);
  }
  if (extraSubtopicIds.size > 0) {
    const { data: rows, error: err } = await supabase.from("subtopics").select("id, title_bn").in("id", [...extraSubtopicIds]);
    logDbError("routine-subtopic-names", err);
    for (const row of rows ?? []) subtopicNames.set(row.id, row.title_bn);
  }

  return (data ?? []).map((row) => ({
    ...row,
    subject_title_bn: flattenEmbeddedTitle(row.subject_title_bn),
    topic_title_bn: flattenEmbeddedTitle(row.topic_title_bn),
    subtopic_title_bn: flattenEmbeddedTitle(row.subtopic_title_bn),
    topic_titles_bn: (((row.topic_ids as string[] | null) ?? [])
      .map((id) => topicNames.get(id))
      .filter(Boolean) ?? []) as string[],
    subtopic_titles_bn: (((row.subtopic_ids as string[] | null) ?? [])
      .map((id) => subtopicNames.get(id))
      .filter(Boolean) ?? []) as string[],
  })) as unknown as Routine[];
}

export type PlanTopicPair = {
  routine_id: string | null;
  course_id: string;
  topic_title_bn: string | null;
  subtopic_title_bn: string | null;
};

/**
 * First-study assignments resolved to Bengali titles, keyed by routine row.
 * This is the authoritative Topic → Subtopic pairing for the printable
 * routine: the per-row id arrays on `routines` lose the association between
 * a subtopic and its parent topic, while assignments keep it exact.
 */
export async function listStudyPlanTopicPairs(courseIds: string[]): Promise<PlanTopicPair[]> {
  const supabase = await getServerClient();
  if (!supabase || courseIds.length === 0) return [];
  const { data, error } = await supabase
    .from("study_plan_assignments")
    .select(
      "routine_id, course_id, topic_title_bn:topics(title_bn), subtopic_title_bn:subtopics(title_bn)",
    )
    .in("course_id", courseIds)
    .not("routine_id", "is", null)
    .order("first_study_date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(2000);
  logDbError("plan-topic-pairs", error);
  return (data ?? []).map((row) => ({
    routine_id: row.routine_id as string | null,
    course_id: row.course_id as string,
    topic_title_bn: flattenEmbeddedTitle(row.topic_title_bn),
    subtopic_title_bn: flattenEmbeddedTitle(row.subtopic_title_bn),
  }));
}

export type StudentPlanRow = {
  id: string;
  course_id: string;
  routine_date: string;
  plan_day: number;
  plan_kind: "study" | "revision" | "rest";
  title_bn: string;
  minutes: number;
  focus_note_bn: string | null;
  topic_title_bn: string | null;
  course_title_bn: string | null;
};

/**
 * The signed-in student's own saved study plan. RLS already restricts these rows
 * to the owner; the explicit `eq("user_id", …)` is belt-and-braces and keeps the
 * query honest if the client is ever swapped for the service role.
 */
export async function listMyStudentRoutines(userId: string, courseId?: string): Promise<StudentPlanRow[]> {
  const supabase = await getServerClient();
  if (!supabase) return [];
  let query = supabase
    .from("student_routines")
    .select(
      "id, course_id, routine_date, plan_day, plan_kind, title_bn, minutes, focus_note_bn, topic_title_bn:topics(title_bn), course_title_bn:courses(title_bn)",
    )
    .eq("user_id", userId)
    .order("routine_date");
  if (courseId) query = query.eq("course_id", courseId);
  const { data, error } = await query;
  logDbError("student-routines", error);
  return (data ?? []).map((row) => ({
    ...row,
    topic_title_bn: flattenEmbeddedTitle(row.topic_title_bn),
    course_title_bn: flattenEmbeddedTitle(row.course_title_bn),
  })) as unknown as StudentPlanRow[];
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await getServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  logDbError("profile", error);
  return (data as Profile) ?? null;
}

/** One row of the student's course enrollments (Phase 1 multi-course). */
export type EnrollmentRow = {
  id: string;
  course_id: string;
  status: "active" | "paused";
  enrolled_at: string;
};

/**
 * All enrollments of a student, newest first. RLS limits reads to the
 * student's own rows, so no explicit user filter beyond `student_id` is
 * strictly required — it is passed anyway for clarity and index usage.
 */
export async function listMyEnrollments(userId: string): Promise<EnrollmentRow[]> {
  const supabase = await getServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("student_course_enrollments")
    .select("id, course_id, status, enrolled_at")
    .eq("student_id", userId)
    .order("enrolled_at", { ascending: true });
  logDbError("enrollments", error);
  return (data as EnrollmentRow[]) ?? [];
}

/**
 * Safe migration for pre-multi-course students: if the profile has a
 * default course but no enrollment row yet, create one. Idempotent
 * (unique student+course) and RLS-scoped to the student's own row.
 */
export async function ensureDefaultEnrollment(userId: string, courseId: string): Promise<void> {
  const supabase = await getServerClient();
  if (!supabase) return;
  const { error } = await supabase
    .from("student_course_enrollments")
    .upsert(
      { student_id: userId, course_id: courseId },
      { onConflict: "student_id,course_id", ignoreDuplicates: true },
    );
  logDbError("ensure-enrollment", error);
}

export async function getStudentAnalytics(courseId?: string | null): Promise<StudentAnalytics | null> {
  const supabase = await getServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("jh_student_analytics", {
    p_course_id: courseId ?? null,
  });
  if (error) {
    console.error("[analytics]", error.message);
    return null;
  }
  return data as StudentAnalytics;
}

/**
 * Persist `is_released` on results/attempts whose schedule's publication time
 * has passed. Best-effort and idempotent — readers also compute release
 * dynamically, so a failure here never hides a due result.
 */
export async function releaseDueResults(): Promise<void> {
  const supabase = await getServerClient();
  if (!supabase) return;
  const { error } = await supabase.rpc("jh_release_due_results");
  if (error) console.error("[release-sweep]", error.message);
}

export async function getLeaderboard(params: {
  scope: "daily" | "weekly" | "course" | "exam";
  courseId?: string | null;
  scheduleId?: string | null;
  limit?: number;
}): Promise<LeaderboardRow[]> {
  const supabase = await getServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("jh_leaderboard", {
    p_scope: params.scope,
    p_course_id: params.courseId ?? null,
    p_schedule_id: params.scheduleId ?? null,
    p_limit: params.limit ?? 20,
  });
  if (error) {
    console.error("[leaderboard]", error.message);
    return [];
  }
  return (data ?? []) as LeaderboardRow[];
}

/**
 * The signed-in student's true rank in a leaderboard scope — even when they
 * are outside the top-N window the list shows. `rank: null` means they have
 * no released result in this scope yet.
 */
export async function getMyRank(params: {
  scope: "daily" | "weekly" | "course" | "exam";
  courseId?: string | null;
  scheduleId?: string | null;
}): Promise<MyRank | null> {
  const supabase = await getServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("jh_my_rank", {
    p_scope: params.scope,
    p_course_id: params.courseId ?? null,
    p_schedule_id: params.scheduleId ?? null,
  });
  if (error) {
    console.error("[my-rank]", error.message);
    return null;
  }
  return (data as MyRank) ?? null;
}

export type CourseTaxonomy = Record<
  string,
  {
    subjects: { id: string; title_bn: string; title_en: string }[];
    topics: {
      id: string;
      subject_id: string;
      title_bn: string;
      title_en: string;
      subtopics: { id: string; title_bn: string }[];
    }[];
  }
>;

/**
 * Subjects + topics + subtopics for every published course in ONE round-trip,
 * keyed by course id. Replaces the per-course fan-out (2 queries × courses +
 * 3 sequential queries inside listTopicsWithSubtopics).
 */
export async function getCourseTaxonomy(): Promise<CourseTaxonomy> {
  const supabase = await getServerClient();
  if (!supabase) return {};
  const { data, error } = await supabase.rpc("jh_course_taxonomy");
  if (error) {
    console.error("[taxonomy]", error.message);
    return {};
  }
  return (data as CourseTaxonomy) ?? {};
}

/**
 * Study-activity days for the calendar/streak card: Dhaka-local date keys
 * of every exam attempt in the last `days` days, with a per-day count.
 */
export async function listMyActivityDays(
  userId: string,
  days = 84,
): Promise<Map<string, number>> {
  const supabase = await getServerClient();
  const result = new Map<string, number>();
  if (!supabase) return result;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("exam_attempts")
    .select("started_at")
    .eq("user_id", userId)
    .gte("started_at", since)
    .order("started_at", { ascending: true })
    .limit(2000);
  logDbError("activity-days", error);
  for (const row of (data as { started_at: string }[]) ?? []) {
    const key = dhakaDateKeyOf(new Date(row.started_at));
    result.set(key, (result.get(key) ?? 0) + 1);
  }
  return result;
}

/** Dhaka-local YYYY-MM-DD for a Date (queries-local copy to avoid a cycle). */
function dhakaDateKeyOf(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(date);
}

/**
 * Today's routine-slot completion for the hero Daily Goals checklist.
 * Reads the student's own routine_progress rows (RLS-scoped) for one
 * Dhaka-local date and returns the set of completed routine ids.
 */
export async function listMyRoutineProgress(
  userId: string,
  dateKey: string,
): Promise<{ routineId: string | null; topicId: string | null; status: string }[]> {
  const supabase = await getServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("routine_progress")
    .select("routine_id, topic_id, status")
    .eq("user_id", userId)
    .eq("progress_date", dateKey)
    .limit(100);
  logDbError("routine-progress", error);
  return ((data as { routine_id: string | null; topic_id: string | null; status: string }[]) ?? []).map(
    (row) => ({ routineId: row.routine_id, topicId: row.topic_id, status: row.status }),
  );
}

export async function listMyAttempts(userId: string, limit = 20) {
  const supabase = await getServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("exam_attempts")
    .select(
      "id, course_id, mode, status, started_at, deadline_at, submitted_at, total_questions, total_marks, score, accuracy, correct_count, wrong_count, unanswered_count, is_released, schedule_id",
    )
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(limit);
  logDbError("my-attempts", error);
  return data ?? [];
}

export async function getOpenAttempts(userId: string) {
  const supabase = await getServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("exam_attempts")
    .select("id, course_id, mode, status, started_at, deadline_at, total_questions, total_marks, schedule_id")
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(5);
  logDbError("open-attempts", error);
  return data ?? [];
}

export async function listMyResults(userId: string, limit = 10): Promise<ResultHistoryRow[]> {
  const supabase = await getServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("results")
    .select(
      "id, attempt_id, score, total_marks, accuracy, correct_count, wrong_count, unanswered_count, is_released, course_id, schedule_id, created_at",
    )
    .eq("user_id", userId)
    .eq("is_released", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  logDbError("my-results", error);
  return (data ?? []).map((r) => ({
    attempt_id: r.attempt_id as string,
    result_id: r.id as string,
    score: Number(r.score),
    total_marks: Number(r.total_marks),
    accuracy: Number(r.accuracy ?? 0),
    correct: r.correct_count as number,
    wrong: r.wrong_count as number,
    unanswered: r.unanswered_count as number,
    mode: "scheduled" as const,
    is_released: true,
    submitted_at: r.created_at as string,
    title_bn: null,
    title_en: null,
    course_id: r.course_id as string,
  }));
}

/**
 * True while the platform has no staff member, so the sign-in screen can offer
 * the one-time first-admin claim. Never throws: a database hiccup just hides
 * the panel instead of breaking the login page.
 */
export async function isFirstAdminSeatOpen(): Promise<boolean> {
  const supabase = await getServerClient();
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("jh_admin_seat_available");
  if (error) return false;
  return data === true;
}

/**
 * Verified-question and subject counts per course. Uses the service-role client
 * because `questions` is never readable by students directly; only aggregates
 * leave this function. Returns `{}` when the service role is not configured.
 */
export async function getCourseCounts(): Promise<
  Record<string, { subjects: number; questions: number }>
> {
  const counts: Record<string, { subjects: number; questions: number }> = {};
  if (!hasServiceRole) return counts;
  try {
    const admin = getAdminClient();
    const [{ data: subjects }, { data: questions }] = await Promise.all([
      admin.from("subjects").select("course_id").eq("is_active", true),
      admin.from("questions").select("course_id").eq("status", "approved").eq("is_verified", true),
    ]);
    for (const row of subjects ?? []) {
      const id = row.course_id as string;
      counts[id] = { subjects: (counts[id]?.subjects ?? 0) + 1, questions: counts[id]?.questions ?? 0 };
    }
    for (const row of questions ?? []) {
      const id = row.course_id as string;
      counts[id] = { subjects: counts[id]?.subjects ?? 0, questions: (counts[id]?.questions ?? 0) + 1 };
    }
  } catch (error) {
    console.error("[courses] count query failed:", (error as Error).message);
  }
  return counts;
}
