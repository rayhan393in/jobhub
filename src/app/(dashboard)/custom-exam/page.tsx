import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { ExamBuilder } from "@/components/exam/exam-builder";
import { EmptyState } from "@/components/ui/empty-state";
import { listCourses, listSubjects, listTopicsWithSubtopics } from "@/lib/queries";
import { Layers } from "lucide-react";
import { getServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "কাস্টম পরীক্ষা" };

export default async function CustomExamPage() {
  const courses = await listCourses();
  const supabase = await getServerClient();

  const subjectsByCourse: Record<string, { id: string; title_bn: string; title_en: string }[]> = {};
  const topicsByCourse: Record<string, { id: string; subject_id: string; title_bn: string; title_en: string; subtopics: { id: string; title_bn: string }[] }[]> = {};

  await Promise.all(
    courses.map(async (course) => {
      const [subjects, topics] = await Promise.all([
        listSubjects(course.id),
        listTopicsWithSubtopics(course.id),
      ]);
      subjectsByCourse[course.id] = subjects.map((s) => ({
        id: s.id,
        title_bn: s.title_bn,
        title_en: s.title_en,
      }));
      topicsByCourse[course.id] = topics.map((t) => ({
        id: t.id,
        subject_id: t.subject_id,
        title_bn: t.title_bn,
        title_en: t.title_en,
        subtopics: t.subtopics.map((s) => ({ id: s.id, title_bn: s.title_bn })),
      }));
    }),
  );

  let limits = { max_questions: 100, max_duration_minutes: 180 };
  if (supabase) {
    const { data } = await supabase.from("system_settings").select("value").eq("key", "exam_limits").maybeSingle();
    if (data?.value) {
      const value = data.value as { max_questions?: number; max_duration_minutes?: number };
      limits = {
        max_questions: value.max_questions ?? 100,
        max_duration_minutes: value.max_duration_minutes ?? 180,
      };
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        eyebrow="কাস্টম পরীক্ষা"
        title="নিজের পরিমাণে অনুশীলন"
        description="কোর্স, বিষয়, টপিক বা সাবটপিক বেছে নিয়ে প্রশ্নসংখ্যা ও সময় নির্ধারণ করুন। শুধু যাচাইকৃত প্রশ্ন ব্যবহার হয়; পর্যাপ্ত প্রশ্ন না থাকলে প্ল্যাটফর্ম স্পষ্টভাবে জানায়।"
      />
      {courses.length === 0 ? (
        <EmptyState
          icon={<Layers className="size-5" />}
          title="কোনো প্রকাশিত কোর্স নেই"
          description="প্রশাসক কোর্স প্রকাশ করলে কাস্টম পরীক্ষা তৈরি করা যাবে।"
        />
      ) : (
        <Suspense fallback={<div className="jh-skeleton h-[30rem] w-full" />}>
          <ExamBuilder
            courses={courses.map((c) => ({
              id: c.id,
              slug: c.slug,
              title_bn: c.title_bn,
              exam_config: c.exam_config,
            }))}
            subjectsByCourse={subjectsByCourse}
            topicsByCourse={topicsByCourse}
            maxQuestions={limits.max_questions}
            maxDuration={limits.max_duration_minutes}
            mode="custom"
          />
        </Suspense>
      )}
    </div>
  );
}
