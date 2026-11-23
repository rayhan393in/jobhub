"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Link2, Link2Off, Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CanonicalSubject, CourseSubject } from "./page";

export function CanonicalMapper({
  canonical,
  subjects,
}: {
  canonical: CanonicalSubject[];
  subjects: CourseSubject[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showCreate, setShowCreate] = React.useState(false);
  const [create, setCreate] = React.useState({ slug: "cs-", titleEn: "", titleBn: "" });
  const [pick, setPick] = React.useState<Record<string, string>>({});

  const bySubjectGroup = React.useMemo(() => {
    const groups = new Map<string, CourseSubject[]>();
    for (const subject of subjects) {
      if (!subject.canonical_subject_id) continue;
      const list = groups.get(subject.canonical_subject_id) ?? [];
      list.push(subject);
      groups.set(subject.canonical_subject_id, list);
    }
    return groups;
  }, [subjects]);

  const unmapped = React.useMemo(
    () => subjects.filter((subject) => subject.canonical_subject_id === null),
    [subjects],
  );

  async function call(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/canonical", {
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

  return (
    <div className="mt-4 space-y-4">
      {error ? (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-[0.8125rem] text-red-700 dark:bg-red-950/40 dark:text-red-300">
          <TriangleAlert className="h-4 w-4 shrink-0" /> {error}
        </p>
      ) : null}

      {/* Unmapped course subjects: the deliberate-mapping workbench. */}
      <section className="jh-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold">অম্যাপকৃত কোর্স-বিষয় ({unmapped.length})</h3>
          {!showCreate ? (
            <Button size="sm" variant="secondary" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5" /> নতুন ক্যানোনিকাল বিষয়
            </Button>
          ) : null}
        </div>

        {showCreate ? (
          <div className="mb-3 grid gap-2 rounded-xl border border-[var(--border)] p-3 sm:grid-cols-3">
            <label className="block">
              <span className="jh-label">slug (cs-...)</span>
              <input className="jh-input h-9 text-[0.8125rem]" value={create.slug}
                onChange={(event) => setCreate({ ...create, slug: event.target.value })} placeholder="cs-accounting" />
            </label>
            <label className="block">
              <span className="jh-label">নাম (English)</span>
              <input className="jh-input h-9 text-[0.8125rem]" value={create.titleEn}
                onChange={(event) => setCreate({ ...create, titleEn: event.target.value })} placeholder="Accounting" />
            </label>
            <label className="block">
              <span className="jh-label">নাম (বাংলা)</span>
              <input className="jh-input h-9 text-[0.8125rem]" value={create.titleBn}
                onChange={(event) => setCreate({ ...create, titleBn: event.target.value })} placeholder="হিসাববিজ্ঞান" />
            </label>
            <div className="flex gap-2 sm:col-span-3">
              <Button size="sm" disabled={busy || create.titleEn.trim().length < 2 || create.titleBn.trim().length < 1}
                onClick={async () => {
                  const ok = await call({ action: "create", slug: create.slug.trim(), titleEn: create.titleEn, titleBn: create.titleBn });
                  if (ok) { setCreate({ slug: "cs-", titleEn: "", titleBn: "" }); setShowCreate(false); }
                }}>
                তৈরি করুন
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowCreate(false)}>বাতিল</Button>
            </div>
          </div>
        ) : null}

        {unmapped.length === 0 ? (
          <p className="text-[0.8125rem] text-[var(--text-muted)]">সব কোর্স-বিষয় হয় ম্যাপকৃত, নয়তো ইচ্ছাকৃতভাবে স্বাধীন।</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {unmapped.map((subject) => (
              <li key={subject.id} className="flex flex-wrap items-center gap-2 py-2 text-[0.8125rem]">
                <span className="min-w-[14rem] flex-1">
                  <span className="font-semibold">{subject.title_bn ?? subject.title_en}</span>
                  <span className="ml-1.5 text-[0.6875rem] text-[var(--text-muted)]">{subject.course_title} · {subject.slug}</span>
                </span>
                <select className="jh-select h-8 w-56 text-[0.75rem]" value={pick[subject.id] ?? ""}
                  onChange={(event) => setPick({ ...pick, [subject.id]: event.target.value })}>
                  <option value="">— ক্যানোনিকাল বাছুন —</option>
                  {canonical.filter((entry) => entry.is_active).map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.title_en}</option>
                  ))}
                </select>
                <Button size="sm" variant="secondary" disabled={busy || !pick[subject.id]}
                  onClick={() => call({ action: "map", subjectId: subject.id, canonicalSubjectId: pick[subject.id] })}>
                  <Link2 className="h-3.5 w-3.5" /> ম্যাপ
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Where-used view per canonical subject. */}
      <section className="space-y-2">
        <h3 className="text-sm font-bold">ক্যানোনিকাল বিষয় ও কোথায় ব্যবহৃত</h3>
        {canonical.map((entry) => {
          const members = bySubjectGroup.get(entry.id) ?? [];
          const courseCount = new Set(members.map((member) => member.course_id)).size;
          return (
            <details key={entry.id} className="jh-card group p-0">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-2.5 text-[0.8125rem]">
                <span className="font-semibold">{entry.title_bn ?? entry.title_en}</span>
                <span className="text-[0.6875rem] text-[var(--text-muted)]">{entry.slug}</span>
                {courseCount >= 2 ? <Badge tone="success">{courseCount} কোর্সে পুনঃব্যবহৃত</Badge>
                  : courseCount === 1 ? <Badge tone="info">১ কোর্সে</Badge>
                  : <Badge tone="neutral">অব্যবহৃত</Badge>}
                {!entry.is_active ? <Badge tone="warning">আর্কাইভড</Badge> : null}
                <span className="ml-auto">
                  {members.length === 0 ? (
                    entry.is_active ? (
                      <Button size="sm" variant="ghost" title="আর্কাইভ" disabled={busy}
                        onClick={(event) => { event.preventDefault(); call({ action: "archive", canonicalSubjectId: entry.id, restore: false }); }}>
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" title="পুনরুদ্ধার" disabled={busy}
                        onClick={(event) => { event.preventDefault(); call({ action: "archive", canonicalSubjectId: entry.id, restore: true }); }}>
                        <ArchiveRestore className="h-3.5 w-3.5" />
                      </Button>
                    )
                  ) : null}
                </span>
              </summary>
              {members.length > 0 ? (
                <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)] px-4">
                  {members.map((member) => (
                    <li key={member.id} className="flex items-center gap-2 py-2 text-[0.8125rem]">
                      <span className="flex-1">
                        <span className="font-medium">{member.title_bn ?? member.title_en}</span>
                        <span className="ml-1.5 text-[0.6875rem] text-[var(--text-muted)]">{member.course_title} · {member.slug}</span>
                      </span>
                      <Button size="sm" variant="ghost" title="আনম্যাপ" disabled={busy}
                        onClick={() => call({ action: "unmap", subjectId: member.id })}>
                        <Link2Off className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </details>
          );
        })}
      </section>
    </div>
  );
}
