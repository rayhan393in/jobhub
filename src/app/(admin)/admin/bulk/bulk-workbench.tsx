"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, CircleSlash, Archive, RotateCcw, Send, RefreshCw, TriangleAlert, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { formatNumber } from "@/lib/format";

const ACTIONS = [
  { id: "approve", label: "অনুমোদন", icon: Check, danger: false, verb: "অনুমোদিত হবে" },
  { id: "reject", label: "বাতিল", icon: CircleSlash, danger: true, verb: "বাতিল হবে" },
  { id: "archive", label: "আর্কাইভ", icon: Archive, danger: true, verb: "আর্কাইভ হবে" },
  { id: "restore", label: "রিভিউতে ফেরান", icon: RotateCcw, danger: false, verb: "রিভিউ অপেক্ষায় যাবে" },
  { id: "submit", label: "জমা দিন", icon: Send, danger: false, verb: "জমা হবে" },
] as const;

export function BulkWorkbench({ courses }: { courses: { id: string; title_bn: string }[] }) {
  const router = useRouter();
  const [filters, setFilters] = React.useState({
    course_id: "",
    subject_id: "",
    status: "",
    difficulty: "",
    source_type: "",
  });
  const [subjects, setSubjects] = React.useState<{ id: string; title_bn: string }[]>([]);
  const [count, setCount] = React.useState<number | null>(null);
  const [action, setAction] = React.useState<(typeof ACTIONS)[number]["id"]>("approve");
  const [notes, setNotes] = React.useState("");
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!filters.course_id) {
      setSubjects([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const response = await fetch(`/api/taxonomy?courseId=${filters.course_id}`);
      const payload = await response.json();
      if (!cancelled) setSubjects(payload.subjects ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [filters.course_id]);

  const activeFilters = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
  const hasScope = Object.keys(activeFilters).length > 0;

  function update(key: keyof typeof filters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCount(null);
    setConfirming(false);
    setDone(null);
    setError(null);
  }

  async function preview() {
    setBusy(true);
    setError(null);
    setDone(null);
    setConfirming(false);
    try {
      const search = new URLSearchParams();
      if (filters.course_id) search.set("course", filters.course_id);
      if (filters.subject_id) search.set("subject", filters.subject_id);
      if (filters.status) search.set("status", filters.status);
      if (filters.difficulty) search.set("difficulty", filters.difficulty);
      if (filters.source_type) search.set("source", filters.source_type);
      const response = await fetch(`/api/admin/bulk?${search}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "সংখ্যা জানা যায়নি।");
        return;
      }
      setCount(payload.count as number);
    } catch {
      setError("নেটওয়ার্ক সমস্যা।");
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (count === null) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          filters: activeFilters,
          notes: notes || undefined,
          expectedCount: count,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "কার্যক্রম ব্যর্থ হয়েছে।");
        setCount(null);
        setConfirming(false);
        return;
      }
      const affected = (payload.result as { affected?: number })?.affected ?? count;
      setDone(`${formatNumber(affected)}টি প্রশ্ন ${ACTIONS.find((a) => a.id === action)?.verb}।`);
      setCount(null);
      setConfirming(false);
      router.refresh();
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="jh-card p-4">
        <h2 className="text-[0.8125rem] font-semibold text-[var(--text)]">১. স্কোপ নির্ধারণ করুন</h2>
        <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
          <div>
            <label htmlFor="bulk-course" className="jh-label">কোর্স</label>
            <select id="bulk-course" value={filters.course_id} onChange={(e) => update("course_id", e.target.value)} className="jh-select">
              <option value="">সব কোর্স</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.title_bn}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="bulk-subject" className="jh-label">বিষয়</label>
            <select
              id="bulk-subject"
              value={filters.subject_id}
              onChange={(e) => update("subject_id", e.target.value)}
              className="jh-select"
              disabled={!filters.course_id}
            >
              <option value="">সব বিষয়</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>{subject.title_bn}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="bulk-status" className="jh-label">বর্তমান অবস্থা</label>
            <select id="bulk-status" value={filters.status} onChange={(e) => update("status", e.target.value)} className="jh-select">
              <option value="">সব</option>
              <option value="draft">ড্রাফট</option>
              <option value="pending_review">রিভিউ অপেক্ষায়</option>
              <option value="approved">অনুমোদিত</option>
              <option value="rejected">বাতিল</option>
              <option value="archived">আর্কাইভ</option>
            </select>
          </div>
          <div>
            <label htmlFor="bulk-difficulty" className="jh-label">কঠিনতা</label>
            <select id="bulk-difficulty" value={filters.difficulty} onChange={(e) => update("difficulty", e.target.value)} className="jh-select">
              <option value="">সব</option>
              <option value="easy">সহজ</option>
              <option value="medium">মধ্যম</option>
              <option value="hard">কঠিন</option>
            </select>
          </div>
          <div>
            <label htmlFor="bulk-source" className="jh-label">উৎস</label>
            <select id="bulk-source" value={filters.source_type} onChange={(e) => update("source_type", e.target.value)} className="jh-select">
              <option value="">সব</option>
              <option value="manual">ম্যানুয়াল</option>
              <option value="csv_import">CSV</option>
              <option value="json_import">JSON</option>
              <option value="ai_assisted">AI-সহায়ক</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={preview} loading={busy} disabled={!hasScope}>
            <RefreshCw className="size-3.5" aria-hidden />
            পূর্বরূপ দেখুন
          </Button>
          {count !== null ? (
            <span className="rounded-lg bg-[var(--surface-sunken)] px-2.5 py-1 text-[0.75rem] font-semibold text-[var(--text)]">
              {formatNumber(count)}টি প্রশ্ন মিলছে
            </span>
          ) : null}
          {!hasScope ? (
            <span className="text-[0.625rem] text-[var(--text-subtle)]">অন্তত একটি ফিল্টার দিন — পুরো ব্যাংকে বাল্ক কাজ বন্ধ।</span>
          ) : null}
        </div>

        <h2 className="mt-4 border-t border-[var(--border)] pt-3 text-[0.8125rem] font-semibold text-[var(--text)]">
          ২. কার্যক্রম বাছুন
        </h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {ACTIONS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setAction(item.id);
                  setConfirming(false);
                  setDone(null);
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[0.75rem] font-semibold transition-colors ${
                  action === item.id
                    ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
                    : "border-[var(--border)] text-[var(--text-muted)]"
                }`}
              >
                <Icon className="size-3" aria-hidden />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="mt-3">
          <label htmlFor="bulk-notes" className="jh-label">রিভিউ নোট (ঐচ্ছিক)</label>
          <Textarea
            id="bulk-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="text-[0.75rem]"
            placeholder="কেন এই বাল্ক কার্যক্রম — audit log-এ রাখা হবে"
          />
        </div>

        {confirming ? (
          <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
            <p className="flex items-start gap-1.5 text-[0.75rem] font-semibold text-amber-900 dark:text-amber-200">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {formatNumber(count ?? 0)}টি প্রশ্ন {ACTIONS.find((a) => a.id === action)?.verb} — নিশ্চিত?
            </p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={commit} loading={busy}>
                হ্যাঁ, সম্পন্ন করুন
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                বাতিল
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            className="mt-3"
            disabled={count === null || count === 0}
            onClick={() => setConfirming(true)}
          >
            <Check className="size-3.5" aria-hidden />
            কার্যক্রম শুরু করুন
          </Button>
        )}

        {error ? (
          <p role="alert" className="mt-2 flex items-start gap-1.5 text-[0.75rem] font-medium text-[var(--danger)]">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}
        {done ? (
          <p role="status" className="mt-2 flex items-start gap-1.5 text-[0.75rem] font-medium text-mint-600 dark:text-mint-500">
            <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {done}
          </p>
        ) : null}
      </div>

      <aside className="space-y-3">
        <div className="jh-card p-4">
          <h2 className="text-[0.75rem] font-semibold text-[var(--text)]">স্কোপ সারাংশ</h2>
          <dl className="mt-2 space-y-1 text-[0.6875rem]">
            {[
              ["কোর্স", courses.find((c) => c.id === filters.course_id)?.title_bn ?? "সব"],
              ["বিষয়", subjects.find((s) => s.id === filters.subject_id)?.title_bn ?? "সব"],
              ["অবস্থা", filters.status || "সব"],
              ["কঠিনতা", filters.difficulty || "সব"],
              ["উৎস", filters.source_type || "সব"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-2">
                <dt className="text-[var(--text-subtle)]">{label}</dt>
                <dd className="text-right font-medium text-[var(--text)]">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-[0.6875rem] font-semibold text-[var(--text)]">নিরাপত্তা</p>
          <ul className="mt-1.5 space-y-1 text-[0.625rem] leading-relaxed text-[var(--text-muted)]">
            <li>· ফিল্টার ছাড়া বাল্ক অনুমোদন সম্ভব নয়।</li>
            <li>· অনুমোদনের আগে সংখ্যা বদলালে সার্ভার অনুরোধ প্রত্যাখ্যান করে।</li>
            <li>· প্রতিটি পরিবর্তন অডিট লগে যায়।</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
