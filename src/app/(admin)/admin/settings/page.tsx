import type { Metadata } from "next";
import { Settings2 } from "lucide-react";
import { getSystemSettings } from "@/lib/admin-queries";
import { requirePermission } from "@/lib/permissions";
import { AdminNote, AdminPageHeader } from "@/components/admin/admin-ui";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "সিস্টেম সেটিংস" };

export default async function SettingsPage() {
  await requirePermission("settings.manage");
  const settings = await getSystemSettings();

  return (
    <div className="mx-auto w-full max-w-4xl">
      <AdminPageHeader
        eyebrow="সিস্টেম সেটিংস"
        title="সীমা, নম্বরকরণ ও প্ল্যাটফর্ম"
        description="এখানে বদলানো মান নতুন পরীক্ষায় প্রযোজ্য হয়। ইতিমধ্যে তৈরি ড্রাফট ও প্রকাশিত পরীক্ষা অপরিবর্তিত থাকে।"
        action={<Settings2 className="size-5 text-[var(--brand)]" aria-hidden />}
      />

      <AdminNote tone="warning">
        মার্কিং ডিফল্ট (+১ / −০.৫ / ০) প্রতিটি নতুন পরীক্ষার জন্য প্রযোজ্য, কিন্তু প্রতিটি পরীক্ষার নিজস্ব
        positive_marks/negative_marks থাকে। ইতিমধ্যে জমা দেওয়া পরীক্ষার স্কোর কখনো পুনরায় গণনা করা হয় না।
      </AdminNote>

      <div className="mt-4">
        <SettingsForm
          platform={(settings.platform ?? {}) as Record<string, unknown>}
          limits={(settings.exam_limits ?? {}) as Record<string, unknown>}
          marking={(settings.marking ?? {}) as Record<string, unknown>}
          pdf={(settings.pdf_downloads ?? {}) as Record<string, unknown>}
        />
      </div>
    </div>
  );
}
