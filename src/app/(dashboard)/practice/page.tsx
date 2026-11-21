import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight, Bookmark, Layers, ListChecks, RotateCcw,
  Shuffle, Sparkles, Target, TriangleAlert,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ExamBuilder } from "@/components/exam/exam-builder";
import { getCurrentUser } from "@/lib/auth";
import { listCourses, listSubjects, listTopicsWithSubtopics, getStudentAnalytics } from "@/lib/queries";
import { getServerClient } from "@/lib/supabase/server";
import { formatNumber, formatPercent } from "@/lib/format";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "প্র্যাকটিস সেন্টার" };

export default async function PracticePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [courses, analytics] = await Promise.all([listCourses(), getStudentAnalytics(null)]);
  const supabase = await getServerClient();

  const subjectsByCourse: Record<string, { id: string; title_bn: string; title_en: string }[]> = {};
  const topicsByCourse: Record<string, { id: string; subject_id: string; title_bn: string; title_en: string; subtopics: { id: string; title_bn: string }[] }[]> = {};

  await Promise.all(
    courses.map(async (course) => {
      const [subjects, topics] = await Promise.all([
        listSubjects(course.id),
        listTopicsWithSubtopics(course.id),
      ]);
      subjectsByCourse[course.id] = subjects.map((s) => ({ id: s.id, title_bn: s.title_bn, title_en: s.title_en }));
      topicsByCourse[course.id] = topics.map((t) => ({
        id: t.id,
        subject_id: t.subject_id,
        title_bn: t.title_bn,
        title_en: t.title_en,
        subtopics: t.subtopics.map((s) => ({ id: s.id, title_bn: s.title_bn })),
      }));
    }),
  );

  let bookmarkCount = 0;
  if (supabase) {
    const { count } = await supabase
      .from("bookmarks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    bookmarkCount = count ?? 0;
  }

  const weakTopics = (analytics?.topics ?? []).slice(0, 3);
  const hasHistory = (analytics?.summary.attempts ?? 0) > 0;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        eyebrow="প্র্যাকটিস সেন্টার"
        title="অনুশীলন — পরীক্ষার দিনের জন্য প্রস্তুতি"
        description="প্র্যাকটিস ও নির্ধারিত পরীক্ষা সম্পূর্ণ আলাদা। প্র্যাকটিসের ফলাফল সাথে সাথেই পাওয়া যায় এবং লিডারবোর্ডে গণ্য হয় না।"
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            icon: <Shuffle className="size-4" />,
            title: "মিশ্র অনুশীলন",
            text: "সব বিষয় মিশিয়ে প্রশ্ন",
            href: "#builder",
          },
          {
            icon: <Target className="size-4" />,
            title: "টপিক-ভিত্তিক",
            text: "নির্দিষ্ট টপিক বেছে নিন",
            href: "#builder",
          },
          {
            icon: <RotateCcw className="size-4" />,
            title: "রিভিশন প্র্যাকটিস",
            text: hasHistory ? `${formatNumber(weakTopics.length)} দুর্বল টপিক` : "ফলাফল থেকে তৈরি হবে",
            href: "#builder",
          },
          {
            icon: <Bookmark className="size-4" />,
            title: "বুকমার্ক ও ভুল উত্তর",
            text: `${formatNumber(bookmarkCount)} বুকমার্ক`,
            href: "/bookmarks",
          },
        ].map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="jh-card jh-card-hover flex items-start gap-2.5 p-4"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
              {item.icon}
            </span>
            <span>
              <span className="block text-[0.8125rem] font-semibold text-[var(--text)]">{item.title}</span>
              <span className="mt-0.5 block text-[0.6875rem] text-[var(--text-subtle)]">{item.text}</span>
            </span>
          </Link>
        ))}
      </div>

      {weakTopics.length > 0 ? (
        <section className="mb-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4" aria-labelledby="weak-h">
          <div className="flex items-center justify-between gap-2">
            <h2 id="weak-h" className="flex items-center gap-2 text-[0.875rem] font-semibold text-[var(--text)]">
              <Sparkles className="size-4 text-[var(--brand)]" aria-hidden />
              আপনার দুর্বল টপিক (বাস্তব ফলাফল থেকে)
            </h2>
            <Link href="/analytics" className="text-[0.6875rem] font-semibold text-[var(--brand)] hover:underline">
              বিশ্লেষণ
            </Link>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {weakTopics.map((topic) => (
              <Link
                key={topic.topic_id}
                href={`/custom-exam?topic=${topic.topic_id}`}
                className="rounded-xl border border-[var(--border)] px-3 py-2.5 transition-colors hover:border-[var(--brand)]"
              >
                <p className="truncate text-[0.75rem] font-semibold text-[var(--text)]">{topic.title_bn}</p>
                <p className="mt-0.5 text-[0.625rem] text-[var(--text-subtle)]">
                  {topic.subject_bn} · {formatPercent(topic.accuracy)} · {formatNumber(topic.attempted)} প্রশ্ন
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div id="builder" className="scroll-mt-20">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[1rem] font-bold tracking-[-0.02em] text-[var(--text)]">প্র্যাকটিস পরীক্ষা তৈরি করুন</h2>
          <div className="flex items-center gap-2">
            <Badge tone="success" dot>
              যাচাইকৃত প্রশ্ন
            </Badge>
            <Badge tone="neutral">ফলাফল তাৎক্ষণিক</Badge>
          </div>
        </div>

        {courses.length === 0 ? (
          <EmptyState
            icon={<Layers className="size-5" />}
            title="কোনো প্রকাশিত কোর্স নেই"
            description="প্রশাসক কোর্স প্রকাশ করলে প্র্যাকটিস শুরু করা যাবে।"
          />
        ) : (
          <Suspense fallback={<div className="jh-skeleton h-[30rem] w-full" />}>
            <ExamBuilder
              courses={courses.map((c) => ({ id: c.id, slug: c.slug, title_bn: c.title_bn, exam_config: c.exam_config }))}
              subjectsByCourse={subjectsByCourse}
              topicsByCourse={topicsByCourse}
              mode="mixed_practice"
              initialCourseSlug={courses[0]?.slug}
            />
          </Suspense>
        )}
      </div>

      <section className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="flex items-center gap-2 text-[0.875rem] font-semibold text-[var(--text)]">
          <ListChecks className="size-4 text-[var(--brand)]" aria-hidden />
          প্র্যাকটিস বনাম নির্ধারিত পরীক্ষা
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-[var(--surface-muted)] p-3">
            <p className="text-[0.75rem] font-semibold text-[var(--text)]">প্র্যাকটিস (এখানে)</p>
            <ul className="mt-1 space-y-0.5 text-[0.6875rem] leading-relaxed text-[var(--text-muted)]">
              <li>যেকোনো সময় শুরু করা যায়</li>
              <li>ফলাফল ও ব্যাখ্যা সাথে সাথেই</li>
              <li>লিডারবোর্ডে গণ্য হয় না</li>
            </ul>
          </div>
          <div className="rounded-xl bg-[var(--surface-muted)] p-3">
            <p className="text-[0.75rem] font-semibold text-[var(--text)]">নির্ধারিত লাইভ পরীক্ষা</p>
            <ul className="mt-1 space-y-0.5 text-[0.6875rem] leading-relaxed text-[var(--text-muted)]">
              <li>নির্দিষ্ট এন্ট্রি উইন্ডোতে অংশগ্রহণ</li>
              <li>ফলাফল প্রকাশের সময় পর্যন্ত গোপন</li>
              <li>লিডারবোর্ডে গণনা হয়</li>
            </ul>
            <ButtonLink href="/exams" variant="ghost" size="sm" className="mt-2 -ml-2">
              পরীক্ষা কেন্দ্র
              <ArrowRight className="size-3" aria-hidden />
            </ButtonLink>
          </div>
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-[0.625rem] leading-relaxed text-[var(--text-subtle)]">
          <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
          প্রশ্নের উৎস ও যাচাই-অবস্থা প্রতিটি প্রশ্নে সংরক্ষিত থাকে। কোনো প্রশ্ন যাচাই ছাড়া প্র্যাকটিসেও আসে না।
        </p>
      </section>
    </div>
  );
}
