"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, ArrowRight, BookOpenCheck, Check, CircleHelp, Layers,
  Loader2, Play, Search, Shuffle, Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import { formatNumber, toBengaliDigits } from "@/lib/format";
import { cn } from "@/lib/cn";

type Subject = { id: string; title_bn: string; title_en: string };
type Topic = { id: string; subject_id: string; title_bn: string; title_en: string; subtopics: { id: string; title_bn: string }[] };

export type BuilderCourse = { id: string; slug: string; title_bn: string; exam_config: { max_questions: number; max_duration_minutes: number } };

type Scope =
  | { kind: "mixed" }
  | { kind: "subject"; subjectId: string; label: string }
  | { kind: "topic"; topicId: string; label: string }
  | { kind: "subtopic"; subtopicId: string; label: string };

type Step = 1 | 2 | 3 | 4 | 5;

const STEPS: { id: Step; label: string }[] = [
  { id: 1, label: "কোর্স" },
  { id: 2, label: "স্কোপ" },
  { id: 3, label: "পরিমাণ" },
  { id: 4, label: "সময়" },
  { id: 5, label: "পর্যালোচনা" },
];

export function ExamBuilder({
  courses,
  subjectsByCourse,
  topicsByCourse,
  initialCourseSlug,
  initialTopicId,
  mode = "custom",
  maxQuestions = 100,
  maxDuration = 180,
}: {
  courses: BuilderCourse[];
  subjectsByCourse: Record<string, Subject[]>;
  topicsByCourse: Record<string, Topic[]>;
  initialCourseSlug?: string;
  initialTopicId?: string;
  mode?: string;
  maxQuestions?: number;
  maxDuration?: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const presetCourse = initialCourseSlug ?? params.get("course") ?? undefined;
  const presetTopic = initialTopicId ?? params.get("topic") ?? undefined;

  const [step, setStep] = React.useState<Step>(1);
  const [courseId, setCourseId] = React.useState<string>(() => {
    const match = courses.find((c) => c.slug === presetCourse);
    return match?.id ?? courses[0]?.id ?? "";
  });
  const [scope, setScope] = React.useState<Scope>({ kind: "mixed" });
  const [search, setSearch] = React.useState("");
  const [count, setCount] = React.useState(20);
  const [duration, setDuration] = React.useState(20);
  const [available, setAvailable] = React.useState<number | null>(null);
  const [checking, setChecking] = React.useState(false);
  const [starting, setStarting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const course = courses.find((c) => c.id === courseId);
  const subjects = subjectsByCourse[courseId] ?? [];
  const topics = topicsByCourse[courseId] ?? [];
  const limit = Math.min(maxQuestions, course?.exam_config.max_questions ?? maxQuestions);
  const durationLimit = Math.min(maxDuration, course?.exam_config.max_duration_minutes ?? maxDuration);

  const scopeQuery = React.useMemo(() => {
    const base = `courseId=${courseId}`;
    if (scope.kind === "subject") return `${base}&subjectId=${scope.subjectId}`;
    if (scope.kind === "topic") return `${base}&topicId=${scope.topicId}`;
    if (scope.kind === "subtopic") return `${base}&subtopicId=${scope.subtopicId}`;
    return base;
  }, [courseId, scope]);

  const checkAvailability = React.useCallback(async () => {
    if (!courseId) return;
    setChecking(true);
    setError(null);
    try {
      const response = await fetch(`/api/practice/availability?${scopeQuery}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "প্রশ্নসংখ্যা যাচাই করা যায়নি।");
        setAvailable(null);
        return;
      }
      setAvailable(payload.available as number);
      setCount((prev) => {
        const cap = Math.max(1, Math.min(limit, payload.available as number));
        return Math.min(prev, cap);
      });
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
    } finally {
      setChecking(false);
    }
  }, [courseId, limit, scopeQuery]);

  React.useEffect(() => {
    if (step >= 2) void checkAvailability();
  }, [checkAvailability, step]);

  // Preselect a topic supplied by the dashboard "revise weak topic" link.
  React.useEffect(() => {
    if (!presetTopic) return;
    const topic = topics.find((t) => t.id === presetTopic);
    if (topic) {
      setScope({ kind: "topic", topicId: topic.id, label: topic.title_bn });
      setStep(2);
    }
  }, [presetTopic, topics]);

  const scopeKindIsTopic: boolean = scope.kind === "topic";
  const scopeTopicId: string | null = scope.kind === "topic" ? scope.topicId : null;
  const scopeSubtopicId: string | null = scope.kind === "subtopic" ? scope.subtopicId : null;

  const filteredTopics = topics.filter((topic) => {
    if (!search.trim()) return true;
    const needle = search.trim().toLowerCase();
    return topic.title_bn.toLowerCase().includes(needle) || topic.title_en.toLowerCase().includes(needle);
  });

  async function startExam() {
    setStarting(true);
    setError(null);
    try {
      const items =
        scope.kind === "mixed"
          ? [{ count }]
          : scope.kind === "subject"
            ? [{ subject_id: scope.subjectId, count }]
            : scope.kind === "topic"
              ? [{ topic_id: scope.topicId, count }]
              : [{ subtopic_id: scope.subtopicId, count }];

      const response = await fetch("/api/practice/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          composition: { items },
          durationMinutes: duration,
          mode,
          titleEn: "Custom practice exam",
          titleBn: "কাস্টম প্র্যাকটিস পরীক্ষা",
        }),
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
      setStarting(false);
    }
  }

  const canNext =
    (step === 1 && Boolean(courseId)) ||
    (step === 2 && (scope.kind === "mixed" || available === null || available > 0)) ||
    step === 3 ||
    step === 4;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="jh-card overflow-hidden">
        {/* Stepper */}
        <ol className="flex items-center gap-1 border-b border-[var(--border)] px-3 py-2.5 sm:px-5" aria-label="Steps">
          {STEPS.map((item) => (
            <li key={item.id} className="flex flex-1 items-center gap-1.5">
              <button
                type="button"
                onClick={() => item.id <= step && setStep(item.id)}
                disabled={item.id > step}
                aria-current={step === item.id ? "step" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2 py-1 text-[0.6875rem] font-semibold transition-colors",
                  step === item.id
                    ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                    : item.id < step
                      ? "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
                      : "text-[var(--text-subtle)]",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full text-[0.625rem]",
                    item.id < step
                      ? "bg-mint-500 text-white"
                      : step === item.id
                        ? "bg-[var(--brand)] text-white"
                        : "bg-[var(--surface-sunken)] text-[var(--text-subtle)]",
                  )}
                >
                  {item.id < step ? <Check className="size-3" aria-hidden /> : toBengaliDigits(item.id)}
                </span>
                <span className="hidden sm:inline">{item.label}</span>
              </button>
              {item.id !== 5 ? <span className="h-px flex-1 bg-[var(--border)]" aria-hidden /> : null}
            </li>
          ))}
        </ol>

        <div className="min-h-[19rem] p-5">
          {step === 1 ? (
            <div>
              <h2 className="text-[0.9375rem] font-semibold text-[var(--text)]">কোন কোর্সের প্রস্তুতি?</h2>
              <p className="mt-1 text-[0.75rem] text-[var(--text-muted)]">
                প্রতিটি কোর্সের আলাদা প্রশ্নব্যাংক ও বিষয়-তালিকা আছে।
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {courses.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setCourseId(item.id);
                      setScope({ kind: "mixed" });
                      setAvailable(null);
                    }}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-[0.8125rem] font-medium transition-colors",
                      courseId === item.id
                        ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
                        : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)]",
                    )}
                  >
                    {item.title_bn}
                    {courseId === item.id ? <Check className="size-4 shrink-0" aria-hidden /> : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div>
              <h2 className="text-[0.9375rem] font-semibold text-[var(--text)]">কী অনুশীলন করবেন?</h2>
              <p className="mt-1 text-[0.75rem] text-[var(--text-muted)]">
                শুধু যাচাইকৃত ও অনুমোদিত প্রশ্ন ব্যবহার হয় — কোনো প্রতিস্থাপন নয়।
              </p>

              <button
                type="button"
                onClick={() => setScope({ kind: "mixed" })}
                className={cn(
                  "mt-3 flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[0.8125rem] font-medium",
                  scope.kind === "mixed"
                    ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
                    : "border-[var(--border)] text-[var(--text-muted)]",
                )}
              >
                <Shuffle className="size-4" aria-hidden />
                মিশ্র অনুশীলন (সব বিষয়)
              </button>

              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--text-subtle)]" aria-hidden />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="টপিক খুঁজুন…"
                  className="h-9 pl-8 text-[0.75rem]"
                  aria-label="Search topics"
                />
              </div>

              <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
                {subjects.map((subject) => {
                  const subjectTopics = filteredTopics.filter((t) => t.subject_id === subject.id);
                  return (
                    <div key={subject.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setScope({ kind: "subject", subjectId: subject.id, label: subject.title_bn })
                        }
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[0.8125rem] font-semibold",
                          scope.kind === "subject" && scope.subjectId === subject.id
                            ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                            : "text-[var(--text)] hover:bg-[var(--surface-muted)]",
                        )}
                      >
                        <BookOpenCheck className="size-3.5 shrink-0" aria-hidden />
                        {subject.title_bn}
                      </button>
                      {subjectTopics.length > 0 ? (
                        <ul className="ml-5 space-y-0.5 border-l border-[var(--border)] pl-2">
                          {subjectTopics.map((topic) => (
                            <li key={topic.id}>
                              <button
                                type="button"
                                onClick={() => setScope({ kind: "topic", topicId: topic.id, label: topic.title_bn })}
                                className={cn(
                                  "w-full rounded-md px-2 py-1 text-left text-[0.75rem]",
                                  scope.kind === "topic" && scope.topicId === topic.id
                                    ? "bg-[var(--brand-soft)] font-semibold text-[var(--brand)]"
                                    : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]",
                                )}
                              >
                                {topic.title_bn}
                              </button>
                              {topic.subtopics.length > 0 && scopeKindIsTopic && scopeTopicId === topic.id ? (
                                <ul className="ml-2 mt-0.5 space-y-0.5">
                                  {topic.subtopics.map((sub) => (
                                    <li key={sub.id}>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setScope({ kind: "subtopic", subtopicId: sub.id, label: sub.title_bn })
                                        }
                                        className={cn(
                                          "w-full rounded px-2 py-0.5 text-left text-[0.6875rem]",
                                          scopeSubtopicId === sub.id
                                            ? "bg-[var(--brand-soft)] font-semibold text-[var(--brand)]"
                                            : "text-[var(--text-subtle)] hover:bg-[var(--surface-muted)]",
                                        )}
                                      >
                                        ↳ {sub.title_bn}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  );
                })}
                {topics.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<Layers className="size-4" />}
                    title="এই কোর্সে এখনো টপিক নেই"
                    description="মিশ্র অনুশীলন বেছে নিন, অথবা প্রশাসক টপিক যোগ করা পর্যন্ত অপেক্ষা করুন।"
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div>
              <h2 className="text-[0.9375rem] font-semibold text-[var(--text)]">কতটি প্রশ্ন?</h2>
              <div className="mt-2 flex items-center gap-2 text-[0.75rem]">
                {checking ? (
                  <span className="inline-flex items-center gap-1.5 text-[var(--text-muted)]">
                    <Loader2 className="size-3 animate-spin" aria-hidden />
                    যাচাই করা হচ্ছে…
                  </span>
                ) : available !== null ? (
                  <Badge tone={available > 0 ? "success" : "warning"}>
                    {formatNumber(available)}টি যাচাইকৃত প্রশ্ন উপলব্ধ
                  </Badge>
                ) : null}
              </div>

              <div className="mt-4">
                <label htmlFor="question-count" className="jh-label">
                  প্রশ্নসংখ্যা: <span className="font-bold text-[var(--text)]">{formatNumber(count)}</span>
                </label>
                <input
                  id="question-count"
                  type="range"
                  min={1}
                  max={Math.max(1, Math.min(limit, available ?? limit))}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="w-full accent-[var(--brand)]"
                />
                <div className="mt-1 flex justify-between text-[0.625rem] text-[var(--text-subtle)]">
                  <span>১</span>
                  <span>সর্বোচ্চ {formatNumber(Math.min(limit, available ?? limit))}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {[10, 20, 30, 50, 100].map((preset) => {
                  const cap = Math.min(limit, available ?? limit);
                  const disabled = preset > cap;
                  return (
                    <button
                      key={preset}
                      type="button"
                      disabled={disabled}
                      onClick={() => setCount(Math.min(preset, cap))}
                      className={cn(
                        "rounded-lg border px-2.5 py-1 text-[0.75rem] font-semibold",
                        count === preset
                          ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
                          : "border-[var(--border)] text-[var(--text-muted)]",
                        disabled && "cursor-not-allowed opacity-40",
                      )}
                    >
                      {formatNumber(preset)}
                    </button>
                  );
                })}
              </div>

              {available === 0 ? (
                <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[0.75rem] leading-relaxed text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  এই নির্বাচনে কোনো যাচাইকৃত প্রশ্ন নেই। অন্য টপিক বেছে নিন — প্ল্যাটফর্ম অযাচাইকৃত প্রশ্ন
                  দিয়ে এই ঘাটতি পূরণ করে না।
                </p>
              ) : null}
            </div>
          ) : null}

          {step === 4 ? (
            <div>
              <h2 className="text-[0.9375rem] font-semibold text-[var(--text)]">কত সময়?</h2>
              <p className="mt-1 text-[0.75rem] text-[var(--text-muted)]">
                সময় সার্ভারে গণনা হয় — ব্রাউজার বন্ধ করলেও সময় বেশি পাওয়া যায় না।
              </p>
              <div className="mt-4">
                <label htmlFor="duration" className="jh-label">
                  সময়কাল: <span className="font-bold text-[var(--text)]">{formatNumber(duration)} মিনিট</span>
                </label>
                <input
                  id="duration"
                  type="range"
                  min={1}
                  max={durationLimit}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full accent-[var(--brand)]"
                />
                <div className="mt-1 flex justify-between text-[0.625rem] text-[var(--text-subtle)]">
                  <span>১ মিনিট</span>
                  <span>সর্বোচ্চ {formatNumber(durationLimit)} মিনিট</span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {[10, 15, 20, 30, 45, 60].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDuration(Math.min(preset, durationLimit))}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-[0.75rem] font-semibold",
                      duration === preset
                        ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
                        : "border-[var(--border)] text-[var(--text-muted)]",
                    )}
                  >
                    {formatNumber(preset)} মিনিট
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === 5 ? (
            <div>
              <h2 className="text-[0.9375rem] font-semibold text-[var(--text)]">পর্যালোচনা</h2>
              <dl className="mt-3 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
                {[
                  ["কোর্স", course?.title_bn ?? "—"],
                  ["স্কোপ", scope.kind === "mixed" ? "মিশ্র (সব বিষয়)" : scope.label],
                  ["প্রশ্নসংখ্যা", formatNumber(count)],
                  ["সময়", `${formatNumber(duration)} মিনিট`],
                  ["নম্বরকরণ", "সঠিক +১ · ভুল −০.৫ · অনুত্তরিত ০"],
                  ["প্রশ্ন যাচাই", "শুধু যাচাইকৃত ও অনুমোদিত"],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <dt className="text-[0.75rem] text-[var(--text-subtle)]">{label}</dt>
                    <dd className="text-right text-[0.8125rem] font-semibold text-[var(--text)]">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-[0.6875rem] leading-relaxed text-[var(--text-muted)]">
                <CircleHelp className="mt-0.5 size-3.5 shrink-0 text-[var(--brand)]" aria-hidden />
                এটি একটি <strong>প্র্যাকটিস</strong> পরীক্ষা, নির্ধারিত লাইভ পরীক্ষা নয়। ফলাফল সাথে সাথেই দেখা
                যাবে এবং লিডারবোর্ডে গণ্য হবে না।
              </p>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[0.75rem] font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] px-5 py-3.5">
          <Button variant="ghost" size="sm" onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))} disabled={step === 1}>
            <ArrowLeft className="size-3.5" aria-hidden />
            আগের
          </Button>
          {step < 5 ? (
            <Button size="sm" onClick={() => setStep((s) => ((s + 1) as Step))} disabled={!canNext}>
              পরবর্তী
              <ArrowRight className="size-3.5" aria-hidden />
            </Button>
          ) : (
            <Button size="sm" onClick={startExam} loading={starting} disabled={!available || available < 1}>
              <Play className="size-3.5" aria-hidden />
              পরীক্ষা শুরু করুন
            </Button>
          )}
        </div>
      </div>

      {/* Summary rail */}
      <aside className="space-y-4">
        <div className="jh-card p-4">
          <h2 className="text-[0.8125rem] font-semibold text-[var(--text)]">আপনার নির্বাচন</h2>
          <dl className="mt-3 space-y-2 text-[0.75rem]">
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--text-subtle)]">কোর্স</dt>
              <dd className="text-right font-medium text-[var(--text)]">{course?.title_bn ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--text-subtle)]">স্কোপ</dt>
              <dd className="max-w-[9rem] text-right font-medium text-[var(--text)]">
                {scope.kind === "mixed" ? "মিশ্র" : scope.label}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--text-subtle)]">প্রশ্ন</dt>
              <dd className="font-medium text-[var(--text)]">{formatNumber(count)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--text-subtle)]">সময়</dt>
              <dd className="font-medium text-[var(--text)]">{formatNumber(duration)} মিনিট</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--text-subtle)]">উপলব্ধ</dt>
              <dd className="font-medium text-[var(--text)]">
                {available === null ? "—" : formatNumber(available)}
              </dd>
            </div>
          </dl>
          <Progress value={step * 20} className="mt-3" label="Builder progress" />
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-[var(--text)]">
            <Sparkles className="size-3.5 text-[var(--brand)]" aria-hidden />
            মনে রাখুন
          </p>
          <ul className="mt-1.5 space-y-1 text-[0.6875rem] leading-relaxed text-[var(--text-muted)]">
            <li>সর্বোচ্চ {formatNumber(limit)} প্রশ্ন ও {formatNumber(durationLimit)} মিনিট।</li>
            <li>কোনো প্রশ্ন পুনরাবৃত্তি হবে না।</li>
            <li>প্রশ্ন শেষ হওয়ার আগেই উত্তর স্বয়ংক্রিয়ভাবে সংরক্ষিত।</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
