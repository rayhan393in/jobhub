import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight, BookOpenCheck, CheckCircle2, Clock3, Layers, Library, PauseCircle,
  PlayCircle, Plus, Radio, Star,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { getCourseCounts, listCourses, listMyEnrollments, listSubjects } from "@/lib/queries";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "আমার কোর্স" };

const FLAG_MESSAGES: Record<string, string> = {
  enrolled: "কোর্সে ভর্তি সম্পন্ন হয়েছে — এখন ড্যাশবোর্ডে কোর্সটি দেখা যাবে।",
  paused: "কোর্সটি সাময়িকভাবে বিরতিতে রাখা হয়েছে — ইতিহাস অক্ষত আছে।",
  resumed: "কোর্সটি আবার সক্রিয় করা হয়েছে।",
  default: "ডিফল্ট কোর্স পরিবর্তন করা হয়েছে।",
  error: "অনুরোধটি সম্পন্ন করা যায়নি — আবার চেষ্টা করুন।",
};

/**
 * My Courses V7 — enrollment management hub.
 * Enrolled courses (with default-course control + pause/resume) on top,
 * the rest of the catalogue below with one-click enroll. All mutations go
 * through /api/enrollments (form POST, RLS-backed).
 */
export default async function DashboardCoursesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [courses, counts, enrollments] = await Promise.all([
    listCourses(),
    getCourseCounts(),
    listMyEnrollments(user.id),
  ]);
  const defaultId = user.profile?.target_course_id ?? null;
  const enrollmentByCourse = new Map(enrollments.map((e) => [e.course_id, e]));
  const enrolledCourses = courses.filter((c) => enrollmentByCourse.has(c.id));
  const availableCourses = courses.filter((c) => !enrollmentByCourse.has(c.id));

  const subjectsByCourse = await Promise.all(
    courses.map(async (course) => ({ id: course.id, subjects: await listSubjects(course.id) })),
  );
  const subjectsFor = new Map(subjectsByCourse.map((row) => [row.id, row.subjects]));
  const flag = params.enroll ? FLAG_MESSAGES[params.enroll] : null;

  const renderMeta = (courseId: string, durationMinutes: number) => (
    <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.6875rem] text-[var(--text-subtle)]">
      <div className="flex items-center gap-1">
        <BookOpenCheck className="size-3" aria-hidden />
        <dt className="sr-only">বিষয়</dt>
        <dd>{formatNumber((subjectsFor.get(courseId) ?? []).length)} বিষয়</dd>
      </div>
      <div className="flex items-center gap-1">
        <Library className="size-3" aria-hidden />
        <dt className="sr-only">যাচাইকৃত প্রশ্ন</dt>
        <dd>{formatNumber(counts[courseId]?.questions ?? 0)} যাচাইকৃত প্রশ্ন</dd>
      </div>
      <div className="flex items-center gap-1">
        <Clock3 className="size-3" aria-hidden />
        <dt className="sr-only">সময়</dt>
        <dd>{formatNumber(durationMinutes)} মিনিট</dd>
      </div>
    </dl>
  );

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        eyebrow="কোর্স"
        title="আমার কোর্সসমূহ"
        description="এক অ্যাকাউন্টেই একাধিক কোর্সে প্রস্তুতি নিন — ভর্তি, ডিফল্ট কোর্স ও বিরতি সবকিছু এখান থেকে ব্যবস্থাপনা করুন।"
      />

      {flag ? (
        <div
          className={cn(
            "mb-4 rounded-xl border px-3.5 py-2.5 text-[0.75rem] font-semibold",
            params.enroll === "error"
              ? "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
              : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
          )}
          role="status"
        >
          {flag}
        </div>
      ) : null}

      {/* ভর্তি হওয়া কোর্স */}
      <h2 className="mb-2 flex items-center gap-1.5 text-[0.8125rem] font-bold text-[var(--text)]">
        <CheckCircle2 className="size-3.5 text-[var(--brand)]" aria-hidden />
        ভর্তি হওয়া কোর্স ({formatNumber(enrolledCourses.length)})
      </h2>
      {enrolledCourses.length === 0 ? (
        <EmptyState
          icon={<Layers className="size-5" />}
          title="আপনি এখনো কোনো কোর্সে ভর্তি হননি"
          description="নিচের তালিকা থেকে এক বা একাধিক কোর্সে ভর্তি হয়ে প্রস্তুতি শুরু করুন।"
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {enrolledCourses.map((course) => {
            const enrollment = enrollmentByCourse.get(course.id)!;
            const isDefault = course.id === defaultId;
            const isPaused = enrollment.status === "paused";
            return (
              <div
                key={course.id}
                className={cn(
                  "jh-card flex flex-col p-4",
                  isDefault && "border-[var(--brand)]/40 ring-1 ring-[var(--brand)]/20",
                  isPaused && "opacity-75",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[0.9375rem] font-bold tracking-[-0.015em] text-[var(--text)]">
                    {course.title_bn}
                  </h3>
                  <div className="flex shrink-0 gap-1">
                    {isDefault ? <Badge tone="brand">ডিফল্ট</Badge> : null}
                    {isPaused ? <Badge tone="warning">বিরতিতে</Badge> : null}
                  </div>
                </div>
                <p className="mt-1 flex-1 text-[0.75rem] leading-relaxed text-[var(--text-muted)]">
                  {course.summary_bn ?? `${course.title_bn} পরীক্ষার বিষয়ভিত্তিক প্রস্তুতি।`}
                </p>
                {renderMeta(course.id, course.exam_config.max_duration_minutes)}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <ButtonLink href={`/dashboard?course=${course.id}`} size="sm" variant="secondary">
                    ড্যাশবোর্ড
                    <ArrowRight className="size-3" aria-hidden />
                  </ButtonLink>
                  <ButtonLink href={`/custom-exam?course=${course.slug}`} size="sm" variant="ghost">
                    অনুশীলন
                  </ButtonLink>
                  {!isDefault && !isPaused ? (
                    <form method="post" action="/api/enrollments">
                      <input type="hidden" name="action" value="set_default" />
                      <input type="hidden" name="courseId" value={course.id} />
                      <input type="hidden" name="back" value="/my-courses" />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1 rounded-[0.625rem] px-2 py-1 text-[0.6875rem] font-semibold text-[var(--brand)] transition hover:bg-[var(--brand-soft)]"
                      >
                        <Star className="size-3" aria-hidden />
                        ডিফল্ট করুন
                      </button>
                    </form>
                  ) : null}
                  <form method="post" action="/api/enrollments" className="ml-auto">
                    <input type="hidden" name="action" value={isPaused ? "resume" : "pause"} />
                    <input type="hidden" name="courseId" value={course.id} />
                    <input type="hidden" name="back" value="/my-courses" />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-[0.625rem] px-2 py-1 text-[0.6875rem] font-semibold text-[var(--text-subtle)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
                    >
                      {isPaused ? (
                        <>
                          <PlayCircle className="size-3" aria-hidden />
                          পুনরায় সক্রিয়
                        </>
                      ) : (
                        <>
                          <PauseCircle className="size-3" aria-hidden />
                          বিরতি
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ভর্তি হওয়া যায় এমন কোর্স */}
      {availableCourses.length > 0 ? (
        <>
          <h2 className="mb-2 mt-7 flex items-center gap-1.5 text-[0.8125rem] font-bold text-[var(--text)]">
            <Plus className="size-3.5 text-[var(--brand)]" aria-hidden />
            আরও কোর্সে ভর্তি হোন ({formatNumber(availableCourses.length)})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {availableCourses.map((course) => (
              <div key={course.id} className="jh-card flex flex-col p-4">
                <h3 className="text-[0.9375rem] font-bold tracking-[-0.015em] text-[var(--text)]">
                  {course.title_bn}
                </h3>
                <p className="mt-1 flex-1 text-[0.75rem] leading-relaxed text-[var(--text-muted)]">
                  {course.summary_bn ?? `${course.title_bn} পরীক্ষার বিষয়ভিত্তিক প্রস্তুতি।`}
                </p>
                {renderMeta(course.id, course.exam_config.max_duration_minutes)}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <form method="post" action="/api/enrollments">
                    <input type="hidden" name="action" value="enroll" />
                    <input type="hidden" name="courseId" value={course.id} />
                    <input type="hidden" name="back" value="/my-courses" />
                    <button
                      type="submit"
                      className="inline-flex h-8 items-center gap-1.5 rounded-[0.625rem] bg-[var(--brand)] px-3 text-[0.75rem] font-semibold text-white transition hover:opacity-90"
                    >
                      <Plus className="size-3" aria-hidden />
                      ভর্তি হোন
                    </button>
                  </form>
                  <Link
                    href={`/courses/${course.slug}`}
                    className="inline-flex items-center gap-1 rounded-[0.625rem] px-2 text-[0.75rem] font-semibold text-[var(--brand)] hover:underline"
                  >
                    <Radio className="size-3" aria-hidden />
                    বিস্তারিত
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
