import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerClient } from "./supabase/server";
import type {
  AttemptPaper, AttemptReview, SavedAnswer, ExamQuestion, StudentAnalytics,
} from "./types";

/**
 * Exam access layer. Every method runs through the visitor's cookie-bound
 * client so the database functions can derive the caller from auth.uid().
 * No method here can reveal a question that is not on the caller's own paper.
 */

function requireClient(client: SupabaseClient | null): SupabaseClient {
  if (!client) throw new Error("Supabase is not configured for this deployment.");
  return client;
}

export async function client(): Promise<SupabaseClient> {
  return requireClient(await getServerClient());
}

export type StartResult = {
  attempt_id: string;
  deadline_at: string;
  resumed: boolean;
  status: string;
};

export async function startScheduledAttempt(scheduleId: string): Promise<StartResult> {
  const supabase = await client();
  const { data, error } = await supabase.rpc("jh_start_scheduled_attempt", { p_schedule_id: scheduleId });
  if (error) throw new Error(error.message);
  return data as StartResult;
}

export async function startCustomAttempt(input: {
  courseId: string;
  composition: { items: Array<Record<string, unknown>> };
  durationMinutes: number;
  mode: string;
  titleEn?: string;
  titleBn?: string;
}): Promise<StartResult> {
  const supabase = await client();
  const { data, error } = await supabase.rpc("jh_start_custom_attempt", {
    p_course_id: input.courseId,
    p_composition: input.composition,
    p_duration_minutes: input.durationMinutes,
    p_mode: input.mode,
    p_title_en: input.titleEn ?? "",
    p_title_bn: input.titleBn ?? "",
  });
  if (error) throw new Error(error.message);
  return data as StartResult;
}

export async function getAttemptPaper(attemptId: string): Promise<AttemptPaper> {
  const supabase = await client();
  const { data, error } = await supabase.rpc("jh_get_attempt_paper", { p_attempt_id: attemptId });
  if (error) throw new Error(error.message);
  const payload = data as AttemptPaper & { questions: ExamQuestion[] };

  // Saved answers for this attempt (the student's own rows under RLS).
  const { data: answers } = await supabase
    .from("student_answers")
    .select("question_id, selected_option, marked_for_review")
    .eq("attempt_id", attemptId);

  const saved: SavedAnswer[] = (answers ?? []).map((a) => ({
    question_id: a.question_id as string,
    selected_option: (a.selected_option as number | null) ?? null,
    marked_for_review: Boolean(a.marked_for_review),
  }));

  return { ...payload, saved_answers: saved } as AttemptPaper & { saved_answers: SavedAnswer[] };
}

export async function saveAnswer(input: {
  attemptId: string;
  questionId: string;
  selectedOption: number | null;
  markedForReview?: boolean;
}) {
  const supabase = await client();
  const { data, error } = await supabase.rpc("jh_save_answer", {
    p_attempt_id: input.attemptId,
    p_question_id: input.questionId,
    p_selected_option: input.selectedOption,
    p_marked_for_review: input.markedForReview ?? false,
  });
  if (error) throw new Error(error.message);
  return data as {
    saved: boolean;
    server_now: string;
    deadline_at: string;
    remaining_seconds: number;
  };
}

export async function submitAttempt(attemptId: string, reason: "manual" | "timeout" = "manual") {
  const supabase = await client();
  const { data, error } = await supabase.rpc("jh_submit_attempt", {
    p_attempt_id: attemptId,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
  return data as {
    already_submitted: boolean;
    result_id: string;
    score: number;
    total_marks?: number;
    correct?: number;
    wrong?: number;
    unanswered?: number;
    accuracy?: number;
    is_released: boolean;
    result_release_at?: string;
    submitted_at?: string;
  };
}

export async function getAttemptReview(attemptId: string): Promise<AttemptReview> {
  const supabase = await client();
  const { data, error } = await supabase.rpc("jh_get_attempt_review", { p_attempt_id: attemptId });
  if (error) throw new Error(error.message);
  return data as AttemptReview;
}

export async function getAnalytics(courseId?: string | null): Promise<StudentAnalytics> {
  const supabase = await client();
  const { data, error } = await supabase.rpc("jh_student_analytics", { p_course_id: courseId ?? null });
  if (error) throw new Error(error.message);
  return data as StudentAnalytics;
}

/** Verified question availability, safe for the browser: counts only. */
export async function availability(
  courseId: string,
  scope: { subjectId?: string | null; topicId?: string | null; subtopicId?: string | null },
): Promise<number> {
  const supabase = await client();
  const { data, error } = await supabase.rpc("jh_question_availability", {
    p_course_id: courseId,
    p_subject_id: scope.subjectId ?? null,
    p_topic_id: scope.topicId ?? null,
    p_subtopic_id: scope.subtopicId ?? null,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}
