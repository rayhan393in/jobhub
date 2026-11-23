"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { EvidenceRow, PreviousQuestion } from "./page";

const CSV_TEMPLATE = [
  "exam_name,exam_year,question,subject,topic,source_ref,source_url,option_a,option_b,option_c,option_d,correct_option,explanation,match_kind",
  "৪৫তম বিসিএস প্রিলিমিনারি,2023,বাংলাদেশের সংবিধান কার্যকর হয় কোন তারিখে?,সাধারণ জ্ঞান,সংবিধান,PSC প্রশ্নপত্র ২০২৩,,,,,,,,exact",
  "৪০তম বিসিএস প্রিলিমিনারি,2018,What is the plural form of 'ox'?,English,Parts of Speech,৪০তম বিসিএস প্রশ্নপত্র,,Oxes,Oxen,Oxs,Ox,b,Irregular plural,exact",
].join("\n");

const MATCH_LABEL: Record<EvidenceRow["match_kind"], string> = {
  exact: "হুবহু",
  same_concept: "একই ধারণা",
  related: "সম্পর্কিত",
};

type Filter = "all" | "missing" | "verified";

export function EvidenceVerifier({
  courses,
  questions,
  coverage,
}: {
  courses: Array<{ id: string; title_bn: string }>;
  questions: PreviousQuestion[];
  coverage: Array<{ course: string; previous_questions: number; questions_with_evidence: number; coverage_pct: number | null }>;
}) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<Filter>("missing");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [openForm, setOpenForm] = React.useState<string | null>(null);

  // CSV import state
  const [courseId, setCourseId] = React.useState(courses[0]?.id ?? "");
  const [csv, setCsv] = React.useState("");
  const [filename, setFilename] = React.useState("");
  const [report, setReport] = React.useState<{
    dryRun: boolean;
    summary: { total: number; matched: number; drafts: number; errors: number };
    verdicts: Array<{ row: number; outcome: string; detail: string; statement: string }>;
    inserted?: number;
    createdDrafts?: number;
    failures?: Array<{ row: number; reason: string }>;
  } | null>(null);

  const visible = questions.filter((question) =>
    filter === "all" ? true : filter === "missing" ? question.evidence.length === 0 : question.evidence.length > 0,
  );

  async function post(payload: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    try {
      const response = await fetch("/api/admin/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "অনুরোধ ব্যর্থ হয়েছে।");
      return data;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "অনুরোধ ব্যর্থ হয়েছে।");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function submitAdd(questionId: string, form: HTMLFormElement) {
    const fields = new FormData(form);
    const data = await post(
      {
        action: "add",
        questionId,
        examName: String(fields.get("examName") ?? ""),
        examYear: Number(fields.get("examYear") ?? 0),
        matchKind: String(fields.get("matchKind") ?? "exact"),
        sourceRef: String(fields.get("sourceRef") ?? ""),
        sourceUrl: String(fields.get("sourceUrl") ?? ""),
      },
      `add-${questionId}`,
    );
    if (data) {
      setOpenForm(null);
      router.refresh();
    }
  }

  async function runCsv(dryRun: boolean) {
    const data = await post({ action: "bulk", courseId, csv, dryRun }, dryRun ? "dry" : "commit");
    if (data) {
      setReport(data);
      if (!dryRun) router.refresh();
    }
  }

  function downloadTemplate() {
    const blob = new Blob([`\uFEFF${CSV_TEMPLATE}`], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "jobhub-evidence-template.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="mt-5 space-y-6">
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[0.75rem] text-red-700">{error}</p>
      ) : null}

      {/* ---- Bulk CSV import ---- */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[0.875rem] font-semibold text-[var(--text)]">CSV বাল্ক ইমপোর্ট</h2>
          <Button variant="secondary" size="sm" onClick={downloadTemplate}>টেমপ্লেট ডাউনলোড</Button>
        </div>
        <p className="mt-1 text-[0.6875rem] leading-relaxed text-[var(--text-muted)]">
          প্রতি সারিতে exam_name + exam_year + question বাধ্যতামূলক। প্রশ্ন বিদ্যমান ব্যাংকে মিললে শুধু এভিডেন্স যুক্ত হয়;
          না মিললে এবং অপশন+সঠিক উত্তর থাকলে অযাচাইকৃত খসড়া প্রশ্ন তৈরি হয়ে রিভিউ কিউতে যায়। আগে ড্রাই-রান দেখুন।
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={courseId}
            onChange={(event) => setCourseId(event.target.value)}
            className="h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 text-[0.75rem]"
          >
            {courses.map((course) => (
              <option key={course.id} value={course.id}>{course.title_bn}</option>
            ))}
          </select>
          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-dashed border-[var(--border)] px-3 text-[0.75rem] text-[var(--text-muted)] hover:border-[var(--brand)]">
            <FileUp className="h-3.5 w-3.5" />
            {filename || "CSV ফাইল বাছুন"}
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setFilename(file.name);
                setCsv(await file.text());
                setReport(null);
              }}
            />
          </label>
          <Button size="sm" loading={busy === "dry"} disabled={!csv} onClick={() => runCsv(true)}>
            ড্রাই-রান
          </Button>
          <Button
            size="sm"
            variant="secondary"
            loading={busy === "commit"}
            disabled={!csv || !report?.dryRun || report.summary.matched + report.summary.drafts === 0}
            onClick={() => runCsv(false)}
          >
            নিশ্চিত করে সংরক্ষণ
          </Button>
        </div>

        {report ? (
          <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-[0.6875rem]">
            <p className="font-medium text-[var(--text)]">
              {report.dryRun ? "ড্রাই-রান ফলাফল" : "সংরক্ষণ সম্পন্ন"} — মোট {report.summary.total} ·
              মিলেছে {report.summary.matched} · নতুন খসড়া {report.summary.drafts} · বাতিল {report.summary.errors}
              {report.inserted !== undefined ? ` · এভিডেন্স সংরক্ষিত ${report.inserted} · খসড়া তৈরি ${report.createdDrafts}` : ""}
            </p>
            <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
              {report.verdicts.map((verdict) => (
                <li key={verdict.row} className="flex gap-2">
                  <span className="shrink-0 text-[var(--text-subtle)]">সারি {verdict.row}</span>
                  <Badge tone={verdict.outcome === "error" ? "danger" : verdict.outcome === "match" ? "success" : "info"}>
                    {verdict.outcome === "match" ? "মিল" : verdict.outcome === "create_draft" ? "খসড়া" : "বাতিল"}
                  </Badge>
                  <span className="text-[var(--text-muted)]">{verdict.detail}</span>
                </li>
              ))}
              {(report.failures ?? []).map((failure) => (
                <li key={`f-${failure.row}`} className="text-red-600">সারি {failure.row}: {failure.reason}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* ---- Coverage by course ---- */}
      {coverage.length > 0 ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="text-[0.875rem] font-semibold text-[var(--text)]">কোর্সভিত্তিক কভারেজ</h2>
          <div className="mt-2 grid gap-1 text-[0.6875rem] text-[var(--text-muted)] sm:grid-cols-2">
            {coverage.map((row) => (
              <p key={row.course}>
                <span className="font-medium text-[var(--text)]">{row.course}</span> — বিগত-বছর {row.previous_questions},
                এভিডেন্সসহ {row.questions_with_evidence}
                {row.coverage_pct !== null ? ` (${row.coverage_pct}%)` : " (ডেটা নেই)"}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      {/* ---- Per-question verifier ---- */}
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {([
            ["missing", "এভিডেন্স নেই"],
            ["verified", "এভিডেন্স আছে"],
            ["all", "সব"],
          ] as Array<[Filter, string]>).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-full px-3 py-1 text-[0.6875rem] font-medium transition ${
                filter === key
                  ? "bg-[var(--brand)] text-white"
                  : "border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--brand)]"
              }`}
            >
              {label}
            </button>
          ))}
          <span className="text-[0.6875rem] text-[var(--text-subtle)]">{visible.length} টি প্রশ্ন</span>
        </div>

        <ul className="space-y-3">
          {visible.map((question) => (
            <li key={question.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="max-w-3xl text-[0.8125rem] leading-relaxed text-[var(--text)]">{question.statement}</p>
                <div className="flex shrink-0 items-center gap-1.5">
                  {question.evidence.length === 0 ? (
                    <Badge tone="danger">অযাচাইকৃত</Badge>
                  ) : (
                    <Badge tone="success">{question.evidence.length} এভিডেন্স</Badge>
                  )}
                </div>
              </div>
              {question.exam_name || question.year ? (
                <p className="mt-1 text-[0.6875rem] text-[var(--text-subtle)]">
                  প্রশ্নে লেখা দাবি: {question.exam_name ?? "—"} · {question.year ?? "সাল নেই"} (এটি এভিডেন্স নয়)
                </p>
              ) : null}

              {question.evidence.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {question.evidence.map((record) => (
                    <li key={record.id} className="flex flex-wrap items-center gap-2 text-[0.6875rem] text-[var(--text-muted)]">
                      <Badge tone="neutral">{MATCH_LABEL[record.match_kind]}</Badge>
                      <span className="font-medium text-[var(--text)]">{record.exam_name} · {record.exam_year}</span>
                      {record.source_ref ? <span>উৎস: {record.source_ref}</span> : null}
                      <button
                        onClick={async () => {
                          if (!window.confirm("এই এভিডেন্স রেকর্ডটি মুছবেন?")) return;
                          const data = await post({ action: "delete", id: record.id }, `del-${record.id}`);
                          if (data) router.refresh();
                        }}
                        className="text-red-500 hover:text-red-700"
                        aria-label="মুছুন"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {openForm === question.id ? (
                <form
                  className="mt-3 grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 sm:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitAdd(question.id, event.currentTarget);
                  }}
                >
                  <input name="examName" required minLength={2} placeholder="পরীক্ষার নাম (যেমন: ৪৫তম বিসিএস প্রিলি)" className="h-9 rounded-lg border border-[var(--border)] px-2 text-[0.75rem]" />
                  <input name="examYear" required type="number" min={1971} max={2100} placeholder="সাল (বাধ্যতামূলক)" className="h-9 rounded-lg border border-[var(--border)] px-2 text-[0.75rem]" />
                  <select name="matchKind" className="h-9 rounded-lg border border-[var(--border)] px-2 text-[0.75rem]">
                    <option value="exact">হুবহু একই প্রশ্ন</option>
                    <option value="same_concept">একই ধারণা</option>
                    <option value="related">সম্পর্কিত</option>
                  </select>
                  <input name="sourceRef" placeholder="উৎস (প্রশ্নপত্র/বই)" className="h-9 rounded-lg border border-[var(--border)] px-2 text-[0.75rem]" />
                  <input name="sourceUrl" placeholder="উৎস URL (ঐচ্ছিক)" className="h-9 rounded-lg border border-[var(--border)] px-2 text-[0.75rem] sm:col-span-2" />
                  <div className="flex gap-2 sm:col-span-2">
                    <Button type="submit" size="sm" loading={busy === `add-${question.id}`}>সংরক্ষণ</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setOpenForm(null)}>বাতিল</Button>
                  </div>
                </form>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  onClick={() => setOpenForm(question.id)}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> এভিডেন্স যোগ করুন
                </Button>
              )}
            </li>
          ))}
          {visible.length === 0 ? (
            <li className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-center text-[0.75rem] text-[var(--text-subtle)]">
              এই ফিল্টারে কোনো প্রশ্ন নেই।
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
