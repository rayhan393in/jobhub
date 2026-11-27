"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Plus, Save, Trash2, TriangleAlert, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { formatNumber } from "@/lib/format";

export type MarksRowDraft = {
  id?: string;
  stage: "preliminary" | "written" | "viva" | "total";
  stageBn: string;
  paperBn: string;
  questionCount: string;
  marksPerQuestion: string;
  negativeMarks: string;
  durationMinutes: string;
  totalMarks: string;
  passMarks: string;
  noteBn: string;
  sortOrder: string;
};

export type MarksCourse = {
  id: string;
  slug: string;
  title_bn: string;
  subjectMarks: number;
  rows: MarksRowDraft[];
};

const STAGES: Array<{ value: MarksRowDraft["stage"]; label: string; defaultBn: string }> = [
  { value: "preliminary", label: "প্রিলিমিনারি", defaultBn: "প্রিলিমিনারি" },
  { value: "written", label: "লিখিত", defaultBn: "লিখিত" },
  { value: "viva", label: "মৌখিক", defaultBn: "মৌখিক (ভাইভা)" },
  { value: "total", label: "মোট", defaultBn: "সর্বমোট" },
];

function emptyRow(stage: MarksRowDraft["stage"] = "preliminary"): MarksRowDraft {
  const meta = STAGES.find((s) => s.value === stage);
  return {
    stage,
    stageBn: meta?.defaultBn ?? "প্রিলিমিনারি",
    paperBn: "",
    questionCount: "",
    marksPerQuestion: "",
    negativeMarks: "0",
    durationMinutes: "",
    totalMarks: "",
    passMarks: "",
    noteBn: "",
    sortOrder: "0",
  };
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function MarksEditor({ courses }: { courses: MarksCourse[] }) {
  const router = useRouter();
  const [openId, setOpenId] = React.useState<string | null>(
    courses.find((course) => course.rows.length > 0)?.id ?? null,
  );
  const [draft, setDraft] = React.useState<Record<string, MarksRowDraft[]>>(() =>
    Object.fromEntries(courses.map((course) => [course.id, course.rows.map((row) => ({ ...row }))])),
  );
  const [state, setState] = React.useState<SaveState>("idle");
  const [savedId, setSavedId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function updateRow(courseId: string, index: number, patch: Partial<MarksRowDraft>) {
    setState("idle");
    setDraft((prev) => ({
      ...prev,
      [courseId]: (prev[courseId] ?? []).map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  }

  function addRow(courseId: string) {
    setDraft((prev) => ({ ...prev, [courseId]: [...(prev[courseId] ?? []), emptyRow()] }));
  }

  function removeRow(courseId: string, index: number) {
    setDraft((prev) => ({ ...prev, [courseId]: (prev[courseId] ?? []).filter((_, i) => i !== index) }));
  }

  async function save(courseId: string) {
    setState("saving");
    setError(null);
    setSavedId(null);
    const rows = (draft[courseId] ?? []).filter(
      (row) => row.totalMarks.trim() !== "" && row.stageBn.trim() !== "",
    );
    try {
      const response = await fetch("/api/admin/marks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          rows: rows.map((row, index) => ({
            ...(row.id ? { id: row.id } : {}),
            stage: row.stage,
            stageBn: row.stageBn.trim(),
            paperBn: row.paperBn.trim(),
            questionCount: row.questionCount.trim() === "" ? null : Number(row.questionCount),
            marksPerQuestion: row.marksPerQuestion.trim() === "" ? null : Number(row.marksPerQuestion),
            negativeMarks: row.negativeMarks.trim() === "" ? 0 : Number(row.negativeMarks),
            durationMinutes: row.durationMinutes.trim() === "" ? null : Number(row.durationMinutes),
            totalMarks: Number(row.totalMarks),
            passMarks: row.passMarks.trim() === "" ? null : Number(row.passMarks),
            noteBn: row.noteBn.trim(),
            sortOrder: row.sortOrder.trim() === "" ? index * 10 : Number(row.sortOrder),
          })),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setState("error");
        setError(result.error ?? "সংরক্ষণ করা যায়নি।");
        return;
      }
      setState("saved");
      setSavedId(courseId);
      router.refresh();
    } catch {
      setState("error");
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
    }
  }

  return (
    <div className="space-y-2.5">
      {state === "error" && error ? (
        <p className="flex items-start gap-2 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/5 px-3 py-2 text-[0.75rem] text-[var(--danger)]" role="alert">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {courses.map((course) => {
        const open = openId === course.id;
        const rows = draft[course.id] ?? [];
        const tableMarks = rows.reduce((sum, row) => sum + (Number(row.totalMarks) || 0), 0);
        return (
          <section key={course.id} className="jh-card overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : course.id)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-[var(--surface-muted)]"
              aria-expanded={open}
            >
              {open ? (
                <ChevronDown className="size-4 shrink-0 text-[var(--text-subtle)]" aria-hidden />
              ) : (
                <ChevronRight className="size-4 shrink-0 text-[var(--text-subtle)]" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-[0.875rem] font-semibold text-[var(--text)]">{course.title_bn}</span>
                <span className="mt-0.5 block text-[0.6875rem] text-[var(--text-subtle)]">
                  {formatNumber(rows.length)} সারি
                  {course.subjectMarks > 0 ? ` · বিষয়ভিত্তিক মোট ${formatNumber(course.subjectMarks)} নম্বর` : ""}
                  {tableMarks > 0 ? ` · টেবিলে ${formatNumber(tableMarks)}` : ""}
                </span>
              </span>
              <Badge tone={rows.length > 0 ? "success" : "neutral"}>
                {rows.length > 0 ? "যুক্ত" : "খালি"}
              </Badge>
            </button>

            {open ? (
              <div className="border-t border-[var(--border)] px-3 py-3">
                {rows.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[var(--border)] px-3 py-4 text-[0.75rem] leading-relaxed text-[var(--text-muted)]">
                    এই কোর্সের যাচাই করা নম্বর বিভাজন এখনো যোগ করা হয়নি। অফিসিয়াল বিজ্ঞপ্তি হাতে
                    থাকলে নিচে “সারি যোগ করুন” চেপে লিখুন — অনুমান করবেন না।
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {rows.map((row, index) => (
                      <li key={row.id ?? `new-${index}`} className="rounded-xl border border-[var(--border)] p-3">
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          <label className="block">
                            <span className="jh-label">ধাপ</span>
                            <Select
                              value={row.stage}
                              onChange={(event) => {
                                const stage = event.target.value as MarksRowDraft["stage"];
                                updateRow(course.id, index, {
                                  stage,
                                  stageBn: STAGES.find((s) => s.value === stage)?.defaultBn ?? row.stageBn,
                                });
                              }}
                            >
                              {STAGES.map((stage) => (
                                <option key={stage.value} value={stage.value}>
                                  {stage.label}
                                </option>
                              ))}
                            </Select>
                          </label>
                          <label className="block">
                            <span className="jh-label">ধাপের নাম (বাংলা)</span>
                            <Input
                              value={row.stageBn}
                              onChange={(event) => updateRow(course.id, index, { stageBn: event.target.value })}
                            />
                          </label>
                          <label className="block">
                            <span className="jh-label">পত্র / অংশ</span>
                            <Input
                              value={row.paperBn}
                              placeholder="যেমন: বাংলা"
                              onChange={(event) => updateRow(course.id, index, { paperBn: event.target.value })}
                            />
                          </label>
                          <label className="block">
                            <span className="jh-label">মোট নম্বর *</span>
                            <Input
                              inputMode="decimal"
                              value={row.totalMarks}
                              onChange={(event) => updateRow(course.id, index, { totalMarks: event.target.value })}
                            />
                          </label>
                          <label className="block">
                            <span className="jh-label">প্রশ্নসংখ্যা</span>
                            <Input
                              inputMode="numeric"
                              value={row.questionCount}
                              onChange={(event) => updateRow(course.id, index, { questionCount: event.target.value })}
                            />
                          </label>
                          <label className="block">
                            <span className="jh-label">নম্বর / প্রশ্ন</span>
                            <Input
                              inputMode="decimal"
                              value={row.marksPerQuestion}
                              onChange={(event) => updateRow(course.id, index, { marksPerQuestion: event.target.value })}
                            />
                          </label>
                          <label className="block">
                            <span className="jh-label">নেগেটিভ মার্ক</span>
                            <Input
                              inputMode="decimal"
                              value={row.negativeMarks}
                              onChange={(event) => updateRow(course.id, index, { negativeMarks: event.target.value })}
                            />
                          </label>
                          <label className="block">
                            <span className="jh-label">সময় (মিনিট)</span>
                            <Input
                              inputMode="numeric"
                              value={row.durationMinutes}
                              onChange={(event) => updateRow(course.id, index, { durationMinutes: event.target.value })}
                            />
                          </label>
                          <label className="block">
                            <span className="jh-label">পাস নম্বর</span>
                            <Input
                              inputMode="decimal"
                              value={row.passMarks}
                              onChange={(event) => updateRow(course.id, index, { passMarks: event.target.value })}
                            />
                          </label>
                          <label className="block">
                            <span className="jh-label">ক্রম</span>
                            <Input
                              inputMode="numeric"
                              value={row.sortOrder}
                              onChange={(event) => updateRow(course.id, index, { sortOrder: event.target.value })}
                            />
                          </label>
                          <label className="block sm:col-span-2 lg:col-span-3">
                            <span className="jh-label">নোট (বাংলা)</span>
                            <Input
                              value={row.noteBn}
                              placeholder="বিজ্ঞপ্তির শর্ত বা ব্যাখ্যা"
                              onChange={(event) => updateRow(course.id, index, { noteBn: event.target.value })}
                            />
                          </label>
                        </div>
                        <div className="mt-2 flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeRow(course.id, index)}
                            aria-label="সারি মুছুন"
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                            মুছুন
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <Button variant="secondary" size="sm" onClick={() => addRow(course.id)}>
                    <Plus className="size-3.5" aria-hidden />
                    সারি যোগ করুন
                  </Button>
                  <div className="flex items-center gap-2">
                    {state === "saved" && savedId === course.id ? (
                      <span className="inline-flex items-center gap-1 text-[0.6875rem] font-medium text-mint-700 dark:text-mint-500">
                        <CheckCircle2 className="size-3.5" aria-hidden />
                        সংরক্ষিত
                      </span>
                    ) : null}
                    <Button size="sm" onClick={() => save(course.id)} disabled={state === "saving"}>
                      <Save className="size-3.5" aria-hidden />
                      {state === "saving" ? "সংরক্ষণ হচ্ছে…" : "সংরক্ষণ করুন"}
                    </Button>
                  </div>
                </div>
                <p className="mt-2 text-[0.6875rem] leading-relaxed text-[var(--text-subtle)]">
                  বাঁদিকের “মুছুন” চেপে সারি সরিয়ে সংরক্ষণ করলে সেই সারি ডেটাবেস থেকেও মুছে যাবে। মোট নম্বর
                  খালি রাখা সারি সংরক্ষণ হয় না।
                </p>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
