import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { listAttempts } from "@/lib/admin-queries";
import { requirePermission } from "@/lib/permissions";
import { formatNumber, relativeFromNow } from "@/lib/format";
import { AdminNote, AdminPageHeader } from "@/components/admin/admin-ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "পরীক্ষার্থীর প্রচেষ্টা" };

export default async function AttemptsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requirePermission("attempt.inspect");
  const { status } = await searchParams;
  const attempts = await listAttempts({ status, limit: 60 });

  return (
    <div className="mx-auto w-full max-w-6xl">
      <AdminPageHeader
        eyebrow="প্রচেষ্টা"
        title="শিক্ষার্থীদের পরীক্ষার প্রচেষ্টা"
        description="সার্ভার-স্কোরড ফলাফল, জমার সময় ও প্রকাশের অবস্থা। এখান থেকে উত্তরপত্র দেখা যায় না — শুধু পরিসংখ্যান।"
        action={<Activity className="size-5 text-[var(--brand)]" aria-hidden />}
      />

      <AdminNote>
        শিক্ষার্থীর ব্যক্তিগত উত্তরপত্র (student_answers) শুধু সেই শিক্ষার্থী ও সিস্টেম দেখতে পায়। এখানকার তালিকায়
        প্রতিটি প্রচেষ্টার স্কোর ফলাফল প্রকাশের আগেও প্রশাসকের কাছে দৃশ্যমান, কিন্তু সেই স্কোর শিক্ষার্থীকে দেখানো হয় না।
      </AdminNote>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {[
          { value: "", label: "সব" },
          { value: "in_progress", label: "চলমান" },
          { value: "submitted", label: "জমা" },
          { value: "expired", label: "সময় শেষ" },
        ].map((filter) => (
          <Link
            key={filter.value}
            href={filter.value ? `/admin/attempts?status=${filter.value}` : "/admin/attempts"}
            className={`rounded-lg px-2.5 py-1 text-[0.6875rem] font-semibold ${
              (status ?? "") === filter.value
                ? "bg-[var(--brand)] text-white"
                : "bg-[var(--surface)] text-[var(--text-muted)]"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      <div className="mt-3">
        {attempts.length === 0 ? (
          <EmptyState
            icon={<Radio className="size-5" />}
            title="কোনো প্রচেষ্টা নেই"
            description="শিক্ষার্থীরা পরীক্ষা শুরু করলে এখানে দেখা যাবে।"
          />
        ) : (
          <div className="jh-card overflow-hidden">
            <div className="hidden grid-cols-[minmax(0,1fr)_8rem_5rem_6rem_5rem] gap-2 border-b border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[0.5625rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)] sm:grid">
              <span>শিক্ষার্থী / পরীক্ষা</span>
              <span>সময়</span>
              <span>প্রশ্ন</span>
              <span>স্কোর</span>
              <span className="text-right">অবস্থা</span>
            </div>
            <ul className="divide-y divide-[var(--border)]">
              {attempts.map((attempt) => (
                <li key={attempt.id} className="grid grid-cols-1 gap-1 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_8rem_5rem_6rem_5rem] sm:items-center sm:gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[0.75rem] font-medium text-[var(--text)]">
                      {attempt.profile?.full_name_bn ?? attempt.profile?.full_name ?? "শিক্ষার্থী"}
                    </p>
                    <p className="truncate text-[0.5625rem] text-[var(--text-subtle)]">
                      {attempt.course?.title_bn ?? "—"} · {attempt.mode.replace(/_/g, " ")}
                    </p>
                  </div>
                  <p className="text-[0.625rem] text-[var(--text-subtle)]">
                    {relativeFromNow(attempt.submitted_at ?? attempt.started_at)}
                  </p>
                  <p className="text-[0.625rem] tabular-nums text-[var(--text-muted)]">
                    {formatNumber(attempt.total_questions)}
                  </p>
                  <p className="text-[0.6875rem] font-semibold tabular-nums text-[var(--text)]">
                    {attempt.score === null ? "—" : `${formatNumber(attempt.score)}/${formatNumber(attempt.total_marks)}`}
                  </p>
                  <div className="sm:text-right">
                    <Badge
                      tone={
                        attempt.status === "submitted" ? "success" : attempt.status === "in_progress" ? "warning" : "neutral"
                      }
                    >
                      {attempt.status === "submitted" ? "জমা" : attempt.status === "in_progress" ? "চলমান" : "সময় শেষ"}
                    </Badge>
                    {attempt.is_released ? (
                      <p className="mt-0.5 text-[0.5625rem] text-mint-600 dark:text-mint-500">প্রকাশিত</p>
                    ) : (
                      <p className="mt-0.5 text-[0.5625rem] text-[var(--text-subtle)]">অপ্রকাশিত</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
