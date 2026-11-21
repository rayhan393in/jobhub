"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Save, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

export function SettingsForm({
  platform,
  limits,
  marking,
  pdf,
}: {
  platform: Record<string, unknown>;
  limits: Record<string, unknown>;
  marking: Record<string, unknown>;
  pdf: Record<string, unknown>;
}) {
  const router = useRouter();
  const [form, setForm] = React.useState({
    platformName: String(platform.name ?? "JobHub"),
    supportEmail: String(platform.support_email ?? ""),
    dailyStart: String((platform.daily_window as { start?: string } | undefined)?.start ?? "10:00"),
    dailyEnd: String((platform.daily_window as { end?: string } | undefined)?.end ?? "22:00"),
    maxQuestions: Number(limits.max_questions ?? 100),
    maxDuration: Number(limits.max_duration_minutes ?? 180),
    minQuestions: Number(limits.min_questions ?? 5),
    minDuration: Number(limits.min_duration_minutes ?? 5),
    positive: Number(marking.positive_marks ?? 1),
    negative: Number(marking.negative_marks ?? 0.5),
    unanswered: Number(marking.unanswered_marks ?? 0),
  });
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState<string | null>(null);

  // Requirement 7 — which printable sections students may take.
  const [pdfFlags, setPdfFlags] = React.useState({
    question_paper: pdf.question_paper !== false,
    answer_key: pdf.answer_key !== false,
    performance_report: pdf.performance_report !== false,
    embed_exam_id: pdf.embed_exam_id !== false,
    embed_user_info: pdf.embed_user_info === true,
  });

  async function save(key: "platform" | "exam_limits" | "marking" | "pdf_downloads", value: Record<string, unknown>) {
    setBusy(key);
    setError(null);
    setSaved(null);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "সংরক্ষণ করা যায়নি।");
        return;
      }
      setSaved(key);
      router.refresh();
    } catch {
      setError("নেটওয়ার্ক সমস্যা।");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="jh-card p-5">
        <h2 className="text-[0.875rem] font-semibold text-[var(--text)]">লাইভ পরীক্ষার সীমা</h2>
        <p className="text-[0.625rem] text-[var(--text-subtle)]">ডিফল্ট: সর্বোচ্চ ১০০ প্রশ্ন, ১৮০ মিনিট — প্রশাসন-নিয়ন্ত্রিত।</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          {[
            ["maxQuestions", "সর্বোচ্চ প্রশ্ন", 1, 200],
            ["maxDuration", "সর্বোচ্চ মিনিট", 1, 240],
            ["minQuestions", "সর্বনিম্ন প্রশ্ন", 1, 200],
            ["minDuration", "সর্বনিম্ন মিনিট", 1, 240],
          ].map(([key, label, min, max]) => (
            <label key={String(key)} className="block">
              <span className="jh-label">{String(label)}</span>
              <Input
                type="number"
                min={Number(min)}
                max={Number(max)}
                value={String(form[key as keyof typeof form])}
                onChange={(e) => setForm({ ...form, [key as string]: Number(e.target.value) })}
                className="h-9 text-[0.8125rem]"
              />
            </label>
          ))}
        </div>
        <Button
          size="sm"
          className="mt-3"
          loading={busy === "exam_limits"}
          onClick={() =>
            save("exam_limits", {
              max_questions: form.maxQuestions,
              max_duration_minutes: form.maxDuration,
              min_questions: form.minQuestions,
              min_duration_minutes: form.minDuration,
            })
          }
        >
          <Save className="size-3.5" aria-hidden />
          সীমা সংরক্ষণ
        </Button>
        {saved === "exam_limits" ? <SavedNote /> : null}
      </section>

      <section className="jh-card p-5">
        <h2 className="text-[0.875rem] font-semibold text-[var(--text)]">ডিফল্ট নম্বরকরণ</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            ["positive", "সঠিক", "0.25"],
            ["negative", "ভুল", "0.25"],
            ["unanswered", "অনুত্তরিত", "0"],
          ].map(([key, label, step]) => (
            <label key={key} className="block">
              <span className="jh-label">{label}</span>
              <Input
                type="number"
                step={step}
                value={String(form[key as keyof typeof form])}
                onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
                className="h-9 text-[0.8125rem]"
              />
            </label>
          ))}
        </div>
        <Button
          size="sm"
          className="mt-3"
          loading={busy === "marking"}
          onClick={() =>
            save("marking", {
              positive_marks: form.positive,
              negative_marks: form.negative,
              unanswered_marks: form.unanswered,
            })
          }
        >
          <Save className="size-3.5" aria-hidden />
          মার্কিং সংরক্ষণ
        </Button>
        {saved === "marking" ? <SavedNote /> : null}
      </section>

      <section className="jh-card p-5">
        <h2 className="text-[0.875rem] font-semibold text-[var(--text)]">প্ল্যাটফর্ম</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="jh-label">নাম</span>
            <Input value={form.platformName} onChange={(e) => setForm({ ...form, platformName: e.target.value })} className="h-9 text-[0.8125rem]" />
          </label>
          <label className="block">
            <span className="jh-label">সাপোর্ট ইমেইল</span>
            <Input type="email" value={form.supportEmail} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} className="h-9 text-[0.8125rem]" />
          </label>
          <label className="block">
            <span className="jh-label">দৈনিক উইন্ডো শুরু</span>
            <Input type="time" value={form.dailyStart} onChange={(e) => setForm({ ...form, dailyStart: e.target.value })} className="h-9 text-[0.8125rem]" />
          </label>
          <label className="block">
            <span className="jh-label">দৈনিক উইন্ডো শেষ</span>
            <Input type="time" value={form.dailyEnd} onChange={(e) => setForm({ ...form, dailyEnd: e.target.value })} className="h-9 text-[0.8125rem]" />
          </label>
        </div>
        <Button
          size="sm"
          className="mt-3"
          loading={busy === "platform"}
          onClick={() =>
            save("platform", {
              ...platform,
              name: form.platformName,
              support_email: form.supportEmail,
              daily_window: { start: form.dailyStart, end: form.dailyEnd },
              timezone: "Asia/Dhaka",
            })
          }
        >
          <Save className="size-3.5" aria-hidden />
          প্ল্যাটফর্ম সংরক্ষণ
        </Button>
        {saved === "platform" ? <SavedNote /> : null}
      </section>

      {/* Requirement 7: the student's PDF sheet is admin-controlled. */}
      <section className="jh-card p-4">
        <h2 className="text-[0.875rem] font-bold text-[var(--text)]">PDF ডাউনলোড নিয়ন্ত্রণ</h2>
        <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-[var(--text-subtle)]">
          পরীক্ষা শেষে শিক্ষার্থীরা কোন কোন অংশ PDF-এ পাবে তা এখান থেকে ঠিক করুন। বন্ধ করা অংশ ফলাফল পাতায় দেখানো হবে না।
        </p>
        <div className="mt-3 space-y-1.5">
          {([
            ["question_paper", "সম্পূর্ণ প্রশ্নপত্র", "পরীক্ষার পর পুরো প্রশ্নপত্র ডাউনলোড"],
            ["answer_key", "উত্তরপত্র ও ব্যাখ্যা", "সঠিক উত্তর, দেওয়া উত্তর ও ব্যাখ্যা"],
            ["performance_report", "পারফরম্যান্স রিপোর্ট", "বিষয়ভিত্তিক ও টপিকভিত্তিক বিশ্লেষণ"],
            ["embed_exam_id", "পরীক্ষা আইডি যুক্ত করুন", "প্রতিটি শীটে Exam ID থাকবে"],
            ["embed_user_info", "শিক্ষার্থীর তথ্য যুক্ত করুন", "নাম ও ইমেইল শীটে থাকবে"],
          ] as const).map(([key, label, hint]) => (
            <label key={key} className="flex cursor-pointer items-start gap-2 rounded-lg px-1 py-1 hover:bg-[var(--surface-muted)]">
              <input
                type="checkbox"
                checked={pdfFlags[key]}
                onChange={(event) => setPdfFlags({ ...pdfFlags, [key]: event.target.checked })}
                className="mt-0.5 size-3.5 accent-[var(--brand)]"
              />
              <span className="min-w-0">
                <span className="block text-[0.75rem] font-medium text-[var(--text)]">{label}</span>
                <span className="block text-[0.625rem] text-[var(--text-subtle)]">{hint}</span>
              </span>
            </label>
          ))}
        </div>
        <Button
          size="sm"
          className="mt-3"
          loading={busy === "pdf_downloads"}
          onClick={() => save("pdf_downloads", pdfFlags)}
        >
          <Save className="size-3.5" aria-hidden />
          PDF সেটিংস সংরক্ষণ
        </Button>
        {saved === "pdf_downloads" ? <SavedNote /> : null}
      </section>

      {error ? (
        <p role="alert" className="flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-[0.75rem] font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SavedNote() {
  return (
    <span className="ml-2 inline-flex items-center gap-1 text-[0.6875rem] font-medium text-mint-600 dark:text-mint-500">
      <Check className="size-3" aria-hidden />
      সংরক্ষিত
    </span>
  );
}
