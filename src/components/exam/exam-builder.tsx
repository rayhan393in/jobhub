"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle, BookOpenCheck, Check, ChevronRight, CircleHelp, Layers,
  Play, Search, Shuffle, Sparkles, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { formatNumber, toBengaliDigits } from "@/lib/format";
import { cn } from "@/lib/cn";
import { splitComposition, type CompositionItem } from "@/lib/exam-composition";

type Subject = { id: string; title_bn: string; title_en: string };
type Topic = { id: string; subject_id: string; title_bn: string; title_en: string; subtopics: { id: string; title_bn: string }[] };

export type BuilderCourse = { id: string; slug: string; title_bn: string; exam_config: { max_questions: number; max_duration_minutes: number } };

/**
 * One selectable scope. The exam can mix several of these at once, which is what
 * "৫টি টপিক + ২টি সাবটপিক বেছে নিন" needs — the old builder allowed exactly one.
 */
type Scope = {
  /** Stable key: `s:<subjectId>` / `t:<topicId>` / `st:<subtopicId>`. */
  key: string;
  kind: "subject" | "topic" | "subtopic";
  id: string;
  label: string;
  /** Walked up the tree for display; never used for filtering. */
  subjectLabel: string;
  topicLabel?: string;
  available: number | null;
};

const PAGE_SIZE = 12;

function scopeKey(kind: Scope["kind"], id: string) {
  return `${kind === "subject" ? "s" : kind === "topic" ? "t" : "st"}:${id}`;
}

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

  const [courseId, setCourseId] = React.useState<string>(() => {
    const match = courses.find((c) => c.slug === presetCourse);
    if (match) return match.id;
    // Several catalogue courses are published before anyone adds a syllabus and
    // therefore have no subjects. Landing on one of those shows an empty tree
    // and looks broken, so start on the first course that actually has content.
    const withSyllabus = courses.find((c) => (topicsByCourse[c.id]?.length ?? 0) > 0);
    return withSyllabus?.id ?? courses[0]?.id ?? "";
  });
  const [scopes, setScopes] = React.useState<Scope[]>([]);
  const [count, setCount] = React.useState(20);
  // Exam mode: the paper is 100 marks at 60/20/10/10. Default off because a
  // 20-question practice drill is not a 100-mark exam.
  const [examMode, setExamMode] = React.useState(false);
  const [duration, setDuration] = React.useState(20);
  const [starting, setStarting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const course = courses.find((c) => c.id === courseId);
  const subjects = subjectsByCourse[courseId] ?? [];
  const topics = React.useMemo(() => topicsByCourse[courseId] ?? [], [topicsByCourse, courseId]);
  const limit = Math.min(maxQuestions, course?.exam_config.max_questions ?? maxQuestions);
  const durationLimit = Math.min(maxDuration, course?.exam_config.max_duration_minutes ?? maxDuration);

  const mixed = scopes.length === 0;
  const available = mixed ? null : scopes.reduce((sum, s) => sum + (s.available ?? 0), 0);
  const anyUnknown = scopes.some((s) => s.available === null);
  const cap = Math.min(limit, available ?? limit);

  /** Availability is tracked per scope so removing one chip only invalidates that chip. */
  const [checking, setChecking] = React.useState(false);

  const refreshAvailability = React.useCallback(
    async (list: Scope[], signal?: AbortSignal) => {
      if (!courseId || list.length === 0) return;
      setChecking(true);
      try {
        const results = await Promise.all(
          list.map(async (item) => {
            const key = item.kind === "subject" ? "subjectId" : item.kind === "topic" ? "topicId" : "subtopicId";
            const response = await fetch(
              `/api/practice/availability?courseId=${courseId}&${key}=${item.id}`,
              { cache: "no-store", signal },
            );
            if (!response.ok) return { key: item.key, available: 0 };
            const payload = (await response.json()) as { available?: number };
            return { key: item.key, available: payload.available ?? 0 };
          }),
        );
        setScopes((current) =>
          current.map((item) => {
            const hit = results.find((r) => r.key === item.key);
            return hit ? { ...item, available: hit.available } : item;
          }),
        );
      } catch (caught) {
        if ((caught as Error).name !== "AbortError") setError("প্রশ্নসংখ্যা যাচাই করা যায়নি।");
      } finally {
        setChecking(false);
      }
    },
    [courseId],
  );

  React.useEffect(() => {
    if (scopes.length === 0) return;
    const controller = new AbortController();
    void refreshAvailability(scopes, controller.signal);
    // Only re-run when the *set* of scopes changes, not on every count edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopes.map((s) => s.key).join("|"), courseId]);

  // Keep the count inside the verified pool as scopes come and go.
  React.useEffect(() => {
    if (mixed) return;
    setCount((prev) => Math.max(1, Math.min(prev, Math.max(1, cap))));
  }, [cap, mixed]);

  // Preselect a topic supplied by the dashboard "revise weak topic" link.
  React.useEffect(() => {
    if (!presetTopic) return;
    const topic = topics.find((t) => t.id === presetTopic);
    const subject = topic ? subjects.find((s) => s.id === topic.subject_id) : undefined;
    if (topic) {
      setScopes((current) =>
        current.some((s) => s.key === scopeKey("topic", topic.id))
          ? current
          : [
              {
                key: scopeKey("topic", topic.id),
                kind: "topic",
                id: topic.id,
                label: topic.title_bn,
                subjectLabel: subject?.title_bn ?? "",
                available: null,
              },
              ...current,
            ],
      );
    }
  }, [presetTopic, topics, subjects]);

  function toggle(next: Omit<Scope, "available">) {
    setScopes((current) => {
      const exists = current.some((s) => s.key === next.key);
      if (exists) return current.filter((s) => s.key !== next.key);
      return [...current, { ...next, available: null }];
    });
  }

  async function startExam() {
    setStarting(true);
    setError(null);
    try {
      // Split the requested count across the selected scopes in proportion to
      // each one's verified pool, so a mixed selection still fills the paper.
      const items: CompositionItem[] = mixed
        ? [{ count }]
        : splitComposition(
            scopes.map((scope) => ({
              kind: scope.kind,
              id: scope.id,
              available: scope.available,
            })),
            count,
          );

      const response = await fetch("/api/practice/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          composition: { items },
          durationMinutes: duration,
          mode,
          titleEn: examMode ? "Custom 100-mark exam" : "Custom practice exam",
          titleBn: examMode ? "কাস্টম ১০০ নম্বরের পরীক্ষা" : "কাস্টম প্র্যাকটিস পরীক্ষা",
          structured: examMode ? { totalMarks: 100 } : undefined,
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

  const canStart = mixed || (!anyUnknown && (available ?? 0) > 0);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-4">
        {/* ---------------- the one bar ---------------- */}
        <div className="jh-card p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <label className="block">
              <span className="jh-label">কোর্স</span>
              <select
                className="jh-select h-10 text-[0.8125rem]"
                value={courseId}
                onChange={(event) => {
                  setCourseId(event.target.value);
                  setScopes([]);
                  setError(null);
                }}
              >
                {courses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title_bn}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <span className="jh-label">প্রশ্ন ও সময়</span>
              <div className="flex items-center gap-2">
                <label className="relative flex-1">
                  <span className="sr-only">প্রশ্নসংখ্যা</span>
                  <Input
                    type="number"
                    min={1}
                    max={cap}
                    value={count}
                    onChange={(event) => {
                      const raw = Number(event.target.value);
                      setCount(Number.isFinite(raw) ? Math.max(1, Math.min(cap, Math.round(raw))) : 1);
                    }}
                    className="h-10 pr-9 text-[0.8125rem] font-semibold"
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[0.625rem] font-semibold text-[var(--text-subtle)]">
                    প্রশ্ন
                  </span>
                </label>
                <label className="relative flex-1">
                  <span className="sr-only">সময় (মিনিট)</span>
                  <Input
                    type="number"
                    min={1}
                    max={durationLimit}
                    value={duration}
                    onChange={(event) => {
                      const raw = Number(event.target.value);
                      setDuration(Number.isFinite(raw) ? Math.max(1, Math.min(durationLimit, Math.round(raw))) : 1);
                    }}
                    className="h-10 pr-10 text-[0.8125rem] font-semibold"
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[0.625rem] font-semibold text-[var(--text-subtle)]">
                    মিনিট
                  </span>
                </label>
              </div>
            </div>
          </div>

          <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
            <input
              type="checkbox"
              checked={examMode}
              onChange={(event) => {
                setExamMode(event.target.checked);
                if (event.target.checked) setCount(100);
              }}
              className="mt-0.5 size-3.5 accent-[var(--brand)]"
            />
            <span className="min-w-0">
              <span className="block text-[0.75rem] font-semibold text-[var(--text)]">১০০ নম্বরের পরীক্ষা মোড</span>
              <span className="block text-[0.625rem] leading-relaxed text-[var(--text-subtle)]">
                পূর্ণমান ১০০ · ৬০% বিগত বছরের প্রশ্ন, ২০% কঠিন, ১০% সহজ, ১০% মাঝারি। প্রশ্ন যাচাইকৃত না হলে সার্ভার স্পষ্টভাবে জানাবে।
              </span>
            </span>
          </label>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {[10, 20, 30, 50, 100].map((preset) => (
              <button
                key={preset}
                type="button"
                disabled={preset > cap}
                onClick={() => setCount(Math.min(preset, cap))}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-[0.6875rem] font-semibold transition-colors",
                  count === preset
                    ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
                    : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)]",
                  preset > cap && "cursor-not-allowed opacity-40",
                )}
              >
                {formatNumber(preset)}টি
              </button>
            ))}
            <span className="ml-auto text-[0.625rem] font-medium text-[var(--text-subtle)]">
              সর্বোচ্চ {formatNumber(cap)} প্রশ্ন · {formatNumber(durationLimit)} মিনিট
            </span>
          </div>
        </div>

        {/* ---------------- selection chips ---------------- */}
        <div className="jh-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[0.9375rem] font-semibold text-[var(--text)]">বিষয় · টপিক · সাবটপিক</h2>
            <Badge tone={mixed ? "neutral" : anyUnknown ? "info" : "success"} dot>
              {mixed
                ? "মিশ্র (সব বিষয়)"
                : checking || anyUnknown
                  ? "যাচাই হচ্ছে…"
                  : `${formatNumber(available ?? 0)}টি যাচাইকৃত প্রশ্ন`}
            </Badge>
          </div>

          {!mixed ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {scopes.map((scope) => (
                <li key={scope.key}>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand)] bg-[var(--brand-soft)] py-1 pl-2.5 pr-1.5 text-[0.6875rem] font-semibold text-[var(--brand)]">
                    {scope.kind === "subtopic" ? "↳ " : ""}
                    {scope.label}
                    <span className="rounded-full bg-[var(--surface)] px-1.5 py-0.5 text-[0.5625rem] font-bold text-[var(--text-muted)]">
                      {scope.available === null ? "…" : formatNumber(scope.available)}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggle(scope)}
                      className="rounded-full p-0.5 hover:bg-[var(--brand)]/15"
                      aria-label={`${scope.label} সরান`}
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <button
            type="button"
            onClick={() => setScopes([])}
            className={cn(
              "mt-3 flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[0.8125rem] font-medium transition-colors",
              mixed
                ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
                : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)]",
            )}
          >
            <Shuffle className="size-4 shrink-0" aria-hidden />
            মিশ্র অনুশীলন (সব বিষয়)
            {mixed ? <Check className="ml-auto size-4" aria-hidden /> : null}
          </button>

          <div className="mt-3">
            <ScopeTree
              key={courseId}
              subjects={subjects}
              topics={topics}
              selected={scopes}
              onToggle={toggle}
            />
          </div>

          {!mixed && !anyUnknown && (available ?? 0) === 0 ? (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[0.75rem] leading-relaxed text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              এই নির্বাচনে কোনো যাচাইকৃত প্রশ্ন নেই। অন্য টপিক বেছে নিন — প্ল্যাটফর্ম অযাচাইকৃত প্রশ্ন দিয়ে
              এই ঘাটতি পূরণ করে না।
            </p>
          ) : null}

          {error ? (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[0.75rem] font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      {/* ---------------- summary rail ---------------- */}
      <aside className="space-y-4">
        <div className="jh-card p-4">
          <h2 className="text-[0.8125rem] font-semibold text-[var(--text)]">আপনার নির্বাচন</h2>
          <dl className="mt-3 space-y-2 text-[0.75rem]">
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--text-subtle)]">কোর্স</dt>
              <dd className="text-right font-medium text-[var(--text)]">{course?.title_bn ?? "—"}</dd>
            </div>
            <div className="flex items-start justify-between gap-2">
              <dt className="shrink-0 text-[var(--text-subtle)]">স্কোপ</dt>
              <dd className="text-right font-medium text-[var(--text)]">
                {mixed ? "মিশ্র" : `${formatNumber(scopes.length)}টি নির্বাচন`}
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
                {mixed ? "—" : available === null ? "…" : formatNumber(available)}
              </dd>
            </div>
          </dl>

          <Button size="sm" onClick={startExam} loading={starting} disabled={!canStart} className="mt-4 w-full">
            {!starting ? <Play className="size-3.5" aria-hidden /> : null}
            পরীক্ষা শুরু করুন
          </Button>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-[var(--text)]">
            <Sparkles className="size-3.5 text-[var(--brand)]" aria-hidden />
            মনে রাখুন
          </p>
          <ul className="mt-1.5 space-y-1 text-[0.6875rem] leading-relaxed text-[var(--text-muted)]">
            <li>একাধিক বিষয়/টপিক একসাথে বাছতে পারবেন — প্রশ্ন ভাগ হয়ে আসবে।</li>
            <li>কোনো প্রশ্ন পুনরাবৃত্তি হবে না।</li>
            <li>প্রশ্ন শেষ হওয়ার আগেই উত্তর স্বয়ংক্রিয়ভাবে সংরক্ষিত।</li>
          </ul>
        </div>

        <p className="flex items-start gap-2 rounded-xl bg-[var(--surface-muted)] px-3 py-2.5 text-[0.6875rem] leading-relaxed text-[var(--text-muted)]">
          <CircleHelp className="mt-0.5 size-3.5 shrink-0 text-[var(--brand)]" aria-hidden />
          এটি <strong>প্র্যাকটিস</strong> — নির্ধারিত লাইভ পরীক্ষা নয়। ফলাফল সাথে সাথেই দেখা যাবে এবং
          লিডারবোর্ডে গণ্য হবে না।
        </p>
      </aside>
    </div>
  );
}

/**
 * Browse-first tree: subjects → topics → subtopics, with a search box that
 * matches all three levels. Collapsed by default so 15 subjects and 227 topics
 * are navigable on a phone; each row is a checkbox-style toggle, not a radio.
 */
function ScopeTree({
  subjects,
  topics,
  selected,
  onToggle,
}: {
  subjects: Subject[];
  topics: Topic[];
  selected: Scope[];
  onToggle: (scope: Omit<Scope, "available">) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [openSubjects, setOpenSubjects] = React.useState<Set<string>>(() => new Set());
  const [openTopics, setOpenTopics] = React.useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = React.useState(false);

  const needle = query.trim().toLowerCase();
  const topicMatches = React.useMemo(() => {
    if (!needle) return [];
    return topics.filter(
      (t) => t.title_bn.toLowerCase().includes(needle) || t.title_en.toLowerCase().includes(needle),
    );
  }, [needle, topics]);

  const subjectMatches = React.useMemo(() => {
    if (!needle) return [];
    return subjects.filter(
      (s) => s.title_bn.toLowerCase().includes(needle) || s.title_en.toLowerCase().includes(needle),
    );
  }, [needle, subjects]);

  const subtopicMatches = React.useMemo(() => {
    if (!needle) return [];
    const hits: Array<{ sub: { id: string; title_bn: string }; topic: Topic; subject: Subject }> = [];
    for (const topic of topics) {
      const subject = subjects.find((s) => s.id === topic.subject_id);
      if (!subject) continue;
      for (const sub of topic.subtopics) {
        if (sub.title_bn.toLowerCase().includes(needle)) hits.push({ sub, topic, subject });
      }
    }
    return hits;
  }, [needle, topics, subjects]);

  const isSelected = (key: string) => selected.some((s) => s.key === key);

  const visibleSubjects = needle
    ? subjects.filter(
        (subject) =>
          subjectMatches.some((s) => s.id === subject.id) ||
          topicMatches.some((t) => t.subject_id === subject.id) ||
          subtopicMatches.some((hit) => hit.subject.id === subject.id),
      )
    : subjects;

  const shown = expanded || needle ? visibleSubjects : visibleSubjects.slice(0, PAGE_SIZE);

  if (topics.length === 0) {
    return (
      <EmptyState
        compact
        icon={<Layers className="size-4" />}
        title="এই কোর্সে এখনো টপিক নেই"
        description="মিশ্র অনুশীলন বেছে নিন, অথবা প্রশাসক টপিক যোগ করা পর্যন্ত অপেক্ষা করুন।"
      />
    );
  }

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--text-subtle)]" aria-hidden />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="বিষয়, টপিক বা সাবটপিক খুঁজুন…"
          className="h-9 pl-8 text-[0.75rem]"
          aria-label="বিষয়, টপিক বা সাবটপিক খুঁজুন"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--text-subtle)] hover:text-[var(--text)]"
            aria-label="সার্চ মুছুন"
          >
            <X className="size-3" aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="mt-2 max-h-[24rem] space-y-1 overflow-y-auto pr-1">
        {needle ? (
          <>
            {subjectMatches.map((subject) => (
              <ScopeRow
                key={scopeKey("subject", subject.id)}
                icon={<BookOpenCheck className="size-3.5 shrink-0" aria-hidden />}
                label={subject.title_bn}
                kindLabel="বিষয়"
                selected={isSelected(scopeKey("subject", subject.id))}
                onToggle={() =>
                  onToggle({
                    key: scopeKey("subject", subject.id),
                    kind: "subject",
                    id: subject.id,
                    label: subject.title_bn,
                    subjectLabel: subject.title_bn,
                  })
                }
              />
            ))}
            {topicMatches.map((topic) => {
              const subject = subjects.find((s) => s.id === topic.subject_id);
              return (
                <ScopeRow
                  key={scopeKey("topic", topic.id)}
                  icon={<Layers className="size-3.5 shrink-0" aria-hidden />}
                  label={topic.title_bn}
                  kindLabel={`টপিক · ${subject?.title_bn ?? ""}`}
                  selected={isSelected(scopeKey("topic", topic.id))}
                  onToggle={() =>
                    onToggle({
                      key: scopeKey("topic", topic.id),
                      kind: "topic",
                      id: topic.id,
                      label: topic.title_bn,
                      subjectLabel: subject?.title_bn ?? "",
                    })
                  }
                />
              );
            })}
            {subtopicMatches.map(({ sub, topic, subject }) => (
              <ScopeRow
                key={scopeKey("subtopic", sub.id)}
                icon={<ChevronRight className="size-3.5 shrink-0" aria-hidden />}
                label={sub.title_bn}
                kindLabel={`সাবটপিক · ${topic.title_bn} · ${subject.title_bn}`}
                selected={isSelected(scopeKey("subtopic", sub.id))}
                onToggle={() =>
                  onToggle({
                    key: scopeKey("subtopic", sub.id),
                    kind: "subtopic",
                    id: sub.id,
                    label: sub.title_bn,
                    subjectLabel: subject.title_bn,
                    topicLabel: topic.title_bn,
                  })
                }
              />
            ))}
            {subjectMatches.length + topicMatches.length + subtopicMatches.length === 0 ? (
              <p className="px-2 py-6 text-center text-[0.75rem] text-[var(--text-subtle)]">
                কিছু পাওয়া যায়নি — অন্য শব্দ দিয়ে খুঁজুন।
              </p>
            ) : null}
          </>
        ) : (
          <>
            {shown.map((subject) => {
              const subjectTopics = topics.filter((t) => t.subject_id === subject.id);
              const open = openSubjects.has(subject.id);
              const subjectKey = scopeKey("subject", subject.id);
              return (
                <div key={subject.id} className="rounded-xl border border-[var(--border)]">
                  <div className="flex items-center gap-1 pr-1">
                    <button
                      type="button"
                      onClick={() =>
                        onToggle({
                          key: subjectKey,
                          kind: "subject",
                          id: subject.id,
                          label: subject.title_bn,
                          subjectLabel: subject.title_bn,
                        })
                      }
                      className={cn(
                        "flex min-w-0 flex-1 items-center gap-2 rounded-l-xl px-2.5 py-2 text-left text-[0.8125rem] font-semibold transition-colors",
                        isSelected(subjectKey)
                          ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                          : "text-[var(--text)] hover:bg-[var(--surface-muted)]",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded border",
                          isSelected(subjectKey)
                            ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                            : "border-[var(--border-strong)]",
                        )}
                        aria-hidden
                      >
                        {isSelected(subjectKey) ? <Check className="size-2.5" /> : null}
                      </span>
                      <span className="truncate">{subject.title_bn}</span>
                      <span className="ml-auto shrink-0 text-[0.625rem] font-medium text-[var(--text-subtle)]">
                        {formatNumber(subjectTopics.length)} টপিক
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenSubjects((current) => {
                          const nextSet = new Set(current);
                          if (nextSet.has(subject.id)) nextSet.delete(subject.id);
                          else nextSet.add(subject.id);
                          return nextSet;
                        })
                      }
                      className="rounded-lg p-1.5 text-[var(--text-subtle)] hover:bg-[var(--surface-muted)]"
                      aria-expanded={open}
                      aria-label={`${subject.title_bn} এর টপিক`}
                    >
                      <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} aria-hidden />
                    </button>
                  </div>

                  {open ? (
                    <ul className="border-t border-[var(--border)] px-1.5 py-1.5">
                      {subjectTopics.map((topic) => {
                        const topicKey = scopeKey("topic", topic.id);
                        const topicOpen = openTopics.has(topic.id);
                        return (
                          <li key={topic.id}>
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() =>
                                  onToggle({
                                    key: topicKey,
                                    kind: "topic",
                                    id: topic.id,
                                    label: topic.title_bn,
                                    subjectLabel: subject.title_bn,
                                  })
                                }
                                className={cn(
                                  "flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[0.75rem] transition-colors",
                                  isSelected(topicKey)
                                    ? "bg-[var(--brand-soft)] font-semibold text-[var(--brand)]"
                                    : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]",
                                )}
                              >
                                <span
                                  className={cn(
                                    "flex size-3.5 shrink-0 items-center justify-center rounded border",
                                    isSelected(topicKey)
                                      ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                                      : "border-[var(--border-strong)]",
                                  )}
                                  aria-hidden
                                >
                                  {isSelected(topicKey) ? <Check className="size-2" /> : null}
                                </span>
                                <span className="truncate">{topic.title_bn}</span>
                              </button>
                              {topic.subtopics.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenTopics((current) => {
                                      const nextSet = new Set(current);
                                      if (nextSet.has(topic.id)) nextSet.delete(topic.id);
                                      else nextSet.add(topic.id);
                                      return nextSet;
                                    })
                                  }
                                  className="rounded-md px-1.5 py-1 text-[0.625rem] font-semibold text-[var(--text-subtle)] hover:bg-[var(--surface-muted)]"
                                  aria-expanded={topicOpen}
                                >
                                  {formatNumber(topic.subtopics.length)} উপ
                                </button>
                              ) : null}
                            </div>

                            {topicOpen ? (
                              <ul className="ml-5 space-y-0.5 border-l border-[var(--border)] pb-1 pl-2">
                                {topic.subtopics.map((sub) => {
                                  const subKey = scopeKey("subtopic", sub.id);
                                  return (
                                    <li key={sub.id}>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onToggle({
                                            key: subKey,
                                            kind: "subtopic",
                                            id: sub.id,
                                            label: sub.title_bn,
                                            subjectLabel: subject.title_bn,
                                            topicLabel: topic.title_bn,
                                          })
                                        }
                                        className={cn(
                                          "flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[0.6875rem]",
                                          isSelected(subKey)
                                            ? "bg-[var(--brand-soft)] font-semibold text-[var(--brand)]"
                                            : "text-[var(--text-subtle)] hover:bg-[var(--surface-muted)]",
                                        )}
                                      >
                                        <span
                                          className={cn(
                                            "flex size-3 shrink-0 items-center justify-center rounded-sm border",
                                            isSelected(subKey)
                                              ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                                              : "border-[var(--border-strong)]",
                                          )}
                                          aria-hidden
                                        >
                                          {isSelected(subKey) ? <Check className="size-1.5" /> : null}
                                        </span>
                                        <span className="truncate">{sub.title_bn}</span>
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              );
            })}

            {visibleSubjects.length > PAGE_SIZE && !expanded ? (
              <Button variant="ghost" size="sm" onClick={() => setExpanded(true)} className="w-full">
                আরও {toBengaliDigits(visibleSubjects.length - PAGE_SIZE)}টি বিষয় দেখুন
              </Button>
            ) : null}
            {visibleSubjects.length === 0 ? (
              <p className="px-2 py-6 text-center text-[0.75rem] text-[var(--text-subtle)]">
                এই কোর্সে এখনো বিষয় যোগ করা হয়নি।
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function ScopeRow({
  icon,
  label,
  kindLabel,
  selected,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  kindLabel: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
        selected
          ? "bg-[var(--brand-soft)] text-[var(--brand)]"
          : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]",
      )}
    >
      <span
        className={cn(
          "flex size-3.5 shrink-0 items-center justify-center rounded border",
          selected ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--border-strong)]",
        )}
        aria-hidden
      >
        {selected ? <Check className="size-2" /> : null}
      </span>
      {icon}
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[0.75rem]", selected ? "font-semibold" : "font-medium")}>
          {label}
        </span>
        <span className="block truncate text-[0.625rem] text-[var(--text-subtle)]">{kindLabel}</span>
      </span>
    </button>
  );
}
