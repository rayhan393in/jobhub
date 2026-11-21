"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarCheck, CalendarPlus, Check, ChevronDown, Coffee, Loader2,
  RefreshCw, TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  buildStudyPlan, formatBn, planSummary, topicCoverageDays,
  type PlanDay, type PlanTopic,
} from "@/lib/study-plan";

type Course = { id: string; title_bn: string; slug: string };

const DURATIONS = [30, 45, 60, 90, 120];
const REST_CHOICES: { value: string; label: string }[] = [
  { value: "5", label: "শুক্রবার" },
  { value: "6", label: "শনিবার" },
  { value: "", label: "বিশ্রাম নেই" },
];

export function StudyPlanner({
  courses,
  topicsByCourse,
  initialCourseId,
  today,
  hasTargetCourse,
}: {
  courses: Course[];
  topicsByCourse: Record<string, PlanTopic[]>;
  initialCourseId: string;
  today: string;
  hasTargetCourse: boolean;
}) {
  const router = useRouter();
  const [courseId, setCourseId] = React.useState(initialCourseId);
  const [minutes, setMinutes] = React.useState(60);
  const [restWeekday, setRestWeekday] = React.useState<string>("5");
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const topics = React.useMemo(() => topicsByCourse[courseId] ?? [], [topicsByCourse, courseId]);

  const plan = React.useMemo(
    () =>
      buildStudyPlan(topics, {
        days: 30,
        minutesPerDay: minutes,
        restWeekday: restWeekday === "" ? null : Number(restWeekday),
        startDate: today,
      }),
    [topics, minutes, restWeekday, today],
  );
  const summary = React.useMemo(() => planSummary(plan), [plan]);
  const coverage = topicCoverageDays(topics.length, minutes);
  /**
   * Is the whole syllabus small enough to finish inside one 30-day cycle? If
   * not, promising "everything ends in N days" next to a 30-day calendar is
   * just wrong — 113 topics cannot be covered by 30 days at one a day.
   */
  const drainsSyllabus = coverage <= 30;
  const course = courses.find((item) => item.id === courseId);

  // Any change to the inputs makes the previous save stale. Reset in the
  // handlers rather than an effect: an effect would fire on mount too and cost
  // an extra render for nothing.
  function changeCourse(next: string) {
    setCourseId(next);
    setSaved(false);
  }

  function changeMinutes(next: number) {
    setMinutes(next);
    setSaved(false);
  }

  function changeRest(next: string) {
    setRestWeekday(next);
    setSaved(false);
  }

  async function savePlan() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/routines/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          minutesPerDay: minutes,
          restWeekday: restWeekday === "" ? null : Number(restWeekday),
          startDate: today,
          days: plan.map((day) => ({
            day: day.day,
            kind: day.kind,
            minutes: day.minutes,
            topicId: day.topic?.id ?? null,
            extraTopicId: day.extra?.id ?? null,
            note: day.note,
          })),
        }),
      });
      const payload = (await response.json()) as { error?: string; created?: number; updated?: number };
      if (!response.ok) {
        setError(payload.error ?? "রুটিন সংরক্ষণ করা যায়নি।");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
    } finally {
      setSaving(false);
    }
  }

  if (topics.length === 0) {
    return (
      <div className="jh-card p-5">
        <p className="flex items-center gap-2 text-[0.875rem] font-semibold text-[var(--text)]">
          <TriangleAlert className="size-4 text-amber-600" aria-hidden />
          এই কোর্সে এখনো টপিক যোগ করা হয়নি
        </p>
        <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
          রুটিন তৈরি হয় কোর্সের আসল সিলেবাস থেকে — তাই টপিক ছাড়া রুটিন বানানো যাবে না। অ্যাডমিন
          সেন্টার থেকে বিষয় ও টপিক যোগ করুন, অথবা এমন কোর্স বেছে নিন যেটায় সিলেবাস আছে।
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {courses
            .filter((item) => (topicsByCourse[item.id]?.length ?? 0) > 0)
            .map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => changeCourse(item.id)}
                className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-[0.75rem] font-semibold text-[var(--text-muted)] hover:border-[var(--brand)] hover:text-[var(--brand)]"
              >
                {item.title_bn}
              </button>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ---------------- controls ---------------- */}
      <div className="jh-card p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="jh-label">কোর্স</span>
            <select
              className="jh-select h-10 text-[0.8125rem]"
              value={courseId}
              onChange={(event) => changeCourse(event.target.value)}
            >
              {courses.map((item) => (
                <option key={item.id} value={item.id} disabled={(topicsByCourse[item.id]?.length ?? 0) === 0}>
                  {item.title_bn}
                  {(topicsByCourse[item.id]?.length ?? 0) === 0 ? " (সিলেবাস নেই)" : ""}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="jh-label">প্রতিদিন কত মিনিট</span>
            <div className="flex flex-wrap gap-1">
              {DURATIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => changeMinutes(value)}
                  className={cn(
                    "h-10 rounded-lg border px-2.5 text-[0.75rem] font-semibold transition-colors",
                    minutes === value
                      ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
                      : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)]",
                  )}
                >
                  {formatBn(value)}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="jh-label">সাপ্তাহিক বিশ্রাম</span>
            <select
              className="jh-select h-10 text-[0.8125rem]"
              value={restWeekday}
              onChange={(event) => changeRest(event.target.value)}
            >
              {REST_CHOICES.map((choice) => (
                <option key={choice.label} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "মোট সময়", value: summary.durationBn },
            { label: "পড়ার দিন", value: `${formatBn(summary.study)} দিন` },
            { label: "রিভিশন", value: `${formatBn(summary.revision)} দিন` },
            { label: "বিশ্রাম", value: `${formatBn(summary.rest)} দিন` },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-[var(--surface-muted)] px-3 py-2">
              <dt className="text-[0.625rem] font-medium text-[var(--text-subtle)]">{item.label}</dt>
              <dd className="mt-0.5 text-[0.8125rem] font-bold text-[var(--text)]">{item.value}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-3 text-[0.6875rem] leading-relaxed text-[var(--text-subtle)]">
          {drainsSyllabus ? (
            <>
              এই কোর্সে {formatBn(topics.length)}টি টপিক আছে—{formatBn(minutes)} মিনিটে প্রতিদিন{" "}
              {formatBn(minutes >= 90 ? 2 : 1)}টি হিসেবে প্রায় {formatBn(coverage)} দিনে সবগুলো একবার শেষ হবে।
              এরপরের দিনগুলো পুনরাবৃত্তিতে যাবে।
            </>
          ) : (
            <>
              এই কোর্সে {formatBn(topics.length)}টি টপিক আছে। ৩০ দিনে {formatBn(summary.topics)}টি টপিক
              একবার দেখা হবে; বাকিগুলো পরের সাইকেলে। প্রতিটি দিনের টপিক আপনার আসল সিলেবাস থেকেই নেওয়া।
            </>
          )}
        </p>

        {!hasTargetCourse ? (
          <p className="mt-2 flex items-start gap-1.5 text-[0.6875rem] leading-relaxed text-[var(--text-subtle)]">
            টিপ: <a href="/account" className="font-semibold text-[var(--brand)] hover:underline">অ্যাকাউন্ট</a>-এ
            লক্ষ্য কোর্স সেট করলে ড্যাশবোর্ডে এই রুটিনটা আগে দেখাবে।
          </p>
        ) : null}
      </div>

      {/* ---------------- save ---------------- */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={savePlan} loading={saving} disabled={saved}>
          {!saving ? (saved ? <Check className="size-4" aria-hidden /> : <CalendarPlus className="size-4" aria-hidden />) : null}
          {saved ? "রুটিন সেভ হয়েছে" : "আমার রুটিনে সেভ করুন"}
        </Button>
        <Button variant="ghost" size="md" onClick={() => setOpen((value) => !value)}>
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
          {open ? "৩০ দিনের তালিকা লুকান" : "৩০ দিনের তালিকা দেখুন"}
        </Button>
        {saved ? (
          <span className="flex items-center gap-1.5 text-[0.75rem] font-medium text-mint-700 dark:text-mint-400">
            <CalendarCheck className="size-3.5" aria-hidden />
            ৩০ দিনের প্ল্যান সেভ হয়েছে — রুটিন পেজে দেখা যাবে।
          </span>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-[0.75rem] font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {/* ---------------- the plan ---------------- */}
      {open ? (
        <ol className="space-y-1.5">
          {plan.map((day) => (
            <PlanRow key={day.day} day={day} startDate={today} />
          ))}
        </ol>
      ) : (
        <div className="jh-card overflow-hidden">
          <div className="grid gap-px bg-[var(--border)] sm:grid-cols-2">
            {plan.slice(0, 6).map((day) => (
              <div key={day.day} className="bg-[var(--surface)] p-3.5">
                <PlanRow day={day} startDate={today} bare />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex w-full items-center justify-center gap-1.5 border-t border-[var(--border)] px-4 py-2.5 text-[0.75rem] font-semibold text-[var(--brand)] hover:bg-[var(--surface-muted)]"
          >
            বাকি {formatBn(plan.length - 6)} দিন দেখুন
            <ChevronDown className="size-3.5" aria-hidden />
          </button>
        </div>
      )}

      {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      <p className="flex items-center gap-1.5 text-[0.625rem] text-[var(--text-subtle)]">
        <RefreshCw className="size-3" aria-hidden />
        মিনিট বা বিশ্রামের দিন বদলালে প্ল্যান সাথে সাথেই নতুন করে সাজানো হয়।
        {course ? ` কোর্স: ${course.title_bn}।` : ""}
      </p>
    </div>
  );
}

function PlanRow({ day, startDate, bare }: { day: PlanDay; startDate: string; bare?: boolean }) {
  const date = React.useMemo(() => {
    const base = new Date(`${startDate}T00:00:00Z`);
    base.setUTCDate(base.getUTCDate() + day.day - 1);
    return new Intl.DateTimeFormat("bn-BD", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(base);
  }, [startDate, day.day]);

  const tone =
    day.kind === "rest"
      ? "border-[var(--border)] bg-[var(--surface-muted)]"
      : day.kind === "revision"
        ? "border-violet-200 bg-violet-50 dark:border-violet-800/40 dark:bg-violet-900/20"
        : "border-[var(--border)] bg-[var(--surface)]";

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[0.6875rem] font-semibold text-[var(--text-subtle)]">
            দিন {formatBn(day.day)} · {date}
          </p>
          <p className="mt-0.5 truncate text-[0.8125rem] font-bold text-[var(--text)]">
            {day.kind === "rest" ? (
              <span className="inline-flex items-center gap-1.5">
                <Coffee className="size-3.5 text-[var(--text-subtle)]" aria-hidden />
                বিশ্রাম
              </span>
            ) : day.topic ? (
              day.topic.label
            ) : (
              "পুনরাবৃত্তি"
            )}
          </p>
          {day.extra ? (
            <p className="truncate text-[0.75rem] text-[var(--text-muted)]">+ {day.extra.label}</p>
          ) : null}
          {!bare ? (
            <p className="mt-1 text-pretty text-[0.6875rem] leading-relaxed text-[var(--text-muted)]">{day.note}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={day.kind === "rest" ? "neutral" : day.kind === "revision" ? "accent" : "brand"}>
            {day.kind === "rest" ? "০ মিনিট" : `${formatBn(day.minutes)} মিনিট`}
          </Badge>
          {bare ? null : (
            <span className="max-w-[7rem] truncate text-[0.625rem] text-[var(--text-subtle)]">
              {day.topic?.subjectLabel ?? ""}
            </span>
          )}
        </div>
      </div>
    </>
  );

  if (bare) return body;

  return <li className={cn("rounded-xl border p-3.5", tone)}>{body}</li>;
}
