import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpenCheck, CalendarClock, Clock3, Info, Lock, Radio, Target } from "lucide-react";
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

  // --- Syllabus: resolve the paper composition (subjects + topics) so the
  // student knows exactly what to study before the exam starts. -------------
  type CompositionSection = { count?: number; subject_id?: string; topic_ids?: string[] };
  const settings = (schedule.settings ?? {}) as {
    composition?: { sections?: CompositionSection[] };
    difficulty_mix?: { easy?: number; medium?: number; hard?: number; previous?: number };
  };
  const sections = Array.isArray(settings.composition?.sections) ? settings.composition.sections : [];
  const subjectIds = [...new Set(sections.map((s) => s.subject_id).filter(Boolean))] as string[];
  const topicIds = [...new Set(sections.flatMap((s) => s.topic_ids ?? []).filter(Boolean))];

  const [subjectRows, topicRows] = await Promise.all([
    subjectIds.length
      ? supabase.from("subjects").select("id, title_bn").in("id", subjectIds)
      : Promise.resolve({ data: [] as { id: string; title_bn: string }[] }),
    topicIds.length
      ? supabase.from("topics").select("id, title_bn, subject_id").in("id", topicIds)
      : Promise.resolve({ data: [] as { id: string; title_bn: string; subject_id: string }[] }),
  ]);
  const subjectName = new Map((subjectRows.data ?? []).map((s) => [s.id, s.title_bn]));
  const topicName = new Map((topicRows.data ?? []).map((t) => [t.id, t.title_bn]));

  const syllabus = sections
    .map((s) => ({
      subject: s.subject_id ? subjectName.get(s.subject_id) ?? null : null,
      topics: (s.topic_ids ?? []).map((id) => topicName.get(id)).filter(Boolean) as string[],
      count: s.count ?? 0,
    }))
    .filter((s) => s.subject || s.topics.length > 0);

  const mix = settings.difficulty_mix;
  const mixParts = mix
    ? ([
        mix.easy ? `সহজ ${formatNumber(mix.easy)}%` : null,
        mix.medium ? `মাঝারি ${formatNumber(mix.medium)}%` : null,
        mix.hard ? `কঠিন ${formatNumber(mix.hard)}%` : null,
        mix.previous ? `বিগত বছরের ${formatNumber(mix.previous)}%` : null,
      ].filter(Boolean) as string[])
    : [];

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

      {syllabus.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50 to-violet-100/40 p-5 dark:border-violet-500/25 dark:from-violet-500/10 dark:to-violet-500/5">
          <h2 className="flex items-center gap-2 text-[0.875rem] font-semibold text-[var(--text)]">
            <span className="flex size-7 items-center justify-center rounded-lg bg-violet-600 text-white">
              <BookOpenCheck className="size-4" aria-hidden />
            </span>
            সিলেবাস — কী কী পড়তে হবে
          </h2>
          <ul className="mt-3 space-y-3">
            {syllabus.map((s, i) => (
              <li key={i} className="rounded-xl border border-violet-200/60 bg-white/70 p-3 dark:border-violet-500/20 dark:bg-white/5">
                <div className="flex flex-wrap items-center gap-2">
                  {s.subject ? (
                    <span className="rounded-full bg-violet-600 px-2.5 py-0.5 text-[0.6875rem] font-bold text-white">
                      {s.subject}
                    </span>
                  ) : null}
                  {s.count > 0 ? (
                    <span className="text-[0.6875rem] font-semibold text-violet-700 dark:text-violet-300">
                      {formatNumber(s.count)}টি প্রশ্ন
                    </span>
                  ) : null}
                </div>
                {s.topics.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {s.topics.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[0.75rem] font-medium text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-200"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          {mixParts.length > 0 ? (
            <p className="mt-3 text-[0.75rem] text-[var(--text-muted)]">
              কঠিনতার মিশ্রণ: {mixParts.join(" · ")}
            </p>
          ) : null}
          <p className="mt-1.5 text-[0.6875rem] text-[var(--text-subtle)]">
            উপরের বিষয় ও টপিক থেকেই এই পরীক্ষার প্রশ্ন আসবে — এগুলো পড়ে প্রস্তুতি নিন।
          </p>
        </div>
      ) : null}

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
