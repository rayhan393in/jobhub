import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Clock3, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { COURSE_ICONS } from "@/components/marketing/landing-sections";
import { getCourseCounts, listCourses } from "@/lib/queries";
import { GraduationCap } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "কোর্স ক্যাটালগ",
  description:
    "BCS, বিশ্ববিদ্যালয় ভর্তি, সরকারি চাকরি, প্রাথমিক শিক্ষক, NTRCA, EEE ও টেকনিক্যাল নিয়োগ — প্রতিটি কোর্সের বিষয় ও প্রশ্নব্যাংক দেখুন।",
};

const LEVEL_LABEL: Record<string, string> = {
  foundation: "বেসিক",
  intermediate: "মধ্যম",
  advanced: "উচ্চতর",
};

export default async function CoursesPage() {
  const [courses, counts] = await Promise.all([listCourses(), getCourseCounts()]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <header className="max-w-2xl">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">
          কোর্স ক্যাটালগ
        </p>
        <h1 className="mt-2 text-balance text-[1.875rem] font-bold tracking-[-0.035em] text-[var(--text)] sm:text-[2.25rem]">
          আপনার লক্ষ্য অনুযায়ী প্রস্তুতি বেছে নিন
        </h1>
        <p className="mt-3 text-pretty text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
          প্রতিটি কোর্সের নিজস্ব বিষয়, টপিক ও প্রশ্নব্যাংক রয়েছে। নিচের সংখ্যাগুলো কেবল
          অনুমোদিত ও যাচাইকৃত প্রশ্নের — কোনো প্রতিশ্রুত সংখ্যা নয়।
        </p>
      </header>

      {courses.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            icon={<GraduationCap className="size-5" />}
            title="এখনো কোনো কোর্স প্রকাশিত হয়নি"
            description="প্রশাসক কোর্স প্রকাশ করলে এখানে দেখা যাবে।"
          />
        </div>
      ) : (
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => {
            const Icon = COURSE_ICONS[course.icon] ?? GraduationCap;
            const stat = counts[course.id] ?? { subjects: 0, questions: 0 };
            return (
              <Link
                key={course.id}
                href={`/courses/${course.slug}`}
                className="jh-card jh-card-hover group flex flex-col p-5 focus-visible:outline-2 focus-visible:outline-[var(--brand)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`flex size-11 items-center justify-center rounded-xl ${
                      course.accent === "violet"
                        ? "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-200"
                        : "bg-[var(--brand-soft)] text-[var(--brand)]"
                    }`}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <Badge tone={course.level === "advanced" ? "brand" : "neutral"}>
                    {LEVEL_LABEL[course.level]}
                  </Badge>
                </div>
                <h2 className="mt-4 text-[1rem] font-bold tracking-[-0.02em] text-[var(--text)]">
                  {course.title_bn}
                </h2>
                <p className="mt-0.5 text-[0.75rem] font-medium text-[var(--text-subtle)]">{course.title_en}</p>
                <p className="mt-2.5 flex-1 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
                  {course.summary_bn ??
                    `${course.title_bn} পরীক্ষার জন্য বিষয়ভিত্তিক প্রস্তুতি, প্র্যাকটিস ও লাইভ পরীক্ষা।`}
                </p>
                <div className="mt-4 flex items-center gap-4 border-t border-[var(--border)] pt-3.5 text-[0.6875rem] font-medium text-[var(--text-subtle)]">
                  <span className="inline-flex items-center gap-1.5">
                    <Layers className="size-3" aria-hidden />
                    {formatNumber(stat.subjects)} বিষয়
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <BookOpen className="size-3" aria-hidden />
                    {formatNumber(stat.questions)} প্রশ্ন
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1 font-semibold text-[var(--brand)]">
                    বিস্তারিত
                    <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-10 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <Clock3 className="size-5 text-[var(--brand)]" aria-hidden />
        <p className="flex-1 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
          নতুন কোর্স (প্রাইভেট জবস, টেকনিক্যাল নিয়োগ ইত্যাদি) প্রশাসক নিজেই কোড পরিবর্তন ছাড়া যুক্ত
          করতে পারেন। নতুন কোর্স খালি থাকা স্বাভাবিক — যাচাইকৃত প্রশ্ন যোগ হলে সংখ্যা বাড়বে।
        </p>
      </div>
    </div>
  );
}
