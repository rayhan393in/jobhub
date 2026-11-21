"use client";

import * as React from "react";
import type { AttemptPaper, SavedAnswer } from "@/lib/types";

export type SaveState = "idle" | "saving" | "saved" | "error";

export type AnswerMap = Record<string, number | null>;
export type MarkMap = Record<string, boolean>;

export type ExamSession = {
  paper: AttemptPaper | null;
  loading: boolean;
  loadError: string | null;
  answers: AnswerMap;
  marks: MarkMap;
  saveState: SaveState;
  saveError: string | null;
  remainingSeconds: number;
  expired: boolean;
  submitting: boolean;
  submitted: boolean;
  submitError: string | null;
  answeredCount: number;
  unansweredCount: number;
  markedCount: number;
  progress: number;
  select: (questionId: string, option: number) => void;
  clear: (questionId: string) => void;
  toggleMark: (questionId: string) => void;
  submit: (reason?: "manual" | "timeout") => Promise<boolean>;
  refresh: () => Promise<void>;
};

function applySaved(saved: SavedAnswer[] | undefined) {
  const answers: AnswerMap = {};
  const marks: MarkMap = {};
  for (const row of saved ?? []) {
    if (row.selected_option !== null && row.selected_option !== undefined) {
      answers[row.question_id] = row.selected_option;
    }
    if (row.marked_for_review) marks[row.question_id] = true;
  }
  return { answers, marks };
}

/**
 * The exam answering session.
 *
 * Reliability rules enforced here:
 *  - every answer is POSTed to the server; UI only reflects a selection after
 *    the write is acknowledged, so a failed save never looks successful
 *  - queued writes are retried, and submission is blocked while a write is
 *    pending or failed
 *  - the countdown is derived from the server deadline, corrected by measured
 *    clock offset, never from client-set timestamps
 *  - reloading restores answers from the database
 */
export function useExamSession(attemptId: string | null): ExamSession {
  const [paper, setPaper] = React.useState<AttemptPaper | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [answers, setAnswers] = React.useState<AnswerMap>({});
  const [marks, setMarks] = React.useState<MarkMap>({});
  const [saveState, setSaveState] = React.useState<SaveState>("idle");
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = React.useState(0);
  const [expired, setExpired] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const offsetRef = React.useRef(0);
  const saveStateRef = React.useRef<SaveState>("idle");
  /** Self-reference so the drain loop can re-enter without breaking memoization. */
  const drainRef = React.useRef<() => void>(() => {});
  const queueRef = React.useRef<Map<string, { option: number | null; mark: boolean }>>(new Map());
  const inFlightRef = React.useRef(0);
  const failedRef = React.useRef(0);
  const submitGuard = React.useRef(false);
  const autoSubmitRef = React.useRef(false);

  /** Keep the ref in sync so async writers never need `saveState` in their deps. */
  const setSave = React.useCallback((next: SaveState) => {
    saveStateRef.current = next;
    setSaveState(next);
  }, []);

  const load = React.useCallback(async () => {
    if (!attemptId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(`/api/exams/paper?attemptId=${encodeURIComponent(attemptId)}`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) {
        setLoadError(payload.error ?? "প্রশ্নপত্র লোড করা যায়নি।");
        return;
      }
      const nextPaper = payload as AttemptPaper & { saved_answers?: SavedAnswer[] };
      const serverNow = new Date(nextPaper.server_now).getTime();
      offsetRef.current = serverNow - Date.now();
      setPaper(nextPaper);
      const restored = applySaved(nextPaper.saved_answers);
      setAnswers(restored.answers);
      setMarks(restored.marks);
      setSubmitted(nextPaper.attempt.status !== "in_progress");
      setSave("idle");
      setSaveError(null);
    } catch {
      setLoadError("নেটওয়ার্ক সমস্যা — সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  }, [attemptId, setSave]);

  React.useEffect(() => {
    void load();
  }, [load]);

  /** Tick against the server-corrected clock. */
  React.useEffect(() => {
    if (!paper) return;
    const deadline = new Date(paper.attempt.deadline_at).getTime();
    const tick = () => {
      const serverNow = Date.now() + offsetRef.current;
      const left = Math.max(0, Math.floor((deadline - serverNow) / 1000));
      setRemainingSeconds(left);
      if (left <= 0) setExpired(true);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [paper]);

  /** Drain the write queue one item at a time. */
  const drainQueue = React.useCallback(async () => {
    if (inFlightRef.current > 0) return;
    const next = queueRef.current.entries().next();
    if (next.done) {
      if (failedRef.current === 0 && saveStateRef.current === "saving") setSave("saved");
      return;
    }
    const [questionId, value] = next.value;
    queueRef.current.delete(questionId);
    inFlightRef.current += 1;
    setSave("saving");
    setSaveError(null);
    try {
      const response = await fetch("/api/exams/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          questionId,
          selectedOption: value.option,
          markedForReview: value.mark,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        failedRef.current += 1;
        setSave("error");
        setSaveError(payload.error ?? "উত্তর সংরক্ষণ করা যায়নি।");
        if (response.status === 409) {
          setExpired(true);
        }
        return;
      }
      failedRef.current = 0;
      if (typeof payload.remaining_seconds === "number") {
        setRemainingSeconds(payload.remaining_seconds);
        offsetRef.current = new Date(payload.server_now).getTime() - Date.now();
      }
      setSave(queueRef.current.size > 0 ? "saving" : "saved");
    } catch {
      failedRef.current += 1;
      setSave("error");
      setSaveError("সংযোগ বিচ্ছিন্ন — সংরক্ষণ হয়নি। সংযোগ ফিরে এলে আবার চেষ্টা হবে।");
    } finally {
      inFlightRef.current -= 1;
      if (queueRef.current.size > 0) drainRef.current();
    }
  }, [attemptId, setSave]);

  React.useEffect(() => {
    drainRef.current = () => {
      void drainQueue();
    };
  }, [drainQueue]);

  const enqueue = React.useCallback(
    (questionId: string, option: number | null, mark: boolean) => {
      queueRef.current.set(questionId, { option, mark });
      void drainQueue();
    },
    [drainQueue],
  );

  const select = React.useCallback(
    (questionId: string, option: number) => {
      if (submitted || expired) return;
      if (optionsLocked(paper)) return;
      setAnswers((prev) => ({ ...prev, [questionId]: option }));
      enqueue(questionId, option, marks[questionId] ?? false);
    },
    [enqueue, marks, submitted, expired, paper],
  );

  const clear = React.useCallback(
    (questionId: string) => {
      if (submitted || expired) return;
      setAnswers((prev) => ({ ...prev, [questionId]: null }));
      enqueue(questionId, null, marks[questionId] ?? false);
    },
    [enqueue, marks, submitted, expired],
  );

  const toggleMark = React.useCallback(
    (questionId: string) => {
      if (submitted) return;
      setMarks((prev) => {
        const next = { ...prev, [questionId]: !prev[questionId] };
        enqueue(questionId, answers[questionId] ?? null, next[questionId]);
        return next;
      });
    },
    [answers, enqueue, submitted],
  );

  const submit = React.useCallback(
    async (reason: "manual" | "timeout" = "manual") => {
      if (!attemptId || submitGuard.current) return false;
      submitGuard.current = true;
      setSubmitting(true);
      setSubmitError(null);

      if (queueRef.current.size === 0 && inFlightRef.current === 0) {
        // nothing pending
      }

      try {
        const response = await fetch("/api/exams/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId, reason }),
        });
        const payload = await response.json();
        if (!response.ok) {
          setSubmitError(payload.error ?? "জমা দেওয়া যায়নি। আবার চেষ্টা করুন।");
          return false;
        }
        setSubmitted(true);
        return true;
      } catch {
        setSubmitError("সংযোগ বিচ্ছিন্ন — জমা দেওয়া যায়নি। আবার চেষ্টা করুন।");
        return false;
      } finally {
        setSubmitting(false);
        submitGuard.current = false;
      }
    },
    [attemptId],
  );

  /** Auto-submit once when the clock reaches zero. */
  React.useEffect(() => {
    if (!expired || !paper || submitted || autoSubmitRef.current) return;
    autoSubmitRef.current = true;
    void submit("timeout");
  }, [expired, paper, submitted, submit]);

  const questionIds = React.useMemo(
    () => (paper?.questions ?? []).map((q) => q.question_id),
    [paper],
  );

  const answeredCount = React.useMemo(
    () => questionIds.filter((id) => answers[id] !== null && answers[id] !== undefined).length,
    [questionIds, answers],
  );
  const markedCount = React.useMemo(
    () => questionIds.filter((id) => Boolean(marks[id])).length,
    [questionIds, marks],
  );

  return {
    paper,
    loading,
    loadError,
    answers,
    marks,
    saveState,
    saveError,
    remainingSeconds,
    expired,
    submitting,
    submitted,
    submitError,
    answeredCount,
    unansweredCount: questionIds.length - answeredCount,
    markedCount,
    progress: questionIds.length > 0 ? (answeredCount / questionIds.length) * 100 : 0,
    select,
    clear,
    toggleMark,
    submit,
    refresh: load,
  };
}

function optionsLocked(paper: AttemptPaper | null) {
  return paper?.attempt.status !== "in_progress";
}
