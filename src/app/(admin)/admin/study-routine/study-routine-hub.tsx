"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatNumber, toBengaliDigits } from "@/lib/format";

export type CoverageRow = {
  subject_id: string;
  title_bn: string;
  sort_order: number;
  topics_total: number;
  subtopics_total: number;
  units_total: number;
  units_assigned: number;
  units_unassigned: number;
};

export type ReadinessRow = {
  subject_id: string;
  title_bn: string;
  sort_order: number;
  pyq_total: number;
  pyq_ready: number;
  pyq_missing_meta: number;
  practice_pool: number;
};

type ChecklistItem = { rule: string; ok: boolean; detail: string };
type UnassignedRow = {
  subject_id: string; subject_bn: string; topic_id: string; topic_bn: string;
  subtopic_id: string | null; subtopic_bn: string | null;
};
type DayAssignment = {
  id: string; subject_id: string; plan_day: number; first_study_date: string;
  minutes: number; objective_bn: string | null; priority: "high" | "normal" | "low";
  subjects: { title_bn: string } | { title_bn: string }[] | null;
  topics: { title_bn: string } | { title_bn: string }[] | null;
  subtopics: { title_bn: string } | { title_bn: string }[] | null;
};
type PlanData = {
  summary: CoverageRow[];
  totals: { topics: number; subtopics: number; units: number; assigned: number; unassigned: number };
  checklist: ChecklistItem[];
  publishable: boolean;
  unassigned: UnassignedRow[];
  unassignedTotal: number;
  integrity: { assignment_id: string; problem: string }[];
  days: { date: string; planDay: number; count: number }[];
  dayAssignments: DayAssignment[] | null;
};
type PyqQuestion = {
  id: string; statement: string; statement_bn: string | null; exam_name: string | null;
  year: number | null; question_type: string | null; source: string;
  source_url: string | null; source_title: string | null;
  subjects: { title_bn: string } | { title_bn: string }[] | null;
  topics: { title_bn: string } | { title_bn: string }[] | null;
};

const TABS = [
  { id: "matrix", label: "কভারেজ ম্যাট্রিক্স" },
  { id: "mapping", label: "দিনভিত্তিক ম্যাপিং" },
  { id: "sync", label: "কমন-টপিক সিঙ্ক" },
  { id: "pyq", label: "PYQ প্রস্তুতি (৭০:৩০)" },
  { id: "metadata", label: "PYQ মেটাডেটা ব্যাকফিল" },
] as const;
type TabId = (typeof TABS)[number]["id"];

type SharedTopic = {
  canonical_id: string;
  canonical_bn: string;
  in_sync: boolean;
  courses: { course_id: string; subject_bn: string; topic_bn: string; first_study_date: string }[];
};
type SyncMove = {
  canonical_topic_bn: string;
  course: string;
  subject_bn: string;
  from_date: string;
  to_date: string;
  can_apply: boolean;
};
type SyncDryRun = {
  dry_run: boolean;
  shared_topics_out_of_sync: number;
  applied: number;
  moves: SyncMove[];
};

function embeddedTitle(value: { title_bn: string } | { title_bn: string }[] | null): string {
  if (!value) return "—";
  return Array.isArray(value) ? value[0]?.title_bn ?? "—" : value.title_bn;
}

export function StudyRoutineHub({
  courseId,
  courseTitle,
  initialCoverage,
  initialReadiness,
  syncCourses = [],
}: {
  courseId: string;
  courseTitle: string;
  initialCoverage: CoverageRow[];
  initialReadiness: ReadinessRow[];
  /** Courses that already have first-study assignments (sync candidates). */
  syncCourses?: { id: string; title_bn: string }[];
}) {
  const [tab, setTab] = useState<TabId>("matrix");
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pyqQueue, setPyqQueue] = useState<PyqQuestion[] | null>(null);
  const [syncSelection, setSyncSelection] = useState<string[]>(() => syncCourses.map((c) => c.id));
  const [syncShared, setSyncShared] = useState<SharedTopic[] | null>(null);
  const [syncDryRun, setSyncDryRun] = useState<SyncDryRun | null>(null);

  const courseNameById = useMemo(() => new Map(syncCourses.map((c) => [c.id, c.title_bn])), [syncCourses]);

  const loadSyncPreview = useCallback(async () => {
    if (syncSelection.length < 2) {
      setSyncShared([]);
      setSyncDryRun(null);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const ids = [...syncSelection].sort().join(",");
      const [overviewRes, dryRunRes] = await Promise.all([
        fetch(`/api/admin/study-plan/sync-common?courseIds=${ids}`, { cache: "no-store" }),
        fetch("/api/admin/study-plan/sync-common", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseIds: syncSelection, apply: false }),
        }),
      ]);
      if (!overviewRes.ok || !dryRunRes.ok) {
        setMessage({ tone: "error", text: "সিঙ্ক-প্রিভিউ লোড করা যায়নি।" });
        return;
      }
      const overview = (await overviewRes.json()) as { shared: SharedTopic[] };
      setSyncShared(overview.shared);
      setSyncDryRun((await dryRunRes.json()) as SyncDryRun);
    } finally {
      setBusy(false);
    }
  }, [syncSelection]);

  useEffect(() => {
    if (tab === "sync" && syncShared === null) void loadSyncPreview();
  }, [tab, syncShared, loadSyncPreview]);

  async function applySync() {
    if (syncSelection.length < 2) return;
    if (
      !window.confirm(
        "আউট-অফ-সিঙ্ক কমন টপিকগুলোর first-study বরাদ্দ anchor (আগের) তারিখে সরানো হবে — শুধু যেখানে ওই তারিখে প্রকাশিত অধ্যয়ন-স্লট আছে। সম্পন্ন অগ্রগতি/পরীক্ষার ইতিহাস অপরিবর্তিত থাকবে। নিশ্চিত?",
      )
    )
      return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/study-plan/sync-common", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseIds: syncSelection, apply: true }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage({ tone: "error", text: payload.error ?? "সিঙ্ক প্রয়োগ ব্যর্থ।" });
      } else {
        setMessage({
          tone: "ok",
          text: `${formatNumber(Number(payload.applied ?? 0))}টি বরাদ্দ anchor তারিখে সরানো হয়েছে।`,
        });
        await Promise.all([loadSyncPreview(), loadPlan(selectedDate)]);
      }
    } finally {
      setBusy(false);
    }
  }

  const loadPlan = useCallback(
    async (date?: string | null) => {
      const query = new URLSearchParams({ courseId });
      if (date) query.set("date", date);
      const response = await fetch(`/api/admin/study-plan?${query}`, { cache: "no-store" });
      if (!response.ok) {
        setMessage({ tone: "error", text: "কভারেজ ডেটা লোড করা যায়নি।" });
        return;
      }
      setPlan((await response.json()) as PlanData);
    },
    [courseId],
  );

  useEffect(() => {
    void loadPlan(selectedDate);
  }, [loadPlan, selectedDate]);

  const loadPyqQueue = useCallback(async () => {
    const response = await fetch(`/api/admin/pyq-metadata?courseId=${courseId}`, { cache: "no-store" });
    if (!response.ok) {
      setMessage({ tone: "error", text: "PYQ তালিকা লোড করা যায়নি।" });
      return;
    }
    const payload = (await response.json()) as { questions: PyqQuestion[] };
    setPyqQueue(payload.questions);
  }, [courseId]);

  useEffect(() => {
    if (tab === "metadata" && pyqQueue === null) void loadPyqQueue();
  }, [tab, pyqQueue, loadPyqQueue]);

  const coverage = plan?.summary ?? initialCoverage;
  const totals = useMemo(
    () =>
      coverage.reduce(
        (acc, row) => ({
          units: acc.units + Number(row.units_total),
          assigned: acc.assigned + Number(row.units_assigned),
          unassigned: acc.unassigned + Number(row.units_unassigned),
        }),
        { units: 0, assigned: 0, unassigned: 0 },
      ),
    [coverage],
  );

  async function generatePlan() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/study-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage({ tone: "error", text: payload.error ?? "জেনারেশন ব্যর্থ।" });
      } else {
        const inserted = Number(payload.result?.inserted ?? 0);
        const gaps = (payload.result?.subjects_with_gaps ?? []) as string[];
        setMessage({
          tone: gaps.length > 0 ? "error" : "ok",
          text:
            `${formatNumber(inserted)}টি নতুন first-study বরাদ্দ তৈরি হয়েছে (বিদ্যমান বরাদ্দ অপরিবর্তিত)।` +
            (gaps.length > 0
              ? ` সতর্কতা: ${gaps.join(", ")} বিষয়ে প্রকাশিত অধ্যয়ন-দিন নেই — রুটিনে দিন যোগ না করা পর্যন্ত এগুলো অবরাদ্দই থাকবে।`
              : ""),
        });
        await loadPlan(selectedDate);
      }
    } finally {
      setBusy(false);
    }
  }

  async function patchAssignment(assignmentId: string, patch: Record<string, unknown>) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/study-plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, ...patch }),
      });
      const payload = await response.json();
      if (!response.ok) setMessage({ tone: "error", text: payload.error ?? "সম্পাদনা ব্যর্থ।" });
      else await loadPlan(selectedDate);
    } finally {
      setBusy(false);
    }
  }

  async function removeAssignment(assignmentId: string) {
    if (!window.confirm("এই first-study বরাদ্দটি মুছে ফেলা হবে — ইউনিটটি অবরাদ্দ তালিকায় ফিরে যাবে। নিশ্চিত?")) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/study-plan", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId }),
      });
      if (!response.ok) {
        const payload = await response.json();
        setMessage({ tone: "error", text: payload.error ?? "মুছে ফেলা যায়নি।" });
      } else await loadPlan(selectedDate);
    } finally {
      setBusy(false);
    }
  }

  async function savePyqMetadata(question: PyqQuestion, form: FormData) {
    setBusy(true);
    setMessage(null);
    try {
      const sourceUrl = String(form.get("sourceUrl") ?? "").trim();
      const sourceRef = String(form.get("sourceRef") ?? "").trim();
      const response = await fetch("/api/admin/pyq-metadata", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          examName: String(form.get("examName") ?? "").trim(),
          year: Number(form.get("year")),
          questionType: String(form.get("questionType") ?? "mcq"),
          ...(sourceUrl ? { sourceUrl } : {}),
          ...(sourceRef ? { sourceRef } : {}),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage({ tone: "error", text: payload.error ?? "সংরক্ষণ ব্যর্থ।" });
      } else {
        setMessage({ tone: "ok", text: "মেটাডেটা সংরক্ষিত — প্রশ্নটি এখন strict PYQ-পুলে গণনার যোগ্য।" });
        await loadPyqQueue();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={
              tab === item.id
                ? "rounded-full bg-[var(--brand)] px-3.5 py-1.5 text-[0.6875rem] font-semibold text-white"
                : "rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-[0.6875rem] font-medium text-[var(--text-muted)] hover:border-[var(--brand)]/40"
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      {message ? (
        <p
          className={
            message.tone === "ok"
              ? "rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[0.6875rem] text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
              : "rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[0.6875rem] text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
          }
        >
          {message.text}
        </p>
      ) : null}

      {tab === "matrix" ? (
        <div className="space-y-4">
          <div className="jh-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[0.875rem] font-bold text-[var(--text)]">কভারেজ ম্যাট্রিক্স — {courseTitle}</h2>
                <p className="mt-0.5 text-[0.6875rem] text-[var(--text-muted)]">
                  ইউনিট = প্রতিটি সাবটপিক + সাবটপিকবিহীন প্রতিটি টপিক। রিভিশন-দিন কখনো first-study হিসেবে গণনা হয় না
                  (ডাটাবেস-স্তরের unique index)।
                </p>
              </div>
              <button
                type="button"
                onClick={generatePlan}
                disabled={busy}
                className="rounded-xl bg-[var(--brand)] px-4 py-2 text-[0.75rem] font-semibold text-white disabled:opacity-50"
              >
                {busy ? "কাজ চলছে…" : "অবরাদ্দ ইউনিট স্বয়ংক্রিয় বরাদ্দ করুন"}
              </button>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[0.6875rem]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[0.5625rem] uppercase tracking-wider text-[var(--text-subtle)]">
                    <th className="py-2 pr-2">বিষয়</th>
                    <th className="py-2 pr-2 text-right">টপিক</th>
                    <th className="py-2 pr-2 text-right">সাবটপিক</th>
                    <th className="py-2 pr-2 text-right">ইউনিট</th>
                    <th className="py-2 pr-2 text-right">বরাদ্দ</th>
                    <th className="py-2 pr-2 text-right">বাকি</th>
                    <th className="py-2 w-40">অগ্রগতি</th>
                  </tr>
                </thead>
                <tbody>
                  {coverage.map((row) => {
                    const pct = Number(row.units_total) > 0
                      ? Math.round((Number(row.units_assigned) / Number(row.units_total)) * 100)
                      : 0;
                    return (
                      <tr key={row.subject_id} className="border-b border-[var(--border)]/60">
                        <td className="py-2 pr-2 font-medium text-[var(--text)]">{row.title_bn}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{formatNumber(row.topics_total)}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{formatNumber(row.subtopics_total)}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{formatNumber(row.units_total)}</td>
                        <td className="py-2 pr-2 text-right tabular-nums text-emerald-700 dark:text-emerald-300">
                          {formatNumber(row.units_assigned)}
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums">
                          {Number(row.units_unassigned) > 0 ? (
                            <span className="font-semibold text-rose-600 dark:text-rose-300">
                              {formatNumber(row.units_unassigned)}
                            </span>
                          ) : (
                            <span className="text-[var(--text-subtle)]">০</span>
                          )}
                        </td>
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                              <div
                                className={pct === 100 ? "h-full bg-emerald-500" : "h-full bg-amber-500"}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-9 text-right tabular-nums text-[var(--text-subtle)]">
                              {toBengaliDigits(pct)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="text-[0.6875rem] font-semibold text-[var(--text)]">
                    <td className="py-2 pr-2">মোট</td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {formatNumber(coverage.reduce((sum, r) => sum + Number(r.topics_total), 0))}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {formatNumber(coverage.reduce((sum, r) => sum + Number(r.subtopics_total), 0))}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">{formatNumber(totals.units)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{formatNumber(totals.assigned)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{formatNumber(totals.unassigned)}</td>
                    <td className="py-2" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {plan ? (
            <div className="jh-card p-4">
              <h3 className="text-[0.8125rem] font-bold text-[var(--text)]">প্রকাশের চেকলিস্ট</h3>
              <ul className="mt-2 space-y-1.5">
                {plan.checklist.map((check) => (
                  <li key={check.rule} className="flex items-start gap-2 text-[0.6875rem]">
                    <Badge tone={check.ok ? "success" : "danger"}>{check.ok ? "✓" : "✕"}</Badge>
                    <span className="font-medium text-[var(--text)]">{check.rule}</span>
                    <span className="text-[var(--text-subtle)]">{check.detail}</span>
                  </li>
                ))}
              </ul>
              {!plan.publishable ? (
                <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[0.6875rem] font-medium text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                  সম্পূর্ণ কভারেজ নিশ্চিত না হওয়া পর্যন্ত ৬০-দিনের প্ল্যান “সম্পূর্ণ” ঘোষণা করা যাবে না। নিচে অনুপস্থিত
                  ইউনিটগুলোর সঠিক তালিকা।
                </p>
              ) : (
                <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[0.6875rem] font-medium text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                  সব শর্ত পূরণ — প্রতিটি ইউনিটের first-study দিন নির্ধারিত।
                </p>
              )}
            </div>
          ) : null}

          {plan && plan.unassignedTotal > 0 ? (
            <div className="jh-card p-4">
              <h3 className="text-[0.8125rem] font-bold text-[var(--text)]">
                অবরাদ্দ ইউনিট — {formatNumber(plan.unassignedTotal)}টি
                {plan.unassignedTotal > plan.unassigned.length
                  ? ` (প্রথম ${formatNumber(plan.unassigned.length)}টি দেখানো হলো)`
                  : ""}
              </h3>
              <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
                {plan.unassigned.map((unit) => (
                  <li
                    key={`${unit.topic_id}:${unit.subtopic_id ?? "topic"}`}
                    className="rounded-lg bg-[var(--surface-muted)] px-2.5 py-1.5 text-[0.6875rem] text-[var(--text-muted)]"
                  >
                    <span className="font-medium text-[var(--text)]">{unit.subject_bn}</span>
                    {" → "}
                    {unit.topic_bn}
                    {unit.subtopic_bn ? <>{" → "}<span className="text-[var(--brand)]">{unit.subtopic_bn}</span></> : (
                      <Badge tone="warning">সাবটপিকবিহীন টপিক</Badge>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {plan && plan.integrity.length > 0 ? (
            <div className="jh-card border-rose-300 p-4">
              <h3 className="text-[0.8125rem] font-bold text-rose-700 dark:text-rose-300">
                সিলেবাস-রেফারেন্স সমস্যা — {formatNumber(plan.integrity.length)}টি
              </h3>
              <ul className="mt-2 space-y-1 text-[0.6875rem] text-[var(--text-muted)]">
                {plan.integrity.map((issue) => (
                  <li key={issue.assignment_id}>
                    <code className="text-[0.625rem]">{issue.assignment_id.slice(0, 8)}</code> — {issue.problem}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "mapping" ? (
        <div className="space-y-4">
          <div className="jh-card p-4">
            <h2 className="text-[0.875rem] font-bold text-[var(--text)]">৬০ দিনের first-study ক্যালেন্ডার</h2>
            <p className="mt-0.5 text-[0.6875rem] text-[var(--text-muted)]">
              প্রতিটি ঘরে ওই দিনের first-study ইউনিট সংখ্যা। দিন নির্বাচন করে বরাদ্দ সম্পাদনা করুন — তারিখ বদলালে নতুন
              তারিখটি অবশ্যই ওই বিষয়ের প্রকাশিত অধ্যয়ন-দিন হতে হবে।
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(plan?.days ?? []).map((day) => (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDate(day.date === selectedDate ? null : day.date)}
                  className={
                    day.date === selectedDate
                      ? "rounded-lg bg-[var(--brand)] px-2 py-1.5 text-[0.625rem] font-semibold text-white"
                      : "rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[0.625rem] text-[var(--text-muted)] hover:border-[var(--brand)]/40"
                  }
                  title={day.date}
                >
                  D{toBengaliDigits(day.planDay)} · {toBengaliDigits(day.count)}
                </button>
              ))}
              {(plan?.days ?? []).length === 0 ? (
                <p className="text-[0.6875rem] text-[var(--text-subtle)]">
                  এখনো কোনো বরাদ্দ নেই — “কভারেজ ম্যাট্রিক্স” ট্যাব থেকে স্বয়ংক্রিয় বরাদ্দ চালান।
                </p>
              ) : null}
            </div>
          </div>

          {selectedDate && plan?.dayAssignments ? (
            <div className="jh-card p-4">
              <h3 className="text-[0.8125rem] font-bold text-[var(--text)]">
                {selectedDate} — {formatNumber(plan.dayAssignments.length)}টি first-study ইউনিট
              </h3>
              <ul className="mt-2 space-y-2">
                {plan.dayAssignments.map((assignment) => (
                  <li
                    key={assignment.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[0.6875rem]">
                        <span className="font-semibold text-[var(--text)]">{embeddedTitle(assignment.subjects)}</span>
                        {" → "}
                        <span className="text-[var(--text-muted)]">{embeddedTitle(assignment.topics)}</span>
                        {" → "}
                        <span className="font-medium text-[var(--brand)]">
                          {embeddedTitle(assignment.subtopics) !== "—"
                            ? embeddedTitle(assignment.subtopics)
                            : "(টপিক-স্তরের ইউনিট)"}
                        </span>
                        <span className="ml-2 text-[var(--text-subtle)]">
                          {toBengaliDigits(assignment.minutes)} মিনিট · D{toBengaliDigits(assignment.plan_day)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="date"
                          defaultValue={assignment.first_study_date}
                          onChange={(event) => {
                            if (event.target.value && event.target.value !== assignment.first_study_date) {
                              void patchAssignment(assignment.id, { date: event.target.value });
                            }
                          }}
                          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[0.625rem] text-[var(--text)]"
                        />
                        <select
                          defaultValue={assignment.priority}
                          onChange={(event) => void patchAssignment(assignment.id, { priority: event.target.value })}
                          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[0.625rem] text-[var(--text)]"
                        >
                          <option value="high">উচ্চ</option>
                          <option value="normal">স্বাভাবিক</option>
                          <option value="low">নিম্ন</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => void removeAssignment(assignment.id)}
                          className="rounded-lg border border-rose-300 px-2 py-1 text-[0.625rem] font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                        >
                          মুছুন
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "sync" ? (
        <div className="space-y-4">
          <div className="jh-card p-4">
            <h3 className="text-[0.875rem] font-bold text-[var(--text)]">কমন-টপিক সিঙ্ক্রোনাইজেশন প্রিভিউ</h3>
            <p className="mt-1 text-[0.6875rem] leading-relaxed text-[var(--text-muted)]">
              কমনত্ব নির্ধারিত হয় শুধুই canonical taxonomy-লিংক দিয়ে — নামের মিল দিয়ে নয়। “একই কমন টপিক → একই
              অধ্যয়ন-দিন; আলাদা বিশেষায়িত টপিক → আলাদা সূচি।” প্রয়োগ করলে শুধু আউট-অফ-সিঙ্ক first-study বরাদ্দ anchor
              তারিখে সরে; সম্পন্ন অগ্রগতি, পরীক্ষার ইতিহাস ও বিশেষায়িত টপিক অপরিবর্তিত থাকে।
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {syncCourses.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[0.6875rem] font-medium text-[var(--text)]"
                >
                  <input
                    type="checkbox"
                    checked={syncSelection.includes(item.id)}
                    onChange={(event) =>
                      setSyncSelection((prev) =>
                        event.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id),
                      )
                    }
                  />
                  {item.title_bn}
                </label>
              ))}
              <button
                type="button"
                onClick={() => void loadSyncPreview()}
                disabled={busy || syncSelection.length < 2}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[0.6875rem] font-semibold text-[var(--text)] disabled:opacity-50"
              >
                প্রিভিউ রিফ্রেশ
              </button>
              <button
                type="button"
                onClick={() => void applySync()}
                disabled={busy || syncSelection.length < 2 || !syncDryRun || syncDryRun.moves.every((m) => !m.can_apply)}
                className="rounded-xl bg-[var(--brand)] px-4 py-2 text-[0.6875rem] font-semibold text-white disabled:opacity-50"
              >
                সিঙ্ক প্রয়োগ করুন
              </button>
            </div>
            {syncSelection.length < 2 ? (
              <p className="mt-2 text-[0.6875rem] text-amber-700 dark:text-amber-300">
                তুলনার জন্য কমপক্ষে ২টি প্রোগ্রাম নির্বাচন করুন।
              </p>
            ) : null}
          </div>

          {syncDryRun && syncDryRun.moves.length > 0 ? (
            <div className="jh-card overflow-x-auto p-4">
              <h4 className="mb-2 text-[0.8125rem] font-bold text-[var(--text)]">
                প্রস্তাবিত পরিবর্তন ({formatNumber(syncDryRun.moves.length)}টি)
              </h4>
              <table className="w-full min-w-[560px] text-[0.6875rem]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--text-subtle)]">
                    <th className="py-2 pr-2">কমন টপিক</th>
                    <th className="py-2 pr-2">প্রোগ্রাম</th>
                    <th className="py-2 pr-2">বিষয়</th>
                    <th className="py-2 pr-2">বর্তমান দিন</th>
                    <th className="py-2 pr-2">anchor দিন</th>
                    <th className="py-2">অবস্থা</th>
                  </tr>
                </thead>
                <tbody>
                  {syncDryRun.moves.map((move, index) => (
                    <tr key={`${move.canonical_topic_bn}-${move.course}-${index}`} className="border-b border-[var(--border)]/60">
                      <td className="py-2 pr-2 font-medium text-[var(--text)]">{move.canonical_topic_bn}</td>
                      <td className="py-2 pr-2">{move.course}</td>
                      <td className="py-2 pr-2">{move.subject_bn}</td>
                      <td className="py-2 pr-2">{formatDate(`${move.from_date}T12:00:00`, "bn", { day: "numeric", month: "short" })}</td>
                      <td className="py-2 pr-2">{formatDate(`${move.to_date}T12:00:00`, "bn", { day: "numeric", month: "short" })}</td>
                      <td className="py-2">
                        {move.can_apply ? (
                          <span className="font-semibold text-emerald-700 dark:text-emerald-300">সরানো যাবে</span>
                        ) : (
                          <span className="font-semibold text-amber-700 dark:text-amber-300">
                            anchor দিনে প্রকাশিত স্লট নেই — রুটিনে দিন যোগ/সম্পাদনা করুন
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {syncShared !== null ? (
            syncShared.length === 0 ? (
              <p className="jh-card p-4 text-[0.75rem] text-[var(--text-muted)]">
                নির্বাচিত প্রোগ্রামগুলোর মধ্যে canonical-লিংকযুক্ত কোনো কমন টপিক নেই — সব টপিক বিশেষায়িত, তাই সূচিও আলাদা
                থাকবে।
              </p>
            ) : (
              <div className="jh-card overflow-x-auto p-4">
                <h4 className="mb-2 text-[0.8125rem] font-bold text-[var(--text)]">
                  শনাক্তকৃত কমন টপিক ({formatNumber(syncShared.length)}টি
                  {syncDryRun ? ` — আউট-অফ-সিঙ্ক ${formatNumber(syncDryRun.shared_topics_out_of_sync)}টি` : ""})
                </h4>
                <table className="w-full min-w-[560px] text-[0.6875rem]">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[var(--text-subtle)]">
                      <th className="py-2 pr-2">কমন টপিক (canonical)</th>
                      <th className="py-2 pr-2">প্রোগ্রাম ও বিষয়</th>
                      <th className="py-2 pr-2">first-study দিন</th>
                      <th className="py-2">অবস্থা</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncShared.map((topic) => (
                      <tr key={topic.canonical_id} className="border-b border-[var(--border)]/60 align-top">
                        <td className="py-2 pr-2 font-medium text-[var(--text)]">{topic.canonical_bn}</td>
                        <td className="py-2 pr-2">
                          {topic.courses.map((entry) => (
                            <p key={entry.course_id}>
                              {courseNameById.get(entry.course_id) ?? entry.course_id} · {entry.subject_bn} →{" "}
                              {entry.topic_bn}
                            </p>
                          ))}
                        </td>
                        <td className="py-2 pr-2">
                          {topic.courses.map((entry) => (
                            <p key={entry.course_id}>
                              {formatDate(`${entry.first_study_date}T12:00:00`, "bn", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </p>
                          ))}
                        </td>
                        <td className="py-2">
                          {topic.in_sync ? (
                            <span className="font-semibold text-emerald-700 dark:text-emerald-300">সিঙ্কড</span>
                          ) : (
                            <span className="font-semibold text-rose-700 dark:text-rose-300">আউট-অফ-সিঙ্ক</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <p className="jh-card p-4 text-[0.75rem] text-[var(--text-muted)]">প্রিভিউ লোড হচ্ছে…</p>
          )}
        </div>
      ) : null}

      {tab === "pyq" ? (
        <div className="jh-card p-4">
          <h2 className="text-[0.875rem] font-bold text-[var(--text)]">বিষয়ভিত্তিক PYQ প্রস্তুতি — strict ৭০:৩০</h2>
          <p className="mt-0.5 text-[0.6875rem] text-[var(--text-muted)]">
            “প্রস্তুত” মানে exam_name + সাল + ধরন + উৎস-রেফারেন্স সম্পূর্ণ। এই সংখ্যাগুলোই দৈনিক পরীক্ষার publish-block
            নির্ধারণ করে — কোনো অনুমান নেই।
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[0.6875rem]">
              <thead>
                <tr className="border-b border-[var(--border)] text-[0.5625rem] uppercase tracking-wider text-[var(--text-subtle)]">
                  <th className="py-2 pr-2">বিষয়</th>
                  <th className="py-2 pr-2 text-right">PYQ মোট</th>
                  <th className="py-2 pr-2 text-right">প্রস্তুত</th>
                  <th className="py-2 pr-2 text-right">মেটাডেটা বাকি</th>
                  <th className="py-2 pr-2 text-right">প্র্যাকটিস পুল</th>
                  <th className="py-2">অবস্থা</th>
                </tr>
              </thead>
              <tbody>
                {initialReadiness.map((row) => (
                  <tr key={row.subject_id} className="border-b border-[var(--border)]/60">
                    <td className="py-2 pr-2 font-medium text-[var(--text)]">{row.title_bn}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{formatNumber(row.pyq_total)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums text-emerald-700 dark:text-emerald-300">
                      {formatNumber(row.pyq_ready)}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {Number(row.pyq_missing_meta) > 0 ? (
                        <span className="font-semibold text-amber-600 dark:text-amber-300">
                          {formatNumber(row.pyq_missing_meta)}
                        </span>
                      ) : (
                        "০"
                      )}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">{formatNumber(row.practice_pool)}</td>
                    <td className="py-2">
                      {Number(row.pyq_ready) === 0 ? (
                        <Badge tone="danger">যাচাইকৃত PYQ ডেটা অনুপলব্ধ</Badge>
                      ) : Number(row.pyq_missing_meta) > 0 ? (
                        <Badge tone="warning">আংশিক</Badge>
                      ) : (
                        <Badge tone="success">সম্পূর্ণ</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "metadata" ? (
        <div className="space-y-3">
          <div className="jh-card p-4">
            <h2 className="text-[0.875rem] font-bold text-[var(--text)]">PYQ মেটাডেটা ব্যাকফিল</h2>
            <p className="mt-0.5 text-[0.6875rem] text-[var(--text-muted)]">
              প্রতিটি প্রশ্নের প্রকৃত পরীক্ষার নাম, সাল ও উৎস-রেফারেন্স লিখুন। সিস্টেম কিছুই অনুমান করে না — উৎস ছাড়া
              সংরক্ষণ প্রত্যাখ্যাত হয়। সংরক্ষণের পরেই প্রশ্নটি strict ৭০-কোটায় গণনা হবে।
            </p>
          </div>
          {pyqQueue === null ? (
            <p className="text-[0.6875rem] text-[var(--text-subtle)]">লোড হচ্ছে…</p>
          ) : pyqQueue.length === 0 ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[0.6875rem] font-medium text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
              দারুণ — মেটাডেটা-অসম্পূর্ণ কোনো PYQ নেই।
            </p>
          ) : (
            pyqQueue.map((question) => (
              <form
                key={question.id}
                className="jh-card p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void savePyqMetadata(question, new FormData(event.currentTarget));
                }}
              >
                <p className="text-[0.6875rem] text-[var(--text-subtle)]">
                  {embeddedTitle(question.subjects)} · {embeddedTitle(question.topics)}
                </p>
                <p className="mt-1 text-[0.75rem] font-medium leading-relaxed text-[var(--text)]">
                  {question.statement_bn || question.statement}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="text-[0.625rem] font-medium text-[var(--text-subtle)]">
                    পরীক্ষার নাম *
                    <input
                      name="examName"
                      required
                      minLength={3}
                      defaultValue={question.exam_name ?? ""}
                      placeholder="যেমন: ৪৫তম বিসিএস প্রিলিমিনারি"
                      className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[0.6875rem] text-[var(--text)]"
                    />
                  </label>
                  <label className="text-[0.625rem] font-medium text-[var(--text-subtle)]">
                    সাল *
                    <input
                      name="year"
                      type="number"
                      required
                      min={1972}
                      max={2026}
                      defaultValue={question.year ?? ""}
                      className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[0.6875rem] text-[var(--text)]"
                    />
                  </label>
                  <label className="text-[0.625rem] font-medium text-[var(--text-subtle)]">
                    ধরন *
                    <select
                      name="questionType"
                      defaultValue={question.question_type ?? "mcq"}
                      className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[0.6875rem] text-[var(--text)]"
                    >
                      <option value="mcq">MCQ</option>
                      <option value="written">লিখিত</option>
                    </select>
                  </label>
                  <label className="text-[0.625rem] font-medium text-[var(--text-subtle)]">
                    উৎস URL
                    <input
                      name="sourceUrl"
                      type="url"
                      defaultValue={question.source_url ?? ""}
                      placeholder="https://…"
                      className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[0.6875rem] text-[var(--text)]"
                    />
                  </label>
                  <label className="text-[0.625rem] font-medium text-[var(--text-subtle)] sm:col-span-2">
                    উৎস রেফারেন্স (বই/ডকুমেন্ট/পৃষ্ঠা)
                    <input
                      name="sourceRef"
                      defaultValue={question.source_title ?? question.source ?? ""}
                      placeholder="যেমন: PSC প্রশ্নপত্র আর্কাইভ, পৃষ্ঠা ১২"
                      className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[0.6875rem] text-[var(--text)]"
                    />
                  </label>
                  <div className="flex items-end sm:col-span-2 lg:col-span-2">
                    <button
                      type="submit"
                      disabled={busy}
                      className="rounded-xl bg-[var(--brand)] px-4 py-2 text-[0.6875rem] font-semibold text-white disabled:opacity-50"
                    >
                      সংরক্ষণ করুন
                    </button>
                  </div>
                </div>
              </form>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
