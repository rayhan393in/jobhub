"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";

type Course = { id: string; title_bn: string };
type Subject = { id: string; title_bn: string };
type Topic = { id: string; title_bn: string };

const OPTION_KEYS = ["ক", "খ", "গ", "ঘ"];

export function NewQuestionDialog({ courses }: { courses: Course[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [courseId, setCourseId] = React.useState(courses[0]?.id ?? "");
  const [subjectId, setSubjectId] = React.useState("");
  const [topicId, setTopicId] = React.useState("");
  const [subjects, setSubjects] = React.useState<Subject[]>([]);
  const [topics, setTopics] = React.useState<Topic[]>([]);
  const [statement, setStatement] = React.useState("");
  const [options, setOptions] = React.useState(["", "", "", ""]);
  const [correct, setCorrect] = React.useState(0);
  const [explanation, setExplanation] = React.useState("");
  const [difficulty, setDifficulty] = React.useState("medium");
  const [sourceType, setSourceType] = React.useState("manual");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !courseId) return;
    let cancelled = false;
    (async () => {
      const response = await fetch(`/api/taxonomy?courseId=${courseId}`);
      const payload = await response.json();
      if (cancelled) return;
      setSubjects(payload.subjects ?? []);
      setTopics([]);
      setSubjectId("");
      setTopicId("");
    })();
    return () => {
      cancelled = true;
    };
  }, [open, courseId]);

  React.useEffect(() => {
    if (!subjectId) {
      setTopics([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const response = await fetch(`/api/taxonomy?subjectId=${subjectId}`);
      const payload = await response.json();
      if (cancelled) return;
      setTopics(payload.topics ?? []);
      setTopicId("");
    })();
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const response = await fetch("/api/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          subjectId: subjectId || null,
          topicId: topicId || null,
          statement,
          options,
          correctOption: correct,
          explanation,
          difficulty,
          sourceType,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "সংরক্ষণ করা যায়নি।");
        return;
      }
      setOpen(false);
      setStatement("");
      setOptions(["", "", "", ""]);
      setExplanation("");
      setCorrect(0);
      router.refresh();
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
    } finally {
      setSaving(false);
    }
  }

  const valid =
    statement.trim().length >= 8 && options.every((option) => option.trim().length > 0) && Boolean(courseId);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-3.5" aria-hidden />
        নতুন প্রশ্ন
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 pt-10"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-question-title"
        >
          <div className="w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
              <div>
                <h2 id="new-question-title" className="text-[0.9375rem] font-semibold text-[var(--text)]">
                  নতুন প্রশ্ন যোগ করুন
                </h2>
                <p className="text-[0.625rem] text-[var(--text-subtle)]">
                  প্রশ্ন ড্রাফট হিসেবে যুক্ত হবে — অনুমোদন ছাড়া কোথাও ব্যবহার হবে না।
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-[var(--text-subtle)] hover:text-[var(--text)]"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-3 p-5" noValidate>
              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <label htmlFor="nq-course" className="jh-label">কোর্স</label>
                  <select id="nq-course" value={courseId} onChange={(e) => setCourseId(e.target.value)} className="jh-select">
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>{course.title_bn}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="nq-subject" className="jh-label">বিষয়</label>
                  <select id="nq-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="jh-select">
                    <option value="">নির্বাচন করুন</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>{subject.title_bn}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="nq-topic" className="jh-label">টপিক</label>
                  <select id="nq-topic" value={topicId} onChange={(e) => setTopicId(e.target.value)} className="jh-select" disabled={!subjectId}>
                    <option value="">নির্বাচন করুন</option>
                    {topics.map((topic) => (
                      <option key={topic.id} value={topic.id}>{topic.title_bn}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="nq-statement" className="jh-label">
                  প্রশ্ন <span className="text-[var(--danger)]">*</span>
                </label>
                <Textarea
                  id="nq-statement"
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  rows={2}
                  className="font-bangla"
                  placeholder="প্রশ্নটি বাংলায় লিখুন (কমপক্ষে ৮ অক্ষর)…"
                  required
                />
              </div>

              <fieldset>
                <legend className="jh-label">চারটি অপশন — সঠিকটি বেছে নিন</legend>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {options.map((option, index) => (
                    <label
                      key={index}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-2 py-1.5",
                        correct === index ? "border-mint-400 bg-mint-50 dark:bg-mint-600/10" : "border-[var(--border)]",
                      )}
                    >
                      <input
                        type="radio"
                        name="correct"
                        checked={correct === index}
                        onChange={() => setCorrect(index)}
                        className="accent-[var(--mint-600,#059669)]"
                        aria-label={`Option ${OPTION_KEYS[index]} is correct`}
                      />
                      <span className="flex size-5 shrink-0 items-center justify-center rounded bg-[var(--surface-sunken)] text-[0.625rem] font-bold text-[var(--text-muted)]">
                        {OPTION_KEYS[index]}
                      </span>
                      <Input
                        value={option}
                        onChange={(e) =>
                          setOptions((prev) => prev.map((value, i) => (i === index ? e.target.value : value)))
                        }
                        className="h-7 border-0 bg-transparent px-0 font-bangla text-[0.8125rem] shadow-none focus:ring-0"
                        placeholder={`অপশন ${OPTION_KEYS[index]}`}
                      />
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <label htmlFor="nq-explanation" className="jh-label">ব্যাখ্যা</label>
                <Textarea
                  id="nq-explanation"
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  rows={2}
                  className="font-bangla"
                  placeholder="কেন এই উত্তর সঠিক — সংক্ষেপে লিখুন"
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label htmlFor="nq-difficulty" className="jh-label">কঠিনতা</label>
                  <select id="nq-difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="jh-select">
                    <option value="easy">সহজ</option>
                    <option value="medium">মধ্যম</option>
                    <option value="hard">কঠিন</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="nq-source" className="jh-label">উৎসের ধরন</label>
                  <select id="nq-source" value={sourceType} onChange={(e) => setSourceType(e.target.value)} className="jh-select">
                    <option value="manual">ম্যানুয়াল</option>
                    <option value="ai_assisted">AI-সহায়ক (অযাচাইকৃত থাকবে)</option>
                  </select>
                </div>
              </div>

              {sourceType === "ai_assisted" ? (
                <p className="rounded-lg bg-[var(--brand-soft)] px-3 py-2 text-[0.625rem] leading-relaxed text-[var(--text-muted)]">
                  AI-সহায়ক প্রশ্ন কখনোই স্বয়ংক্রিয়ভাবে যাচাইকৃত হয় না — রিভিউ কিউতে ম্যানুয়াল যাচাই বাধ্যতামূলক।
                </p>
              ) : null}

              {error ? (
                <p role="alert" className="flex items-center gap-1.5 text-[0.75rem] font-medium text-[var(--danger)]">
                  <TriangleAlert className="size-3.5" aria-hidden />
                  {error}
                </p>
              ) : null}

              <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-3">
                <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  বাতিল
                </Button>
                <Button type="submit" size="sm" loading={saving} disabled={!valid}>
                  ড্রাফট সংরক্ষণ
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
