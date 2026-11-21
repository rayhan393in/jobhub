"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Check, CircleCheck, CircleX, Clock3, Loader2, Megaphone, Plus, Rocket, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { PublisherSchedule } from "./page";

type Course = { id: string; title_bn: string; slug: string };

function toLocalInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Dhaka is a fixed +06:00 offset, so local input can be converted exactly. */
function dhakaIso(local: string): string {
  if (!local) return "";
  return new Date(`${local}:00+06:00`).toISOString();
}

const STATUS_LABEL: Record<string, string> = {
  draft: "ড্রাফট",
  published: "প্রকাশিত",
  completed: "সম্পন্ন",
  cancelled: "বাতিল",
};

export function ExamPublisher({
  courses,
  schedules,
  limits,
}: {
  courses: Course[];
  schedules: PublisherSchedule[];
  limits: { maxQuestions: number; maxDuration: number; positive: number; negative: number };
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [availability, setAvailability] = React.useState<{
    verifiedAvailable: number;
    pendingInCourse: number;
    unverifiedAiInCourse: number;
  } | null>(null);
  const [checking, setChecking] = React.useState(false);

  // One clock read for the whole render; `nowMs` is also used to decide whether a
  // schedule has started, so nothing reads the clock again mid-render.
  const [nowMs] = React.useState(() => Date.now());
  const startDefault = new Date(nowMs + 60 * 60 * 1000);
  const endDefault = new Date(nowMs + 4 * 60 * 60 * 1000);

  const [form, setForm] = React.useState({
    courseId: courses[0]?.id ?? "",
    kind: "daily_live",
    titleBn: "",
    startsAt: toLocalInput(startDefault),
    endsAt: toLocalInput(endDefault),
    durationMinutes: 20,
    questionCount: 20,
    positiveMarks: limits.positive,
    negativeMarks: limits.negative,
    resultDelayMinutes: 10,
  });

  React.useEffect(() => {
    if (!form.courseId) return;
    let cancelled = false;
    setChecking(true);
    (async () => {
      try {
        const response = await fetch(`/api/admin/exams?courseId=${form.courseId}`, { cache: "no-store" });
        const payload = await response.json();
        if (!cancelled && response.ok) setAvailability(payload);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.courseId]);

  async function create() {
    setBusy("create");
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: form.courseId,
          kind: form.kind,
          titleBn: form.titleBn,
          startsAt: dhakaIso(form.startsAt),
          endsAt: dhakaIso(form.endsAt),
          durationMinutes: form.durationMinutes,
          questionCount: form.questionCount,
          positiveMarks: form.positiveMarks,
          negativeMarks: form.negativeMarks,
          resultDelayMinutes: form.resultDelayMinutes,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "ড্রাফট তৈরি হয়নি।");
        return;
      }
      setNotice(payload.note ?? "ড্রাফট তৈরি হয়েছে।");
      setOpen(false);
      setForm((prev) => ({ ...prev, titleBn: "" }));
      router.refresh();
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
    } finally {
      setBusy(null);
    }
  }

  async function publish(scheduleId: string) {
    setBusy(scheduleId);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/exams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId, action: "publish" }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "প্রকাশ করা যায়নি।");
        return;
      }
      setNotice("পরীক্ষা প্রকাশিত হয়েছে — শিক্ষার্থীরা এন্ট্রি উইন্ডোতে অংশ নিতে পারবে।");
      router.refresh();
    } catch {
      setError("নেটওয়ার্ক সমস্যা।");
    } finally {
      setBusy(null);
    }
  }

  async function cancel(scheduleId: string) {
    setBusy(scheduleId);
    setError(null);
    try {
      const response = await fetch("/api/admin/exams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId, action: "cancel" }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "বাতিল করা যায়নি।");
        return;
      }
      setNotice("ড্রাফট বাতিল হয়েছে।");
      router.refresh();
    } catch {
      setError("নেটওয়ার্ক সমস্যা।");
    } finally {
      setBusy(null);
    }
  }

  const enoughQuestions = availability === null || availability.verifiedAvailable >= form.questionCount;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setOpen((value) => !value)}>
          {open ? <X className="size-3.5" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
          {open ? "ফর্ম বন্ধ" : "নতুন পরীক্ষার ড্রাফট"}
        </Button>
        {availability ? (
          <Badge tone={availability.verifiedAvailable > 0 ? "success" : "warning"}>
            {formatNumber(availability.verifiedAvailable)} যাচাইকৃত প্রশ্ন প্রস্তুত
          </Badge>
        ) : checking ? (
          <span className="inline-flex items-center gap-1 text-[0.6875rem] text-[var(--text-subtle)]">
            <Loader2 className="size-3 animate-spin" aria-hidden />
            যাচাই চলছে…
          </span>
        ) : null}
      </div>

      {notice ? (
        <p role="status" className="flex items-start gap-1.5 rounded-lg bg-mint-50 px-3 py-2 text-[0.75rem] font-medium text-mint-800 dark:bg-mint-600/10 dark:text-mint-300">
          <CircleCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-[0.75rem] font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {open ? (
        <div className="jh-card p-4">
          <h2 className="text-[0.875rem] font-semibold text-[var(--text)]">নতুন পরীক্ষার ড্রাফট</h2>
          <p className="text-[0.625rem] text-[var(--text-subtle)]">
            সময় ঢাকা (UTC+6) অনুযায়ী। ড্রাফট তৈরি হলে কোনো শিক্ষার্থী দেখতে পাবে না — প্রকাশ আলাদা ধাপ।
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="jh-label">কোর্স</span>
              <select value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })} className="jh-select">
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.title_bn}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="jh-label">ধরন</span>
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="jh-select">
                <option value="daily_live">দৈনিক লাইভ</option>
                <option value="weekly_special">সাপ্তাহিক স্পেশাল</option>
                <option value="scheduled_mock">নির্ধারিত মক</option>
              </select>
            </label>
            <label className="block">
              <span className="jh-label">শিরোনাম</span>
              <Input
                value={form.titleBn}
                onChange={(e) => setForm({ ...form, titleBn: e.target.value })}
                className="h-9 font-bangla text-[0.8125rem]"
                placeholder="যেমন: দৈনিক লাইভ — বাংলা ও ইংরেজি"
              />
            </label>
            <label className="block">
              <span className="jh-label">শুরু (ঢাকা)</span>
              <Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className="h-9 text-[0.75rem]" />
            </label>
            <label className="block">
              <span className="jh-label">শেষ (এন্ট্রি বন্ধ)</span>
              <Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} className="h-9 text-[0.75rem]" />
            </label>
            <label className="block">
              <span className="jh-label">প্রশ্নসংখ্যা</span>
              <Input
                type="number"
                min={1}
                max={limits.maxQuestions}
                value={form.questionCount}
                onChange={(e) => setForm({ ...form, questionCount: Number(e.target.value) })}
                className="h-9 text-[0.8125rem]"
              />
            </label>
            <label className="block">
              <span className="jh-label">সময়কাল (মিনিট)</span>
              <Input
                type="number"
                min={1}
                max={limits.maxDuration}
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
                className="h-9 text-[0.8125rem]"
              />
            </label>
            <label className="block">
              <span className="jh-label">সঠিক নম্বর</span>
              <Input
                type="number"
                step="0.25"
                min={0.25}
                value={form.positiveMarks}
                onChange={(e) => setForm({ ...form, positiveMarks: Number(e.target.value) })}
                className="h-9 text-[0.8125rem]"
              />
            </label>
            <label className="block">
              <span className="jh-label">ভুলে কাটা</span>
              <Input
                type="number"
                step="0.25"
                min={0}
                value={form.negativeMarks}
                onChange={(e) => setForm({ ...form, negativeMarks: Number(e.target.value) })}
                className="h-9 text-[0.8125rem]"
              />
            </label>
            <label className="block">
              <span className="jh-label">ফলাফল প্রকাশ (শেষের পরে মিনিট)</span>
              <Input
                type="number"
                min={0}
                value={form.resultDelayMinutes}
                onChange={(e) => setForm({ ...form, resultDelayMinutes: Number(e.target.value) })}
                className="h-9 text-[0.8125rem]"
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-[var(--surface-muted)] px-3 py-2">
            <span className="text-[0.6875rem] text-[var(--text-muted)]">
              মোট নম্বর: <strong>{formatNumber(form.questionCount * form.positiveMarks)}</strong> ·{" "}
              {formatNumber(form.questionCount)} প্রশ্ন · {formatNumber(form.durationMinutes)} মিনিট
            </span>
            {availability ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[0.6875rem] font-semibold",
                  enoughQuestions ? "text-mint-600 dark:text-mint-500" : "text-[var(--danger)]",
                )}
              >
                {enoughQuestions ? <Check className="size-3" aria-hidden /> : <AlertTriangle className="size-3" aria-hidden />}
                {formatNumber(availability.verifiedAvailable)} যাচাইকৃত প্রশ্ন উপলব্ধ
              </span>
            ) : null}
          </div>

          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={create} loading={busy === "create"} disabled={form.titleBn.trim().length < 3}>
              <Check className="size-3.5" aria-hidden />
              ড্রাফট সংরক্ষণ
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>বাতিল</Button>
          </div>
        </div>
      ) : null}

      <div className="jh-card overflow-hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 sm:grid-cols-[minmax(0,1fr)_7rem_8rem_auto]">
          <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">পরীক্ষা</span>
          <span className="hidden text-[0.5625rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)] sm:block">সময়সূচি</span>
          <span className="hidden text-[0.5625rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)] sm:block">অবস্থা</span>
          <span className="text-right text-[0.5625rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">কার্যক্রম</span>
        </div>

        {schedules.length === 0 ? (
          <p className="px-4 py-8 text-center text-[0.75rem] text-[var(--text-subtle)]">
            এখনো কোনো পরীক্ষা নেই। উপরের বাটন থেকে প্রথম ড্রাফট তৈরি করুন।
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {schedules.map((schedule) => {
              const course = courses.find((c) => c.id === schedule.course_id);
              const start = new Date(schedule.starts_at);
              // Compared against the render-time clock from props, not Date.now():
              // reading the clock during render makes the output impure.
              const startFuture = start.getTime() > nowMs;
              return (
                <li key={schedule.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_7rem_8rem_auto]">
                  <div className="min-w-0">
                    <p className="truncate text-[0.8125rem] font-semibold text-[var(--text)]">{schedule.title_bn}</p>
                    <p className="truncate text-[0.5625rem] text-[var(--text-subtle)]">
                      {course?.title_bn} · {formatNumber(schedule.question_count)} প্রশ্ন ·{" "}
                      {formatNumber(schedule.duration_minutes)} মিনিট · {formatNumber(schedule.total_marks)} নম্বর
                    </p>
                  </div>
                  <div className="hidden text-[0.625rem] leading-relaxed text-[var(--text-muted)] sm:block">
                    <p className="flex items-center gap-1">
                      <Clock3 className="size-2.5" aria-hidden />
                      {formatDateTime(schedule.starts_at)}
                    </p>
                    <p className="text-[0.5625rem] text-[var(--text-subtle)]">
                      ফলাফল: {formatDateTime(schedule.result_release_at)}
                    </p>
                  </div>
                  <div className="hidden sm:block">
                    <Badge
                      tone={
                        schedule.status === "published"
                          ? "success"
                          : schedule.status === "draft"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {STATUS_LABEL[schedule.status] ?? schedule.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    {schedule.status === "draft" ? (
                      <>
                        <Button
                          size="sm"
                          variant={startFuture ? "primary" : "secondary"}
                          loading={busy === schedule.id}
                          onClick={() => publish(schedule.id)}
                          disabled={!startFuture}
                          title={startFuture ? "প্রকাশ করুন" : "শুরুর সময় অতীত"}
                        >
                          <Rocket className="size-3" aria-hidden />
                          প্রকাশ
                        </Button>
                        <button
                          type="button"
                          onClick={() => cancel(schedule.id)}
                          className="rounded p-1.5 text-[var(--text-subtle)] hover:text-[var(--danger)]"
                          aria-label="Cancel draft"
                        >
                          <CircleX className="size-3.5" />
                        </button>
                      </>
                    ) : schedule.status === "published" ? (
                      <Badge tone="success" dot>লাইভ</Badge>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="flex items-start gap-1.5 text-[0.625rem] text-[var(--text-subtle)]">
        <Megaphone className="mt-0.5 size-3 shrink-0" aria-hidden />
        প্রকাশের মুহূর্তে প্রশ্নপত্র তৈরি ও হিমায়িত হয় (exam_papers)। প্রকাশিত পরীক্ষার প্রশ্ন বা সময় বদলানো
        যায় না — প্রয়োজনে নতুন ড্রাফট তৈরি করুন।
      </p>
    </div>
  );
}
