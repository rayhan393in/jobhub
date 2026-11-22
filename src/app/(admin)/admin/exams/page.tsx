import type { Metadata } from "next";
import { Radio, ShieldAlert } from "lucide-react";
import { getServerClient } from "@/lib/supabase/server";
import { listCourses } from "@/lib/queries";
import { requirePermission } from "@/lib/permissions";
import { getSystemSettings } from "@/lib/admin-queries";
import { AdminNote, AdminPageHeader } from "@/components/admin/admin-ui";
import { ExamPublisher } from "./exam-publisher";
import { WeeklyExamPanel } from "./weekly-exam-panel";
import { DailyExamPanel } from "./daily-exam-panel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "পরীক্ষা প্রকাশ" };

export type PublisherSchedule = {
  id: string;
  course_id: string;
  kind: string;
  title_bn: string;
  starts_at: string;
  ends_at: string;
  result_release_at: string;
  duration_minutes: number;
  question_count: number;
  total_marks: number;
  status: string;
  published_at: string | null;
  settings: { composition?: { items?: { count: number; subject_id?: string | null }[] } } | null;
};

export default async function ExamsAdminPage() {
  await requirePermission("exam.publish");
  const [courses, settings] = await Promise.all([listCourses(), getSystemSettings()]);
  const supabase = await getServerClient();

  let schedules: PublisherSchedule[] = [];
  if (supabase) {
    const { data } = await supabase
      .from("exam_schedules")
      .select(
        "id, course_id, kind, title_bn, starts_at, ends_at, result_release_at, duration_minutes, question_count, total_marks, status, published_at, settings",
      )
      .in("status", ["draft", "published", "completed", "cancelled"])
      .order("starts_at", { ascending: false })
      .limit(40);
    schedules = (data ?? []) as unknown as PublisherSchedule[];
  }

  const limits = (settings.exam_limits ?? {}) as { max_questions?: number; max_duration_minutes?: number };
  const marking = (settings.marking ?? {}) as { positive_marks?: number; negative_marks?: number };

  return (
    <div className="mx-auto w-full max-w-6xl">
      <AdminPageHeader
        eyebrow="পরীক্ষা প্রকাশ"
        title="ড্রাফট তৈরি করুন, যাচাই করে প্রকাশ করুন"
        description="প্রকাশের সময় সার্ভার নিজে যাচাই করে — যথেষ্ট যাচাইকৃত প্রশ্ন না থাকলে প্রকাশ আটকে যায়। প্রকাশিত প্রশ্নপত্র অপরিবর্তনীয়।"
        action={<Radio className="size-5 text-[var(--brand)]" aria-hidden />}
      />

      <AdminNote tone="warning">
        <strong>রুটিন সংরক্ষণ পরীক্ষা প্রকাশ করে না।</strong> শুধু এখান থেকে প্রকাশিত ও পর্যাপ্ত যাচাইকৃত প্রশ্নসহ
        পরীক্ষাই শিক্ষার্থীদের এন্ট্রি উইন্ডোতে দেখা যায়। ডিফল্ট নম্বরকরণ: +{marking.positive_marks ?? 1} / −
        {marking.negative_marks ?? 0.5} / ০ (প্রতি পরীক্ষায় পরিবর্তনযোগ্য)।
      </AdminNote>

      <div className="mt-4">
        <DailyExamPanel
          courses={courses.map((course) => ({ id: course.id, title_bn: course.title_bn }))}
          today={new Date(Date.now() + 6 * 3600_000).toISOString().slice(0, 10)}
        />
      </div>

      <div className="mt-4">
        <WeeklyExamPanel
          courses={courses.map((course) => ({ id: course.id, title_bn: course.title_bn }))}
          today={new Date(Date.now() + 6 * 3600_000).toISOString().slice(0, 10)}
        />
      </div>

      <div className="mt-4">
        <ExamPublisher
          courses={courses.map((c) => ({ id: c.id, title_bn: c.title_bn, slug: c.slug }))}
          schedules={schedules}
          limits={{
            maxQuestions: limits.max_questions ?? 100,
            maxDuration: limits.max_duration_minutes ?? 180,
            positive: marking.positive_marks ?? 1,
            negative: marking.negative_marks ?? 0.5,
          }}
        />
      </div>

      <div className="mt-4 flex items-start gap-1.5 text-[0.625rem] text-[var(--text-subtle)]">
        <ShieldAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
        <p>
          প্রকাশের শর্ত: কোর্স প্রকাশিত, শুরুর সময় ভবিষ্যতে, শেষ সময় শুরুর পরে, ফলাফল প্রকাশ শেষ সময়ের পরে বা
          সমান, এবং প্রয়োজনীয় সংখ্যক অনুমোদিত+যাচাইকৃত প্রশ্ন উপলব্ধ।
        </p>
      </div>
    </div>
  );
}
