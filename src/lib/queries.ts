import "server-only";
import { getServerClient } from "./supabase/server";
import { getAdminClient } from "./supabase/admin";
import { hasServiceRole } from "./supabase/env";
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
  ResultHistoryRow,
} from "./types";

/** Public catalogue reads (RLS restricts to published courses). */
export async function listCourses(): Promise<Course[]> {
  const supabase = await getServerClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("courses")
    .select(
      "id, slug, title_en, title_bn, short_en, short_bn, summary_en, summary_bn, description_en, description_bn, level, icon, accent, duration_weeks, price_bdt, status, sort_order, exam_config",
    )
    .eq("status", "published")
    .order("sort_order");
  return (data ?? []) as Course[];
}

export async function getCourseBySlug(slug: string): Promise<Course | null> {
  const supabase = await getServerClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("courses")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return (data as Course) ?? null;
}

export async function listSubjects(courseId: string): Promise<Subject[]> {
  const supabase = await getServerClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("subjects")
    .select("id, course_id, slug, title_en, title_bn, chapter_group, sort_order")
    .eq("course_id", courseId)
    .eq("is_active", true)
    .order("sort_order");
  return (data ?? []) as Subject[];
}

export async function listTopicsWithSubtopics(
  courseId: string,
): Promise<Array<Topic & { subtopics: Subtopic[] }>> {
  const supabase = await getServerClient();
  if (!supabase) return [];

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id")
    .eq("course_id", courseId)
    .eq("is_active", true);
  if (!subjects?.length) return [];

  const { data: topics } = await supabase
    .from("topics")
    .select("id, subject_id, slug, title_en, title_bn, chapter, sort_order")
    .in(
      "subject_id",
      subjects.map((s) => s.id),
    )
    .eq("is_active", true)
    .order("sort_order");
  if (!topics?.length) return [];

  const { data: subtopics } = await supabase
    .from("subtopics")
    .select("id, topic_id, slug, title_en, title_bn, sort_order")
    .in(
      "topic_id",
      topics.map((t) => t.id),
    )
    .eq("is_active", true)
    .order("sort_order");

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

  const { data } = await query;
  const rows = (data ?? []) as unknown as ScheduleWithCourse[];
  if (!options?.userId || rows.length === 0) return rows;

  const { data: attempts } = await supabase
    .from("exam_attempts")
    .select("id, schedule_id, status")
    .eq("user_id", options.userId)
    .in(
      "schedule_id",
      rows.map((r) => r.id),
    );

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
      "id, course_id, kind, routine_date, title_en, title_bn, subject_id, topic_id, subtopic_id, minutes, focus_note_bn, status, subject_title_bn:subjects(title_bn), topic_title_bn:topics(title_bn)",
    )
    .eq("status", "published")
    .order("routine_date", { ascending: true })
    .limit(options?.limit ?? 60);
  if (options?.courseId) query = query.eq("course_id", options.courseId);
  if (options?.fromDate) query = query.gte("routine_date", options.fromDate);
  if (options?.toDate) query = query.lte("routine_date", options.toDate);
  const { data } = await query;
  return (data ?? []) as unknown as Routine[];
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await getServerClient();
  if (!supabase) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  return (data as Profile) ?? null;
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

export async function listMyAttempts(userId: string, limit = 20) {
  const supabase = await getServerClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("exam_attempts")
    .select(
      "id, course_id, mode, status, started_at, deadline_at, submitted_at, total_questions, total_marks, score, accuracy, correct_count, wrong_count, unanswered_count, is_released, schedule_id",
    )
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getOpenAttempts(userId: string) {
  const supabase = await getServerClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("exam_attempts")
    .select("id, course_id, mode, status, started_at, deadline_at, total_questions, total_marks, schedule_id")
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(5);
  return data ?? [];
}

export async function listMyResults(userId: string, limit = 10): Promise<ResultHistoryRow[]> {
  const supabase = await getServerClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("results")
    .select(
      "id, attempt_id, score, total_marks, accuracy, correct_count, wrong_count, unanswered_count, is_released, course_id, schedule_id, created_at",
    )
    .eq("user_id", userId)
    .eq("is_released", true)
    .order("created_at", { ascending: false })
    .limit(limit);
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
