"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Save, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";

const OPTION_KEYS = ["ক", "খ", "গ", "ঘ"];

export function QuestionEditor({
  question,
}: {
  question: {
    id: string;
    courseTitle: string;
    subjectTitle: string;
    topicTitle: string;
    statement: string;
    statementBn: string;
    options: string[];
    correctOption: number;
    explanation: string;
    difficulty: string;
    sourceType: string;
    status: string;
    fingerprint: string;
    year: number | null;
    createdAt: string;
  };
}) {
  const router = useRouter();
  const [statement, setStatement] = React.useState(question.statement);
  const [options, setOptions] = React.useState(question.options);
  const [correct, setCorrect] = React.useState(question.correctOption);
  const [explanation, setExplanation] = React.useState(question.explanation);
  const [difficulty, setDifficulty] = React.useState(question.difficulty);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const dirty =
    statement !== question.statement ||
    explanation !== question.explanation ||
    correct !== question.correctOption ||
    difficulty !== question.difficulty ||
    options.some((option, index) => option !== question.options[index]);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/admin/questions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: question.id,
          action: "update",
          statement,
          options,
          correctOption: correct,
          explanation,
          difficulty,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "সংরক্ষণ করা যায়নি।");
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

  return (
    <div className="jh-card p-5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] text-[var(--text-subtle)]">
        <span>{question.courseTitle}</span>
        <span aria-hidden>·</span>
        <span>{question.subjectTitle || "বিষয় নেই"}</span>
        <span aria-hidden>·</span>
        <span>{question.topicTitle || "টপিক নেই"}</span>
        <span aria-hidden>·</span>
        <span>{question.sourceType === "ai_assisted" ? "AI-সহায়ক" : question.sourceType}</span>
      </div>

      <div className="mt-3">
        <label htmlFor="statement" className="jh-label">প্রশ্ন</label>
        <Textarea
          id="statement"
          value={statement}
          onChange={(event) => setStatement(event.target.value)}
          rows={2}
          className="font-bangla"
        />
      </div>

      <fieldset className="mt-3">
        <legend className="jh-label">অপশন ও সঠিক উত্তর</legend>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {options.map((option, index) => (
            <div
              key={index}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2 py-1.5",
                correct === index
                  ? "border-mint-400 bg-mint-50 dark:bg-mint-600/10"
                  : "border-[var(--border)]",
              )}
            >
              <button
                type="button"
                onClick={() => setCorrect(index)}
                aria-pressed={correct === index}
                aria-label={`Mark option ${OPTION_KEYS[index]} correct`}
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-bold",
                  correct === index ? "bg-mint-600 text-white" : "bg-[var(--surface-sunken)] text-[var(--text-muted)]",
                )}
              >
                {correct === index ? <Check className="size-3" aria-hidden /> : OPTION_KEYS[index]}
              </button>
              <Input
                value={option}
                onChange={(event) =>
                  setOptions((prev) => prev.map((value, i) => (i === index ? event.target.value : value)))
                }
                className="h-8 border-0 bg-transparent px-0 font-bangla text-[0.8125rem] shadow-none focus:ring-0"
                aria-label={`Option ${OPTION_KEYS[index]}`}
              />
            </div>
          ))}
        </div>
      </fieldset>

      <div className="mt-3">
        <label htmlFor="explanation" className="jh-label">ব্যাখ্যা</label>
        <Textarea
          id="explanation"
          value={explanation}
          onChange={(event) => setExplanation(event.target.value)}
          rows={2}
          className="font-bangla"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="difficulty" className="jh-label">কঠিনতা</label>
          <select id="difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className="jh-select w-32">
            <option value="easy">সহজ</option>
            <option value="medium">মধ্যম</option>
            <option value="hard">কঠিন</option>
          </select>
        </div>
        <Button size="sm" onClick={save} loading={saving} disabled={!dirty && !saving}>
          <Save className="size-3.5" aria-hidden />
          সংরক্ষণ
        </Button>
        {saved ? (
          <span className="inline-flex items-center gap-1 text-[0.6875rem] font-medium text-mint-600 dark:text-mint-500">
            <Check className="size-3" aria-hidden />
            সংরক্ষিত — পুনরায় রিভিউ প্রয়োজন
          </span>
        ) : null}
      </div>

      {dirty ? (
        <p className="mt-2 flex items-center gap-1.5 text-[0.625rem] text-amber-700 dark:text-amber-300">
          <TriangleAlert className="size-3" aria-hidden />
          অসংরক্ষিত পরিবর্তন আছে। সংরক্ষণ করলে যাচাই-অবস্থা বাতিল হবে।
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-[0.75rem] font-medium text-[var(--danger)]">
          <TriangleAlert className="size-3.5" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}
