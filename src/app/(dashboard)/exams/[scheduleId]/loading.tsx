import { ExamLoading } from "@/components/ui/exam-loading";

/**
 * Shown while the exam paper is fetched. The paper RPC is the heaviest query in
 * the app, and a blank screen here reads as "the exam broke" to a student who is
 * already anxious about a timed test.
 */
export default function Loading() {
  return <ExamLoading label="পরীক্ষার প্রশ্নপত্র প্রস্তুত হচ্ছে…" />;
}
