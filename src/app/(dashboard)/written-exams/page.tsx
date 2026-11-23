import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { WrittenExamCenter } from "@/components/written/written-exam-center";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "লিখিত পরীক্ষা" };

export default async function WrittenExamsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        eyebrow="লিখিত পরীক্ষা"
        title="লিখিত পরীক্ষা কেন্দ্র"
        description="লিখিত স্টেজ আছে এমন নিয়োগ পরীক্ষার (বিসিএস, এনটিআরসিএ, সরকারি চাকরি, পেট্রোবাংলা, টেকনিক্যাল) জন্য টাইমড লিখিত পরীক্ষা। টাইপ করে উত্তর দিন বা হাতে লেখা খাতার ছবি/PDF আপলোড করুন — পরীক্ষক দেখে নম্বর দেবেন।"
      />
      <WrittenExamCenter />
    </div>
  );
}
