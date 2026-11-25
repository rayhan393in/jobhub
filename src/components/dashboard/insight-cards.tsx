import { AlertCircle, ArrowRight, Radio, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Progress, Ring } from "@/components/ui/progress";
import { formatDate, formatNumber, formatPercent, formatTime } from "@/lib/format";
import type { Course, StudentAnalytics, TopicPerformance } from "@/lib/types";
import type { ScheduleWithCourse } from "@/lib/queries";

/** Overall accuracy ring with correct/wrong/unanswered breakdown. */
export function AccuracyCard({ summary }: { summary: StudentAnalytics["summary"] | undefined }) {
  return (
    <section className="jh-card p-5">
      <h2 className="text-[0.875rem] font-semibold text-[var(--text)]">সার্বিক নির্ভুলতা</h2>
      <div className="mt-4 flex items-center gap-4">
        <Ring value={summary?.avg_accuracy ?? 0} size={84} label="Accuracy">
          <span className="text-[1rem] font-bold tabular-nums text-[var(--text)]">
            {formatNumber(Math.round(summary?.avg_accuracy ?? 0))}
            <span className="text-[0.625rem]">%</span>
          </span>
        </Ring>
        <div className="min-w-0 space-y-1.5 text-[0.75rem]">
          <p className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-mint-500" aria-hidden />
            <span className="text-[var(--text-muted)]">সঠিক</span>
            <span className="ml-auto font-semibold text-[var(--text)]">
              {formatNumber(summary?.correct ?? 0)}
            </span>
          </p>
          <p className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-red-500" aria-hidden />
            <span className="text-[var(--text-muted)]">ভুল</span>
            <span className="ml-auto font-semibold text-[var(--text)]">
              {formatNumber(summary?.wrong ?? 0)}
            </span>
          </p>
          <p className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[var(--border-strong)]" aria-hidden />
            <span className="text-[var(--text-muted)]">অনুত্তরিত</span>
            <span className="ml-auto font-semibold text-[var(--text)]">
              {formatNumber(summary?.unanswered ?? 0)}
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}

/** Per-subject accuracy bars (top 4, weakest first — RPC orders ascending). */
export function SubjectPerformanceCard({ subjects }: { subjects: StudentAnalytics["subjects"] }) {
  return (
    <section className="jh-card p-5">
      <h2 className="text-[0.875rem] font-semibold text-[var(--text)]">বিষয়ভিত্তিক পারফরম্যান্স</h2>
      {subjects.length === 0 ? (
        <p className="mt-2 text-[0.75rem] leading-relaxed text-[var(--text-subtle)]">
          উত্তর দেওয়া প্রশ্ন থেকে বিষয়ভিত্তিক নির্ভুলতা তৈরি হবে।
        </p>
      ) : (
        <ul className="mt-3.5 space-y-3">
          {subjects.slice(0, 4).map((subject) => (
            <li key={subject.subject_id ?? subject.title_en}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[0.75rem] font-medium text-[var(--text)]">
                  {subject.title_bn}
                </span>
                <span className="shrink-0 text-[0.6875rem] font-semibold tabular-nums text-[var(--text-muted)]">
                  {formatPercent(subject.accuracy)}
                </span>
              </div>
              <Progress
                value={subject.accuracy}
                className="mt-1.5"
                tone={subject.accuracy >= 60 ? "success" : subject.accuracy >= 40 ? "brand" : "warning"}
                label={subject.title_bn}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Revision suggestions. Only topics with enough attempts qualify (the page
 * applies the threshold); each card shows the honest correct/attempted count.
 */
export function WeakTopicsCard({
  weakTopics,
  almostThere,
  hasData,
}: {
  weakTopics: TopicPerformance[];
  almostThere: boolean;
  hasData: boolean;
}) {
  return (
    <section className="jh-card p-5">
      <h2 className="flex items-center gap-2 text-[0.875rem] font-semibold text-[var(--text)]">
        <AlertCircle className="size-4 text-[var(--brand)]" aria-hidden />
        রিভিশন প্রস্তাব
      </h2>
      {weakTopics.length === 0 ? (
        <p className="mt-2 text-[0.75rem] leading-relaxed text-[var(--text-subtle)]">
          {almostThere
            ? "প্রতি টপিকে অন্তত ৩টি প্রশ্নের উত্তর দিলে নির্ভরযোগ্য দুর্বলতা-বিশ্লেষণ এখানে দেখা যাবে — আর অল্প কিছু প্রশ্ন বাকি!"
            : hasData
              ? "দারুণ! এখন পর্যন্ত কোনো টপিকে উল্লেখযোগ্য দুর্বলতা ধরা পড়েনি। অনুশীলন চালিয়ে যান।"
              : "আরও প্রশ্নের উত্তর দিলে আপনার দুর্বল টপিকগুলো এখানে দেখা যাবে — কোনো অনুমান নয়, শুধু আপনার নিজের ফলাফলের ভিত্তিতে।"}
        </p>
      ) : (
        <>
          <ul className="mt-3 space-y-2">
            {weakTopics.map((topic) => (
              <li key={topic.topic_id} className="rounded-xl bg-[var(--surface-muted)] px-3 py-2">
                <p className="truncate text-[0.75rem] font-semibold text-[var(--text)]">{topic.title_bn}</p>
                <p className="text-[0.625rem] text-[var(--text-subtle)]">
                  {topic.subject_bn} · {formatNumber(topic.attempted)}টির মধ্যে{" "}
                  {formatNumber(topic.correct)}টি সঠিক ({formatPercent(topic.accuracy)})
                </p>
              </li>
            ))}
          </ul>
          <ButtonLink
            href={`/custom-exam?topic=${weakTopics[0].topic_id}`}
            variant="secondary"
            size="sm"
            className="mt-3 w-full"
          >
            <Sparkles className="size-3.5" aria-hidden />
            দুর্বল টপিকে অনুশীলন
          </ButtonLink>
        </>
      )}
    </section>
  );
}

/** Next published exams (max 3) with start times. */
export function UpcomingExamsCard({ exams }: { exams: ScheduleWithCourse[] }) {
  return (
    <section className="jh-card p-5">
      <h2 className="flex items-center gap-2 text-[0.875rem] font-semibold text-[var(--text)]">
        <Radio className="size-4 text-[var(--brand)]" aria-hidden />
        আসন্ন পরীক্ষা
      </h2>
      {exams.length === 0 ? (
        <p className="mt-2 text-[0.75rem] leading-relaxed text-[var(--text-subtle)]">
          এখন কোনো প্রকাশিত আসন্ন পরীক্ষা নেই। প্র্যাকটিস বা কাস্টম পরীক্ষা দিয়ে প্রস্তুতি
          চালিয়ে যান।
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {exams.map((exam) => (
            <li key={exam.id} className="rounded-xl border border-[var(--border)] px-3 py-2">
              <p className="truncate text-[0.75rem] font-semibold text-[var(--text)]">{exam.title_bn}</p>
              <p className="mt-0.5 text-[0.625rem] text-[var(--text-subtle)]">
                {formatDate(exam.starts_at)} · {formatTime(exam.starts_at)} থেকে
              </p>
            </li>
          ))}
        </ul>
      )}
      <ButtonLink href="/exams" variant="ghost" size="sm" className="mt-2 w-full">
        পরীক্ষা কেন্দ্র
      </ButtonLink>
    </section>
  );
}

/** The student's target course with a syllabus link. */
export function TargetCourseCard({ course }: { course: Course | undefined }) {
  if (!course) return null;
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-subtle)]">
        আপনার লক্ষ্য কোর্স
      </p>
      <p className="mt-1 text-[0.875rem] font-semibold text-[var(--text)]">{course.title_bn}</p>
      <ButtonLink href={`/courses/${course.slug}`} variant="ghost" size="sm" className="mt-1 -ml-2">
        সিলেবাস দেখুন
        <ArrowRight className="size-3" aria-hidden />
      </ButtonLink>
    </div>
  );
}
