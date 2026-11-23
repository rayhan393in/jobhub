"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, CircleCheck, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ExamRow } from "./page";

const STAGES: Array<{ value: string; label: string }> = [
  { value: "preliminary", label: "প্রিলিমিনারি" },
  { value: "written", label: "লিখিত" },
  { value: "viva", label: "ভাইভা" },
  { value: "technical", label: "টেকনিক্যাল" },
  { value: "practical", label: "ব্যবহারিক" },
  { value: "other", label: "অন্যান্য" },
];

const stageLabel = (value: string) => STAGES.find((stage) => stage.value === value)?.label ?? value;

type FormState = {
  id: string | null;
  examName: string;
  examNameBn: string;
  examBody: string;
  examYear: string;
  examStage: string;
  positionTitle: string;
  courseId: string;
  yearVerified: boolean;
  sourceUrl: string;
  notes: string;
};

const EMPTY: FormState = {
  id: null,
  examName: "",
  examNameBn: "",
  examBody: "",
  examYear: "",
  examStage: "preliminary",
  positionTitle: "",
  courseId: "",
  yearVerified: false,
  sourceUrl: "",
  notes: "",
};

export function ExamRegistryManager({
  courses,
  exams,
}: {
  courses: Array<{ id: string; title_bn: string }>;
  exams: ExamRow[];
}) {
  const router = useRouter();
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [showForm, setShowForm] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const courseTitle = React.useMemo(() => {
    const map = new Map(courses.map((course) => [course.id, course.title_bn]));
    return (id: string | null) => (id ? map.get(id) ?? "—" : "—");
  }, [courses]);

  async function call(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/exam-registry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "অনুরোধ ব্যর্থ হয়েছে।");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const yearNumber = form.examYear.trim() === "" ? null : Number(form.examYear);
    const ok = await call({
      action: form.id ? "update" : "create",
      ...(form.id ? { id: form.id } : {}),
      examName: form.examName,
      examNameBn: form.examNameBn,
      examBody: form.examBody,
      examYear: yearNumber,
      examStage: form.examStage,
      positionTitle: form.positionTitle,
      courseId: form.courseId || null,
      yearVerified: form.yearVerified,
      sourceUrl: form.sourceUrl,
      notes: form.notes,
    });
    if (ok) {
      setForm(EMPTY);
      setShowForm(false);
    }
  }

  function edit(exam: ExamRow) {
    setForm({
      id: exam.id,
      examName: exam.exam_name,
      examNameBn: exam.exam_name_bn ?? "",
      examBody: exam.exam_body ?? "",
      examYear: exam.exam_year === null ? "" : String(exam.exam_year),
      examStage: exam.exam_stage,
      positionTitle: exam.position_title ?? "",
      courseId: exam.course_id ?? "",
      yearVerified: exam.year_verified,
      sourceUrl: exam.source_url ?? "",
      notes: exam.notes ?? "",
    });
    setShowForm(true);
  }

  return (
    <div className="mt-4 space-y-3">
      {error ? (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-[0.8125rem] text-red-700 dark:bg-red-950/40 dark:text-red-300">
          <TriangleAlert className="h-4 w-4 shrink-0" /> {error}
        </p>
      ) : null}

      {!showForm ? (
        <Button size="sm" onClick={() => { setForm(EMPTY); setShowForm(true); }}>
          <Plus className="h-4 w-4" /> নতুন পরীক্ষা যোগ করুন
        </Button>
      ) : (
        <div className="jh-card space-y-3 p-4">
          <h3 className="text-sm font-bold">{form.id ? "পরীক্ষা সম্পাদনা" : "নতুন পরীক্ষা"}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="jh-label">পরীক্ষার নাম *</span>
              <input className="jh-input h-9 text-[0.8125rem]" value={form.examName}
                onChange={(event) => setForm({ ...form, examName: event.target.value })}
                placeholder="45th BCS Preliminary" />
            </label>
            <label className="block">
              <span className="jh-label">নাম (বাংলা)</span>
              <input className="jh-input h-9 text-[0.8125rem]" value={form.examNameBn}
                onChange={(event) => setForm({ ...form, examNameBn: event.target.value })}
                placeholder="৪৫তম বিসিএস প্রিলিমিনারি" />
            </label>
            <label className="block">
              <span className="jh-label">আয়োজক সংস্থা</span>
              <input className="jh-input h-9 text-[0.8125rem]" value={form.examBody}
                onChange={(event) => setForm({ ...form, examBody: event.target.value })}
                placeholder="BPSC / NTRCA / Petrobangla" />
            </label>
            <label className="block">
              <span className="jh-label">সাল (অজানা হলে খালি রাখুন)</span>
              <input className="jh-input h-9 text-[0.8125rem]" inputMode="numeric" value={form.examYear}
                onChange={(event) => {
                  const value = event.target.value;
                  setForm({ ...form, examYear: value, yearVerified: value.trim() === "" ? false : form.yearVerified });
                }}
                placeholder="2023" />
            </label>
            <label className="block">
              <span className="jh-label">ধাপ</span>
              <select className="jh-select h-9 text-[0.8125rem]" value={form.examStage}
                onChange={(event) => setForm({ ...form, examStage: event.target.value })}>
                {STAGES.map((stage) => <option key={stage.value} value={stage.value}>{stage.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="jh-label">পদের নাম (থাকলে)</span>
              <input className="jh-input h-9 text-[0.8125rem]" value={form.positionTitle}
                onChange={(event) => setForm({ ...form, positionTitle: event.target.value })}
                placeholder="Assistant Engineer (EEE)" />
            </label>
            <label className="block">
              <span className="jh-label">সম্পর্কিত কোর্স</span>
              <select className="jh-select h-9 text-[0.8125rem]" value={form.courseId}
                onChange={(event) => setForm({ ...form, courseId: event.target.value })}>
                <option value="">— নেই —</option>
                {courses.map((course) => <option key={course.id} value={course.id}>{course.title_bn}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="jh-label">সোর্স URL</span>
              <input className="jh-input h-9 text-[0.8125rem]" value={form.sourceUrl}
                onChange={(event) => setForm({ ...form, sourceUrl: event.target.value })}
                placeholder="https://..." />
            </label>
          </div>
          <label className="flex items-center gap-2 text-[0.8125rem]">
            <input type="checkbox" checked={form.yearVerified} disabled={form.examYear.trim() === ""}
              onChange={(event) => setForm({ ...form, yearVerified: event.target.checked })} />
            সালটি নির্ভরযোগ্য সোর্স থেকে যাচাই করা হয়েছে
            {form.examYear.trim() === "" ? <span className="text-[var(--text-muted)]">(আগে সাল লিখুন)</span> : null}
          </label>
          <label className="block">
            <span className="jh-label">নোট</span>
            <textarea className="jh-input min-h-16 text-[0.8125rem]" value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </label>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={busy || form.examName.trim().length < 3}>
              {form.id ? "সংরক্ষণ" : "যোগ করুন"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => { setShowForm(false); setForm(EMPTY); setError(null); }}>
              বাতিল
            </Button>
          </div>
        </div>
      )}

      <div className="jh-card overflow-x-auto p-0">
        <table className="w-full text-[0.8125rem]">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-[0.6875rem] uppercase tracking-wider text-[var(--text-muted)]">
              <th className="px-3 py-2">পরীক্ষা</th>
              <th className="px-3 py-2">সাল</th>
              <th className="px-3 py-2">ধাপ</th>
              <th className="px-3 py-2">কোর্স</th>
              <th className="px-3 py-2">এভিডেন্স</th>
              <th className="px-3 py-2">অবস্থা</th>
              <th className="px-3 py-2 text-right">অ্যাকশন</th>
            </tr>
          </thead>
          <tbody>
            {exams.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-[var(--text-muted)]">
                  রেজিস্ট্রি খালি — প্রথম পরীক্ষাটি যোগ করুন।
                </td>
              </tr>
            ) : (
              exams.map((exam) => (
                <tr key={exam.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-3 py-2">
                    <div className="font-semibold">{exam.exam_name_bn ?? exam.exam_name}</div>
                    <div className="text-[0.6875rem] text-[var(--text-muted)]">
                      {exam.exam_name}{exam.position_title ? ` · ${exam.position_title}` : ""}{exam.exam_body ? ` · ${exam.exam_body}` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {exam.exam_year === null ? (
                      <Badge tone="warning">সাল নেই</Badge>
                    ) : exam.year_verified ? (
                      <span className="inline-flex items-center gap-1 font-semibold">
                        {exam.exam_year} <CircleCheck className="h-3.5 w-3.5 text-emerald-600" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">{exam.exam_year} <Badge tone="warning">অযাচাইকৃত</Badge></span>
                    )}
                  </td>
                  <td className="px-3 py-2">{stageLabel(exam.exam_stage)}</td>
                  <td className="px-3 py-2">{courseTitle(exam.course_id)}</td>
                  <td className="px-3 py-2">{exam.evidence_count}</td>
                  <td className="px-3 py-2">
                    {exam.status === "published" ? <Badge tone="success">প্রকাশিত</Badge>
                      : exam.status === "archived" ? <Badge tone="neutral">আর্কাইভড</Badge>
                      : <Badge tone="warning">ড্রাফট</Badge>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" title="সম্পাদনা" onClick={() => edit(exam)} disabled={busy}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {exam.status !== "published" ? (
                        <Button size="sm" variant="ghost" title="প্রকাশ" disabled={busy}
                          onClick={() => call({ action: "status", id: exam.id, status: "published" })}>
                          <CircleCheck className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" title="আর্কাইভ" disabled={busy}
                          onClick={() => call({ action: "status", id: exam.id, status: "archived" })}>
                          <Archive className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {exam.evidence_count === 0 ? (
                        <Button size="sm" variant="ghost" title="মুছুন" disabled={busy}
                          onClick={() => call({ action: "delete", id: exam.id })}>
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
