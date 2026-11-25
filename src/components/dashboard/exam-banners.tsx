import { ArrowRight, RotateCcw } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { LiveDot } from "@/components/ui/badge";
import { AttemptCountdown } from "@/components/dashboard/attempt-countdown";
import { formatNumber } from "@/lib/format";
import type { Course } from "@/lib/types";
import type { ScheduleWithCourse } from "@/lib/queries";

export type ResumeAttempt = {
  id: string;
  course_id: string;
  deadline_at: string;
  total_questions: number;
};

/** "You have an unfinished exam" banner with a live ticking countdown. */
export function ResumeBanner({
  attempts,
  courseById,
  now,
}: {
  attempts: ResumeAttempt[];
  courseById: Map<string, Course>;
  now: number;
}) {
  if (attempts.length === 0) return null;
  return (
    <div className="mb-5">
      {attempts.slice(0, 1).map((attempt) => {
        const course = courseById.get(attempt.course_id);
        const alive = new Date(attempt.deadline_at).getTime() > now;
        return (
          <div
            key={attempt.id}
            className="flex flex-col gap-3 rounded-2xl border border-[var(--brand)]/25 bg-[var(--brand-soft)] p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)] text-white">
                <RotateCcw className="size-4" aria-hidden />
              </span>
              <div>
                <p className="text-[0.875rem] font-semibold text-[var(--text)]">
                  অসম্পূর্ণ পরীক্ষা {alive ? "আছে" : "সময় শেষ"}
                </p>
                <p className="mt-0.5 text-[0.75rem] text-[var(--text-muted)]">
                  {course?.title_bn ?? "পরীক্ষা"} · {formatNumber(attempt.total_questions)} প্রশ্ন ·{" "}
                  <AttemptCountdown deadline={attempt.deadline_at} />
                </p>
              </div>
            </div>
            <ButtonLink href={`/exam/${attempt.id}`} size="sm">
              {alive ? "চালিয়ে যান" : "জমা দিন ও ফলাফল"}
              <ArrowRight className="size-3.5" aria-hidden />
            </ButtonLink>
          </div>
        );
      })}
    </div>
  );
}

/** Red "running now" card listing every currently-live exam. */
export function LiveExamsBanner({ exams }: { exams: ScheduleWithCourse[] }) {
  if (exams.length === 0) return null;
  return (
    <div className="mb-5 rounded-2xl border border-red-100 bg-red-50/60 p-4 dark:border-red-500/20 dark:bg-red-500/5">
      <div className="flex items-center gap-2">
        <LiveDot label="এখন চলছে" />
      </div>
      <div className="mt-2.5 grid gap-2">
        {exams.map((exam) => (
          <div key={exam.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <p className="min-w-0 flex-1 truncate text-[0.875rem] font-semibold text-[var(--text)]">
              {exam.title_bn}
            </p>
            <span className="text-[0.6875rem] text-[var(--text-muted)]">
              {formatNumber(exam.question_count)} প্রশ্ন · {formatNumber(exam.duration_minutes)} মিনিট
            </span>
            {exam.my_attempt_id ? (
              <ButtonLink href={`/exam/${exam.my_attempt_id}`} size="sm" variant="secondary">
                চালিয়ে যান
              </ButtonLink>
            ) : (
              <ButtonLink href={`/exams/${exam.id}`} size="sm">
                শুরু করুন
              </ButtonLink>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
