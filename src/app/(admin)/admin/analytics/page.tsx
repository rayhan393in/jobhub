import type { Metadata } from "next";
import { ChartNoAxesColumn, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { getServerClient } from "@/lib/supabase/server";
import { getAdminOverview } from "@/lib/admin-queries";
import { listCourses } from "@/lib/queries";
import { requirePermission } from "@/lib/permissions";
import { formatNumber, formatPercent } from "@/lib/format";
import { AdminPageHeader, MiniStat } from "@/components/admin/admin-ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "অ্যানালিটিক্স" };

export default async function AdminAnalyticsPage() {
  await requirePermission("analytics.view");
  const supabase = await getServerClient();
  const [overview, courses] = await Promise.all([getAdminOverview(), listCourses()]);

  // Question coverage per course — real counts, no estimation.
  const coverage: { title: string; approved: number; total: number; verified: number }[] = [];
  if (supabase) {
    for (const course of courses) {
      const [{ count: total }, { count: approved }, { count: verified }] = await Promise.all([
        supabase.from("questions").select("id", { count: "exact", head: true }).eq("course_id", course.id),
        supabase
          .from("questions")
          .select("id", { count: "exact", head: true })
          .eq("course_id", course.id)
          .eq("status", "approved")
          .eq("is_verified", true),
        supabase
          .from("questions")
          .select("id", { count: "exact", head: true })
          .eq("course_id", course.id)
          .eq("is_verified", true),
      ]);
      coverage.push({ title: course.title_bn, approved: approved ?? 0, total: total ?? 0, verified: verified ?? 0 });
    }
  }

  const maxTotal = Math.max(1, ...coverage.map((row) => row.total));

  return (
    <div className="mx-auto w-full max-w-5xl">
      <AdminPageHeader
        eyebrow="অ্যানালিটিক্স"
        title="প্ল্যাটফর্মের বাস্তব ডেটা"
        description="প্রতিটি সংখ্যা সরাসরি ডেটাবেস কুয়েরি থেকে। কোনো অনুমান, পূর্বাভাস বা AI-উত্পন্ন সুপারিশ নেই।"
        action={<ChartNoAxesColumn className="size-5 text-[var(--brand)]" aria-hidden />}
      />

      {!overview ? (
        <EmptyState icon={<ChartNoAxesColumn className="size-5" />} title="ডেটা পাওয়া যায়নি" description="সার্ভার কনফিগারেশন যাচাই করুন।" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MiniStat icon={<ChartNoAxesColumn className="size-4" />} label="প্রশ্ন" value={formatNumber(overview.questions.total)} hint={`${formatNumber(overview.questions.verified)} যাচাইকৃত`} />
            <MiniStat icon={<ChartNoAxesColumn className="size-4" />} label="শিক্ষার্থী" value={formatNumber(overview.students)} hint="নিবন্ধিত" />
            <MiniStat icon={<ChartNoAxesColumn className="size-4" />} label="প্রচেষ্টা" value={formatNumber(overview.attempts.total)} hint={`${formatNumber(overview.attempts.submitted)} জমা`} />
            <MiniStat icon={<ChartNoAxesColumn className="size-4" />} label="প্রকাশিত পরীক্ষা" value={formatNumber(overview.schedules.published)} hint={`${formatNumber(overview.schedules.completed)} সম্পন্ন`} />
          </div>

          <section className="jh-card mt-4 p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[0.875rem] font-semibold text-[var(--text)]">কোর্সভিত্তিক প্রশ্ন কভারেজ</h2>
              <Badge tone="neutral">বাস্তব</Badge>
            </div>
            <ul className="mt-3 space-y-2.5">
              {coverage.map((row) => (
                <li key={row.title}>
                  <div className="flex items-baseline justify-between gap-2 text-[0.75rem]">
                    <span className="truncate text-[var(--text)]">{row.title}</span>
                    <span className="shrink-0 tabular-nums text-[var(--text-subtle)]">
                      {formatNumber(row.approved)} যাচাইকৃত-অনুমোদিত / {formatNumber(row.total)} মোট
                    </span>
                  </div>
                  <Progress
                    value={(row.total / maxTotal) * 100}
                    className="mt-1"
                    tone={row.approved > 0 ? "success" : "warning"}
                    label={`${row.title} coverage`}
                  />
                  <p className="mt-0.5 text-[0.5625rem] text-[var(--text-subtle)]">
                    যাচাইকৃত {formatPercent(row.total ? (row.verified / row.total) * 100 : 0)}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="jh-card mt-4 p-5">
            <h2 className="text-[0.875rem] font-semibold text-[var(--text)]">রিভিউ ও প্রকাশনা</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["রিভিউ অপেক্ষায়", overview.questions.pending],
                ["AI অযাচাইকৃত", overview.questions.aiUnverified],
                ["ড্রাফট পরীক্ষা", overview.schedules.draft],
                ["প্রকাশিত রুটিন", overview.routines.published],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl bg-[var(--surface-muted)] px-3 py-2">
                  <dt className="text-[0.5625rem] text-[var(--text-subtle)]">{label}</dt>
                  <dd className="text-[1rem] font-bold tabular-nums text-[var(--text)]">{formatNumber(Number(value))}</dd>
                </div>
              ))}
            </dl>
          </section>

          <p className="mt-4 flex items-start gap-1.5 text-[0.625rem] text-[var(--text-subtle)]">
            <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
            এই পাতায় কোনো কৃত্রিম পারফরম্যান্স ট্রেন্ড বা ভবিষ্যদ্বাণী নেই — শুধু সংরক্ষিত রেকর্ড।
          </p>
        </>
      )}
    </div>
  );
}
