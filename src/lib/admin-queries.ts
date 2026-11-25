import "server-only";
import { getServerClient } from "./supabase/server";
import { getAdminClient } from "./supabase/admin";
import { hasServiceRole } from "./supabase/env";

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
  is_verified: boolean;
  year: number | null;
  created_at: string;
  course_id: string;
  subject_id: string | null;
  topic_id: string | null;
  course?: { title_bn: string; slug: string } | null;
  subject?: { title_bn: string } | null;
  topic?: { title_bn: string } | null;
};

/** Headline numbers for the question-bank page's stat cards. */
export type QuestionBankStats = {
  total: number;
  approved: number;
  pending: number;
  exams: number;
};

export async function getQuestionBankStats(): Promise<QuestionBankStats> {
  const supabase = await getServerClient();
  if (!supabase) return { total: 0, approved: 0, pending: 0, exams: 0 };
  const head = { count: "exact" as const, head: true };
  const [total, approved, pending, draft, exams] = await Promise.all([
    supabase.from("questions").select("id", head),
    supabase.from("questions").select("id", head).eq("status", "approved"),
    supabase.from("questions").select("id", head).eq("status", "pending_review"),
    supabase.from("questions").select("id", head).eq("status", "draft"),
    supabase.from("exam_schedules").select("id", head).in("status", ["published", "completed"]),
  ]);
  return {
    total: total.count ?? 0,
    approved: approved.count ?? 0,
    pending: (pending.count ?? 0) + (draft.count ?? 0),
    exams: exams.count ?? 0,
  };
}

export type QuestionFilters = {
  status?: string;
  courseId?: string;
  subjectId?: string;
  topicId?: string;
  difficulty?: string;
  sourceType?: string;
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
    .select(
      "id, statement, statement_bn, option_a, option_b, option_c, option_d, correct_option, explanation, source, status, difficulty, source_type, is_verified, year, created_at, course_id, subject_id, topic_id, course:courses(title_bn, slug), subject:subjects(title_bn), topic:topics(title_bn)",
      { count: "exact" },
    );

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
  if (filters.difficulty) query = query.eq("difficulty", filters.difficulty);
  if (filters.sourceType) query = query.eq("source_type", filters.sourceType);
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
