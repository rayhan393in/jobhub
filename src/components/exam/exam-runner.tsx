"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, ArrowRight, Bookmark, Check, CheckCheck, ChevronLeft, Clock3,
  Flag, Loader2, RotateCcw, Send, X, ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatClock, formatNumber, toBengaliDigits } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useExamSession, type SaveState } from "./use-exam-session";
import type { ExamQuestion } from "@/lib/types";

const OPTION_KEYS = ["ক", "খ", "গ", "ঘ"];

type Filter = "all" | "answered" | "unanswered" | "marked";

export function ExamRunner({
  attemptId,
  title,
  subtitle,
  onFinished,
}: {
  attemptId: string;
  title: string;
  subtitle?: string;
  onFinished?: () => void;
}) {
  const router = useRouter();
  const session = useExamSession(attemptId);
  const [current, setCurrent] = React.useState(0);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [showShortcuts, setShowShortcuts] = React.useState(false);
  const questionRefs = React.useRef(new Map<string, HTMLElement>());

  const questions = React.useMemo(() => session.paper?.questions ?? [], [session.paper]);
  const visible = React.useMemo(() => {
    if (filter === "all") return questions;
    return questions.filter((q) => {
      const answered = session.answers[q.question_id] !== null && session.answers[q.question_id] !== undefined;
      if (filter === "answered") return answered;
      if (filter === "unanswered") return !answered;
      return Boolean(session.marks[q.question_id]);
    });
  }, [filter, questions, session.answers, session.marks]);

  const active = visible[Math.min(current, Math.max(visible.length - 1, 0))];

  const goTo = React.useCallback(
    (index: number) => {
      const target = visible[index];
      if (!target) return;
      setCurrent(index);
      const node = questionRefs.current.get(target.question_id);
      node?.scrollIntoView({ behavior: "smooth", block: "center" });
      node?.focus({ preventScroll: true });
    },
    [visible],
  );

  /** Keyboard shortcuts: 1–4 answer, N/P move, M mark, Enter next, S submit. */
  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (confirmOpen) return;

      const index = visible.findIndex((q) => q.question_id === active?.question_id);
      if (index === -1) return;

      switch (event.key.toLowerCase()) {
        case "1":
        case "2":
        case "3":
        case "4":
          event.preventDefault();
          session.select(active.question_id, Number(event.key) - 1);
          break;
        case "n":
          event.preventDefault();
          goTo(Math.min(index + 1, visible.length - 1));
          break;
        case "p":
          event.preventDefault();
          goTo(Math.max(index - 1, 0));
          break;
        case "m":
          event.preventDefault();
          session.toggleMark(active.question_id);
          break;
        case "enter":
          event.preventDefault();
          goTo(Math.min(index + 1, visible.length - 1));
          break;
        case "?":
          event.preventDefault();
          setShowShortcuts((v) => !v);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, confirmOpen, goTo, session, visible]);

  async function submitNow() {
    const submitted = await session.submit("manual");
    if (submitted) {
      setConfirmOpen(false);
      onFinished?.();
      router.refresh();
    }
  }

  if (session.loading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-16">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="size-6 animate-spin text-[var(--brand)]" aria-hidden />
          <p className="text-[0.875rem] font-medium text-[var(--text-muted)]">প্রশ্নপত্র প্রস্তুত হচ্ছে…</p>
        </div>
      </div>
    );
  }

  if (session.loadError || !session.paper) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-16 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
          <AlertTriangle className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-[1.125rem] font-bold text-[var(--text)]">প্রশ্নপত্র লোড করা যায়নি</h1>
        <p className="mt-2 text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
          {session.loadError}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button onClick={() => session.refresh()} variant="secondary">
            <RotateCcw className="size-4" aria-hidden />
            আবার চেষ্টা করুন
          </Button>
          <Button onClick={() => router.push("/dashboard")} variant="ghost">
            ড্যাশবোর্ডে ফিরুন
          </Button>
        </div>
      </div>
    );
  }

  const locked = session.submitted || session.paper.attempt.status !== "in_progress";

  return (
    <div className="min-h-dvh bg-[var(--surface-muted)] pb-28">
      {/* Sticky exam header */}
      <div className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[0.75rem] font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
            aria-label="Back to dashboard"
          >
            <ChevronLeft className="size-4" aria-hidden />
            <span className="hidden sm:inline">বন্ধ</span>
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.8125rem] font-semibold text-[var(--text)]">{title}</p>
            {subtitle ? (
              <p className="truncate text-[0.6875rem] text-[var(--text-subtle)]">{subtitle}</p>
            ) : null}
          </div>
          <SaveIndicator state={session.saveState} error={session.saveError} />
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[0.8125rem] font-bold tabular-nums ring-1",
              session.remainingSeconds <= 300
                ? "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30"
                : "bg-[var(--surface-muted)] text-[var(--text)] ring-[var(--border)]",
            )}
            role="timer"
            aria-live="off"
          >
            <Clock3 className="size-3.5" aria-hidden />
            {formatClock(session.remainingSeconds)}
          </div>
          <button
            type="button"
            onClick={() => setPaletteOpen((v) => !v)}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] lg:hidden"
            aria-label="Question palette"
            aria-expanded={paletteOpen}
          >
            <CheckCheck className="size-4" aria-hidden />
          </button>
        </div>
        <Progress value={session.progress} className="h-[3px] rounded-none" label="Answered progress" />
      </div>

      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div>
          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            {(
              [
                { key: "all", label: `সব (${formatNumber(questions.length)})` },
                { key: "answered", label: `উত্তর দেওয়া (${formatNumber(session.answeredCount)})` },
                { key: "unanswered", label: `বাকি (${formatNumber(session.unansweredCount)})` },
                { key: "marked", label: `চিহ্নিত (${formatNumber(session.markedCount)})` },
              ] as { key: Filter; label: string }[]
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setFilter(item.key);
                  setCurrent(0);
                }}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-[0.75rem] font-semibold transition-colors",
                  filter === item.key
                    ? "bg-[var(--brand)] text-white"
                    : "bg-[var(--surface)] text-[var(--text-muted)] ring-1 ring-[var(--border)] hover:text-[var(--text)]",
                )}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowShortcuts((v) => !v)}
              className="ml-auto hidden rounded-lg px-2 py-1 text-[0.6875rem] font-medium text-[var(--text-subtle)] hover:text-[var(--text)] sm:inline-flex"
            >
              কীবোর্ড শর্টকাট ?
            </button>
          </div>

          {showShortcuts ? <Shortcuts /> : null}

          {visible.length === 0 ? (
            <div className="jh-card p-8 text-center">
              <Check className="mx-auto size-7 text-mint-600" aria-hidden />
              <p className="mt-3 text-[0.875rem] font-semibold text-[var(--text)]">
                {filter === "marked" ? "কোনো প্রশ্ন চিহ্নিত করা হয়নি" : "এই ফিল্টারে কোনো প্রশ্ন নেই"}
              </p>
              <button
                type="button"
                onClick={() => setFilter("all")}
                className="mt-2 text-[0.8125rem] font-semibold text-[var(--brand)] hover:underline"
              >
                সব প্রশ্ন দেখুন
              </button>
            </div>
          ) : (
            <ol className="space-y-3">
              {visible.map((question, index) => (
                <li key={question.question_id}>
                  <QuestionCard
                    ref={(node) => {
                      if (node) questionRefs.current.set(question.question_id, node);
                      else questionRefs.current.delete(question.question_id);
                    }}
                    question={question}
                    index={questions.findIndex((q) => q.question_id === question.question_id) + 1}
                    total={questions.length}
                    selected={session.answers[question.question_id] ?? null}
                    marked={Boolean(session.marks[question.question_id])}
                    locked={locked}
                    onSelect={(option) => session.select(question.question_id, option)}
                    onClear={() => session.clear(question.question_id)}
                    onToggleMark={() => session.toggleMark(question.question_id)}
                    active={active?.question_id === question.question_id}
                    onFocus={() => setCurrent(index)}
                  />
                </li>
              ))}
            </ol>
          )}

          {/* Prev / next */}
          <div className="mt-5 flex items-center justify-between gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => goTo(Math.max(current - 1, 0))}
              disabled={current === 0}
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              পূর্ববর্তী
            </Button>
            <span className="text-[0.75rem] font-medium text-[var(--text-subtle)]">
              {formatNumber(Math.min(current + 1, visible.length))} / {formatNumber(visible.length)}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => goTo(Math.min(current + 1, visible.length - 1))}
              disabled={current >= visible.length - 1}
            >
              পরবর্তী
              <ArrowRight className="size-3.5" aria-hidden />
            </Button>
          </div>
        </div>

        {/* Palette */}
        <aside
          className={cn(
            "lg:sticky lg:top-[4.5rem] lg:block lg:h-fit",
            paletteOpen ? "block" : "hidden",
          )}
          aria-label="Question palette"
        >
          <div className="jh-card p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[0.8125rem] font-semibold text-[var(--text)]">প্রশ্ন গ্রিড</h2>
              <button
                type="button"
                className="lg:hidden"
                onClick={() => setPaletteOpen(false)}
                aria-label="Close palette"
              >
                <X className="size-4 text-[var(--text-subtle)]" aria-hidden />
              </button>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-2 text-[0.6875rem]">
              <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                <span className="size-3 rounded bg-[var(--brand)]" aria-hidden />
                উত্তর দেওয়া
              </div>
              <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                <span className="size-3 rounded bg-[var(--surface-sunken)] ring-1 ring-[var(--border-strong)]" aria-hidden />
                বাকি
              </div>
              <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                <span className="size-3 rounded bg-amber-400" aria-hidden />
                চিহ্নিত
              </div>
              <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                <span className="size-3 rounded ring-2 ring-[var(--brand)]" aria-hidden />
                বর্তমান
              </div>
            </dl>

            <div className="mt-3 grid grid-cols-6 gap-1.5 lg:grid-cols-5">
              {questions.map((question, index) => {
                const answered = session.answers[question.question_id] !== null && session.answers[question.question_id] !== undefined;
                const marked = Boolean(session.marks[question.question_id]);
                const isActive = active?.question_id === question.question_id;
                return (
                  <button
                    key={question.question_id}
                    type="button"
                    onClick={() => {
                      setFilter("all");
                      goTo(index);
                      setPaletteOpen(false);
                    }}
                    aria-label={`Question ${index + 1}${answered ? ", answered" : ", unanswered"}${marked ? ", marked" : ""}`}
                    aria-current={isActive ? "true" : undefined}
                    className={cn(
                      "flex h-8 items-center justify-center rounded-md text-[0.6875rem] font-bold tabular-nums transition-colors",
                      answered
                        ? "bg-[var(--brand)] text-white"
                        : "bg-[var(--surface-sunken)] text-[var(--text-muted)]",
                      marked && !answered && "bg-amber-100 text-amber-800 dark:bg-amber-500/25 dark:text-amber-200",
                      marked && answered && "ring-2 ring-amber-400",
                      isActive && "ring-2 ring-[var(--brand)] ring-offset-1 ring-offset-[var(--surface)]",
                    )}
                  >
                    {toBengaliDigits(index + 1)}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 space-y-1.5 border-t border-[var(--border)] pt-3 text-[0.75rem]">
              <div className="flex justify-between">
                <span className="text-[var(--text-subtle)]">উত্তর দেওয়া</span>
                <span className="font-semibold text-[var(--text)]">{formatNumber(session.answeredCount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-subtle)]">বাকি</span>
                <span className="font-semibold text-[var(--text)]">{formatNumber(session.unansweredCount)}</span>
              </div>
            </div>

            <Button
              className="mt-4 w-full"
              onClick={() => setConfirmOpen(true)}
              disabled={locked || session.submitting}
              loading={session.submitting}
            >
              <Send className="size-3.5" aria-hidden />
              পরীক্ষা জমা দিন
            </Button>

            {session.submitError ? (
              <p role="alert" className="mt-2 rounded-lg bg-red-50 px-2.5 py-2 text-[0.6875rem] font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
                {session.submitError}
              </p>
            ) : null}

            {session.submitted ? (
              <div className="mt-3 rounded-lg bg-mint-50 px-2.5 py-2 text-[0.6875rem] font-medium text-mint-700 dark:bg-mint-600/15 dark:text-mint-500">
                পরীক্ষা জমা হয়েছে।{" "}
                <Link href={`/results/${attemptId}`} className="underline">
                  ফলাফল দেখুন
                </Link>
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      {/* Mobile submit bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface)]/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-2">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2.5 text-[0.75rem] font-semibold text-[var(--text-muted)]"
          >
            <CheckCheck className="size-4" aria-hidden />
            {toBengaliDigits(session.answeredCount)}/{toBengaliDigits(questions.length)}
          </button>
          <Button className="flex-1" onClick={() => setConfirmOpen(true)} disabled={locked} loading={session.submitting}>
            <Send className="size-3.5" aria-hidden />
            জমা দিন
          </Button>
        </div>
      </div>

      {confirmOpen ? (
        <SubmitDialog
          answered={session.answeredCount}
          total={questions.length}
          marked={session.markedCount}
          saving={session.saveState === "saving"}
          error={session.saveError}
          submitting={session.submitting}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={submitNow}
        />
      ) : null}
    </div>
  );
}

const QuestionCard = React.forwardRef<
  HTMLLIElement,
  {
    question: ExamQuestion;
    index: number;
    total: number;
    selected: number | null;
    marked: boolean;
    locked: boolean;
    active: boolean;
    onSelect: (option: number) => void;
    onClear: () => void;
    onToggleMark: () => void;
    onFocus: () => void;
  }
>(function QuestionCard(
  { question, index, total, selected, marked, locked, active, onSelect, onClear, onToggleMark, onFocus },
  ref,
) {
  return (
    <article
      ref={ref}
      tabIndex={-1}
      onFocus={onFocus}
      onClick={onFocus}
      aria-current={active ? "true" : undefined}
      className={cn(
        "jh-card scroll-mt-24 p-4 transition-shadow sm:p-5",
        active && "ring-1 ring-[var(--brand)]/40",
        marked && "border-amber-200 dark:border-amber-500/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-[var(--surface-sunken)] px-1.5 text-[0.6875rem] font-bold text-[var(--text-muted)]">
            {toBengaliDigits(index)}
          </span>
          <span className="text-[0.6875rem] text-[var(--text-subtle)]">
            {formatNumber(index)} / {formatNumber(total)}
          </span>
          {question.year ? <Badge tone="neutral">{formatNumber(question.year)}</Badge> : null}
        </div>
        <button
          type="button"
          onClick={onToggleMark}
          disabled={locked}
          aria-pressed={marked}
          className={cn(
            "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[0.6875rem] font-semibold transition-colors",
            marked
              ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200"
              : "text-[var(--text-subtle)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-muted)]",
          )}
        >
          <Bookmark className={cn("size-3.5", marked && "fill-current")} aria-hidden />
          <span className="hidden sm:inline">{marked ? "চিহ্নিত" : "রিভিউ"}</span>
        </button>
      </div>

      <p className="mt-3 font-bangla text-[0.9375rem] font-medium leading-[1.85] text-[var(--text)] sm:text-base">
        {question.statement}
      </p>

      <div className="mt-3.5 grid gap-2 sm:grid-cols-2">
        {question.options.map((option, optionIndex) => {
          const isSelected = selected === optionIndex;
          return (
            <button
              key={optionIndex}
              type="button"
              onClick={() => onSelect(optionIndex)}
              disabled={locked}
              aria-pressed={isSelected}
              className={cn(
                "flex min-h-[3rem] items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[0.875rem] leading-snug transition-colors",
                isSelected
                  ? "border-[var(--brand)] bg-[var(--brand-soft)] font-semibold text-[var(--brand)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]",
                locked && "cursor-not-allowed opacity-80",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-md text-[0.6875rem] font-bold",
                  isSelected
                    ? "bg-[var(--brand)] text-white"
                    : "bg-[var(--surface-sunken)] text-[var(--text-subtle)]",
                )}
                aria-hidden
              >
                {OPTION_KEYS[optionIndex]}
              </span>
              <span className="flex-1">{option}</span>
              {isSelected ? <Check className="size-4 shrink-0" aria-hidden /> : null}
            </button>
          );
        })}
      </div>

      {selected !== null && !locked ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-2.5 inline-flex items-center gap-1 text-[0.6875rem] font-medium text-[var(--text-subtle)] hover:text-[var(--danger)]"
        >
          <X className="size-3" aria-hidden />
          উত্তর মুছুন
        </button>
      ) : null}
    </article>
  );
});

function SaveIndicator({ state, error }: { state: SaveState; error: string | null }) {
  const config = {
    idle: { icon: <Clock3 className="size-3" />, text: "স্বয়ংক্রিয় সেভ চালু", tone: "text-[var(--text-subtle)]" },
    saving: { icon: <Loader2 className="size-3 animate-spin" />, text: "সংরক্ষণ হচ্ছে…", tone: "text-[var(--text-muted)]" },
    saved: { icon: <Check className="size-3" />, text: "সংরক্ষিত", tone: "text-mint-600 dark:text-mint-500" },
    error: { icon: <ShieldAlert className="size-3" />, text: "সেভ হয়নি", tone: "text-red-600 dark:text-red-400" },
  } as const;
  const item = config[state];
  return (
    <span
      className={cn("hidden items-center gap-1 text-[0.6875rem] font-semibold sm:inline-flex", item.tone)}
      role="status"
      aria-live="polite"
      title={error ?? undefined}
    >
      {item.icon}
      {item.text}
    </span>
  );
}

function Shortcuts() {
  return (
    <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-[0.75rem] text-[var(--text-muted)]">
      <p className="font-semibold text-[var(--text)]">কীবোর্ড শর্টকাট</p>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
        {[
          ["1–4", "উত্তর নির্বাচন"],
          ["N / →", "পরবর্তী প্রশ্ন"],
          ["P / ←", "পূর্ববর্তী প্রশ্ন"],
          ["M", "রিভিউ চিহ্ন"],
          ["Enter", "পরবর্তী প্রশ্ন"],
          ["?", "শর্টকাট দেখান/লুকান"],
        ].map(([key, label]) => (
          <span key={key} className="flex items-center gap-1.5">
            <kbd className="rounded border border-[var(--border-strong)] bg-[var(--surface-muted)] px-1.5 py-0.5 font-mono text-[0.625rem] text-[var(--text)]">
              {key}
            </kbd>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function SubmitDialog({
  answered,
  total,
  marked,
  saving,
  error,
  submitting,
  onCancel,
  onConfirm,
}: {
  answered: number;
  total: number;
  marked: number;
  saving: boolean;
  error: string | null;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const unanswered = total - answered;
  const blocked = saving || Boolean(error);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-title"
        className="w-full max-w-md rounded-t-2xl bg-[var(--surface)] p-5 shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
            <Flag className="size-5" aria-hidden />
          </span>
          <div>
            <h2 id="submit-title" className="text-[1rem] font-bold text-[var(--text)]">
              পরীক্ষা জমা দিতে চান?
            </h2>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
              জমা দেওয়ার পর উত্তর পরিবর্তন করা যাবে না। নিচের সারাংশ দেখে নিন।
            </p>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-2">
          {[
            { label: "উত্তর দেওয়া", value: answered, tone: "text-mint-600 dark:text-mint-500" },
            { label: "অনুত্তরিত", value: unanswered, tone: "text-amber-600 dark:text-amber-400" },
            { label: "চিহ্নিত", value: marked, tone: "text-[var(--brand)]" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-[var(--surface-muted)] px-2.5 py-2 text-center">
              <dt className="text-[0.625rem] text-[var(--text-subtle)]">{item.label}</dt>
              <dd className={cn("mt-0.5 text-[1.125rem] font-bold tabular-nums", item.tone)}>
                {formatNumber(item.value)}
              </dd>
            </div>
          ))}
        </dl>

        {unanswered > 0 ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[0.75rem] leading-relaxed text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            {formatNumber(unanswered)}টি প্রশ্নের উত্তর দেওয়া হয়নি। অনুত্তরিত প্রশ্নে কোনো নম্বর
            কাটা যাবে না।
          </p>
        ) : null}

        {saving ? (
          <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-[0.75rem] text-[var(--text-muted)]">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            সর্বশেষ উত্তর সংরক্ষণ হচ্ছে — অপেক্ষা করুন।
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[0.75rem] text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {error} — জমা দেওয়ার আগে সংযোগ ঠিক করুন।
          </p>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            পরীক্ষায় ফিরুন
          </Button>
          <Button onClick={onConfirm} disabled={blocked} loading={submitting}>
            <Send className="size-3.5" aria-hidden />
            নিশ্চিত করছি — জমা দিন
          </Button>
        </div>
      </div>
    </div>
  );
}
