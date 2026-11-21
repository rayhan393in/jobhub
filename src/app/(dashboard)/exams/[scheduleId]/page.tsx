import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarClock, Clock3, Info, Lock, Radio, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";
import { StartExamButton } from "./start-button";
import { formatDate, formatDateTime, formatNumber, formatTime } from "@/lib/format";
import type { ExamSchedule } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "পরীক্ষার বিস্তারিত" };

export default async function ScheduleDetailPage({ params }: { params: Promise<{ scheduleId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { scheduleId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(scheduleId)) notFound();

  const supabase = await getServerClient();
  if (!supabase) notFound();

  const { data } = await supabase
    .from("exam_schedules")
    .select("*, course:courses(slug, title_bn, title_en)")
    .eq("id", scheduleId)
    .in("status", ["published", "completed"])
    .maybeSingle();

  if (!data) notFound();
  const schedule = data as ExamSchedule & { course?: { title_bn: string; title_en: string } };

  const { data: attempt } = await supabase
    .from("exam_attempts")
    .select("id, status")
    .eq("schedule_id", scheduleId)
    .eq("user_id", user.id)
    .maybeSingle();

  const now = Date.now();
  const start = new Date(schedule.starts_at).getTime();
  const end = new Date(schedule.ends_at).getTime();
  const isLive = now >= start && now < end;
  const isUpcoming = now < start;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href="/exams"
        className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-[var(--text-muted)] hover:text-[var(--brand)]"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        পরীক্ষা কেন্দ্র
      </Link>

      <div className="jh-card mt-3 overflow-hidden">
        <div className="jh-hero-field border-b border-[var(--border)] p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={isLive ? "danger" : isUpcoming ? "brand" : "neutral"} dot={isLive}>
              {isLive ? "এখন চলছে" : isUpcoming ? "আসন্ন" : "সমাপ্ত"}
            </Badge>
            <Badge tone="info">
              {schedule.kind === "weekly_special" ? "সাপ্তাহিক স্পেশাল" : schedule.kind === "daily_live" ? "দৈনিক লাইভ" : "নির্ধারিত মক"}
            </Badge>
            <span className="text-[0.6875rem] font-medium text-[var(--text-subtle)]">
              {schedule.course?.title_bn}
            </span>
          </div>
          <h1 className="mt-3 text-balance text-[1.375rem] font-bold leading-tight tracking-[-0.03em] text-[var(--text)] sm:text-[1.625rem]">
            {schedule.title_bn}
          </h1>
          <p className="mt-1 text-[0.8125rem] text-[var(--text-muted)]">{schedule.title_en}</p>
        </div>

        <dl className="grid grid-cols-2 divide-x divide-y divide-[var(--border)] sm:grid-cols-3 sm:divide-y-0">
          {[
            { icon: <CalendarClock className="size-4" />, label: "তারিখ", value: formatDate(schedule.starts_at) },
            {
              icon: <Clock3 className="size-4" />,
              label: "সময় (ঢাকা)",
              value: `${formatTime(schedule.starts_at)}–${formatTime(schedule.ends_at)}`,
            },
            { icon: <Target className="size-4" />, label: "সময়কাল", value: `${formatNumber(schedule.duration_minutes)} মিনিট` },
            { icon: <Radio className="size-4" />, label: "প্রশ্ন", value: `${formatNumber(schedule.question_count)}টি` },
            { icon: <Target className="size-4" />, label: "পূর্ণমান", value: formatNumber(schedule.total_marks) },
            {
              icon: <Lock className="size-4" />,
              label: "ফলাফল প্রকাশ",
              value: formatDateTime(schedule.result_release_at),
            },
          ].map((item) => (
            <div key={item.label} className="p-4">
              <dt className="flex items-center gap-1.5 text-[0.625rem] font-medium text-[var(--text-subtle)]">
                <span className="text-[var(--brand)]">{item.icon}</span>
                {item.label}
              </dt>
              <dd className="mt-1 text-[0.8125rem] font-semibold text-[var(--text)]">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="jh-card mt-4 p-5">
        <h2 className="flex items-center gap-2 text-[0.875rem] font-semibold text-[var(--text)]">
          <Info className="size-4 text-[var(--brand)]" aria-hidden />
          নিয়মাবলি
        </h2>
        <ul className="mt-2 space-y-1.5 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
          <li>প্রতিটি সঠিক উত্তরে +{formatNumber(schedule.positive_marks)} নম্বর, ভুল উত্তরে −{formatNumber(schedule.negative_marks)} নম্বর।</li>
          <li>অনুত্তরিত প্রশ্নে কোনো নম্বর কাটা যাবে না।</li>
          <li>নির্বাচিত সময় বা এন্ট্রি উইন্ডো শেষ হলে যা আগে আসে, সেটিই কার্যকর হয়।</li>
          <li>প্রতিটি উত্তর সার্ভারে স্বয়ংক্রিয়ভাবে সংরক্ষিত হয়; রিফ্রেশ করলেও ফিরে পাওয়া যাবে।</li>
          <li>জমা দেওয়ার পর স্কোর ও ব্যাখ্যা ফলাফল প্রকাশের সময় পর্যন্ত দৃশ্যমান হয় না।</li>
        </ul>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {attempt ? (
          attempt.status === "in_progress" ? (
            <StartExamButton scheduleId={scheduleId} label="চালিয়ে যান" />
          ) : (
            <Link
              href={`/results/${attempt.id}`}
              className="inline-flex h-11 items-center rounded-xl bg-[var(--brand)] px-5 text-[0.875rem] font-semibold text-white"
            >
              ফলাফল দেখুন
            </Link>
          )
        ) : isLive ? (
          <StartExamButton scheduleId={scheduleId} label="পরীক্ষা শুরু করুন" />
        ) : (
          <span className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border-strong)] px-5 text-[0.875rem] font-semibold text-[var(--text-subtle)]">
            <Lock className="size-4" aria-hidden />
            {isUpcoming ? "এখনো শুরু হয়নি" : "এন্ট্রি উইন্ডো বন্ধ"}
          </span>
        )}
        {isUpcoming ? (
          <p className="text-[0.75rem] text-[var(--text-subtle)]">
            শুরু হবে {formatDateTime(schedule.starts_at)}-এ (Asia/Dhaka)
          </p>
        ) : null}
      </div>
    </div>
  );
}
