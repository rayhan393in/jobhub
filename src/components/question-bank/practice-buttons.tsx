"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ListChecks, Loader2, Play, Timer, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { formatNumber } from "@/lib/format";

/** Starts a one-question practice attempt and jumps straight into the runner. */
export function SinglePracticeButton({ questionId }: { questionId: string }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/practice/single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });
      const payload = (await response.json()) as { attemptId?: string; error?: string };
      if (!response.ok || !payload.attemptId) {
        setError(payload.error ?? "অনুশীলন শুরু করা যায়নি।");
        return;
      }
      router.push(`/exam/${payload.attemptId}`);
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button type="button" variant="outline" size="sm" onClick={start} loading={loading}>
        {loading ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
        একক অনুশীলন
      </Button>
      {error ? <span className="text-[0.625rem] font-medium text-[var(--danger)]">{error}</span> : null}
    </span>
  );
}

/**
 * Exam-wise (timed) practice for a selected BCS examination. Builds a paper
 * exclusively from that exam's verified previous-year questions via
 * `/api/practice/start` with an exam-scoped composition.
 */
export function ExamPracticeButton({
  courseId,
  examName,
  examYear,
  total,
}: {
  courseId: string;
  examName: string;
  examYear: number | null;
  total: number;
}) {
  const router = useRouter();
  const suggested = Math.min(Math.max(total, 10), 100);
  const [count, setCount] = React.useState(suggested);
  const [duration, setDuration] = React.useState(Math.min(Math.max(suggested, 10), 120));
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const capped = Math.min(Math.max(1, count || 1), total);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/practice/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          composition: {
            items: [{ exam_name: examName, exam_year: examYear ?? undefined, count: capped }],
          },
          durationMinutes: Math.max(1, Math.min(180, duration || capped)),
          mode: "timed_mock",
          titleEn: `${examName} practice`,
          titleBn: `${examName} অনুশীলন`,
        }),
      });
      const payload = (await response.json()) as { attempt_id?: string; error?: string };
      if (!response.ok || !payload.attempt_id) {
        setError(payload.error ?? "মক টেস্ট শুরু করা যায়নি।");
        return;
      }
      router.push(`/exam/${payload.attempt_id}`);
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  }

  if (total < 1) return null;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[0.8125rem] font-semibold text-[var(--text)]">
          <ListChecks className="size-4 text-[var(--brand)]" aria-hidden />
          এই পরীক্ষার মক টেস্ট
        </p>
        <span className="text-[0.6875rem] text-[var(--text-subtle)]">
          যাচাইকৃত প্রশ্ন: {formatNumber(total)}টি
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[0.625rem] font-semibold text-[var(--text-subtle)]">
          প্রশ্নসংখ্যা
          <select
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
            className="jh-select h-9 w-28 text-[0.75rem]"
            aria-label="প্রশ্নসংখ্যা"
          >
            {[10, 20, 30, 50, 100].filter((option) => option < total).concat([total]).filter((option, index, all) => all.indexOf(option) === index).map((option) => (
              <option key={option} value={option}>{formatNumber(option)}টি</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[0.625rem] font-semibold text-[var(--text-subtle)]">
          সময় (মিনিট)
          <Input
            type="number"
            min={1}
            max={180}
            value={duration}
            onChange={(event) => setDuration(Number(event.target.value))}
            className="h-9 w-24 text-[0.75rem]"
            aria-label="সময় মিনিট"
          />
        </label>
        <Button type="button" onClick={start} loading={loading} className="h-9 px-4 text-[0.8125rem]">
          {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Timer className="size-4" aria-hidden />}
          মক টেস্ট শুরু করুন
        </Button>
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-[0.625rem] leading-relaxed text-[var(--text-subtle)]">
        <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
        সময় শেষ হলে পরীক্ষা স্বয়ংক্রিয়ভাবে জমা হবে। সার্ভারে সময় নিয়ন্ত্রিত — রিফ্রেশ করলেও বেশি সময় পাওয়া যাবে না।
      </p>
      {error ? <p className="mt-2 text-[0.6875rem] font-medium text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
