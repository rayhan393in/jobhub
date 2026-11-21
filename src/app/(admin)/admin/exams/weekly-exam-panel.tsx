"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CircleAlert, CircleCheck, Radio, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";

type Course = { id: string; title_bn: string };

type PreviewTopic = { topic_bn: string; subject_bn: string; minutes: number };

/**
 * Weekly exam publisher.
 *
 * The topics are not chosen here — they are read from the week's published
 * routine, because requirement 4 says the exam must come from *that* week's
 * plan. This panel only decides when it runs and how big it is.
 */
export function WeeklyExamPanel({ courses, today }: { courses: Course[]; today: string }) {
  const router = useRouter();
  const [courseId, setCourseId] = React.useState(courses[0]?.id ?? "");
  const [weekStart, setWeekStart] = React.useState(today);
  const [startsAt, setStartsAt] = React.useState(() => {
    // Default to Sunday 20:00 in the admin's local clock — the end of the study
    // week, which is when a weekly exam is actually sat.
    const date = new Date();
    date.setUTCHours(14, 0, 0, 0);
    return date.toISOString().slice(0, 16);
  });
  const [duration, setDuration] = React.useState(90);
  const [questionCount, setQuestionCount] = React.useState(100);
  const [resultDelay, setResultDelay] = React.useState(30);

  const [preview, setPreview] = React.useState<{ topics: PreviewTopic[]; routineRows: number } | null>(null);
  const [busy, setBusy] = React.useState<"preview" | "create" | "publish" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{ published: boolean; paperId: string | null; topics: number } | null>(null);

  async function loadPreview() {
    if (!courseId) return;
    setBusy("preview");
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/weekly-exam?courseId=${courseId}&weekStart=${weekStart}`,
      );
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "প্রিভিউ আনা যায়নি।");
        setPreview(null);
        return;
      }
      setPreview({ topics: payload.topics ?? [], routineRows: payload.routineRows ?? 0 });
    } catch {
      setError("নেটওয়ার্ক সমস্যা।");
    } finally {
      setBusy(null);
    }
  }

  async function create(publish: boolean) {
    if (!courseId) return;
    setBusy(publish ? "publish" : "create");
    setError(null);
    setDone(null);
    try {
      const response = await fetch("/api/admin/weekly-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          weekStart,
          // The input is a local datetime; the API wants an offset-aware ISO
          // string. Dhaka is fixed at +06:00 with no DST.
          startsAt: new Date(`${startsAt}:00+06:00`).toISOString(),
          durationMinutes: duration,
          questionCount,
          totalMarks: 100,
          negativeMarks: 0.5,
          resultDelayMinutes: resultDelay,
          publish,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        // A published draft whose paper could not be built reports the shortfall
        // here — the schedule exists, so say so instead of pretending nothing
        // happened.
        if (payload.error) setError(payload.error);
        if (payload.scheduleId) setDone({ published: false, paperId: null, topics: payload.topicsCovered ?? 0 });
        return;
      }
      setDone({ published: payload.published, paperId: payload.paperId, topics: payload.topicsCovered });
      router.refresh();
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
    } finally {
      setBusy(null);
    }
  }

  const covered = preview?.topics.reduce((sum, topic) => sum + topic.minutes, 0) ?? 0;
  const subjects = new Set(preview?.topics.map((topic) => topic.subject_bn) ?? []).size;

  return (
    <section className="jh-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-1.5 text-[0.875rem] font-bold text-[var(--text)]">
            <CalendarClock className="size-4 text-[var(--brand)]" aria-hidden />
            সাপ্তাহিক পরীক্ষা
          </h2>
          <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-[var(--text-muted)]">
            রুটিনের ওই সপ্তাহের টপিক থেকেই প্রশ্নপত্র তৈরি হবে — একাধিক বিষয়, ১০০ নম্বর, ৬০/২০/১০/১০।
          </p>
        </div>
        <Badge tone="brand">১০০ নম্বর</Badge>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <label className="block">
          <span className="jh-label">কোর্স</span>
          <select
            className="jh-select h-9 text-[0.8125rem]"
            value={courseId}
            onChange={(event) => { setCourseId(event.target.value); setPreview(null); }}
          >
            {courses.map((course) => (
              <option key={course.id} value={course.id}>{course.title_bn}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="jh-label">সপ্তাহ (সোমবার)</span>
          <input
            type="date"
            value={weekStart}
            onChange={(event) => { setWeekStart(event.target.value); setPreview(null); }}
            className="jh-input h-9 text-[0.8125rem]"
          />
        </label>
        <label className="block">
          <span className="jh-label">শুরুর সময় (ঢাকা)</span>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            className="jh-input h-9 text-[0.8125rem]"
          />
        </label>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <label className="block">
          <span className="jh-label">সময় (মিনিট)</span>
          <input type="number" min={10} max={240} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="jh-input h-9 text-[0.8125rem]" />
        </label>
        <label className="block">
          <span className="jh-label">প্রশ্নসংখ্যা</span>
          <input type="number" min={10} max={200} value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} className="jh-input h-9 text-[0.8125rem]" />
        </label>
        <label className="block">
          <span className="jh-label">ফল প্রকাশ (মিনিট পরে)</span>
          <input type="number" min={0} max={10080} value={resultDelay} onChange={(e) => setResultDelay(Number(e.target.value))} className="jh-input h-9 text-[0.8125rem]" />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" loading={busy === "preview"} onClick={loadPreview} disabled={!courseId}>
          রুটিন দেখুন
        </Button>
        <Button size="sm" variant="secondary" loading={busy === "create"} onClick={() => create(false)} disabled={!courseId}>
          ড্রাফট তৈরি
        </Button>
        <Button size="sm" loading={busy === "publish"} onClick={() => create(true)} disabled={!courseId}>
          <Radio className="size-3.5" aria-hidden />
          তৈরি ও প্রকাশ
        </Button>
      </div>

      {error ? (
        <p role="alert" className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-2 text-[0.6875rem] font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
          <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {done ? (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-mint-50 px-2.5 py-2 text-[0.6875rem] font-medium text-mint-700 dark:bg-mint-600/10 dark:text-mint-400">
          <CircleCheck className="mt-0.5 size-3 shrink-0" aria-hidden />
          {done.published
            ? `পরীক্ষা প্রকাশিত — ${formatNumber(done.topics)}টি টপিকের ওপর প্রশ্নপত্র তৈরি হয়েছে।`
            : `ড্রাফট তৈরি হয়েছে (${formatNumber(done.topics)}টি টপিক)। প্রশ্নপত্র এখনো তৈরি হয়নি।`}
        </p>
      ) : null}

      {preview ? (
        preview.topics.length === 0 ? (
          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-[0.6875rem] font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            <CircleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
            এই সপ্তাহে প্রকাশিত রুটিনে কোনো টপিক নেই। আগে রুটিন প্রকাশ করুন — পরীক্ষা রুটিন ছাড়া তৈরি হবে না।
          </p>
        ) : (
          <div className="mt-2 rounded-lg border border-[var(--border)] p-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="success">{preview.topics.length} টপিক</Badge>
              <Badge tone="neutral">{subjects} বিষয়</Badge>
              <Badge tone="neutral">{formatNumber(covered)} মিনিট</Badge>
              <Badge tone="brand">{questionCount} প্রশ্ন · ১০০ নম্বর</Badge>
            </div>
            <ul className="mt-1.5 max-h-36 space-y-0.5 overflow-y-auto text-[0.625rem]">
              {preview.topics.slice(0, 12).map((topic) => (
                <li key={`${topic.subject_bn}-${topic.topic_bn}`} className="flex items-center gap-2 rounded px-1 py-0.5 odd:bg-[var(--surface-muted)]">
                  <span className="w-24 shrink-0 truncate text-[var(--text-subtle)]">{topic.subject_bn}</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-[var(--text)]">{topic.topic_bn}</span>
                  <span className="shrink-0 text-[var(--text-subtle)]">{formatNumber(topic.minutes)}m</span>
                </li>
              ))}
            </ul>
          </div>
        )
      ) : null}
    </section>
  );
}
