"use client";

import * as React from "react";
import { CheckCircle2, Clock3, FileUp, PenLine, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";

type Question = { id: string; question_bn: string; marks: number; sort_order: number };
type Answer = { id: string; question_id: string; answer_text: string | null; awarded_marks: number | null; examiner_note_bn: string | null };
type Upload = { id: string; file_name: string | null; mime_type: string | null; uploaded_at: string; signed_url?: string | null };
type Attempt = {
  id: string;
  status: "in_progress" | "submitted" | "graded";
  started_at: string;
  submitted_at: string | null;
  graded_at: string | null;
  total_awarded: number | null;
  examiner_note_bn: string | null;
  written_answers: Answer[];
  written_uploads: Upload[];
};
type Exam = {
  id: string;
  title_bn: string;
  instructions_bn: string | null;
  mode: "typed" | "upload" | "both";
  duration_minutes: number;
  total_marks: number;
  opens_at: string | null;
  closes_at: string | null;
  status: string;
  courses: { slug: string; title_bn: string } | null;
  written_questions: Question[];
  my_attempt: Attempt | null;
};

const MODE_LABEL: Record<Exam["mode"], string> = {
  typed: "টাইপ করা উত্তর",
  upload: "খাতা আপলোড",
  both: "টাইপ + খাতা আপলোড",
};

export function WrittenExamCenter() {
  const [exams, setExams] = React.useState<Exam[] | null>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/written-exams", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "লোড করা যায়নি");
      setExams(json.exams);
    } catch (e) {
      setError(e instanceof Error ? e.message : "লোড করা যায়নি");
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const active = exams?.find((e) => e.id === activeId) ?? null;

  if (error) {
    return <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>;
  }
  if (!exams) return <p className="py-10 text-center text-sm text-[var(--text-muted)]">লোড হচ্ছে…</p>;
  if (exams.length === 0) {
    return <EmptyState title="এখনো কোনো লিখিত পরীক্ষা নেই" description="লিখিত স্টেজের কোর্সগুলোর পরীক্ষা প্রকাশিত হলে এখানে দেখা যাবে।" />;
  }

  if (active) {
    return (
      <AttemptView
        exam={active}
        busy={busy}
        setBusy={setBusy}
        onBack={() => {
          setActiveId(null);
          void load();
        }}
        reload={load}
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {exams.map((exam) => {
        const a = exam.my_attempt;
        return (
          <div key={exam.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {exam.courses?.title_bn ?? ""} · {MODE_LABEL[exam.mode]}
            </p>
            <h3 className="mt-1 text-[0.9375rem] font-bold">{exam.title_bn}</h3>
            <p className="mt-1 flex items-center gap-1.5 text-[0.75rem] text-[var(--text-muted)]">
              <Clock3 className="h-3.5 w-3.5" /> {exam.duration_minutes} মিনিট · {exam.total_marks} নম্বর ·{" "}
              {exam.written_questions.length}টি প্রশ্ন
            </p>
            <div className="mt-3 border-t border-[var(--border)] pt-3">
              {a?.status === "graded" ? (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" /> ফলাফল: {a.total_awarded} / {exam.total_marks}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => setActiveId(exam.id)}>
                    খাতা দেখুন
                  </Button>
                </div>
              ) : a?.status === "submitted" ? (
                <div className="flex items-center justify-between">
                  <span className="text-[0.8125rem] font-medium text-amber-600">জমা হয়েছে — মূল্যায়নের অপেক্ষায়</span>
                  <Button size="sm" variant="outline" onClick={() => setActiveId(exam.id)}>
                    দেখুন
                  </Button>
                </div>
              ) : a?.status === "in_progress" ? (
                <Button size="sm" className="w-full" onClick={() => setActiveId(exam.id)}>
                  <PenLine className="mr-1.5 h-4 w-4" /> পরীক্ষা চালিয়ে যান
                </Button>
              ) : exam.status === "published" ? (
                <StartButton exam={exam} onStarted={() => { void load().then(() => setActiveId(exam.id)); }} />
              ) : (
                <span className="text-[0.8125rem] text-[var(--text-muted)]">পরীক্ষাটি বন্ধ হয়ে গেছে</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StartButton({ exam, onStarted }: { exam: Exam; onStarted: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  return (
    <div>
      <Button
        size="sm"
        className="w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            const res = await fetch("/api/written-exams", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ examId: exam.id }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? "শুরু করা যায়নি");
            onStarted();
          } catch (e) {
            setErr(e instanceof Error ? e.message : "শুরু করা যায়নি");
          } finally {
            setBusy(false);
          }
        }}
      >
        <PenLine className="mr-1.5 h-4 w-4" /> পরীক্ষা শুরু করুন
      </Button>
      {err ? <p className="mt-1.5 text-[0.75rem] font-medium text-red-600">{err}</p> : null}
    </div>
  );
}

function AttemptView({
  exam,
  busy,
  setBusy,
  onBack,
  reload,
}: {
  exam: Exam;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onBack: () => void;
  reload: () => Promise<void>;
}) {
  const attempt = exam.my_attempt!;
  const readOnly = attempt.status !== "in_progress";
  const [drafts, setDrafts] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(attempt.written_answers.map((a) => [a.question_id, a.answer_text ?? ""])),
  );
  const [uploads, setUploads] = React.useState<Upload[]>(attempt.written_uploads ?? []);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [remaining, setRemaining] = React.useState<number | null>(null);

  // Countdown from started_at + duration.
  React.useEffect(() => {
    if (readOnly) return;
    const deadline = new Date(attempt.started_at).getTime() + exam.duration_minutes * 60_000;
    const tick = () => setRemaining(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [attempt.started_at, exam.duration_minutes, readOnly]);

  const save = React.useCallback(
    async (submit: boolean) => {
      setBusy(true);
      setMsg(null);
      try {
        const res = await fetch("/api/written-exams", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attemptId: attempt.id,
            action: submit ? "submit" : "save",
            answers:
              exam.mode === "upload"
                ? []
                : exam.written_questions.map((q) => ({ questionId: q.id, answerText: drafts[q.id] ?? "" })),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "সংরক্ষণ ব্যর্থ");
        if (submit) {
          await reload();
          onBack();
        } else {
          setMsg("সংরক্ষিত হয়েছে ✓");
        }
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "সংরক্ষণ ব্যর্থ");
      } finally {
        setBusy(false);
      }
    },
    [attempt.id, drafts, exam.mode, exam.written_questions, onBack, reload, setBusy],
  );

  const answerById = new Map(attempt.written_answers.map((a) => [a.question_id, a]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <button onClick={onBack} className="text-[0.75rem] font-semibold text-[var(--brand)] hover:underline">
            ← সব লিখিত পরীক্ষা
          </button>
          <h3 className="text-base font-bold">{exam.title_bn}</h3>
        </div>
        {!readOnly && remaining !== null ? (
          <span
            className={cn(
              "rounded-lg border px-2.5 py-1 text-[0.8125rem] font-bold tabular-nums",
              remaining < 600 ? "border-red-200 bg-red-50 text-red-700" : "border-[var(--border)] bg-[var(--surface)]",
            )}
          >
            ⏱ {Math.floor(remaining / 3600)}:{String(Math.floor((remaining % 3600) / 60)).padStart(2, "0")}:
            {String(remaining % 60).padStart(2, "0")}
          </span>
        ) : null}
        {attempt.status === "graded" ? (
          <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[0.8125rem] font-bold text-emerald-700">
            মোট: {attempt.total_awarded} / {exam.total_marks}
          </span>
        ) : null}
      </div>

      {exam.instructions_bn ? (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
          {exam.instructions_bn}
        </p>
      ) : null}

      {exam.mode !== "upload" ? (
        <ol className="space-y-4">
          {exam.written_questions.map((q, i) => {
            const graded = answerById.get(q.id);
            return (
              <li key={q.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[0.875rem] font-semibold leading-relaxed">
                    {i + 1}. {q.question_bn}
                  </p>
                  <span className="shrink-0 rounded-md bg-[var(--brand)]/10 px-2 py-0.5 text-[0.75rem] font-bold text-[var(--brand)]">
                    {q.marks} নম্বর
                  </span>
                </div>
                {readOnly ? (
                  <>
                    <p className="mt-3 whitespace-pre-wrap rounded-xl bg-black/[0.03] p-3 text-[0.8125rem] leading-relaxed dark:bg-white/[0.04]">
                      {drafts[q.id]?.trim() ? drafts[q.id] : "— কোনো উত্তর লেখা হয়নি —"}
                    </p>
                    {attempt.status === "graded" ? (
                      <p className="mt-2 text-[0.8125rem] font-semibold text-emerald-700">
                        প্রাপ্ত নম্বর: {graded?.awarded_marks ?? 0} / {q.marks}
                        {graded?.examiner_note_bn ? (
                          <span className="ml-2 font-normal text-[var(--text-muted)]">· {graded.examiner_note_bn}</span>
                        ) : null}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <textarea
                    value={drafts[q.id] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                    rows={7}
                    placeholder="এখানে উত্তর লিখুন…"
                    className="mt-3 w-full rounded-xl border border-[var(--border)] bg-transparent p-3 text-[0.8125rem] leading-relaxed focus:border-[var(--brand)] focus:outline-none"
                  />
                )}
              </li>
            );
          })}
        </ol>
      ) : null}

      {exam.mode !== "typed" ? (
        <SheetUploads attemptId={attempt.id} uploads={uploads} setUploads={setUploads} readOnly={readOnly} />
      ) : null}

      {attempt.status === "graded" && attempt.examiner_note_bn ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[0.8125rem] text-emerald-800">
          <strong>পরীক্ষকের মন্তব্য:</strong> {attempt.examiner_note_bn}
        </p>
      ) : null}

      {!readOnly ? (
        <div className="sticky bottom-3 flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-lg">
          <Button variant="outline" disabled={busy} onClick={() => void save(false)}>
            সংরক্ষণ করুন
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              if (window.confirm("খাতা জমা দিলে আর পরিবর্তন করা যাবে না। জমা দেবেন?")) void save(true);
            }}
          >
            <Send className="mr-1.5 h-4 w-4" /> জমা দিন
          </Button>
          {msg ? <span className="text-[0.75rem] font-medium text-[var(--text-muted)]">{msg}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function SheetUploads({
  attemptId,
  uploads,
  setUploads,
  readOnly,
}: {
  attemptId: string;
  uploads: Upload[];
  setUploads: React.Dispatch<React.SetStateAction<Upload[]>>;
  readOnly: boolean;
}) {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const refresh = React.useCallback(async () => {
    const res = await fetch(`/api/written-exams/upload?attemptId=${attemptId}`, { cache: "no-store" });
    const json = await res.json();
    if (res.ok) setUploads(json.uploads);
  }, [attemptId, setUploads]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-[0.875rem] font-bold">
          <FileUp className="h-4 w-4" /> খাতার পাতা ({uploads.length})
        </h4>
        {!readOnly ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBusy(true);
                setErr(null);
                try {
                  const form = new FormData();
                  form.set("attemptId", attemptId);
                  form.set("file", file);
                  const res = await fetch("/api/written-exams/upload", { method: "POST", body: form });
                  const json = await res.json();
                  if (!res.ok) throw new Error(json.error ?? "আপলোড ব্যর্থ");
                  await refresh();
                } catch (er) {
                  setErr(er instanceof Error ? er.message : "আপলোড ব্যর্থ");
                } finally {
                  setBusy(false);
                  if (inputRef.current) inputRef.current.value = "";
                }
              }}
            />
            <Button size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
              {busy ? "আপলোড হচ্ছে…" : "+ পাতা যোগ করুন"}
            </Button>
          </>
        ) : null}
      </div>
      {err ? <p className="mt-2 text-[0.75rem] font-medium text-red-600">{err}</p> : null}
      {uploads.length === 0 ? (
        <p className="mt-3 text-[0.8125rem] text-[var(--text-muted)]">
          হাতে লেখা উত্তরের ছবি (JPG/PNG/WebP) বা PDF আপলোড করুন — প্রতি ফাইল সর্বোচ্চ ১০ MB।
        </p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {uploads.map((u, i) => (
            <li key={u.id} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] px-3 py-2">
              <a
                href={u.signed_url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="truncate text-[0.8125rem] font-medium text-[var(--brand)] hover:underline"
              >
                পাতা {i + 1} — {u.file_name ?? u.mime_type ?? "ফাইল"}
              </a>
              {!readOnly ? (
                <button
                  className="text-red-500 hover:text-red-700"
                  onClick={async () => {
                    const res = await fetch(`/api/written-exams/upload?uploadId=${u.id}`, { method: "DELETE" });
                    if (res.ok) await refresh();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
