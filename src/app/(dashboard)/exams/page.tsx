import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { ExamCenterClient } from "@/components/exam/exam-center-client";
import { getCurrentUser } from "@/lib/auth";
import { listCourses, listPublishedSchedules } from "@/lib/queries";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "লাইভ পরীক্ষা কেন্দ্র" };

export default async function ExamsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [schedules, courses] = await Promise.all([
    // The 90-day BCS plan publishes a daily live exam per day, and each course
    // keeps its own season, so the cap has to hold the whole set — otherwise a
    // running exam from a later part of the plan silently falls off the list.
    listPublishedSchedules({ userId: user.id, limit: 1000 }),
    listCourses(),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        eyebrow="পরীক্ষা কেন্দ্র"
        title="লাইভ ও নির্ধারিত পরীক্ষা"
        description="প্রতিটি পরীক্ষার নিজস্ব সময়, প্রশ্নসংখ্যা, নম্বর ও ফলাফল প্রকাশের সময় থাকে। এন্ট্রি উইন্ডোর আগে বা পরে অংশগ্রহণ করা যায় না।"
      />
      <ExamCenterClient
        schedules={schedules}
        courses={courses.map((c) => ({ id: c.id, slug: c.slug, title_bn: c.title_bn }))}
      />
    </div>
  );
}
