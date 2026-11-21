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
}: {
  platform: Record<string, unknown>;
  limits: Record<string, unknown>;
  marking: Record<string, unknown>;
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

  async function save(key: "platform" | "exam_limits" | "marking", value: Record<string, unknown>) {
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
