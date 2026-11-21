import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { getServerClient } from "@/lib/supabase/server";
import { listCourses } from "@/lib/queries";
import { requirePermission } from "@/lib/permissions";
import { formatDateTime, formatNumber } from "@/lib/format";
import { AdminPageHeader } from "@/components/admin/admin-ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "পরীক্ষার সময়সূচি" };

type Row = {
  id: string;
  course_id: string;
  kind: string;
  title_bn: string;
  starts_at: string;
  ends_at: string;
  result_release_at: string;
  duration_minutes: number;
  question_count: number;
  total_marks: number;
  status: string;
  published_at: string | null;
};

export default async function SchedulesPage() {
  await requirePermission("exam.publish");
  const supabase = await getServerClient();
  const courses = await listCourses();

  let rows: Row[] = [];
  if (supabase) {
    const { data } = await supabase
      .from("exam_schedules")
      .select(
        "id, course_id, kind, title_bn, starts_at, ends_at, result_release_at, duration_minutes, question_count, total_marks, status, published_at",
      )
      .order("starts_at", { ascending: true })
      .limit(60);
    rows = (data ?? []) as Row[];
  }

  const now = Date.now();
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const upcoming = rows.filter((row) => new Date(row.starts_at).getTime() > now && row.status === "published");
  const live = rows.filter(
    (row) =>
      row.status === "published" &&
      new Date(row.starts_at).getTime() <= now &&
      new Date(row.ends_at).getTime() > now,
  );

  return (
    <div className="mx-auto w-full max-w-5xl">
      <AdminPageHeader
        eyebrow="সময়সূচি"
        title="সব পরীক্ষার সময়সূচি"
        description="ঢাকা সময় (Asia/Dhaka) অনুযায়ী এন্ট্রি উইন্ডো, সময়কাল ও ফলাফল প্রকাশের সময়।"
        action={
          <ButtonLink href="/admin/exams" size="sm" variant="secondary">
            <Radio className="size-3.5" aria-hidden />
            প্রকাশ মডিউল
          </ButtonLink>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-2">
        {[
          { label: "এখন চলছে", value: live.length, tone: "danger" as const },
          { label: "আসন্ন (প্রকাশিত)", value: upcoming.length, tone: "brand" as const },
          { label: "মোট রেকর্ড", value: rows.length, tone: "neutral" as const },
        ].map((item) => (
          <div key={item.label} className="jh-card p-3">
            <p className="text-[0.5625rem] uppercase tracking-[0.08em] text-[var(--text-subtle)]">{item.label}</p>
            <p className="mt-0.5 text-[1.125rem] font-bold tabular-nums text-[var(--text)]">{formatNumber(item.value)}</p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="size-5" />}
          title="কোনো সময়সূচি নেই"
          description="পরীক্ষা প্রকাশ মডিউল থেকে ড্রাফট তৈরি করলে সময়সূচি এখানে দেখা যাবে।"
        />
      ) : (
        <div className="jh-card divide-y divide-[var(--border)] overflow-hidden">
          {rows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.8125rem] font-semibold text-[var(--text)]">{row.title_bn}</p>
                <p className="truncate text-[0.5625rem] text-[var(--text-subtle)]">
                  {courseById.get(row.course_id)?.title_bn} · {row.kind === "daily_live" ? "দৈনিক" : row.kind === "weekly_special" ? "সাপ্তাহিক" : "মক"} ·{" "}
                  {formatNumber(row.question_count)} প্রশ্ন · {formatNumber(row.duration_minutes)} মিনিট
                </p>
                <p className="text-[0.5625rem] text-[var(--text-subtle)]">
                  {formatDateTime(row.starts_at)} → {formatDateTime(row.ends_at)} · ফলাফল {formatDateTime(row.result_release_at)}
                </p>
              </div>
              <Badge
                tone={
                  row.status === "published" ? "success" : row.status === "draft" ? "warning" : row.status === "cancelled" ? "danger" : "neutral"
                }
              >
                {row.status === "published" ? "প্রকাশিত" : row.status === "draft" ? "ড্রাফট" : row.status === "cancelled" ? "বাতিল" : "সম্পন্ন"}
              </Badge>
              <Link
                href="/admin/exams"
                className="text-[0.625rem] font-semibold text-[var(--brand)] hover:underline"
              >
                পরিচালনা
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
