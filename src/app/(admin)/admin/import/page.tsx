import type { Metadata } from "next";
import { FileUp, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { listCourses } from "@/lib/queries";
import { requirePermission } from "@/lib/permissions";
import { getServerClient } from "@/lib/supabase/server";
import { formatNumber, relativeFromNow } from "@/lib/format";
import { AdminNote, AdminPageHeader } from "@/components/admin/admin-ui";
import { CSV_TEMPLATE } from "@/lib/import/parse";
import { ImportWorkbench } from "./import-workbench";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ইমপোর্ট" };

export default async function ImportPage() {
  await requirePermission("question.import");
  const courses = await listCourses();
  const supabase = await getServerClient();

  let batches: {
    id: string;
    filename: string | null;
    format: string;
    mode: string;
    total_rows: number;
    created_rows: number;
    failed_rows: number;
    duplicate_rows: number;
    created_at: string;
  }[] = [];

  if (supabase) {
    const { data } = await supabase
      .from("import_batches")
      .select("id, filename, format, mode, total_rows, created_rows, failed_rows, duplicate_rows, created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    batches = data ?? [];
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <AdminPageHeader
        eyebrow="ইমপোর্ট"
        title="CSV / JSON প্রশ্ন ইমপোর্ট"
        description="আপলোড → যাচাই ও পূর্বরূপ → নিশ্চিতকরণ। ভুল সারি কিছুই লিখবে না, ডুপ্লিকেট ফিঙ্গারপ্রিন্টে আটকে যাবে।"
        action={<Badge tone="neutral">সর্বোচ্চ ২০০০ সারি / ফাইল</Badge>}
      />

      <AdminNote tone="brand">
        ইমপোর্ট করা সব প্রশ্ন <strong>রিভিউ অপেক্ষায়</strong> ও <strong>অযাচাইকৃত</strong> হিসেবে জমা হয়। AI-সহায়ক
        সারি কখনোই স্বয়ংক্রিয়ভাবে যাচাইকৃত হয় না — প্রতিটি প্রশ্ন রিভিউ কিউতে ম্যানুয়াল অনুমোদন প্রয়োজন।
      </AdminNote>

      <div className="mt-4">
        <ImportWorkbench courses={courses.map((c) => ({ id: c.id, title_bn: c.title_bn }))} template={CSV_TEMPLATE} />
      </div>

      <section className="jh-card mt-5" aria-labelledby="batches">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-5 py-3">
          <h2 id="batches" className="flex items-center gap-2 text-[0.875rem] font-semibold text-[var(--text)]">
            <History className="size-4 text-[var(--brand)]" aria-hidden />
            সাম্প্রতিক ইমপোর্ট
          </h2>
          <span className="text-[0.625rem] text-[var(--text-subtle)]">{formatNumber(batches.length)} ব্যাচ</span>
        </div>
        {batches.length === 0 ? (
          <p className="px-5 py-6 text-center text-[0.6875rem] text-[var(--text-subtle)]">
            এখনো কোনো ইমপোর্ট হয়নি। উপরের ফর্ম দিয়ে শুরু করুন।
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {batches.map((batch) => (
              <li key={batch.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                <FileUp className="size-3.5 shrink-0 text-[var(--text-subtle)]" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-[0.75rem] font-medium text-[var(--text)]">
                  {batch.filename ?? "upload"}
                </span>
                <Badge tone="neutral">{batch.format.toUpperCase()}</Badge>
                <span className="text-[0.625rem] text-[var(--text-subtle)]">
                  {formatNumber(batch.created_rows)} যোগ · {formatNumber(batch.failed_rows)} ব্যর্থ ·{" "}
                  {formatNumber(batch.duplicate_rows)} ডুপ্লিকেট
                </span>
                <span className="text-[0.625rem] text-[var(--text-subtle)]">{relativeFromNow(batch.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
