import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, Clock3, Layers, Library, Radio } from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { getCourseCounts, listCourses, listSubjects } from "@/lib/queries";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "আমার কোর্স" };

/**
 * Inside the app, "কোর্স" must stay inside the app. The sidebar used to point at
 * the public marketing catalogue, which threw students out of their dashboard.
 * This page lists every published course with the student's own chosen course
 * first, plus a direct jump into the exam builder.
 */
export default async function DashboardCoursesPage() {
  const [courses, counts, user] = await Promise.all([listCourses(), getCourseCounts(), getCurrentUser()]);
  const targetId = user?.profile?.target_course_id ?? null;

  const ordered = [...courses].sort((a, b) => {
    if (a.id === targetId) return -1;
    if (b.id === targetId) return 1;
    return 0;
  });

  const subjectsByCourse = await Promise.all(
    ordered.map(async (course) => ({ id: course.id, subjects: await listSubjects(course.id) })),
  );
  const subjectsFor = new Map(subjectsByCourse.map((row) => [row.id, row.subjects]));

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        eyebrow="কোর্স"
        title="আপনার প্রস্তুতির কোর্স"
        description="প্রতিটি কোর্সের নিজস্ব বিষয় ও প্রশ্নব্যাংক রয়েছে। যেকোনো কোর্স থেকে সরাসরি অনুশীলন শুরু করতে পারবেন।"
      />

      {courses.length === 0 ? (
        <EmptyState
          icon={<Layers className="size-5" />}
          title="এখনো কোনো কোর্স প্রকাশিত হয়নি"
          description="প্রশাসক কোর্স প্রকাশ করলে এখানে দেখা যাবে।"
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {ordered.map((course) => {
            const subjects = subjectsFor.get(course.id) ?? [];
            const isTarget = course.id === targetId;
            return (
              <div key={course.id} className="jh-card flex flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-[0.9375rem] font-bold tracking-[-0.015em] text-[var(--text)]">
                    {course.title_bn}
                  </h2>
                  {isTarget ? <Badge tone="brand">লক্ষ্য কোর্স</Badge> : null}
                </div>
                <p className="mt-1 flex-1 text-[0.75rem] leading-relaxed text-[var(--text-muted)]">
                  {course.summary_bn ?? `${course.title_bn} পরীক্ষার বিষয়ভিত্তিক প্রস্তুতি।`}
                </p>

                <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.6875rem] text-[var(--text-subtle)]">
                  <div className="flex items-center gap-1">
                    <BookOpenCheck className="size-3" aria-hidden />
                    <dt className="sr-only">বিষয়</dt>
                    <dd>{formatNumber(subjects.length)} বিষয়</dd>
                  </div>
                  <div className="flex items-center gap-1">
                    <Library className="size-3" aria-hidden />
                    <dt className="sr-only">যাচাইকৃত প্রশ্ন</dt>
                    <dd>{formatNumber(counts[course.id]?.questions ?? 0)} যাচাইকৃত প্রশ্ন</dd>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock3 className="size-3" aria-hidden />
                    <dt className="sr-only">সময়</dt>
                    <dd>{formatNumber(course.exam_config.max_duration_minutes)} মিনিট</dd>
                  </div>
                </dl>

                <div className="mt-3 flex flex-wrap gap-2">
                  <ButtonLink href={`/custom-exam?course=${course.slug}`} size="sm" variant="secondary">
                    অনুশীলন শুরু
                    <ArrowRight className="size-3" aria-hidden />
                  </ButtonLink>
                  <Link
                    href={`/courses/${course.slug}`}
                    className="inline-flex items-center gap-1 rounded-[0.625rem] px-2 text-[0.75rem] font-semibold text-[var(--brand)] hover:underline"
                  >
                    <Radio className="size-3" aria-hidden />
                    কোর্স বিস্তারিত
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
