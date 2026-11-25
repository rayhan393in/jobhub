import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, BookCopy, CalendarDays, CircleAlert, ClipboardCheck, Clock3, FileUp, Radio,
  ScrollText, ShieldCheck, TrendingUp, Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { ButtonLink } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getAdminOverview } from "@/lib/admin-queries";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatNumber, relativeFromNow } from "@/lib/format";
import { redirect } from "next/navigation";
import { AdminPageHeader, MiniStat } from "@/components/admin/admin-ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ওভারভিউ" };

const ACTION_LABELS: Record<string, string> = {
  "question.bulk_review": "প্রশ্ন রিভিউ (বাল্ক)",
  "question.create": "নতুন প্রশ্ন",
  "question.update": "প্রশ্ন সম্পাদনা",
  "exam.publish": "পরীক্ষা প্রকাশ",
  "routine.publish": "রুটিন প্রকাশ",
  "import.commit": "ইমপোর্ট সম্পন্ন",
  "settings.update": "সেটিংস পরিবর্তন",
  "student.role_update": "রোল পরিবর্তন",
};

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  const { denied } = await searchParams;
  const overview = await getAdminOverview();
  if (!overview) redirect("/dashboard");

  const verifiedShare =
    overview.questions.total > 0
      ? (overview.questions.verified / overview.questions.total) * 100
      : 0;
  const approvedShare =
    overview.questions.total > 0 ? (overview.questions.approved / overview.questions.total) * 100 : 0;

  return (
    <div className="mx-auto w-full max-w-7xl">
      <AdminPageHeader
        eyebrow="অ্যাডমিন সেন্টার"
        title="প্ল্যাটফর্মের বাস্তব অবস্থা"
        description="এই সব সংখ্যা সরাসরি ডেটাবেস থেকে আসে। কোনো নমুনা বা অনুমানিত মেট্রিক এখানে নেই।"
        action={
          <div className="flex flex-wrap gap-2">
            {can(user.role, "question.review") ? (
              <ButtonLink href="/admin/review" size="sm">
                <ClipboardCheck className="size-3.5" aria-hidden />
                রিভিউ কিউ
              </ButtonLink>
            ) : null}
            {can(user.role, "exam.publish") ? (
              <ButtonLink href="/admin/exams" variant="secondary" size="sm">
                <Radio className="size-3.5" aria-hidden />
                পরীক্ষা প্রকাশ
              </ButtonLink>
            ) : null}
          </div>
        }
      />

      {denied ? (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[0.8125rem] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            আপনার রোলে <code className="rounded bg-white/60 px-1 py-0.5 text-[0.6875rem] dark:bg-black/30">{denied}</code>{" "}
            অনুমতি নেই, তাই ওই পাতাটি খোলা হয়নি। প্রয়োজন হলে সুপার অ্যাডমিনকে অনুরোধ করুন — শুধু UI লুকিয়ে
            নয়, সার্ভারও এই অপারেশন প্রত্যাখ্যান করে।
          </p>
        </div>
      ) : null}

      {/* Alerts that reflect real data problems */}
      <div className="mb-5 grid gap-2">
        {overview.questions.pending > 0 ? (
          <AlertRow
            tone="warning"
            icon={<Clock3 className="size-4" aria-hidden />}
            title={`${formatNumber(overview.questions.pending)}টি প্রশ্ন রিভিউয়ের অপেক্ষায়`}
            text="অনুমোদনের আগে এই প্রশ্নগুলো কোনো পরীক্ষা বা প্র্যাকটিসে আসবে না।"
            href="/admin/review"
            cta="রিভিউ করুন"
          />
        ) : null}
        {overview.questions.aiUnverified > 0 ? (
          <AlertRow
            tone="brand"
            icon={<CircleAlert className="size-4" aria-hidden />}
            title={`${formatNumber(overview.questions.aiUnverified)}টি AI-সহায়ক প্রশ্ন এখনো অযাচাইকৃত`}
            text="AI দিয়ে তৈরি প্রশ্ন কখনোই স্বয়ংক্রিয়ভাবে যাচাইকৃত হয় না — প্রতিটি ম্যানুয়াল রিভিউ দরকার।"
            href="/admin/review?source=ai_assisted"
            cta="দেখুন"
          />
        ) : null}
        {overview.schedules.draft > 0 ? (
          <AlertRow
            tone="neutral"
            icon={<Radio className="size-4" aria-hidden />}
            title={`${formatNumber(overview.schedules.draft)}টি ড্রাফট পরীক্ষা প্রকাশের অপেক্ষায়`}
            text="প্রকাশের সময় যাচাইকৃত প্রশ্নের সংখ্যা যাচাই করা হয়; অপর্যাপ্ত হলে প্রকাশ বন্ধ থাকে।"
            href="/admin/schedules"
            cta="সময়সূচি"
          />
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat
          tone="violet"
          icon={<BookCopy className="size-4" />}
          label="মোট প্রশ্ন"
          value={formatNumber(overview.questions.total)}
          hint={`${formatNumber(overview.questions.approved)} অনুমোদিত · ${formatNumber(overview.questions.verified)} যাচাইকৃত`}
        />
        <MiniStat
          tone="sky"
          icon={<Users className="size-4" />}
          label="শিক্ষার্থী"
          value={formatNumber(overview.students)}
          hint={`${formatNumber(overview.staff)} স্টাফ অ্যাকাউন্ট`}
        />
        <MiniStat
          tone="orange"
          icon={<Radio className="size-4" />}
          label="পরীক্ষা"
          value={formatNumber(overview.schedules.published)}
          hint={`${formatNumber(overview.schedules.completed)} সম্পন্ন · ${formatNumber(overview.schedules.draft)} ড্রাফট`}
        />
        <MiniStat
          tone="emerald"
          icon={<TrendingUp className="size-4" />}
          label="প্রচেষ্টা"
          value={formatNumber(overview.attempts.total)}
          hint={`${formatNumber(overview.attempts.inProgress)} চলমান · ${formatNumber(overview.attempts.submitted)} জমা`}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <section className="jh-card p-5" aria-labelledby="pipeline">
          <h2 id="pipeline" className="text-[0.875rem] font-semibold text-[var(--text)]">
            প্রশ্ন পাইপলাইন
          </h2>
          <p className="mt-1 text-[0.6875rem] text-[var(--text-subtle)]">
            অগ্রগতি ধাপে ধাপে — ড্রাফট → রিভিউ → অনুমোদিত।
          </p>
          <ul className="mt-4 space-y-2.5">
            {[
              { key: "draft", label: "ড্রাফট", value: overview.questions.draft, tone: "neutral" as const },
              { key: "pending", label: "রিভিউ অপেক্ষায়", value: overview.questions.pending, tone: "warning" as const },
              { key: "approved", label: "অনুমোদিত", value: overview.questions.approved, tone: "success" as const },
              { key: "rejected", label: "বাতিল", value: overview.questions.rejected, tone: "danger" as const },
              { key: "archived", label: "আর্কাইভ", value: overview.questions.archived, tone: "neutral" as const },
            ].map((row) => {
              const total = Math.max(1, overview.questions.total);
              return (
                <li key={row.key}>
                  <div className="flex items-baseline justify-between gap-2 text-[0.75rem]">
                    <span className="text-[var(--text-muted)]">{row.label}</span>
                    <span className="font-semibold tabular-nums text-[var(--text)]">
                      {formatNumber(row.value)}
                      <span className="ml-1 text-[0.625rem] font-normal text-[var(--text-subtle)]">
                        ({formatNumber((row.value / total) * 100)}%)
                      </span>
                    </span>
                  </div>
                  <Progress
                    value={(row.value / total) * 100}
                    tone={row.tone === "neutral" ? "brand" : row.tone}
                    className="mt-1"
                    label={row.label}
                  />
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3 text-[0.6875rem] text-[var(--text-subtle)]">
            <Badge tone="success">{formatNumber(verifiedShare)}% যাচাইকৃত</Badge>
            <Badge tone="brand">{formatNumber(approvedShare)}% অনুমোদিত</Badge>
            <span>· {formatNumber(overview.importBatches)} ইমপোর্ট ব্যাচ</span>
          </div>
        </section>

        <section className="jh-card p-5" aria-labelledby="ops">
          <h2 id="ops" className="text-[0.875rem] font-semibold text-[var(--text)]">
            অপারেশন
          </h2>
          <div className="mt-3 grid gap-2">
            {[
              { icon: <CalendarDays className="size-3.5" />, label: "প্রকাশিত রুটিন", value: overview.routines.published, href: "/admin/routines" },
              { icon: <FileUp className="size-3.5" />, label: "ইমপোর্ট ব্যাচ", value: overview.importBatches, href: "/admin/import" },
              { icon: <Radio className="size-3.5" />, label: "প্রকাশিত পরীক্ষা", value: overview.schedules.published, href: "/admin/schedules" },
              { icon: <ScrollText className="size-3.5" />, label: "অডিট এন্ট্রি", value: overview.recentAudit.length, href: "/admin/audit" },
            ].map((row) => (
              <Link
                key={row.label}
                href={row.href}
                className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] px-3 py-2 text-[0.75rem] transition-colors hover:border-[var(--brand)]"
              >
                <span className="text-[var(--brand)]">{row.icon}</span>
                <span className="flex-1 text-[var(--text-muted)]">{row.label}</span>
                <span className="font-semibold tabular-nums text-[var(--text)]">{formatNumber(row.value)}</span>
                <ArrowRight className="size-3 text-[var(--text-subtle)]" aria-hidden />
              </Link>
            ))}
          </div>
          <div className="mt-3 rounded-xl bg-[var(--surface-muted)] px-3 py-2.5">
            <p className="text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-subtle)]">
              ট্যাক্সোনমি
            </p>
            <p className="mt-1 text-[0.75rem] text-[var(--text-muted)]">
              {formatNumber(overview.courses)} কোর্স · {formatNumber(overview.subjects)} বিষয় ·{" "}
              {formatNumber(overview.topics)} টপিক
            </p>
          </div>
        </section>
      </div>

      <section className="jh-card mt-5" aria-labelledby="audit">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3.5">
          <h2 id="audit" className="flex items-center gap-2 text-[0.875rem] font-semibold text-[var(--text)]">
            <ScrollText className="size-4 text-[var(--brand)]" aria-hidden />
            সাম্প্রতিক অডিট লগ
          </h2>
          <Link href="/admin/audit" className="text-[0.6875rem] font-semibold text-[var(--brand)] hover:underline">
            সব দেখুন
          </Link>
        </div>
        {overview.recentAudit.length === 0 ? (
          <p className="px-5 py-6 text-center text-[0.75rem] text-[var(--text-subtle)]">
            এখনো কোনো অডিট এন্ট্রি নেই। প্রশ্ন বা পরীক্ষায় পরিবর্তন হলে এখানে রেকর্ড হবে।
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {overview.recentAudit.map((row) => (
              <li key={row.id} className="flex items-start gap-3 px-4 py-2.5">
                <Badge tone="neutral">{ACTION_LABELS[row.action] ?? row.action}</Badge>
                <span className="min-w-0 flex-1 truncate text-[0.75rem] text-[var(--text-muted)]">
                  {row.actor?.full_name_bn || row.actor?.full_name || "সিস্টেম"} · {row.entity_type}
                </span>
                <span className="shrink-0 text-[0.625rem] text-[var(--text-subtle)]">
                  {relativeFromNow(row.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AlertRow({
  tone,
  icon,
  title,
  text,
  href,
  cta,
}: {
  tone: "warning" | "brand" | "neutral";
  icon: React.ReactNode;
  title: string;
  text: string;
  href: string;
  cta: string;
}) {
  const styles = {
    warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
    brand: "border-[var(--brand)]/25 bg-[var(--brand-soft)] text-[var(--text)]",
    neutral: "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]",
  }[tone];

  return (
    <div className={cn("flex flex-col gap-2 rounded-xl border px-3.5 py-2.5 sm:flex-row sm:items-center", styles)}>
      <span className="flex items-center gap-2 text-[0.8125rem] font-semibold">
        {icon}
        {title}
      </span>
      <p className="min-w-0 flex-1 text-[0.6875rem] opacity-80">{text}</p>
      <Link
        href={href}
        className="shrink-0 text-[0.6875rem] font-semibold text-[var(--brand)] hover:underline"
      >
        {cta} →
      </Link>
    </div>
  );
}
