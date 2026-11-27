import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Layers, NotebookText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatNumber } from "@/lib/format";
import { listSyllabusCourses } from "@/lib/syllabus";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "সিলেবাস ও নম্বর বিভাজন",
  description:
    "BCS, প্রাথমিক শিক্ষক, NTRCA সহ প্রতিটি কোর্সের বিষয়ভিত্তিক সিলেবাস — টপিক, সাব-টপিক, অগ্রাধিকার (P1/P2/P3) ও নম্বর বিভাজন এক জায়গায়।",
};

export default async function SyllabusIndexPage() {
  const courses = await listSyllabusCourses();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <header className="max-w-2xl">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">
          সিলেবাস
        </p>
        <h1 className="mt-2 text-balance text-[1.875rem] font-bold tracking-[-0.035em] text-[var(--text)] sm:text-[2.25rem]">
          বিষয়, টপিক ও নম্বর বিভাজন
        </h1>
        <p className="mt-3 text-pretty text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
          প্রতিটি কোর্সের সিলেবাস আলাদা করে সাজানো — প্রতিটি সাব-টপিক আলাদা রেকর্ড, তাই প্রশ্ন,
          রুটিন ও অগ্রাধিকার সবই একই নামে মিলে যায়। প্রতিটি সাব-টপিকের পাশে তার অগ্রাধিকার
          (P1 = সর্বোচ্চ, P3 = সর্বনিম্ন) দেওয়া আছে।
        </p>
      </header>

      {courses.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<Layers className="size-5" />}
            title="এখনো কোনো প্রকাশিত সিলেবাস নেই"
            description="প্রশাসক সিলেবাস যোগ করলে এখানে কোর্সভিত্তিক রূপরেখা দেখা যাবে।"
          />
        </div>
      ) : (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {courses.map((course) => (
            <li key={course.id}>
              <Link
                href={`/syllabus/${course.slug}`}
                className="jh-card group flex h-full flex-col justify-between gap-4 p-5 transition-colors hover:border-[var(--brand)]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <NotebookText className="size-4 text-[var(--brand)]" aria-hidden />
                    <h2 className="text-[1rem] font-semibold text-[var(--text)]">{course.title_bn}</h2>
                  </div>
                  <p className="mt-1.5 text-[0.8125rem] text-[var(--text-muted)]">
                    {formatNumber(course.subjects)} বিষয় · {formatNumber(course.topics)} টপিক ·{" "}
                    {formatNumber(course.subtopics)} সাব-টপিক
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Badge tone={course.marks > 0 ? "brand" : "neutral"}>
                    {course.marks > 0 ? `মোট ${formatNumber(course.marks)} নম্বর` : "নম্বর বিভাজন যুক্ত হচ্ছে"}
                  </Badge>
                  <span className="inline-flex items-center gap-1 text-[0.75rem] font-semibold text-[var(--brand)]">
                    সিলেবাস দেখুন
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
