import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { listAuditLogs } from "@/lib/admin-queries";
import { requirePermission } from "@/lib/permissions";
import { formatDateTime, formatNumber } from "@/lib/format";
import { AdminNote, AdminPageHeader } from "@/components/admin/admin-ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "অডিট লগ" };

const ACTION_LABELS: Record<string, string> = {
  "question.bulk_review": "প্রশ্ন রিভিউ",
  "question.create": "প্রশ্ন তৈরি",
  "exam.publish": "পরীক্ষা প্রকাশ",
  "routine.publish": "রুটিন প্রকাশ",
  "import.commit": "ইমপোর্ট",
  "settings.update": "সেটিংস",
  "student.role_update": "রোল পরিবর্তন",
  "student.activation_update": "অ্যাকাউন্ট স্ট্যাটাস",
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  await requirePermission("audit.view");
  const { action } = await searchParams;
  const logs = await listAuditLogs({ limit: 150, action });

  return (
    <div className="mx-auto w-full max-w-5xl">
      <AdminPageHeader
        eyebrow="অডিট লগ"
        title="সব গুরুত্বপূর্ণ পরিবর্তনের রেকর্ড"
        description="প্রশ্ন রিভিউ, পরীক্ষা প্রকাশ, ইমপোর্ট, রোল পরিবর্তন ও সেটিংস — সব লেনদেনের সাথে অভিনেতা ও সময় সংরক্ষিত।"
        action={<Badge tone="neutral">{formatNumber(logs.length)} এন্ট্রি</Badge>}
      />

      <AdminNote>
        অডিট এন্ট্রি অপরিবর্তনীয় (immutable) — RLS-এ শুধু পড়ার অনুমতি আছে, আপডেট বা ডিলিট নয়।
      </AdminNote>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {["", "question.bulk_review", "exam.publish", "import.commit", "student.role_update", "settings.update"].map((value) => (
          <Link
            key={value || "all"}
            href={value ? `/admin/audit?action=${value}` : "/admin/audit"}
            className={`rounded-lg px-2.5 py-1 text-[0.6875rem] font-semibold ${
              (action ?? "") === value ? "bg-[var(--brand)] text-white" : "bg-[var(--surface)] text-[var(--text-muted)]"
            }`}
          >
            {value ? ACTION_LABELS[value] ?? value : "সব"}
          </Link>
        ))}
      </div>

      <div className="mt-3">
        {logs.length === 0 ? (
          <EmptyState
            icon={<ScrollText className="size-5" />}
            title="কোনো অডিট এন্ট্রি নেই"
            description="প্রথম পরিবর্তন হলে এখানে রেকর্ড হবে।"
          />
        ) : (
          <div className="jh-card divide-y divide-[var(--border)] overflow-hidden">
            {logs.map((log) => (
              <details key={log.id} className="group px-3 py-2">
                <summary className="flex cursor-pointer list-none items-start gap-2">
                  <Badge tone="neutral">{ACTION_LABELS[log.action] ?? log.action}</Badge>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.75rem] text-[var(--text)]">
                      {log.actor?.full_name_bn ?? log.actor?.full_name ?? "সিস্টেম"}
                      <span className="text-[var(--text-subtle)]"> → {log.entity_type}</span>
                    </span>
                    <span className="block text-[0.5625rem] text-[var(--text-subtle)]">
                      {formatDateTime(log.created_at)} · #{log.id}
                    </span>
                  </span>
                </summary>
                <pre className="mt-1.5 overflow-x-auto rounded-lg bg-[var(--surface-muted)] p-2 text-[0.5625rem] leading-relaxed text-[var(--text-muted)]">
{JSON.stringify(log.details, null, 2)}
                </pre>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
