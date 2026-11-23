"use client";

import * as React from "react";
import { CheckCircle2, PenLine, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";

type Course = { id: string; slug: string; title_bn: string };
type Question = { id?: string; question_bn: string; marks: number; sort_order?: number };
type Exam = {
  id: string;
  course_id: string;
  title_bn: string;
  instructions_bn: string | null;
  mode: "typed" | "upload" | "both";
  duration_minutes: number;
  total_marks: number;
  status: "draft" | "published" | "closed";
  written_questions: Question[];
  attempt_counts: { total: number; submitted: number; graded: number };
};
type GradeAnswer = {
  id: string;
  question_id: string;
  answer_text: string | null;
  awarded_marks: number | null;
  examiner_note_bn: string | null;
};
type GradeUpload = { id: string; file_name: string | null; signed_url: string | null; uploaded_at: string };
type GradeAttempt = {
  id: string;
  status: string;
  submitted_at: string | null;
  total_awarded: number | null;
  examiner_note_bn: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
  written_answers: GradeAnswer[];
  written_uploads: GradeUpload[];
};

export function WrittenExamManager() {
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [exams, setExams] = React.useState<Exam[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [gradingExam, setGradingExam] = React.useState<Exam | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/written-exams", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "লোড ব্যর্থ");
      setCourses(json.eligibleCourses);
      setExams(json.exams);
    } catch (e) {
      setError(e instanceof Error ? e.message : "লোড ব্যর্থ");
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (error) return <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>;
  if (!exams) return <p className="py-10 text-center text-sm text-[var(--text-muted)]">লোড হচ্ছে…</p>;

  if (gradingExam) {
    return <GradingPanel exam={gradingExam} onBack={() => { setGradingExam(null); void load(); }} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[0.8125rem] text-[var(--text-muted)]">
          লিখিত স্টেজ নিবন্ধিত কোর্স: {courses.map((c) => c.title_bn).join(", ") || "—"}
        </p>
        <Button size="sm" onClick={() => setCreating((v) => !v)}>
          <Plus className="mr-1 h-4 w-4" /> নতুন লিখিত পরীক্ষা
        </Button>
      </div>

      {creating ? (
        <CreateForm
          courses={courses}
          onDone={() => {
            setCreating(false);
            void load();
          }}
        />
      ) : null}

      {exams.length === 0 ? (
        <EmptyState title="কোনো লিখিত পরীক্ষা নেই" description="উপরের বোতাম থেকে প্রথম লিখিত পরীক্ষা তৈরি করুন।" />
      ) : (
        <ul className="space-y-3">
          {exams.map((exam) => (
            <li key={exam.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {courses.find((c) => c.id === exam.course_id)?.title_bn ?? exam.course_id} ·{" "}
                    {exam.mode === "typed" ? "টাইপ করা" : exam.mode === "upload" ? "খাতা আপলোড" : "টাইপ + আপলোড"} ·{" "}
                    {exam.duration_minutes} মিনিট · {exam.total_marks} নম্বর
                  </p>
                  <h3 className="text-[0.9375rem] font-bold">{exam.title_bn}</h3>
                  <p className="mt-0.5 text-[0.75rem] text-[var(--text-muted)]">
                    {exam.written_questions.length}টি প্রশ্ন · খাতা {exam.attempt_counts.total}টি (জমা{" "}
                    {exam.attempt_counts.submitted}, মূল্যায়িত {exam.attempt_counts.graded})
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[0.6875rem] font-bold",
                      exam.status === "published"
                        ? "bg-emerald-50 text-emerald-700"
                        : exam.status === "closed"
                          ? "bg-zinc-100 text-zinc-600"
                          : "bg-amber-50 text-amber-700",
                    )}
                  >
                    {exam.status === "published" ? "প্রকাশিত" : exam.status === "closed" ? "বন্ধ" : "খসড়া"}
                  </span>
                  {exam.status === "draft" ? (
                    <>
                      <ActionButton examId={exam.id} action="publish" label="প্রকাশ করুন" onDone={load} />
                      <DeleteButton examId={exam.id} onDone={load} />
                    </>
                  ) : (
                    <>
                      {exam.status === "published" ? (
                        <ActionButton examId={exam.id} action="close" label="বন্ধ করুন" variant="outline" onDone={load} />
                      ) : null}
                      <Button size="sm" variant="outline" onClick={() => setGradingExam(exam)}>
                        <PenLine className="mr-1 h-3.5 w-3.5" /> খাতা দেখুন
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActionButton({
  examId,
  action,
  label,
  variant,
  onDone,
}: {
  examId: string;
  action: "publish" | "close";
  label: string;
  variant?: "outline";
  onDone: () => Promise<void> | void;
}) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      size="sm"
      variant={variant}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch("/api/admin/written-exams", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ examId, action }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error);
          await onDone();
        } catch (e) {
          window.alert(e instanceof Error ? e.message : "ব্যর্থ হয়েছে");
        } finally {
          setBusy(false);
        }
      }}
    >
      {label}
    </Button>
  );
}

function DeleteButton({ examId, onDone }: { examId: string; onDone: () => Promise<void> | void }) {
  return (
    <button
      className="text-red-500 hover:text-red-700"
      title="মুছে ফেলুন"
      onClick={async () => {
        if (!window.confirm("খসড়া পরীক্ষাটি মুছে ফেলবেন?")) return;
        const res = await fetch(`/api/admin/written-exams?examId=${examId}`, { method: "DELETE" });
        if (res.ok) await onDone();
      }}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

function CreateForm({ courses, onDone }: { courses: Course[]; onDone: () => void }) {
  const [courseId, setCourseId] = React.useState(courses[0]?.id ?? "");
  const [titleBn, setTitleBn] = React.useState("");
  const [instructionsBn, setInstructionsBn] = React.useState("");
  const [mode, setMode] = React.useState<"typed" | "upload" | "both">("both");
  const [durationMinutes, setDurationMinutes] = React.useState(180);
  const [totalMarks, setTotalMarks] = React.useState(100);
  const [questions, setQuestions] = React.useState<Question[]>([{ question_bn: "", marks: 10 }]);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--brand)]/30 bg-[var(--surface)] p-4">
      <h3 className="text-[0.9375rem] font-bold">নতুন লিখিত পরীক্ষা</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-[0.8125rem]">
          কোর্স (লিখিত স্টেজ আছে)
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-transparent p-2">
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title_bn}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[0.8125rem]">
          শিরোনাম
          <input value={titleBn} onChange={(e) => setTitleBn(e.target.value)} placeholder="যেমন: বিসিএস লিখিত — বাংলা ১ম পত্র মডেল টেস্ট" className="mt-1 w-full rounded-lg border border-[var(--border)] bg-transparent p-2" />
        </label>
        <label className="text-[0.8125rem]">
          ধরন
          <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-transparent p-2">
            <option value="both">টাইপ + খাতা আপলোড</option>
            <option value="typed">শুধু টাইপ করা উত্তর</option>
            <option value="upload">শুধু খাতা আপলোড</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-[0.8125rem]">
            সময় (মিনিট)
            <input type="number" value={durationMinutes} min={10} max={600} onChange={(e) => setDurationMinutes(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-transparent p-2" />
          </label>
          <label className="text-[0.8125rem]">
            মোট নম্বর
            <input type="number" value={totalMarks} min={1} max={1000} onChange={(e) => setTotalMarks(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-transparent p-2" />
          </label>
        </div>
      </div>
      <label className="block text-[0.8125rem]">
        নির্দেশনা (ঐচ্ছিক)
        <textarea value={instructionsBn} onChange={(e) => setInstructionsBn(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-transparent p-2" />
      </label>

      <div className="space-y-2">
        <p className="text-[0.8125rem] font-semibold">প্রশ্ন</p>
        {questions.map((q, i) => (
          <div key={i} className="flex gap-2">
            <textarea
              value={q.question_bn}
              onChange={(e) => setQuestions((qs) => qs.map((x, j) => (j === i ? { ...x, question_bn: e.target.value } : x)))}
              rows={2}
              placeholder={`প্রশ্ন ${i + 1}`}
              className="flex-1 rounded-lg border border-[var(--border)] bg-transparent p-2 text-[0.8125rem]"
            />
            <input
              type="number"
              value={q.marks}
              min={1}
              max={100}
              title="নম্বর"
              onChange={(e) => setQuestions((qs) => qs.map((x, j) => (j === i ? { ...x, marks: Number(e.target.value) } : x)))}
              className="w-20 rounded-lg border border-[var(--border)] bg-transparent p-2 text-[0.8125rem]"
            />
            <button
              className="text-red-500 hover:text-red-700 disabled:opacity-30"
              disabled={questions.length === 1}
              onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setQuestions((qs) => [...qs, { question_bn: "", marks: 10 }])}>
          + প্রশ্ন যোগ করুন
        </Button>
      </div>

      {err ? <p className="text-[0.75rem] font-medium text-red-600">{err}</p> : null}
      <div className="flex gap-2">
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              const res = await fetch("/api/admin/written-exams", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  courseId,
                  titleBn,
                  instructionsBn: instructionsBn || undefined,
                  mode,
                  durationMinutes,
                  totalMarks,
                  questions: questions.map((q) => ({ questionBn: q.question_bn, marks: q.marks })),
                }),
              });
              const json = await res.json();
              if (!res.ok) throw new Error(json.error ?? "তৈরি ব্যর্থ");
              onDone();
            } catch (e) {
              setErr(e instanceof Error ? e.message : "তৈরি ব্যর্থ");
            } finally {
              setBusy(false);
            }
          }}
        >
          খসড়া হিসেবে সংরক্ষণ
        </Button>
        <Button variant="outline" onClick={onDone}>
          বাতিল
        </Button>
      </div>
    </div>
  );
}

function GradingPanel({ exam, onBack }: { exam: Exam; onBack: () => void }) {
  const [attempts, setAttempts] = React.useState<GradeAttempt[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/written-exams/grade?examId=${exam.id}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "লোড ব্যর্থ");
      setAttempts(json.attempts);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "লোড ব্যর্থ");
    }
  }, [exam.id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const qById = new Map(exam.written_questions.map((q) => [q.id as string, q]));

  return (
    <div className="space-y-4">
      <div>
        <button onClick={onBack} className="text-[0.75rem] font-semibold text-[var(--brand)] hover:underline">
          ← সব লিখিত পরীক্ষা
        </button>
        <h3 className="text-base font-bold">{exam.title_bn} — খাতা মূল্যায়ন</h3>
      </div>
      {err ? <p className="text-sm font-medium text-red-600">{err}</p> : null}
      {!attempts ? (
        <p className="py-8 text-center text-sm text-[var(--text-muted)]">লোড হচ্ছে…</p>
      ) : attempts.filter((a) => a.status !== "in_progress").length === 0 ? (
        <EmptyState title="জমা দেওয়া খাতা নেই" description="শিক্ষার্থীরা জমা দিলে এখানে খাতা আসবে।" />
      ) : (
        attempts
          .filter((a) => a.status !== "in_progress")
          .map((a) => <AttemptGrader key={a.id} attempt={a} qById={qById} totalMarks={exam.total_marks} onSaved={load} />)
      )}
    </div>
  );
}

function AttemptGrader({
  attempt,
  qById,
  totalMarks,
  onSaved,
}: {
  attempt: GradeAttempt;
  qById: Map<string, Question>;
  totalMarks: number;
  onSaved: () => Promise<void>;
}) {
  const [marks, setMarks] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(attempt.written_answers.map((ans) => [ans.id, ans.awarded_marks?.toString() ?? ""])),
  );
  const [notes, setNotes] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(attempt.written_answers.map((ans) => [ans.id, ans.examiner_note_bn ?? ""])),
  );
  const [overallNote, setOverallNote] = React.useState(attempt.examiner_note_bn ?? "");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const save = async (finalize: boolean) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/written-exams/grade", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: attempt.id,
          grades: attempt.written_answers.map((ans) => ({
            answerId: ans.id,
            awardedMarks: marks[ans.id] === "" ? null : Number(marks[ans.id]),
            examinerNoteBn: notes[ans.id] || undefined,
          })),
          examinerNoteBn: overallNote || undefined,
          finalize,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "সংরক্ষণ ব্যর্থ");
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "সংরক্ষণ ব্যর্থ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[0.875rem] font-bold">{attempt.profiles?.full_name ?? attempt.profiles?.email ?? "শিক্ষার্থী"}</p>
          <p className="text-[0.75rem] text-[var(--text-muted)]">
            জমা: {attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString("bn-BD") : "—"}
          </p>
        </div>
        {attempt.status === "graded" ? (
          <span className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[0.8125rem] font-bold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> {attempt.total_awarded} / {totalMarks}
          </span>
        ) : (
          <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-[0.8125rem] font-bold text-amber-700">মূল্যায়ন বাকি</span>
        )}
      </div>

      {attempt.written_uploads.length > 0 ? (
        <div className="mt-3">
          <p className="text-[0.8125rem] font-semibold">খাতার পাতা:</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {attempt.written_uploads.map((u, i) => (
              <li key={u.id}>
                <a href={u.signed_url ?? "#"} target="_blank" rel="noreferrer" className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-[0.75rem] font-medium text-[var(--brand)] hover:underline">
                  পাতা {i + 1}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 space-y-3">
        {attempt.written_answers.map((ans) => {
          const q = qById.get(ans.question_id);
          return (
            <div key={ans.id} className="rounded-xl border border-[var(--border)] p-3">
              <p className="text-[0.8125rem] font-semibold">
                {q?.question_bn ?? "প্রশ্ন"} <span className="text-[var(--text-muted)]">({q?.marks ?? "?"} নম্বর)</span>
              </p>
              <p className="mt-1.5 whitespace-pre-wrap rounded-lg bg-black/[0.03] p-2.5 text-[0.8125rem] dark:bg-white/[0.04]">
                {ans.answer_text?.trim() ? ans.answer_text : "— টাইপ করা উত্তর নেই (খাতা দেখুন) —"}
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  type="number"
                  min={0}
                  max={q?.marks ?? 100}
                  step="0.5"
                  placeholder="নম্বর"
                  value={marks[ans.id] ?? ""}
                  onChange={(e) => setMarks((m) => ({ ...m, [ans.id]: e.target.value }))}
                  className="w-24 rounded-lg border border-[var(--border)] bg-transparent p-2 text-[0.8125rem]"
                />
                <input
                  placeholder="মন্তব্য (ঐচ্ছিক)"
                  value={notes[ans.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [ans.id]: e.target.value }))}
                  className="flex-1 rounded-lg border border-[var(--border)] bg-transparent p-2 text-[0.8125rem]"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 space-y-2">
        <input
          placeholder="সামগ্রিক মন্তব্য (ঐচ্ছিক)"
          value={overallNote}
          onChange={(e) => setOverallNote(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-transparent p-2 text-[0.8125rem]"
        />
        {err ? <p className="text-[0.75rem] font-medium text-red-600">{err}</p> : null}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void save(false)}>
            নম্বর সংরক্ষণ
          </Button>
          <Button size="sm" disabled={busy} onClick={() => void save(true)}>
            চূড়ান্ত করুন (graded)
          </Button>
        </div>
      </div>
    </div>
  );
}
