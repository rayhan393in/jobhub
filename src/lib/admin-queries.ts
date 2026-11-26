import "server-only";
import { getServerClient } from "./supabase/server";
import { getAdminClient } from "./supabase/admin";
import { hasServiceRole } from "./supabase/env";

/** Bangladesh has been a fixed UTC+6 with no DST since 2010. */
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

/**
 * Staff reads. RLS already allows staff to read the rows they need, so the
 * normal cookie-bound client is preferred; the service-role client is only used
 * for aggregate counts that would otherwise need many round-trips.
 */
export type AdminOverview = {
  questions: { total: number; draft: number; pending: number; approved: number; rejected: number; archived: number; verified: number; aiUnverified: number };
  courses: number;
  subjects: number;
  topics: number;
  students: number;
  staff: number;
  schedules: { draft: number; published: number; completed: number };
  attempts: { total: number; inProgress: number; submitted: number };
  routines: { draft: number; published: number };
  importBatches: number;
  recentAudit: AuditRow[];
};

export type AuditRow = {
  id: number;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  actor?: { full_name: string | null; full_name_bn: string | null; role_id: string } | null;
};

export async function getAdminOverview(): Promise<AdminOverview | null> {
  const supabase = await getServerClient();
  if (!supabase) return null;

  const head = { count: "exact" as const, head: true };
  const [
    qTotal, qDraft, qPending, qApproved, qRejected, qArchived, qVerified, qAi,
    courses, subjects, topics, students, staff,
    sDraft, sPublished, sCompleted,
    aTotal, aInProgress, aSubmitted,
    rDraft, rPublished, batches,
  ] = await Promise.all([
    supabase.from("questions").select("id", head),
    supabase.from("questions").select("id", head).eq("status", "draft"),
    supabase.from("questions").select("id", head).eq("status", "pending_review"),
    supabase.from("questions").select("id", head).eq("status", "approved"),
    supabase.from("questions").select("id", head).eq("status", "rejected"),
    supabase.from("questions").select("id", head).eq("status", "archived"),
    supabase.from("questions").select("id", head).eq("is_verified", true),
    supabase.from("questions").select("id", head).eq("source_type", "ai_assisted").eq("is_verified", false),
    supabase.from("courses").select("id", head),
    supabase.from("subjects").select("id", head),
    supabase.from("topics").select("id", head),
    supabase.from("profiles").select("id", head).eq("role_id", "student"),
    supabase.from("profiles").select("id", head).neq("role_id", "student"),
    supabase.from("exam_schedules").select("id", head).eq("status", "draft"),
    supabase.from("exam_schedules").select("id", head).eq("status", "published"),
    supabase.from("exam_schedules").select("id", head).eq("status", "completed"),
    supabase.from("exam_attempts").select("id", head),
    supabase.from("exam_attempts").select("id", head).eq("status", "in_progress"),
    supabase.from("exam_attempts").select("id", head).eq("status", "submitted"),
    supabase.from("routines").select("id", head).eq("status", "draft"),
    supabase.from("routines").select("id", head).eq("status", "published"),
    supabase.from("import_batches").select("id", head),
  ]);

  const { data: audit } = await supabase
    .from("audit_logs")
    .select("id, actor_id, action, entity_type, entity_id, details, created_at, actor:profiles(full_name, full_name_bn, role_id)")
    .order("created_at", { ascending: false })
    .limit(8);

  return {
    questions: {
      total: qTotal.count ?? 0,
      draft: qDraft.count ?? 0,
      pending: qPending.count ?? 0,
      approved: qApproved.count ?? 0,
      rejected: qRejected.count ?? 0,
      archived: qArchived.count ?? 0,
      verified: qVerified.count ?? 0,
      aiUnverified: qAi.count ?? 0,
    },
    courses: courses.count ?? 0,
    subjects: subjects.count ?? 0,
    topics: topics.count ?? 0,
    students: students.count ?? 0,
    staff: staff.count ?? 0,
    schedules: {
      draft: sDraft.count ?? 0,
      published: sPublished.count ?? 0,
      completed: sCompleted.count ?? 0,
    },
    attempts: {
      total: aTotal.count ?? 0,
      inProgress: aInProgress.count ?? 0,
      submitted: aSubmitted.count ?? 0,
    },
    routines: { draft: rDraft.count ?? 0, published: rPublished.count ?? 0 },
    importBatches: batches.count ?? 0,
    recentAudit: (audit ?? []) as unknown as AuditRow[],
  };
}

export type QuestionListRow = {
  id: string;
  statement: string;
  statement_bn: string | null;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: number;
  explanation: string;
  source: string;
  status: string;
  difficulty: string;
  source_type: string;
  question_kind: string | null;
  exam_name: string | null;
  is_verified: boolean;
  year: number | null;
  created_at: string;
  course_id: string;
  subject_id: string | null;
  topic_id: string | null;
  subtopic_id: string | null;
  course?: { title_bn: string; slug: string } | null;
  subject?: { title_bn: string } | null;
  topic?: { title_bn: string } | null;
  subtopic?: { title_bn: string } | null;
};

const QUESTION_ROW_SELECT =
  "id, statement, statement_bn, option_a, option_b, option_c, option_d, correct_option, explanation, source, status, difficulty, source_type, question_kind, exam_name, is_verified, year, created_at, course_id, subject_id, topic_id, subtopic_id, course:courses(title_bn, slug), subject:subjects(title_bn), topic:topics(title_bn), subtopic:subtopics(title_bn)";

/** Headline numbers for the question-bank page's stat cards and tabs. */
export type QuestionBankStats = {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  exams: number;
  /** source_type = 'previous' (PYQ) */
  previous: number;
  /** question_kind = 'practice' */
  practice: number;
  /** source_type = 'ai_assisted' */
  ai: number;
  /** source_type = 'manual' */
  manual: number;
  /** source_type = csv_import / json_import */
  imported: number;
};

const EMPTY_QB_STATS: QuestionBankStats = {
  total: 0, approved: 0, pending: 0, rejected: 0, exams: 0,
  previous: 0, practice: 0, ai: 0, manual: 0, imported: 0,
};

export async function getQuestionBankStats(): Promise<QuestionBankStats> {
  const supabase = await getServerClient();
  if (!supabase) return EMPTY_QB_STATS;
  const head = { count: "exact" as const, head: true };
  const [total, approved, pending, draft, rejected, exams, previous, practice, ai, manual, imported] =
    await Promise.all([
      supabase.from("questions").select("id", head),
      supabase.from("questions").select("id", head).eq("status", "approved"),
      supabase.from("questions").select("id", head).eq("status", "pending_review"),
      supabase.from("questions").select("id", head).eq("status", "draft"),
      supabase.from("questions").select("id", head).eq("status", "rejected"),
      supabase.from("exam_schedules").select("id", head).in("status", ["published", "completed"]),
      supabase.from("questions").select("id", head).eq("source_type", "previous"),
      supabase.from("questions").select("id", head).eq("question_kind", "practice"),
      supabase.from("questions").select("id", head).eq("source_type", "ai_assisted"),
      supabase.from("questions").select("id", head).eq("source_type", "manual"),
      supabase.from("questions").select("id", head).in("source_type", ["csv_import", "json_import"]),
    ]);
  return {
    total: total.count ?? 0,
    approved: approved.count ?? 0,
    pending: (pending.count ?? 0) + (draft.count ?? 0),
    rejected: rejected.count ?? 0,
    exams: exams.count ?? 0,
    previous: previous.count ?? 0,
    practice: practice.count ?? 0,
    ai: ai.count ?? 0,
    manual: manual.count ?? 0,
    imported: imported.count ?? 0,
  };
}

/** Chart data for the question-bank analytics row (course donut + monthly bars). */
export type QuestionBankInsights = {
  byCourse: { courseId: string; count: number }[];
  /** Last 6 calendar months, oldest first. */
  byMonth: { label: string; count: number }[];
};

export async function getQuestionBankInsights(courseIds: string[]): Promise<QuestionBankInsights> {
  const supabase = await getServerClient();
  if (!supabase) return { byCourse: [], byMonth: [] };
  const head = { count: "exact" as const, head: true };

  // Month buckets must line up with the Bangladesh calendar the UI displays.
  // These used to be built with Date.UTC, so a question created at 03:00 Dhaka
  // on the 1st (21:00 UTC on the last day of the previous month) was counted
  // in the wrong month. Dhaka has been a fixed UTC+6 with no DST since 2010,
  // so shifting the boundaries by six hours is exact — see DHAKA_TZ in
  // src/lib/format.ts, which every date formatter already uses.
  const now = new Date();
  const dhakaNow = new Date(now.getTime() + DHAKA_OFFSET_MS);
  const monthStarts = Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(dhakaNow.getUTCFullYear(), dhakaNow.getUTCMonth() - 5 + i, 1) - DHAKA_OFFSET_MS),
  );

  const [courseCounts, monthCounts] = await Promise.all([
    Promise.all(
      courseIds.map((id) => supabase.from("questions").select("id", head).eq("course_id", id)),
    ),
    Promise.all(
      monthStarts.slice(0, 6).map((start, i) =>
        supabase
          .from("questions")
          .select("id", head)
          .gte("created_at", start.toISOString())
          .lt("created_at", monthStarts[i + 1].toISOString()),
      ),
    ),
  ]);

  return {
    byCourse: courseIds
      .map((courseId, i) => ({ courseId, count: courseCounts[i].count ?? 0 }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count),
    byMonth: monthStarts.slice(0, 6).map((start, i) => ({
      // Label from the Dhaka-local instant of the bucket start.
      label: new Date(start.getTime() + DHAKA_OFFSET_MS).toLocaleString("en", {
        month: "short",
        timeZone: "UTC",
      }),
      count: monthCounts[i].count ?? 0,
    })),
  };
}

/** Recent audit entries for one question — powers the version-history panel. */
export type QuestionAuditEntry = {
  id: string;
  action: string;
  actor_role: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

export async function getQuestionAudit(questionId: string): Promise<QuestionAuditEntry[]> {
  const supabase = await getServerClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("audit_logs")
    .select("id, action, actor_role, details, created_at")
    .eq("entity_type", "question")
    .eq("entity_id", questionId)
    .order("created_at", { ascending: false })
    .limit(8);
  return (data ?? []) as QuestionAuditEntry[];
}

/** Fetch a single question (same shape as the list rows) for the detail panel. */
export async function getQuestionById(id: string): Promise<QuestionListRow | null> {
  const supabase = await getServerClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("questions")
    .select(QUESTION_ROW_SELECT)
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as QuestionListRow) ?? null;
}

export type QuestionFilters = {
  status?: string;
  courseId?: string;
  subjectId?: string;
  topicId?: string;
  difficulty?: string;
  sourceType?: string;
  /** question_kind filter: exact_pyq | practice | ai_generated */
  kind?: string;
  subtopicId?: string;
  /** Matches questions.exam_name with ilike. */
  examName?: string;
  verified?: "yes" | "no";
  year?: string;
  search?: string;
  /** newest (default) | oldest | difficulty */
  sort?: string;
  page?: number;
  pageSize?: number;
};

export async function listQuestions(filters: QuestionFilters): Promise<{ rows: QuestionListRow[]; total: number }> {
  const supabase = await getServerClient();
  if (!supabase) return { rows: [], total: 0 };

  const pageSize = Math.min(filters.pageSize ?? 25, 100);
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * pageSize;

  let query = supabase
    .from("questions")
    .select(QUESTION_ROW_SELECT, { count: "exact" });

  if (filters.sort === "oldest") {
    query = query.order("created_at", { ascending: true });
  } else if (filters.sort === "difficulty") {
    // easy < hard < medium alphabetically is useless, so order by mapped weight via status column trick is
    // not possible in PostgREST; order by difficulty text then recency keeps groups together predictably.
    query = query.order("difficulty", { ascending: true }).order("created_at", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }
  query = query.range(from, from + pageSize - 1);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.courseId) query = query.eq("course_id", filters.courseId);
  if (filters.subjectId) query = query.eq("subject_id", filters.subjectId);
  if (filters.topicId) query = query.eq("topic_id", filters.topicId);
  if (filters.subtopicId) query = query.eq("subtopic_id", filters.subtopicId);
  if (filters.examName?.trim()) {
    query = query.ilike("exam_name", `%${filters.examName.trim().replace(/[%,()]/g, " ")}%`);
  }
  if (filters.difficulty) query = query.eq("difficulty", filters.difficulty);
  if (filters.sourceType) query = query.eq("source_type", filters.sourceType);
  if (filters.kind && ["exact_pyq", "practice", "ai_generated"].includes(filters.kind)) {
    query = query.eq("question_kind", filters.kind);
  }
  if (filters.verified) query = query.eq("is_verified", filters.verified === "yes");
  if (filters.year && /^\d{4}$/.test(filters.year)) query = query.eq("year", Number(filters.year));
  if (filters.search?.trim()) {
    const needle = filters.search.trim().replace(/[%,()]/g, " ");
    query = query.or(`statement.ilike.%${needle}%,statement_bn.ilike.%${needle}%`);
  }

  const { data, count, error } = await query;
  if (error) {
    console.error("[admin] listQuestions", error.message);
    return { rows: [], total: 0 };
  }
  return { rows: (data ?? []) as unknown as QuestionListRow[], total: count ?? 0 };
}

export type StudentRow = {
  id: string;
  full_name: string | null;
  full_name_bn: string | null;
  email: string | null;
  phone: string | null;
  role_id: string;
  is_active: boolean;
  created_at: string;
  last_active_at: string;
  attempts?: number;
};

export async function listStudents(options: { search?: string; role?: string; limit?: number } = {}): Promise<StudentRow[]> {
  const supabase = await getServerClient();
  if (!supabase) return [];
  let query = supabase
    .from("profiles")
    .select("id, full_name, full_name_bn, email, phone, role_id, is_active, created_at, last_active_at")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 60);
  if (options.role) query = query.eq("role_id", options.role);
  if (options.search?.trim()) {
    const needle = options.search.trim().replace(/[%,()]/g, " ");
    query = query.or(`full_name.ilike.%${needle}%,email.ilike.%${needle}%,full_name_bn.ilike.%${needle}%`);
  }
  const { data, error } = await query;
  if (error) {
    console.error("[admin] listStudents", error.message);
    return [];
  }
  return (data ?? []) as StudentRow[];
}

export type AdminAttemptRow = {
  id: string;
  user_id: string;
  course_id: string;
  mode: string;
  status: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  total_questions: number;
  total_marks: number;
  is_released: boolean;
  profile?: { full_name: string | null; full_name_bn: string | null } | null;
  course?: { title_bn: string } | null;
};

export async function listAttempts(options: { status?: string; limit?: number } = {}): Promise<AdminAttemptRow[]> {
  const supabase = await getServerClient();
  if (!supabase) return [];
  let query = supabase
    .from("exam_attempts")
    .select(
      "id, user_id, course_id, mode, status, started_at, submitted_at, score, total_questions, total_marks, is_released, profile:profiles(full_name, full_name_bn), course:courses(title_bn)",
    )
    .order("started_at", { ascending: false })
    .limit(options.limit ?? 50);
  if (options.status) query = query.eq("status", options.status);
  const { data, error } = await query;
  if (error) {
    console.error("[admin] listAttempts", error.message);
    return [];
  }
  return (data ?? []) as unknown as AdminAttemptRow[];
}

export async function listAuditLogs(options: { limit?: number; action?: string } = {}): Promise<AuditRow[]> {
  const supabase = await getServerClient();
  if (!supabase) return [];
  let query = supabase
    .from("audit_logs")
    .select("id, actor_id, action, entity_type, entity_id, details, created_at, actor:profiles(full_name, full_name_bn, role_id)")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 100);
  if (options.action) query = query.eq("action", options.action);
  const { data, error } = await query;
  if (error) {
    console.error("[admin] listAuditLogs", error.message);
    return [];
  }
  return (data ?? []) as unknown as AuditRow[];
}

export async function getSystemSettings(): Promise<Record<string, unknown>> {
  if (!hasServiceRole) {
    const supabase = await getServerClient();
    if (!supabase) return {};
    const { data } = await supabase.from("system_settings").select("key, value");
    return Object.fromEntries((data ?? []).map((row) => [row.key as string, row.value]));
  }
  try {
    const admin = getAdminClient();
    const { data } = await admin.from("system_settings").select("key, value");
    return Object.fromEntries((data ?? []).map((row) => [row.key as string, row.value]));
  } catch {
    return {};
  }
}
