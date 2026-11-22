"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckCheck, CircleAlert, ClipboardPaste, Download, FileUp, Loader2, TriangleAlert, Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";

type Preview = {
  total: number;
  valid: number;
  invalid: number;
  duplicatesInFile: number;
  duplicatesInDb: number;
  toInsert: number;
  taxonomy?: { taggedRows: number; unmatchedLabels: string[] };
  preview: {
    row: number;
    statement: string;
    options: string[];
    correctOption: number;
    difficulty: string;
    sourceType: string;
  }[];
  errors: { row: number; issues: { field: string; message: string }[] }[];
};

const OPTION_KEYS = ["ক", "খ", "গ", "ঘ"];

export function ImportWorkbench({
  courses,
  template,
}: {
  courses: { id: string; title_bn: string }[];
  template: string;
}) {
  const router = useRouter();
  const [courseId, setCourseId] = React.useState(courses[0]?.id ?? "");
  const [format, setFormat] = React.useState<"csv" | "json">("csv");
  const [filename, setFilename] = React.useState("");
  const [content, setContent] = React.useState("");
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [checking, setChecking] = React.useState(false);
  const [committing, setCommitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);

  function readFile(file: File) {
    setFilename(file.name);
    const lower = file.name.toLowerCase();

    // Excel files are converted to CSV in the browser; the server pipeline
    // stays unchanged and still does the authoritative validation.
    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      setFormat("csv");
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const XLSX = await import("xlsx");
          const workbook = XLSX.read(reader.result, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          if (!sheet) throw new Error("empty");
          setContent(XLSX.utils.sheet_to_csv(sheet, { blankrows: false }));
          setPreview(null);
          setDone(null);
          setError(null);
        } catch {
          setError("Excel ফাইলটি পড়া যায়নি — ফাইলটি ঠিক আছে কি না দেখুন, অথবা CSV হিসেবে সেভ করে চেষ্টা করুন।");
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    setFormat(lower.endsWith(".json") ? "json" : "csv");
    const reader = new FileReader();
    reader.onload = () => {
      setContent(String(reader.result ?? ""));
      setPreview(null);
      setDone(null);
    };
    reader.readAsText(file);
  }

  async function run(mode: "dry_run" | "commit") {
    setError(null);
    setDone(null);
    if (!content.trim()) {
      setError("প্রথমে ফাইল নির্বাচন করুন বা টেক্সট পেস্ট করুন।");
      return;
    }
    if (mode === "dry_run") setChecking(true);
    else setCommitting(true);
    try {
      const response = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          format,
          mode,
          filename: filename || `paste-${format}-${Date.now()}`,
          content,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "প্রক্রিয়া ব্যর্থ হয়েছে।");
        return;
      }
      if (mode === "dry_run") {
        setPreview(payload as Preview);
      } else {
        setDone(payload.message ?? `${payload.inserted}টি প্রশ্ন যোগ হয়েছে।`);
        setPreview(null);
        setContent("");
        setFilename("");
        router.refresh();
      }
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
    } finally {
      setChecking(false);
      setCommitting(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="jh-card p-4">
        <div className="grid gap-2 sm:grid-cols-3">
          <div>
            <label htmlFor="import-course" className="jh-label">কোর্স</label>
            <select id="import-course" value={courseId} onChange={(e) => setCourseId(e.target.value)} className="jh-select">
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.title_bn}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="import-format" className="jh-label">ফরম্যাট</label>
            <select
              id="import-format"
              value={format}
              onChange={(e) => setFormat(e.target.value as "csv" | "json")}
              className="jh-select"
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </div>
          <div>
            <label htmlFor="import-file" className="jh-label">ফাইল</label>
            <label
              htmlFor="import-file"
              className="jh-select flex cursor-pointer items-center gap-1.5 truncate text-[var(--text-muted)]"
            >
              <FileUp className="size-3.5 shrink-0" aria-hidden />
              {filename || "ফাইল বাছুন…"}
            </label>
            <input
              id="import-file"
              type="file"
              accept=".csv,.json,.txt,.xlsx,.xls"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) readFile(file);
              }}
            />
          </div>
        </div>

        <div className="mt-3">
          <label htmlFor="import-content" className="jh-label flex items-center gap-1.5">
            <ClipboardPaste className="size-3" aria-hidden />
            অথবা সরাসরি পেস্ট করুন
          </label>
          <Textarea
            id="import-content"
            value={content}
            onChange={(event) => {
              setContent(event.target.value);
              setPreview(null);
              if (!filename) setFilename("pasted");
            }}
            rows={10}
            spellCheck={false}
            placeholder={format === "csv" ? "statement,option_a,option_b,option_c,option_d,correct_option,…" : '[{"statement": "…", "option_a": "…"}]'}
            className="font-mono text-[0.6875rem] leading-relaxed"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => run("dry_run")} loading={checking}>
            {!checking ? <CheckCheck className="size-3.5" aria-hidden /> : null}
            যাচাই ও পূর্বরূপ
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => run("commit")}
            loading={committing}
            disabled={!preview || preview.toInsert === 0}
          >
            {!committing ? <Upload className="size-3.5" aria-hidden /> : null}
            নিশ্চিত করে ইমপোর্ট
          </Button>
          <span className="text-[0.625rem] text-[var(--text-subtle)]">
            {content.trim() ? `${formatNumber(content.split(/\r?\n/).length)} লাইন` : "কোনো কনটেন্ট নেই"}
          </span>
        </div>

        {error ? (
          <p role="alert" className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-[0.75rem] font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}
        {done ? (
          <p role="status" className="mt-2 flex items-start gap-1.5 rounded-lg bg-mint-50 px-3 py-2 text-[0.75rem] font-medium text-mint-800 dark:bg-mint-600/10 dark:text-mint-300">
            <CheckCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {done}
          </p>
        ) : null}
      </div>

      <aside className="space-y-3">
        <div className="jh-card p-4">
          <h2 className="text-[0.75rem] font-semibold text-[var(--text)]">কলামের নাম</h2>
          <ul className="mt-2 space-y-0.5 font-mono text-[0.625rem] leading-relaxed text-[var(--text-muted)]">
            <li>statement <span className="text-[var(--danger)]">*</span></li>
            <li>option_a … option_d <span className="text-[var(--danger)]">*</span></li>
            <li>correct_option (a/b/c/d বা 0–3) <span className="text-[var(--danger)]">*</span></li>
            <li>explanation</li>
            <li>difficulty (easy/medium/hard)</li>
            <li>source_type (manual/ai_assisted)</li>
            <li>year</li>
            <li>subject / subject_slug (বাংলা নামেও চলবে)</li>
            <li>topic / topic_slug</li>
            <li>subtopic_slug</li>
          </ul>
          <p className="mt-2 text-[0.5625rem] leading-relaxed text-[var(--text-subtle)]">
            Excel (.xlsx) ফাইল দিলে প্রথম শিটটি স্বয়ংক্রিয়ভাবে CSV-তে রূপান্তর হয়।
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="mt-2 -ml-2"
            onClick={() => {
              setContent(template);
              setFilename("template.csv");
              setFormat("csv");
              setPreview(null);
            }}
          >
            <Download className="size-3" aria-hidden />
            টেমপ্লেট ব্যবহার করুন
          </Button>
        </div>

        {preview ? (
          <div className="jh-card p-4">
            <h2 className="text-[0.75rem] font-semibold text-[var(--text)]">পূর্বরূপ</h2>
            <dl className="mt-2 space-y-1.5 text-[0.6875rem]">
              {[
                ["মোট সারি", formatNumber(preview.total), "neutral"],
                ["বৈধ", formatNumber(preview.valid), "success"],
                ["অবৈধ", formatNumber(preview.invalid), preview.invalid ? "danger" : "neutral"],
                ["ফাইলে ডুপ্লিকেট", formatNumber(preview.duplicatesInFile), "neutral"],
                ["ডেটাবেসে আছে", formatNumber(preview.duplicatesInDb), "neutral"],
                ...(preview.taxonomy ? [["বিষয়/টপিক ট্যাগড", formatNumber(preview.taxonomy.taggedRows), "neutral"]] : []),
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-2">
                  <dt className="text-[var(--text-subtle)]">{label}</dt>
                  <dd className="font-semibold tabular-nums text-[var(--text)]">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-2 flex items-center justify-between rounded-lg bg-[var(--brand-soft)] px-2.5 py-1.5">
              <span className="text-[0.6875rem] font-medium text-[var(--text-muted)]">যোগ হবে</span>
              <span className="text-[0.875rem] font-bold tabular-nums text-[var(--brand)]">
                {formatNumber(preview.toInsert)}
              </span>
            </div>

            {preview.taxonomy && preview.taxonomy.unmatchedLabels.length > 0 ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-[0.6875rem] font-semibold text-amber-600 dark:text-amber-400">
                  {formatNumber(preview.taxonomy.unmatchedLabels.length)}টি বিষয়/টপিক লেবেল মেলেনি
                </summary>
                <ul className="mt-1.5 max-h-32 space-y-1 overflow-y-auto">
                  {preview.taxonomy.unmatchedLabels.map((label) => (
                    <li key={label} className="rounded bg-amber-50 px-2 py-1 text-[0.5625rem] leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                      {label}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-[0.5625rem] text-[var(--text-subtle)]">
                  এই সারিগুলো ট্যাগ ছাড়াই যোগ হবে — পরে প্রশ্ন সম্পাদনা করে বিষয়/টপিক দেওয়া যাবে।
                </p>
              </details>
            ) : null}

            {preview.errors.length > 0 ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-[0.6875rem] font-semibold text-[var(--danger)]">
                  {formatNumber(preview.invalid)}টি সারিতে সমস্যা
                </summary>
                <ul className="mt-1.5 max-h-40 space-y-1 overflow-y-auto">
                  {preview.errors.map((item) => (
                    <li key={item.row} className="rounded bg-red-50 px-2 py-1 text-[0.5625rem] leading-relaxed text-red-700 dark:bg-red-500/10 dark:text-red-300">
                      <span className="font-bold">সারি {formatNumber(item.row)}:</span>{" "}
                      {item.issues.map((issue) => issue.message).join(" · ")}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="flex items-center gap-1.5 text-[0.6875rem] font-semibold text-[var(--text)]">
              <CircleAlert className="size-3.5 text-[var(--brand)]" aria-hidden />
              কীভাবে কাজ করে
            </p>
            <ol className="mt-1.5 space-y-1 text-[0.625rem] leading-relaxed text-[var(--text-muted)]">
              <li>১. ফাইল বাছুন বা পেস্ট করুন।</li>
              <li>২. “যাচাই ও পূর্বরূপ” — কোনো কিছু লেখা হয় না।</li>
              <li>৩. সংখ্যা মিললে “নিশ্চিত করে ইমপোর্ট”।</li>
              <li>৪. প্রতিটি প্রশ্ন রিভিউ কিউতে যাবে।</li>
            </ol>
          </div>
        )}
      </aside>

      {preview && preview.preview.length > 0 ? (
        <section className="jh-card p-4 lg:col-span-2" aria-labelledby="preview-table">
          <h2 id="preview-table" className="text-[0.75rem] font-semibold text-[var(--text)]">
            প্রথম {formatNumber(preview.preview.length)}টি সারি
          </h2>
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {preview.preview.map((row) => (
              <li key={row.row} className="py-2">
                <div className="flex items-center gap-1.5">
                  <Badge tone="neutral">#{formatNumber(row.row)}</Badge>
                  {row.sourceType === "ai_assisted" ? <Badge tone="accent">AI</Badge> : null}
                  <span className="text-[0.5625rem] text-[var(--text-subtle)]">{row.difficulty}</span>
                </div>
                <p className="mt-1 font-bangla text-[0.8125rem] leading-relaxed text-[var(--text)]">{row.statement}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {row.options.map((option, index) => (
                    <span
                      key={index}
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[0.625rem]",
                        index === row.correctOption
                          ? "bg-mint-100 font-semibold text-mint-800 dark:bg-mint-600/20 dark:text-mint-300"
                          : "bg-[var(--surface-sunken)] text-[var(--text-muted)]",
                      )}
                    >
                      {OPTION_KEYS[index]}. {option}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {checking || committing ? (
        <p className="sr-only" role="status">
          <Loader2 className="size-3 animate-spin" aria-hidden />
          প্রক্রিয়া চলছে
        </p>
      ) : null}
    </div>
  );
}
