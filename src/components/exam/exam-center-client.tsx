"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Clock3, Lock, Play, Radio, CalendarClock, RotateCcw } from "lucide-react";
import { Badge, LiveDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatClock, formatDate, formatDateTime, formatNumber, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { ExamSchedule } from "@/lib/types";

type Schedule = ExamSchedule & {
  course?: { slug: string; title_bn: string; title_en: string };
  my_attempt_id?: string | null;
  my_status?: string | null;
};

type Status = "live" | "upcoming" | "closed" | "draft";

function statusOf(schedule: Schedule, now: number): Status {
  const start = new Date(schedule.starts_at).getTime();
  const end = new Date(schedule.ends_at).getTime();
  if (schedule.status !== "published" && schedule.status !== "completed") return "draft";
  if (now < start) return "upcoming";
  if (now < end) return "live";
  return "closed";
}

export function ExamCenterClient({
  schedules,
  courses,
}: {
  schedules: Schedule[];
  courses: { id: string; slug: string; title_bn: string }[];
}) {
  const router = useRouter();
  const [course, setCourse] = React.useState("all");
  const [dateFilter, setDateFilter] = React.useState<"all" | "today" | "week">("all");
  const [kind, setKind] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState<"all" | Status>("all");
  const [startingId, setStartingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const filtered = schedules.filter((s) => {
    if (course !== "all" && s.course_id !== course) return false;
    if (kind !== "all" && s.kind !== kind) return false;
    const sStatus = statusOf(s, now);
    if (statusFilter !== "all" && sStatus !== statusFilter) return false;
    if (dateFilter !== "all") {
      const start = new Date(s.starts_at).getTime();
      const dayMs = 86400000;
      if (dateFilter === "today" && start > now + dayMs) return false;
      if (dateFilter === "week" && start > now + dayMs * 7) return false;
    }
    return true;
  });

  async function beginExam(schedule: Schedule) {
    setStartingId(schedule.id);
    setError(null);
    try {
      const response = await fetch("/api/exams/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId: schedule.id }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "পরীক্ষা শুরু করা যায়নি।");
        return;
      }
      router.push(`/exam/${payload.attempt_id}`);
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
    } finally {
      setStartingId(null);
    }
  }

  const liveCount = schedules.filter((s) => statusOf(s, now) === "live").length;

  return (
    <div>
      {/* Filters */}
      <div className="jh-card mb-5 flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center">
        <div className="flex flex-1 flex-wrap gap-2">
          <FilterSelect label="কোর্স" value={course} onChange={setCourse}>
            <option value="all">সব কোর্স</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title_bn}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="ধরন" value={kind} onChange={setKind}>
            <option value="all">সব ধরন</option>
            <option value="daily_live">দৈনিক লাইভ</option>
            <option value="weekly_special">সাপ্তাহিক স্পেশাল</option>
            <option value="scheduled_mock">সcheduled mock</option>
          </FilterSelect>
          <FilterSelect label="সময়" value={dateFilter} onChange={(v) => setDateFilter(v as typeof dateFilter)}>
            <option value="all">সব সময়</option>
            <option value="today">আজ ও আগামী ২৪ ঘণ্টা</option>
            <option value="week">আগামী ৭ দিন</option>
          </FilterSelect>
          <FilterSelect label="অবস্থা" value={statusFilter} onChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <option value="all">সব অবস্থা</option>
            <option value="live">চলছে</option>
            <option value="upcoming">আসন্ন</option>
            <option value="closed">সমাপ্ত</option>
          </FilterSelect>
        </div>
        {liveCount > 0 ? (
          <Badge tone="danger" dot>
            {formatNumber(liveCount)} পরীক্ষা চলছে
          </Badge>
        ) : (
          <Badge tone="neutral">এখন কোনো পরীক্ষা চলছে না</Badge>
        )}
      </div>

      {error ? (
        <p
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-[0.8125rem] font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Radio className="size-5" />}
          title={schedules.length === 0 ? "এখনো কোনো পরীক্ষা প্রকাশিত হয়নি" : "এই ফিল্টারে কোনো পরীক্ষা নেই"}
          description={
            schedules.length === 0
              ? "প্রশাসক যাচাইকৃত প্রশ্নসহ পরীক্ষা প্রকাশ করলে এখানে দেখা যাবে। রুটিন সংরক্ষণ করলেই পরীক্ষা প্রকাশ পায় না — শুধু স্পষ্টভাবে প্রকাশিত পরীক্ষাই খোলে।"
              : "ফিল্টার পরিবর্তন করে দেখুন অথবা সব পরীক্ষা দেখুন।"
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((schedule) => {
            const sStatus = statusOf(schedule, now);
            const end = new Date(schedule.ends_at).getTime();
            const start = new Date(schedule.starts_at).getTime();
            const resumes = Boolean(schedule.my_attempt_id);
            return (
              <article key={schedule.id} className="jh-card flex flex-col p-4 sm:p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {sStatus === "live" ? (
                      <LiveDot label="চলছে" />
                    ) : (
                      <Badge tone={sStatus === "upcoming" ? "brand" : "neutral"}>
                        {sStatus === "upcoming" ? "আসন্ন" : "সমাপ্ত"}
                      </Badge>
                    )}
                    <Badge tone={schedule.kind === "weekly_special" ? "accent" : "info"}>
                      {schedule.kind === "weekly_special"
                        ? "সাপ্তাহিক"
                        : schedule.kind === "daily_live"
                          ? "দৈনিক"
                          : "মক"}
                    </Badge>
                  </div>
                  <span className="shrink-0 text-[0.625rem] text-[var(--text-subtle)]">
                    {schedule.course?.title_bn ?? ""}
                  </span>
                </div>

                <h2 className="mt-2.5 text-[0.9375rem] font-bold leading-snug tracking-[-0.01em] text-[var(--text)]">
                  {schedule.title_bn}
                </h2>

                <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-[0.6875rem]">
                  <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                    <CalendarClock className="size-3 text-[var(--brand)]" aria-hidden />
                    {formatDate(schedule.starts_at)}
                  </div>
                  <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                    <Clock3 className="size-3 text-[var(--brand)]" aria-hidden />
                    {formatTime(schedule.starts_at)}–{formatTime(schedule.ends_at)}
                  </div>
                  <div className="text-[var(--text-muted)]">
                    {formatNumber(schedule.duration_minutes)} মিনিট · {formatNumber(schedule.question_count)} প্রশ্ন
                  </div>
                  <div className="text-[var(--text-muted)]">
                    {formatNumber(schedule.total_marks)} নম্বর
                  </div>
                </dl>

                <p className="mt-2 text-[0.625rem] text-[var(--text-subtle)]">
                  ফলাফল প্রকাশ: {formatDateTime(schedule.result_release_at)}
                </p>

                <div className="mt-3.5 flex items-center gap-2 border-t border-[var(--border)] pt-3">
                  {sStatus === "live" ? (
                    <>
                      {resumes && schedule.my_status === "in_progress" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="flex-1"
                          onClick={() => router.push(`/exam/${schedule.my_attempt_id}`)}
                        >
                          <RotateCcw className="size-3.5" aria-hidden />
                          চালিয়ে যান
                        </Button>
                      ) : resumes ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="flex-1"
                          onClick={() => router.push(`/results/${schedule.my_attempt_id}`)}
                        >
                          ফলাফল দেখুন
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="flex-1"
                          loading={startingId === schedule.id}
                          onClick={() => beginExam(schedule)}
                        >
                          <Play className="size-3.5" aria-hidden />
                          পরীক্ষা শুরু
                        </Button>
                      )}
                      <span className="shrink-0 text-[0.625rem] font-semibold tabular-nums text-[var(--text-muted)]">
                        বাকি {formatClock(Math.max(0, (end - now) / 1000))}
                      </span>
                    </>
                  ) : sStatus === "upcoming" ? (
                    <>
                      <Button size="sm" variant="secondary" className="flex-1" disabled>
                        <Lock className="size-3.5" aria-hidden />
                        শুরু হবে
                      </Button>
                      <span className="shrink-0 text-[0.625rem] font-medium text-[var(--text-subtle)]">
                        {countdownLabel(start - now)} পরে
                      </span>
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" className="flex-1" disabled>
                      <Lock className="size-3.5" aria-hidden />
                      এন্ট্রি উইন্ডো বন্ধ
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "appearance-none rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1.5 pl-2.5 pr-7 text-[0.75rem] font-medium text-[var(--text-muted)]",
          "focus:border-[var(--brand)] focus:outline-none",
        )}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-[var(--text-subtle)]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </label>
  );
}

function countdownLabel(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(seconds / 86400);
  if (days > 0) return `${formatNumber(days)} দিন`;
  const hours = Math.floor(seconds / 3600);
  if (hours > 0) return `${formatNumber(hours)} ঘণ্টা`;
  return `${formatNumber(Math.ceil(seconds / 60))} মিনিট`;
}
