import type { Metadata } from "next";
import { requirePermission } from "@/lib/permissions";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { WrittenExamManager } from "@/components/written/written-exam-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "লিখিত পরীক্ষা ব্যবস্থাপনা" };

/**
 * /admin/written-exams — written exam module.
 *
 * Exams can be created only for courses whose exam registry carries a
 * published 'written' stage (BCS, NTRCA, সরকারি চাকরি, পেট্রোবাংলা AE,
 * টেকনিক্যাল নিয়োগ) — eligibility is registry data, not a code switch.
 * Students type answers and/or upload খাতা pages; examiners mark each
 * answer here and finalize the grade.
 */
export default async function WrittenExamsAdminPage() {
  await requirePermission("exam.publish");

  return (
    <div className="mx-auto w-full max-w-5xl">
      <AdminPageHeader
        eyebrow="পরীক্ষা"
        title="লিখিত পরীক্ষা ব্যবস্থাপনা"
        description="লিখিত স্টেজ নিবন্ধিত কোর্সের জন্য লিখিত পরীক্ষা তৈরি, প্রকাশ ও খাতা মূল্যায়ন।"
      />
      <WrittenExamManager />
    </div>
  );
}
