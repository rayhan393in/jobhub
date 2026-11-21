import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAttemptPaper, getAttemptReview } from "@/lib/exam-service";
import { getSystemSettings } from "@/lib/admin-queries";
import { getServerClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import type { ReviewItem } from "@/lib/types";
import { PrintSheet } from "./print-sheet";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ফলাফল শীট" };

const OPTION_KEYS = ["ক", "খ", "গ", "ঘ"];

export type PdfFlags = {
  question_paper: boolean;
  answer_key: boolean;
  performance_report: boolean;
  embed_exam_id: boolean;
  embed_user_info: boolean;
};

export type PerformanceGroup = {
  key: string;
  label: string;
  attempted: number;
  correct: number;
  wrong: number;
  accuracy: number;
  marks: number;
  scored: number;
};

/**
 * The printable result sheet.
 *
 * A real page rather than a generated PDF binary on purpose: Bengali is a
 * complex script, and only a browser shapes it correctly — conjuncts, repha,
 * and the i-matra that renders before its consonant. The page opens the print
 * dialog, where "Save as PDF" produces a correctly shaped document. The admin's
 * `pdf_downloads` switches decide which sections exist at all.
 */
export default async function ResultSheetPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { attemptId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) notFound();

  const settings = await getSystemSettings();
  const flags: PdfFlags = {
    question_paper: true,
    answer_key: true,
    performance_report: true,
    embed_exam_id: true,
    embed_user_info: false,
    ...((settings.pdf_downloads ?? {}) as Partial<PdfFlags>),
  };

  if (!flags.question_paper && !flags.answer_key && !flags.performance_report) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-lg font-bold text-[var(--text)]">PDF ডাউনলোড বন্ধ আছে</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          প্রশাসক এই মুহূর্তে PDF ডাউনলোড চালু রাখেননি। ফলাফল স্ক্রিনে দেখা যাবে।
        </p>
      </main>
    );
  }

  let paper;
  let review;
  try {
    [paper, review] = await Promise.all([getAttemptPaper(attemptId), getAttemptReview(attemptId)]);
  } catch {
    notFound();
  }

  if (paper.attempt.status === "in_progress") redirect(`/exam/${attemptId}`);
  // The answer key is withheld until results are released — and so is the sheet.
  if (!review.released) notFound();

  // The paper itself does not carry a title; the schedule (or the course) does.
  let examTitle = "পরীক্ষা";
  const supabase = await getServerClient();
  if (supabase) {
    const { data: attempt } = await supabase
      .from("exam_attempts")
      .select("schedule_id, course_id")
      .eq("id", attemptId)
      .maybeSingle();
    if (attempt?.schedule_id) {
      const { data: schedule } = await supabase
        .from("exam_schedules")
        .select("title_bn")
        .eq("id", attempt.schedule_id)
        .maybeSingle();
      if (schedule?.title_bn) examTitle = schedule.title_bn as string;
    }
    if (examTitle === "পরীক্ষা" && attempt?.course_id) {
      const { data: course } = await supabase
        .from("courses")
        .select("title_bn")
        .eq("id", attempt.course_id)
        .maybeSingle();
      if (course?.title_bn) examTitle = `${course.title_bn} — অনুশীলন পরীক্ষা`;
    }
  }

  const items = review.items as ReviewItem[];
  const attempted = items.filter((item) => item.selected_option !== null).length;
  const correct = items.filter((item) => item.is_correct).length;
  const wrong = attempted - correct;
  const totalMarks = Number(review.total_marks ?? items.length);
  const scored = Number(review.score ?? 0);
  const accuracy = attempted > 0 ? (correct / attempted) * 100 : 0;
  const perQuestion = items.length > 0 ? totalMarks / items.length : 0;

  /** Aggregate a released review by subject or topic — never by anything withheld. */
  function aggregate(kind: "subject" | "topic"): PerformanceGroup[] {
    const map = new Map<string, PerformanceGroup>();
    for (const item of items) {
      if (item.selected_option === null) continue;
      const key = (kind === "subject" ? item.subject_id : item.topic_id) ?? "none";
      const entry = map.get(key) ?? {
        key,
        label:
          kind === "subject"
            ? item.subject_title_bn ?? "বিষয় নেই"
            : item.topic_title_bn ?? (item.topic_id ? `টপিক ${item.topic_id.slice(0, 6)}` : "টপিক নেই"),
        attempted: 0,
        correct: 0,
        wrong: 0,
        accuracy: 0,
        marks: 0,
        scored: 0,
      };
      entry.attempted += 1;
      entry.marks += perQuestion;
      if (item.is_correct) {
        entry.correct += 1;
        entry.scored += perQuestion;
      } else {
        entry.wrong += 1;
      }
      map.set(key, entry);
    }
    return [...map.values()]
      .map((entry) => ({ ...entry, accuracy: entry.attempted ? (entry.correct / entry.attempted) * 100 : 0 }))
      .sort((a, b) => b.attempted - a.attempted);
  }

  return (
    <PrintSheet
      flags={flags}
      meta={{
        examTitle,
        examId: attemptId,
        date: formatDateTime(paper.attempt.started_at, "bn"),
        printedOn: formatDateTime(new Date().toISOString(), "bn"),
        studentName: flags.embed_user_info ? user.profile?.full_name ?? user.email ?? "" : "",
        studentEmail: flags.embed_user_info ? user.email ?? "" : "",
      }}
      score={{
        scored,
        totalMarks,
        correct,
        wrong,
        unanswered: items.length - attempted,
        accuracy,
        totalQuestions: items.length,
      }}
      subjects={aggregate("subject")}
      topics={aggregate("topic")}
      topicNames={Object.fromEntries(
        items.filter((item) => item.topic_id && item.topic_title_bn).map((item) => [item.topic_id as string, item.topic_title_bn as string]),
      )}
      items={items.map((item) => ({
        position: item.position,
        statement: item.statement_bn || item.statement,
        options: item.options,
        correctOption: item.correct_option,
        selectedOption: item.selected_option,
        isCorrect: item.is_correct,
        explanation: item.explanation,
        source: item.source,
        year: item.year,
        difficulty: item.difficulty,
        examName: item.exam_name ?? "",
        bookChapter: item.book_chapter ?? "",
        bookPage: item.book_page ?? null,
      }))}
      optionKeys={OPTION_KEYS}
    />
  );
}
