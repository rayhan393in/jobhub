import type { Metadata } from "next";
import { Columns3 } from "lucide-react";
import { listCourses } from "@/lib/queries";
import { requirePermission } from "@/lib/permissions";
import { AdminNote, AdminPageHeader } from "@/components/admin/admin-ui";
import { BulkWorkbench } from "./bulk-workbench";
import { getServerClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "বাল্ক অ্যাকশন" };

export default async function BulkPage() {
  await requirePermission("question.review");
  const courses = await listCourses();
  const supabase = await getServerClient();

  const counts: Record<string, number> = {};
  if (supabase) {
    for (const status of ["draft", "pending_review", "approved", "rejected", "archived"]) {
      const { count } = await supabase
        .from("questions")
        .select("id", { count: "exact", head: true })
        .eq("status", status);
      counts[status] = count ?? 0;
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <AdminPageHeader
        eyebrow="বাল্ক অ্যাকশন"
        title="ফিল্টার-স্কোপড অনুমোদন"
        description="ফিল্টার দিয়ে ঠিক কোন প্রশ্নগুলো প্রভাবিত হবে তা আগে দেখুন। সংখ্যা নিশ্চিত না হলে কোনো পরিবর্তন হবে না।"
        action={<Columns3 className="size-5 text-[var(--brand)]" aria-hidden />}
      />

      <AdminNote tone="warning">
        বাল্ক অনুমোদনও <strong>jh_bulk_review</strong> ফাংশন দিয়ে যায় — প্রতি প্রশ্নে রিভিউ রেকর্ড লেখা হয় এবং
        audit log-এ স্কোপসহ এন্ট্রি থাকে। AI-সহায়ক প্রশ্ন থাকলে সেগুলোও আলাদা করে দেখে নিন।
      </AdminNote>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          ["ড্রাফট", counts.draft ?? 0],
          ["রিভিউ অপেক্ষায়", counts.pending_review ?? 0],
          ["অনুমোদিত", counts.approved ?? 0],
          ["বাতিল", counts.rejected ?? 0],
          ["আর্কাইভ", counts.archived ?? 0],
        ].map(([label, value]) => (
          <div key={String(label)} className="jh-card p-3">
            <p className="text-[0.5625rem] font-medium uppercase tracking-[0.08em] text-[var(--text-subtle)]">{label}</p>
            <p className="mt-0.5 text-[1.125rem] font-bold tabular-nums text-[var(--text)]">{formatNumber(Number(value))}</p>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <BulkWorkbench courses={courses.map((c) => ({ id: c.id, title_bn: c.title_bn }))} />
      </div>
    </div>
  );
}
