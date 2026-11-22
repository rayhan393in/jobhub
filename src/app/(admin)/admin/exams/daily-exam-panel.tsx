"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays, CircleAlert, CircleCheck, CircleX, Radio, RefreshCw, Settings2, TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";

type Course = { id: string; title_bn: string };
type Subject = { id: string; title_bn: string };

type Check = { rule: string; ok: boolean; critical: boolean; detail: string };

type DayPlan =
  | { kind: "grand"; position: number }
  | { kind: "none" }
  | {
      kind: "daily";
      position: number;
      overridden: boolean;
      mainSubjectId: string;
      secondarySubjectId: string;
      mainTitle: string;
      secondaryTitle: string;
      mainPlan: { planned: number; requested: number; availableTotal: number; usedWholeSubjectFallback: boolean };
      secondaryPlan: { planned: number; requested: number; availableTotal: number; usedWholeSubjectFallback: boolean };
      checks: Check[];
      blocked: boolean;
    };

type UpcomingDay =
  | { date: string; kind: "none" }
  | { date: string; kind: "grand"; position: number }
  | {
      date: string; kind: "daily"; position: number; overridden: boolean;
      main: { id: string; title_bn: string }; secondary: { id: string; title_bn: string };
    };

type Config = {
  anchor_date: string;
  question_count: number;
  duration_minutes: number;
  negative_marks: number;
  difficulty_mix: { previous: number; easy: number; medium: number; hard: number };
  cumulative_revision: boolean;
  allow_whole_subject_fallback: boolean;
};

type Preview = {
  config: Config;
  date: string;
  plan: DayPlan;
  upcoming: UpcomingDay[];
  existing: { id: string; status: string; title_bn: string } | null;
  subjects: Subject[];
};

/**
 * Daily 100-mark live exam (90:10) panel.
 *
 * The subject pair is not chosen here — the rotation engine picks it from the
 * seeded 14-day cycle (which repeats forever), and this panel shows the
 * resolved pair, the 90:10 plan scoped to the published routine's topics, and
 * the pre-publish checklist. Overrides and config changes are explicit,
 * audited actions.
 */
export function DailyExamPanel({ courses, today }: { courses: Course[]; today: string }) {
  const router = useRouter();
  const [courseId, setCourseId] = React.useState(courses[0]?.id ?? "");
  const [date, setDate] = React.useState(today);
  const [startTime, setStartTime] = React.useState("21:00");
  const [resultDelay, setResultDelay] = React.useState(30);

  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);

  const [showConfig, setShowConfig] = React.useState(false);
  const [configDraft, setConfigDraft] = React.useState<Config | null>(null);

  const [overrideMain, setOverrideMain] = React.useState("");
  const [overrideSecondary, setOverrideSecondary] = React.useState("");

  const loadPreview = React.useCallback(async (cId: string, d: string) => {
    if (!cId) return;
    setBusy("preview");
    setError(null);
    setDone(null);
    try {
      const response = await fetch(`/api/admin/daily-exam?courseId=${cId}&date=${d}`);
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "প্রিভিউ আনা যায়নি।");
        setPreview(null);
        return;
      }
      setPreview(payload as Preview);
      setConfigDraft(payload.config as Config);
    } catch {
      setError("নেটওয়ার্ক সমস্যা।");
    } finally {
      setBusy(null);
    }
  }, []);

  async function create(publish: boolean) {
    if (!courseId) return;
    setBusy(publish ? "publish" : "draft");
    setError(null);
    setDone(null);
    try {
      const response = await fetch("/api/admin/daily-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, date, startTime, resultDelayMinutes: resultDelay, publish }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "তৈরি করা যায়নি।");
        if (payload.checks) setPreview((current) => (current ? { ...current, plan: { ...(current.plan as object), ...payload } as DayPlan } : current));
        return;
      }
      setDone(
        payload.published
          ? `পরীক্ষা প্রকাশিত — মূল ${formatNumber(payload.main.count)} + সহ ${formatNumber(payload.secondary.count)} প্রশ্ন।`
          : `ড্রাফট তৈরি হয়েছে (মূল ${formatNumber(payload.main.count)} + সহ ${formatNumber(payload.secondary.count)})।`,
      );
      await loadPreview(courseId, date);
      router.refresh();
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
    } finally {
      setBusy(null);
    }
  }

  async function saveConfig() {
    if (!configDraft) return;
    setBusy("config");
    setError(null);
    try {
      const response = await fetch("/api/admin/daily-exam", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "config",
          courseId,
          questionCount: configDraft.question_count,
          durationMinutes: configDraft.duration_minutes,
          negativeMarks: configDraft.negative_marks,
          difficultyMix: configDraft.difficulty_mix,
          cumulativeRevision: configDraft.cumulative_revision,
          allowWholeSubjectFallback: configDraft.allow_whole_subject_fallback,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "কনফিগ সংরক্ষণ হয়নি।");
        return;
      }
      setDone("কনফিগারেশন সংরক্ষিত।");
      setShowConfig(false);
      await loadPreview(courseId, date);
    } catch {
      setError("নেটওয়ার্ক সমস্যা।");
    } finally {
      setBusy(null);
    }
  }

  async function setOverride(clear: boolean) {
    setBusy("override");
    setError(null);
    try {
      const response = await fetch("/api/admin/daily-exam", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          clear
            ? { action: "clear_override", courseId, date }
            : { action: "override", courseId, date, mainSubjectId: overrideMain, secondarySubjectId: overrideSecondary },
        ),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "ওভাররাইড সংরক্ষণ হয়নি।");
        return;
      }
      setDone(clear ? "ওভাররাইড মুছে ফেলা হয়েছে — রোটেশন অনুযায়ী চলবে।" : "এই তারিখের জন্য ম্যানুয়াল ওভাররাইড সংরক্ষিত।");
      await loadPreview(courseId, date);
    } catch {
      setError("নেটওয়ার্ক সমস্যা।");
    } finally {
      setBusy(null);
    }
  }

  const plan = preview?.plan;
  const mixTotal = configDraft
    ? configDraft.difficulty_mix.previous + configDraft.difficulty_mix.easy +
      configDraft.difficulty_mix.medium + configDraft.difficulty_mix.hard
    : 100;

  return (
    <section className="jh-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-1.5 text-[0.875rem] font-bold text-[var(--text)]">
            <CalendarDays className="size-4 text-[var(--brand)]" aria-hidden />
            দৈনিক ১০০ নম্বর লাইভ পরীক্ষা (৯০:১০)
          </h2>
          <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-[var(--text-muted)]">
            রোটেশন ইঞ্জিন প্রতিদিনের মূল (৯০) ও সহ-বিষয় (১০) ঠিক করে; প্রশ্ন আসে প্রকাশিত রুটিনের টপিক থেকে। ৭ম দিন
            সাপ্তাহিক গ্র্যান্ড — উপরের প্যানেল থেকে।
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge tone="brand">৯০ + ১০</Badge>
          <button
            type="button"
            onClick={() => setShowConfig((value) => !value)}
            className="rounded-md border border-[var(--border)] p-1.5 text-[var(--text-muted)] hover:text-[var(--text)]"
            aria-label="দৈনিক পরীক্ষার কনফিগারেশন"
          >
            <Settings2 className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <label className="block">
          <span className="jh-label">কোর্স</span>
          <select
            className="jh-select h-9 text-[0.8125rem]"
            value={courseId}
            onChange={(event) => { setCourseId(event.target.value); setPreview(null); }}
          >
            {courses.map((course) => (
              <option key={course.id} value={course.id}>{course.title_bn}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="jh-label">পরীক্ষার তারিখ</span>
          <input type="date" value={date} onChange={(event) => { setDate(event.target.value); setPreview(null); }} className="jh-input h-9 text-[0.8125rem]" />
        </label>
        <label className="block">
          <span className="jh-label">শুরুর সময় (ঢাকা)</span>
          <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="jh-input h-9 text-[0.8125rem]" />
        </label>
        <label className="block">
          <span className="jh-label">ফল প্রকাশ (মিনিট পরে)</span>
          <input type="number" min={0} max={10080} value={resultDelay} onChange={(event) => setResultDelay(Number(event.target.value))} className="jh-input h-9 text-[0.8125rem]" />
        </label>
      </div>

      {showConfig && configDraft ? (
        <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-2.5">
          <p className="text-[0.6875rem] font-semibold text-[var(--text)]">কোর্স-ভিত্তিক দৈনিক কনফিগারেশন</p>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            <label className="block">
              <span className="mb-0.5 block text-[0.5625rem] text-[var(--text-subtle)]">মোট প্রশ্ন (৯০:১০ বজায় থাকে)</span>
              <input type="number" min={20} max={200} value={configDraft.question_count}
                onChange={(e) => setConfigDraft({ ...configDraft, question_count: Number(e.target.value) || 100 })}
                className="jh-input h-8 text-[0.75rem]" />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[0.5625rem] text-[var(--text-subtle)]">সময় (মিনিট)</span>
              <input type="number" min={10} max={240} value={configDraft.duration_minutes}
                onChange={(e) => setConfigDraft({ ...configDraft, duration_minutes: Number(e.target.value) || 60 })}
                className="jh-input h-8 text-[0.75rem]" />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[0.5625rem] text-[var(--text-subtle)]">নেগেটিভ মার্ক (প্রতি ভুলে)</span>
              <input type="number" min={0} max={5} step={0.25} value={configDraft.negative_marks}
                onChange={(e) => setConfigDraft({ ...configDraft, negative_marks: Number(e.target.value) || 0 })}
                className="jh-input h-8 text-[0.75rem]" />
            </label>
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {([["previous", "বিগত বছরের"], ["easy", "সহজ"], ["medium", "মধ্যম"], ["hard", "কঠিন"]] as const).map(([key, label]) => (
              <label key={key} className="block">
                <span className="mb-0.5 block text-[0.5625rem] text-[var(--text-subtle)]">{label} %</span>
                <input type="number" min={0} max={100} value={configDraft.difficulty_mix[key]}
                  onChange={(e) =>
                    setConfigDraft({
                      ...configDraft,
                      difficulty_mix: { ...configDraft.difficulty_mix, [key]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) },
                    })
                  }
                  className="jh-input h-8 text-[0.75rem]" />
              </label>
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-3">
            <label className="flex items-center gap-1.5 text-[0.625rem] text-[var(--text-muted)]">
              <input type="checkbox" checked={configDraft.cumulative_revision}
                onChange={(e) => setConfigDraft({ ...configDraft, cumulative_revision: e.target.checked })} />
              ক্রমপুঞ্জিত রিভিশন (আজ পর্যন্ত রুটিনের সব টপিক)
            </label>
            <label className="flex items-center gap-1.5 text-[0.625rem] text-[var(--text-muted)]">
              <input type="checkbox" checked={configDraft.allow_whole_subject_fallback}
                onChange={(e) => setConfigDraft({ ...configDraft, allow_whole_subject_fallback: e.target.checked })} />
              রুটিনে টপিক না থাকলে সম্পূর্ণ-বিষয় ফলব্যাক (সতর্কতাসহ)
            </label>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Button size="sm" loading={busy === "config"} onClick={saveConfig} disabled={mixTotal !== 100}>
              কনফিগ সংরক্ষণ
            </Button>
            {mixTotal !== 100 ? (
              <span className="text-[0.625rem] font-semibold text-amber-700 dark:text-amber-400">
                কঠিনতার যোগফল {mixTotal}% — ১০০% হতে হবে।
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" loading={busy === "preview"} onClick={() => loadPreview(courseId, date)} disabled={!courseId}>
          <RefreshCw className="size-3.5" aria-hidden />
          রোটেশন ও যাচাই দেখুন
        </Button>
        <Button size="sm" variant="secondary" loading={busy === "draft"} onClick={() => create(false)}
          disabled={!courseId || !plan || plan.kind !== "daily"}>
          ড্রাফট তৈরি
        </Button>
        <Button size="sm" loading={busy === "publish"} onClick={() => create(true)}
          disabled={!courseId || !plan || plan.kind !== "daily" || plan.blocked || preview?.existing?.status === "published"}>
          <Radio className="size-3.5" aria-hidden />
          তৈরি ও প্রকাশ
        </Button>
        {preview?.existing ? (
          <Badge tone={preview.existing.status === "published" ? "success" : "neutral"}>
            এই তারিখে {preview.existing.status === "published" ? "প্রকাশিত" : "ড্রাফট"}: {preview.existing.title_bn}
          </Badge>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-2 text-[0.6875rem] font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
          <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
      {done ? (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-mint-50 px-2.5 py-2 text-[0.6875rem] font-medium text-mint-700 dark:bg-mint-600/10 dark:text-mint-400">
          <CircleCheck className="mt-0.5 size-3 shrink-0" aria-hidden />
          {done}
        </p>
      ) : null}

      {plan?.kind === "grand" ? (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-[0.6875rem] font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          <CircleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
          রোটেশনে এই দিনটি (স্লট {formatNumber(plan.position)}) সাপ্তাহিক গ্র্যান্ড পরীক্ষার — উপরের সাপ্তাহিক প্যানেল ব্যবহার করুন।
        </p>
      ) : null}

      {plan?.kind === "daily" ? (
        <>
          {/* 90:10 preview */}
          <div className="mt-2 rounded-lg border border-[var(--border)] p-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="brand">স্লট {formatNumber(plan.position)}</Badge>
              {plan.overridden ? <Badge tone="warning">ম্যানুয়াল ওভাররাইড</Badge> : null}
              <Badge tone="success">মূল: {plan.mainTitle} — {formatNumber(plan.mainPlan.planned)}/{formatNumber(plan.mainPlan.requested)}</Badge>
              <Badge tone="neutral">সহ: {plan.secondaryTitle} — {formatNumber(plan.secondaryPlan.planned)}/{formatNumber(plan.secondaryPlan.requested)}</Badge>
            </div>
            <ul className="mt-2 space-y-1">
              {plan.checks.map((check) => (
                <li key={check.rule} className="flex items-start gap-1.5 text-[0.625rem] leading-relaxed">
                  {check.ok ? (
                    <CircleCheck className="mt-0.5 size-3 shrink-0 text-mint-600" aria-hidden />
                  ) : check.critical ? (
                    <CircleX className="mt-0.5 size-3 shrink-0 text-red-600" aria-hidden />
                  ) : (
                    <CircleAlert className="mt-0.5 size-3 shrink-0 text-amber-600" aria-hidden />
                  )}
                  <span className={check.ok ? "text-[var(--text-muted)]" : "font-semibold text-[var(--text)]"}>
                    <strong className="font-semibold">{check.rule}:</strong> {check.detail}
                  </span>
                </li>
              ))}
            </ul>
            {plan.blocked ? (
              <p className="mt-1.5 text-[0.625rem] font-semibold text-red-700 dark:text-red-400">
                গুরুতর সমস্যা থাকায় প্রকাশ বন্ধ — প্রশ্নব্যাংকে অনুমোদিত প্রশ্ন বাড়ান, কনফিগে প্রশ্নসংখ্যা কমান, বা রুটিনে টপিক যোগ করুন।
              </p>
            ) : null}
          </div>

          {/* Manual override for this date */}
          <div className="mt-2 rounded-lg border border-dashed border-[var(--border)] p-2.5">
            <p className="text-[0.6875rem] font-semibold text-[var(--text)]">এই তারিখের রোটেশন ওভাররাইড</p>
            <div className="mt-1.5 flex flex-wrap items-end gap-2">
              <label className="block min-w-40 flex-1">
                <span className="mb-0.5 block text-[0.5625rem] text-[var(--text-subtle)]">মূল বিষয় (৯০%)</span>
                <select className="jh-select h-8 text-[0.75rem]" value={overrideMain} onChange={(e) => setOverrideMain(e.target.value)}>
                  <option value="">— নির্বাচন —</option>
                  {preview?.subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.title_bn}</option>
                  ))}
                </select>
              </label>
              <label className="block min-w-40 flex-1">
                <span className="mb-0.5 block text-[0.5625rem] text-[var(--text-subtle)]">সহ-বিষয় (১০%)</span>
                <select className="jh-select h-8 text-[0.75rem]" value={overrideSecondary} onChange={(e) => setOverrideSecondary(e.target.value)}>
                  <option value="">— নির্বাচন —</option>
                  {preview?.subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.title_bn}</option>
                  ))}
                </select>
              </label>
              <Button size="sm" variant="secondary" loading={busy === "override"} onClick={() => setOverride(false)}
                disabled={!overrideMain || !overrideSecondary || overrideMain === overrideSecondary}>
                ওভাররাইড সংরক্ষণ
              </Button>
              {plan.overridden ? (
                <Button size="sm" variant="ghost" onClick={() => setOverride(true)}>
                  ওভাররাইড মুছুন
                </Button>
              ) : null}
            </div>
          </div>

          {/* Upcoming rotation preview */}
          <div className="mt-2 rounded-lg border border-[var(--border)] p-2.5">
            <p className="text-[0.6875rem] font-semibold text-[var(--text)]">পরবর্তী {formatNumber(preview?.upcoming.length ?? 0)} দিনের রোটেশন</p>
            <ul className="mt-1.5 max-h-44 space-y-0.5 overflow-y-auto text-[0.625rem]">
              {preview?.upcoming.map((day) => (
                <li key={day.date} className="flex items-center gap-2 rounded px-1 py-0.5 odd:bg-[var(--surface-muted)]">
                  <span className="w-20 shrink-0 text-[var(--text-subtle)]">{day.date}</span>
                  {day.kind === "grand" ? (
                    <span className="font-semibold text-amber-700 dark:text-amber-400">সাপ্তাহিক গ্র্যান্ড পরীক্ষা</span>
                  ) : day.kind === "daily" ? (
                    <>
                      <span className="min-w-0 flex-1 truncate font-medium text-[var(--text)]">
                        {day.main.title_bn} <span className="text-[var(--text-subtle)]">(৯০)</span> + {day.secondary.title_bn}{" "}
                        <span className="text-[var(--text-subtle)]">(১০)</span>
                      </span>
                      {day.overridden ? <Badge tone="warning">ওভাররাইড</Badge> : null}
                    </>
                  ) : (
                    <span className="text-[var(--text-subtle)]">রোটেশন নেই</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </section>
  );
}
