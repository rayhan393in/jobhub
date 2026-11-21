"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileUp, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { FrequencyRow } from "./page";

const CSV_TEMPLATE = [
  "exam_name,exam_year,subject,topic,count,source_title",
  "৪০তম বিসিএস প্রিলিমিনারি,2018,English Language & Literature,Subject–verb agreement,3,৪০তম বিসিএস প্রশ্ন",
  "৪১তম বিসিএস প্রিলিমিনারি,2019,English Language & Literature,Subject–verb agreement,2,৪১তম বিসিএস প্রশ্ন",
].join("\n");

/**
 * Frequency import.
 *
 * The CSV path is the one that matters: a real analysis of 40th–50th BCS is a
 * spreadsheet, not something to retype. Names are resolved server-side against
 * the actual syllabus, and a name that does not resolve is reported rather than
 * dropped — an unplaced count would quietly bias the priority ranking.
 */
export function FrequencyManager({
  courses,
  initialCourseId,
  rows,
}: {
  courses: Array<{ id: string; title_bn: string }>;
  initialCourseId: string;
  rows: FrequencyRow[];
}) {
  const router = useRouter();
  const [courseId, setCourseId] = React.useState(initialCourseId);
  const [content, setContent] = React.useState("");
  const [filename, setFilename] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<{
    ready: number;
    errors: Array<{ row: number; message: string }>;
    missingSubjects: string[];
    missingTopics: string[];
  } | null>(null);
  const [done, setDone] = React.useState<number | null>(null);

  async function send(mode: "dry_run" | "commit") {
    if (!content) {
      setError("আগে একটি CSV ফাইল বেছে নিন।");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/frequency", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, content, mode }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "আপলোড ব্যর্থ হয়েছে।");
        return;
      }
      if (mode === "dry_run") {
        setPreview(payload);
      } else {
        setDone(payload.saved ?? 0);
        setPreview(null);
        setContent("");
        setFilename("");
        router.refresh();
      }
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
    } finally {
      setBusy(false);
    }
  }

  async function removeRow(id: string) {
    setBusy(true);
    try {
      await fetch("/api/admin/frequency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", courseId, id }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([`\uFEFF${CSV_TEMPLATE}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "jobhub-frequency-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="jh-card p-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="block min-w-[12rem] flex-1">
            <span className="jh-label">কোর্স</span>
            <select className="jh-select h-9 text-[0.8125rem]" value={courseId} onChange={(event) => setCourseId(event.target.value)}>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.title_bn}</option>
              ))}
            </select>
          </label>
          <Button variant="secondary" size="sm" onClick={downloadTemplate}>টেমপ্লেট</Button>
        </div>

        <label className="mt-3 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[var(--border-strong)] px-4 py-5 text-center hover:border-[var(--brand)]">
          <FileUp className="size-4 text-[var(--brand)]" aria-hidden />
          <span className="text-[0.75rem] font-semibold text-[var(--text)]">
            {filename || "ফ্রিকোয়েন্সি CSV বেছে নিন"}
          </span>
          <span className="text-[0.5625rem] text-[var(--text-subtle)]">
            কলাম: exam_name, exam_year, subject, topic, count, source_title
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setFilename(file.name);
              setContent(await file.text());
              setPreview(null);
              setDone(null);
            }}
          />
        </label>

        {error ? (
          <p role="alert" className="mt-2 flex items-start gap-1.5 text-[0.6875rem] font-medium text-[var(--danger)]">
            <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}

        {preview ? (
          <div className="mt-2 rounded-lg border border-[var(--border)] p-2.5">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="success">{preview.ready} সারি প্রস্তুত</Badge>
              {preview.errors.length > 0 ? <Badge tone="danger">{preview.errors.length} ভুল</Badge> : null}
              {preview.missingSubjects.length > 0 ? <Badge tone="warning">{preview.missingSubjects.length} বিষয় মেলেনি</Badge> : null}
              {preview.missingTopics.length > 0 ? <Badge tone="warning">{preview.missingTopics.length} টপিক মেলেনি</Badge> : null}
            </div>
            {preview.missingTopics.length > 0 ? (
              <p className="mt-1.5 text-[0.625rem] leading-relaxed text-amber-800 dark:text-amber-300">
                মেলেনি: {preview.missingTopics.slice(0, 5).join(", ")} — নাম হুবহু সিলেবাসের মতো লিখুন।
              </p>
            ) : null}
            {preview.errors.length > 0 ? (
              <ul className="mt-1.5 space-y-0.5 text-[0.5625rem] text-[var(--danger)]">
                {preview.errors.slice(0, 5).map((row) => (
                  <li key={row.row}>সারি {row.row}: {row.message}</li>
                ))}
              </ul>
            ) : null}
            <Button
              className="mt-2 w-full"
              size="sm"
              loading={busy}
              disabled={preview.ready === 0}
              onClick={() => send("commit")}
            >
              {preview.ready} সারি সংরক্ষণ করুন
            </Button>
          </div>
        ) : (
          <Button className="mt-3" size="sm" loading={busy} disabled={!content} onClick={() => send("dry_run")}>
            যাচাই করুন
          </Button>
        )}

        {done !== null ? (
          <p className="mt-2 rounded-lg bg-mint-50 px-2.5 py-2 text-[0.6875rem] font-medium text-mint-700 dark:bg-mint-600/10 dark:text-mint-400">
            {done}টি সারি সংরক্ষিত হয়েছে।
          </p>
        ) : null}
      </div>

      <div className="jh-card overflow-hidden">
        <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
          <p className="text-[0.75rem] font-semibold text-[var(--text)]">সংরক্ষিত বিশ্লেষণ</p>
          <span className="text-[0.5625rem] text-[var(--text-subtle)]">{rows.length} সারি</span>
        </header>
        {rows.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-[0.75rem] font-semibold text-[var(--text)]">এখনো কোনো বিশ্লেষণ নেই</p>
            <p className="mx-auto mt-1 max-w-sm text-[0.625rem] leading-relaxed text-[var(--text-subtle)]">
              ৪০তম–৫০তম বিসিএসের প্রশ্ন থেকে প্রতিটি টপিকের প্রশ্নসংখ্যা CSV আকারে আপলোড করুন। তারপর সাপ্তাহিক রুটিন
              সেই প্রমাণ অনুযায়ী সাজবে।
            </p>
          </div>
        ) : (
          <ul className="max-h-80 divide-y divide-[var(--border)] overflow-y-auto">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center gap-2 px-3 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.6875rem] font-medium text-[var(--text)]">
                    {row.exam_name}
                    {row.exam_year ? ` · ${row.exam_year}` : ""}
                  </p>
                  <p className="truncate text-[0.5625rem] text-[var(--text-subtle)]">{row.source_title || "উৎস লেখা নেই"}</p>
                </div>
                <span className="shrink-0 text-[0.625rem] font-semibold tabular-nums text-[var(--text)]">
                  {row.question_count}
                </span>
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  disabled={busy}
                  className="rounded p-1 text-[var(--text-subtle)] hover:text-[var(--danger)] disabled:opacity-40"
                  aria-label="সারি মুছুন"
                >
                  <Trash2 className="size-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
