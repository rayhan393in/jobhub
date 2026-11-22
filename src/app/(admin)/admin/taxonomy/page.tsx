import type { Metadata } from "next";
import { Network } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { formatNumber } from "@/lib/format";
import { AdminNote, AdminPageHeader } from "@/components/admin/admin-ui";
import { TaxonomyWorkbench } from "./taxonomy-workbench";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "টপিক ডাটাবেস" };

export default async function TaxonomyAdminPage() {
  await requirePermission("taxonomy.manage");
  const supabase = await getServerClient();

  let courses: Array<{ id: string; title_bn: string; slug: string }> = [];
  let pendingTopics = 0;
  let pendingSubtopics = 0;

  if (supabase) {
    const [{ data: courseRows }, { count: topicCount }, { count: subtopicCount }] = await Promise.all([
      supabase.from("courses").select("id, title_bn, slug").order("sort_order"),
      supabase.from("topics").select("id", { count: "exact", head: true }).eq("approval_status", "pending"),
      supabase.from("subtopics").select("id", { count: "exact", head: true }).eq("approval_status", "pending"),
    ]);
    courses = courseRows ?? [];
    pendingTopics = topicCount ?? 0;
    pendingSubtopics = subtopicCount ?? 0;
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <AdminPageHeader
        eyebrow="টপিক ডাটাবেস"
        title="বিষয় → টপিক → সাব-টপিক ব্যবস্থাপনা"
        description="গবেষণাভিত্তিক টপিক প্রথমে পেন্ডিং অবস্থায় আসে — আপনি যাচাই করে অনুমোদন দিলে তবেই শিক্ষার্থীরা (রুটিন, প্র্যাকটিস, পরীক্ষায়) দেখতে পায়।"
        action={
          <div className="flex gap-1.5">
            <Badge tone={pendingTopics > 0 ? "warning" : "success"}>
              {formatNumber(pendingTopics)} পেন্ডিং টপিক
            </Badge>
            <Badge tone={pendingSubtopics > 0 ? "warning" : "neutral"}>
              {formatNumber(pendingSubtopics)} পেন্ডিং সাব-টপিক
            </Badge>
          </div>
        }
      />

      <AdminNote tone="brand">
        <span className="inline-flex items-center gap-1">
          <Network className="size-3.5" aria-hidden />
          <strong>কমন টপিক একবারই তৈরি করুন।</strong>
        </span>{" "}
        “কমন লাইব্রেরি” থেকে একটি টপিক একাধিক কোর্সে ম্যাপ করা যায় — কোর্সভেদে কঠিনতা ও সাব-টপিক আলাদা থাকে।
        প্রশ্ন বা রুটিনে ব্যবহৃত কোনো টপিক মুছে ফেলা যায় না (নিরাপত্তা গার্ড)।
      </AdminNote>

      <div className="mt-4">
        <TaxonomyWorkbench courses={courses} />
      </div>
    </div>
  );
}
