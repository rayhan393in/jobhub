import "server-only";
import { getServerClient } from "./supabase/server";

/**
 * Student-facing Question Bank reads. Everything goes through the
 * security-definer RPCs from migration 20261207000000 — students can never
 * read the `questions` table directly (RLS), and the browse payload never
 * carries the answer key. Counts are real database counts; an unconfigured
 * database or a missing migration yields zeros, never fabricated numbers.
 */

export type CollectionCount = {
  course_id: string;
  slug: string;
  total_verified: number;
  previous_verified: number;
};

export type QbExam = {
  exam_name: string;
  year: number | null;
  question_count: number;
  subject_count: number;
};

export type PyqQuestion = {
  id: string;
  statement: string;
  statement_bn: string | null;
  options: string[];
  difficulty: "easy" | "medium" | "hard";
  subject_id: string | null;
  topic_id: string | null;
  subtopic_id: string | null;
  subject_title: string | null;
  topic_title: string | null;
  subtopic_title: string | null;
  exam_name: string | null;
  year: number | null;
  question_type: string;
  /** Provenance is admin-only; the student payload carries exam attribution only. */
  has_explanation: boolean;
  classification: "pyq";
};

export type PyqPage = {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  rows: PyqQuestion[];
};

export type PyqQuery = {
  courseSlug?: string;
  examName?: string | null;
  examYear?: number | null;
  subjectId?: string | null;
  topicId?: string | null;
  subtopicId?: string | null;
  questionType?: string | null;
  difficulty?: string | null;
  search?: string | null;
  sort?: string | null;
  page?: number;
  pageSize?: number;
};

export async function getCollectionCounts(): Promise<Map<string, CollectionCount>> {
  const supabase = await getServerClient();
  if (!supabase) return new Map();
  const { data, error } = await supabase.rpc("jh_qb_collections");
  if (error || !Array.isArray(data)) {
    if (error) console.error("[question-bank] collections:", error.message);
    return new Map();
  }
  const map = new Map<string, CollectionCount>();
  for (const row of data as CollectionCount[]) {
    map.set(row.slug, row);
  }
  return map;
}

export async function getExamList(courseSlug = "bcs"): Promise<QbExam[]> {
  const supabase = await getServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("jh_qb_exams", { p_course_slug: courseSlug });
  if (error) {
    console.error("[question-bank] exams:", error.message);
    return [];
  }
  return Array.isArray(data) ? (data as QbExam[]) : [];
}

export async function queryPyq(params: PyqQuery = {}): Promise<PyqPage> {
  const supabase = await getServerClient();
  const empty: PyqPage = { total: 0, page: Math.max(1, params.page ?? 1), page_size: params.pageSize ?? 12, total_pages: 0, rows: [] };
  if (!supabase) return empty;
  const { data, error } = await supabase.rpc("jh_qb_pyq_list", {
    p_course_slug: params.courseSlug ?? "bcs",
    p_exam_name: params.examName ?? null,
    p_exam_year: params.examYear ?? null,
    p_subject_id: params.subjectId ?? null,
    p_topic_id: params.topicId ?? null,
    p_subtopic_id: params.subtopicId ?? null,
    p_question_type: params.questionType ?? null,
    p_difficulty: params.difficulty ?? null,
    p_search: params.search ?? null,
    p_sort: params.sort ?? "year",
    p_page: Math.max(1, params.page ?? 1),
    p_page_size: Math.min(Math.max(1, params.pageSize ?? 12), 50),
  });
  if (error || !data || typeof data !== "object") {
    if (error) console.error("[question-bank] list:", error.message);
    return empty;
  }
  const payload = data as Partial<PyqPage>;
  return {
    total: Number(payload.total ?? 0),
    page: Number(payload.page ?? 1),
    page_size: Number(payload.page_size ?? 12),
    total_pages: Number(payload.total_pages ?? 0),
    rows: Array.isArray(payload.rows) ? (payload.rows as PyqQuestion[]) : [],
  };
}
