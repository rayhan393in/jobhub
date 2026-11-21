"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2, Download, FileSpreadsheet, TriangleAlert, Upload, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { ROUTINE_CSV_TEMPLATE } from "@/lib/routines/parse";

type Course = { id: string; title_bn: string };

type DryRun = {
  total: number;
  ready: number;
  invalidCount: number;
  invalidRows: Array<{ row: number; issues: Array<{ field: string; message: string }> }>;
  missingSubjects: string[];
  missingTopics: string[];
  dateRange: [string, string] | null;
  preview: Array<{ row: number; date: string; subject: string; topic: string; minutes: number; note: string }>;
};

/**
 * Routine CSV upload. Everything here is a preview until the server says the
 * dry run passed — the file is parsed twice, once in the browser for instant
 * feedback and once on the server, which is the authoritative check.
 */
export function RoutineCsvImport({ courses, today }: { courses: Course[]; today: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [courseId, setCourseId] = React.useState(courses[0]?.id ?? "");
  const [startDate, setStartDate] = React.useState(today);
  const [defaultMinutes, setDefaultMinutes] = React.useState(60);
  const [createMissing, setCreateMissing] = React.useState(false);
  const [replace, setReplace] = React.useState(true);
  const [filename, setFilename] = React.useState("");
  const [content, setContent] = React.useState("");
  const [dryRun, setDryRun] = React.useState<DryRun | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{ created: number; createdTopics: number } | null>(null);
  const [dragging, setDragging] = React.useState(false);

  async function readFile(file: File) {
    if (file.size > 2_000_000) {
      setError("ফাইলটি ২MB-এর বেশি — ভাগ করে আপলোড করুন।");
      return;
    }
    const text = await file.text();
    setFilename(file.name);
    setContent(text);
    setDryRun(null);
    setDone(null);
    setError(null);
  }

  async function run(mode: "dry_run" | "commit") {
    if (!content) {
      setError("আগে একটি CSV ফাইল বেছে নিন।");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/routines/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          mode,
          startDate,
          defaultMinutes,
          createMissingTopics: createMissing,
          replace,
          filename: filename || "routine.csv",
          content,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "আপলোড ব্যর্থ হয়েছে।");
        return;
      }
      if (mode === "dry_run") {
        setDryRun(payload as DryRun);
      } else {
        setDone({ created: payload.created ?? 0, createdTopics: payload.createdTopics ?? 0 });
        setDryRun(null);
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

  function downloadTemplate() {
    const blob = new Blob([`\uFEFF${ROUTINE_CSV_TEMPLATE}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "jobhub-routine-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!open) {
    return (
      <div className="jh-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[0.875rem] font-semibold text-[var(--text)]">
            <FileSpreadsheet className="size-4 text-[var(--brand)]" aria-hidden />
            CSV থেকে রুটিন আপলোড
          </p>
          <p className="mt-1 text-[0.75rem] leading-relaxed text-[var(--text-muted)]">
            ৩০ বা ৯০ দিনের রুটিন এক ফাইলে আপলোড করুন — প্রতিটি সারি সিলেবাসের বিষয়/টপিকের সঙ্গে মিলিয়ে
            নেওয়া হয়, তারপর প্রকাশিত রুটিন হয়ে যায়।
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={downloadTemplate}>
            <Download className="size-3.5" aria-hidden />
            টেমপ্লেট
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Upload className="size-3.5" aria-hidden />
            CSV আপলোড
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="jh-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[0.875rem] font-semibold text-[var(--text)]">
          <FileSpreadsheet className="size-4 text-[var(--brand)]" aria-hidden />
          CSV থেকে রুটিন আপলোড
        </p>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setDryRun(null);
            setDone(null);
            setError(null);
          }}
          className="rounded-lg p-1.5 text-[var(--text-subtle)] hover:bg-[var(--surface-muted)]"
          aria-label="বন্ধ করুন"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="jh-label">কোর্স</span>
          <select className="jh-select h-10 text-[0.8125rem]" value={courseId} onChange={(event) => setCourseId(event.target.value)}>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title_bn}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="jh-label">শুরুর তারিখ</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="jh-input h-10 text-[0.8125rem]"
          />
        </label>
        <label className="block">
          <span className="jh-label">ডিফল্ট সময় (মিনিট)</span>
          <input
            type="number"
            min={5}
            max={480}
            value={defaultMinutes}
            onChange={(event) => setDefaultMinutes(Number(event.target.value))}
            className="jh-input h-10 text-[0.8125rem]"
          />
        </label>
      </div>

      {/* file drop */}
      <label
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) void readFile(file);
        }}
        className={cn(
          "mt-3 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
          dragging
            ? "border-[var(--brand)] bg-[var(--brand-soft)]"
            : "border-[var(--border-strong)] hover:border-[var(--brand)]",
        )}
      >
        <Upload className="size-5 text-[var(--brand)]" aria-hidden />
        <span className="text-[0.8125rem] font-semibold text-[var(--text)]">
          {filename || "CSV ফাইল এখানে ছাড়ুন বা ক্লিক করুন"}
        </span>
        <span className="text-[0.6875rem] text-[var(--text-subtle)]">
          কলাম: day, subject, topic, subtopic, minutes, slot, note — সর্বোচ্চ ৪০০ সারি
        </span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
          }}
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-[0.75rem] text-[var(--text-muted)]">
          <input
            type="checkbox"
            checked={replace}
            onChange={(event) => setReplace(event.target.checked)}
            className="size-3.5 accent-[var(--brand)]"
          />
          ওই তারিখগুলোর পুরনো রুটিন মুছে দিন
        </label>
        <label className="flex items-center gap-1.5 text-[0.75rem] text-[var(--text-muted)]">
          <input
            type="checkbox"
            checked={createMissing}
            onChange={(event) => setCreateMissing(event.target.checked)}
            className="size-3.5 accent-[var(--brand)]"
          />
          অজানা টপিক স্বয়ংক্রিয়ভাবে যোগ করুন
        </label>
      </div>

      {error ? (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-[0.75rem] font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {dryRun ? (
        <div className="mt-3 rounded-xl border border-[var(--border)] p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="success">{dryRun.ready} সারি প্রস্তুত</Badge>
            {dryRun.invalidCount > 0 ? <Badge tone="danger">{dryRun.invalidCount} সারি ভুল</Badge> : null}
            {dryRun.missingSubjects.length > 0 ? (
              <Badge tone="warning">{dryRun.missingSubjects.length} বিষয় মেলেনি</Badge>
            ) : null}
            {dryRun.missingTopics.length > 0 ? (
              <Badge tone="warning">{dryRun.missingTopics.length} টপিক মেলেনি</Badge>
            ) : null}
            {dryRun.dateRange ? (
              <span className="ml-auto text-[0.625rem] text-[var(--text-subtle)]">
                {dryRun.dateRange[0]} → {dryRun.dateRange[1]}
              </span>
            ) : null}
          </div>

          {dryRun.missingSubjects.length > 0 ? (
            <p className="mt-2 text-[0.6875rem] leading-relaxed text-amber-800 dark:text-amber-300">
              কোনো বিষয় পাওয়া যায়নি: {dryRun.missingSubjects.slice(0, 6).join(", ")}. আগে বিষয় তৈরি করুন।
            </p>
          ) : null}
          {dryRun.missingTopics.length > 0 ? (
            <p className="mt-1 text-[0.6875rem] leading-relaxed text-amber-800 dark:text-amber-300">
              কোনো টপিক পাওয়া যায়নি: {dryRun.missingTopics.slice(0, 6).join(", ")}
              {createMissing ? " — আপলোড করলে এগুলো তৈরি হবে।" : "."}
            </p>
          ) : null}

          <ul className="mt-2 max-h-44 space-y-0.5 overflow-y-auto text-[0.6875rem]">
            {dryRun.preview.map((row) => (
              <li key={row.row} className="flex items-center gap-2 rounded px-1 py-0.5 odd:bg-[var(--surface-muted)]">
                <span className="w-10 shrink-0 text-[var(--text-subtle)]">{row.date.slice(5)}</span>
                <span className="min-w-0 truncate font-medium text-[var(--text)]">{row.topic}</span>
                <span className="ml-auto shrink-0 text-[var(--text-subtle)]">{row.minutes} মিনিট</span>
              </li>
            ))}
          </ul>

          {dryRun.invalidRows.length > 0 ? (
            <ul className="mt-2 space-y-0.5 text-[0.625rem] text-red-700 dark:text-red-300">
              {dryRun.invalidRows.slice(0, 5).map((row) => (
                <li key={row.row}>
                  সারি {row.row}: {row.issues.map((issue) => issue.message).join(" · ")}
                </li>
              ))}
            </ul>
          ) : null}

          <Button
            className="mt-3 w-full"
            size="sm"
            loading={busy}
            disabled={dryRun.ready === 0}
            onClick={() => run("commit")}
          >
            {dryRun.ready} সারি প্রকাশ করুন
          </Button>
        </div>
      ) : (
        <Button className="mt-3" size="sm" loading={busy} onClick={() => run("dry_run")} disabled={!content}>
          যাচাই করুন
        </Button>
      )}

      {done ? (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-mint-50 px-3 py-2 text-[0.75rem] font-medium text-mint-700 dark:bg-mint-600/10 dark:text-mint-400">
          <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
          {done.created} সারির রুটিন প্রকাশ হয়েছে
          {done.createdTopics > 0 ? ` · ${done.createdTopics}টি নতুন টপিক যোগ হয়েছে` : ""}।
        </p>
      ) : null}
    </div>
  );
}
