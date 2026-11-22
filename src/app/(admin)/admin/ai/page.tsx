import type { Metadata } from "next";
import { requirePermission } from "@/lib/permissions";
import { listCourses } from "@/lib/queries";
import { AdminNote, AdminPageHeader } from "@/components/admin/admin-ui";
import { AiWorkbench } from "./ai-workbench";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AI প্রশ্ন জেনারেটর" };

export default async function AiGeneratorPage() {
  await requirePermission("question.import");
  const courses = await listCourses();
  const configured = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <AdminPageHeader
        eyebrow="AI সহায়ক"
        title="AI দিয়ে প্রশ্নের খসড়া তৈরি"
        description="Google Gemini (ফ্রি টিয়ার) দিয়ে বিষয়-টপিক ধরে MCQ খসড়া তৈরি হয়। প্রতিটি প্রশ্ন ইমপোর্ট পাইপলাইন দিয়ে 'রিভিউ অপেক্ষায়' হিসেবে ঢোকে — আপনি যাচাই ও অনুমোদন না করা পর্যন্ত কোনো পরীক্ষায় ব্যবহার হয় না।"
      />

      {!configured ? (
        <div className="mb-4">
          <AdminNote tone="warning">
          <strong>AI এখনো কনফিগার করা নেই।</strong> ফ্রি API Key নিন{" "}
          <span className="font-mono text-[0.6875rem]">aistudio.google.com/apikey</span> থেকে, তারপর Vercel
          প্রজেক্টের Settings → Environment Variables-এ <span className="font-mono text-[0.6875rem]">GEMINI_API_KEY</span>{" "}
          নামে যোগ করে redeploy করুন। Key যোগ হলে এই পেজ থেকেই প্রশ্ন তৈরি করা যাবে।
          </AdminNote>
        </div>
      ) : null}

      <AiWorkbench
        courses={courses.map((c) => ({ id: c.id, title_bn: c.title_bn }))}
        configured={configured}
      />
    </div>
  );
}
