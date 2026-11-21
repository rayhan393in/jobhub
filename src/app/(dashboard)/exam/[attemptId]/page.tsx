import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAttemptPaper } from "@/lib/exam-service";
import { ExamRunner } from "@/components/exam/exam-runner";
import { MODE_LABELS, type AttemptMode } from "@/lib/types";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "পরীক্ষা" };

export default async function ExamPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { attemptId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) notFound();

  let paper;
  try {
    paper = await getAttemptPaper(attemptId);
  } catch {
    notFound();
  }

  // Already submitted: send the student straight to their result.
  if (paper.attempt.status !== "in_progress") {
    redirect(`/results/${attemptId}`);
  }

  const mode = (paper.attempt.mode as AttemptMode) ?? "custom";
  const title = MODE_LABELS[mode]?.bn ?? "পরীক্ষা";
  const subtitle = `${formatNumber(paper.attempt.total_questions)} প্রশ্ন · ${formatNumber(paper.attempt.total_marks)} নম্বর · +১ / −০.৫`;

  return <ExamRunner attemptId={attemptId} title={title} subtitle={subtitle} />;
}
