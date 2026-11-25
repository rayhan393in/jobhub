import type { Metadata } from "next";
import { CalendarCheck2, Landmark, ShieldAlert, ShieldCheck } from "lucide-react";
import { requirePermission } from "@/lib/permissions";
import { getAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { listCourses } from "@/lib/queries";
import { AdminNote, AdminPageHeader, MiniStat } from "@/components/admin/admin-ui";
import { formatNumber } from "@/lib/format";
import { ExamRegistryManager } from "./exam-registry-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "পরীক্ষা রেজিস্ট্রি" };

export type ExamRow = {
  id: string;
  slug: string;
  exam_name: string;
  exam_name_bn: string | null;
  exam_body: string | null;
  exam_year: number | null;
  exam_stage: string;
  position_title: string | null;
  course_id: string | null;
  status: "draft" | "published" | "archived";
  year_verified: boolean;
  source_url: string | null;
  notes: string | null;
  evidence_count: number;
};

/**
 * Exam Registry.
 *
 * Every examination (e.g. "৪৫তম বিসিএস প্রিলিমিনারি ২০২৩", "Petrobangla AE
 * (EEE) ২০২২") becomes one canonical record that evidence records point at.
 * The year column is honest: an exam whose year nobody has verified stays
 * NULL + "অযাচাইকৃত" — it is never guessed, and such exams never feed the
 * historical analytics view.
 */
export default async function ExamRegistryPage() {
  await requirePermission("question.review");
  const courses = await listCourses();

  let exams: ExamRow[] = [];
  if (isSupabaseConfigured) {
    const supabase = getAdminClient();
    const { data: examRows } = await supabase
      .from("exam_registry")
      .select(
        "id, slug, exam_name, exam_name_bn, exam_body, exam_year, exam_stage, position_title, course_id, status, year_verified, source_url, notes",
      )
      .order("exam_year", { ascending: false, nullsFirst: false })
      .order("exam_name", { ascending: true })
      .limit(500);

    const base = (examRows ?? []) as Array<Omit<ExamRow, "evidence_count">>;
    const counts = new Map<string, number>();
    if (base.length > 0) {
      const { data: evidenceRows } = await supabase
        .from("evidence_records")
        .select("exam_id")
        .in("exam_id", base.map((exam) => exam.id));
      for (const record of (evidenceRows ?? []) as Array<{ exam_id: string | null }>) {
        if (record.exam_id) counts.set(record.exam_id, (counts.get(record.exam_id) ?? 0) + 1);
      }
    }
    exams = base.map((exam) => ({ ...exam, evidence_count: counts.get(exam.id) ?? 0 }));
  }

  const published = exams.filter((exam) => exam.status === "published").length;
  const verifiedYears = exams.filter((exam) => exam.year_verified).length;
  const unverifiedYears = exams.filter((exam) => !exam.year_verified).length;

  return (
    <div>
      <AdminPageHeader
        eyebrow="প্রশ্ন ট্রেসেবিলিটি"
        title="পরীক্ষা রেজিস্ট্রি"
        description="প্রতিটি পরীক্ষা (নাম · সাল · ধাপ · পদ) একটি স্থায়ী রেকর্ড — এভিডেন্স ও বিশ্লেষণ সবকিছু এখান থেকে রেফারেন্স নেয়। সাল অজানা থাকলে খালি থাকে, অনুমান করা হয় না।"
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <MiniStat tone="violet" icon={<Landmark className="h-4 w-4" />} label="মোট পরীক্ষা" value={formatNumber(exams.length)} />
        <MiniStat tone="emerald" icon={<CalendarCheck2 className="h-4 w-4" />} label="প্রকাশিত" value={formatNumber(published)} />
        <MiniStat tone="orange" icon={<ShieldCheck className="h-4 w-4" />} label="যাচাইকৃত সাল" value={formatNumber(verifiedYears)} />
        <MiniStat tone="sky"
          icon={<ShieldAlert className="h-4 w-4" />}
          label="অযাচাইকৃত সাল"
          value={formatNumber(unverifiedYears)}
          hint="এগুলো বিশ্লেষণে গণনা হয় না"
        />
      </div>

      <AdminNote>
        শুধু <strong>প্রকাশিত + যাচাইকৃত-সাল</strong> পরীক্ষাই ঐতিহাসিক বিশ্লেষণে ঢোকে। এভিডেন্স যুক্ত থাকা পরীক্ষা মুছে ফেলা
        যায় না — প্রয়োজনে আর্কাইভ করুন; প্রতিটি পরিবর্তন অডিট লগে যায়।
      </AdminNote>

      <ExamRegistryManager
        courses={courses.map((course) => ({ id: course.id, title_bn: course.title_bn }))}
        exams={exams}
      />
    </div>
  );
}
