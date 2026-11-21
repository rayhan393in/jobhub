"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Pencil, Plus, Save, TriangleAlert, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { formatNumber } from "@/lib/format";
import type { AdminCourse } from "./page";

type Draft = {
  entity: "course" | "subject" | "topic" | "subtopic";
  id?: string;
  parentId?: string;
  values: Record<string, string | number | boolean>;
};

export function CourseManager({ courses }: { courses: AdminCourse[] }) {
  const router = useRouter();
  const [expandedCourses, setExpandedCourses] = React.useState<Set<string>>(new Set());
  const [expandedSubjects, setExpandedSubjects] = React.useState<Set<string>>(new Set());
  const [expandedTopics, setExpandedTopics] = React.useState<Set<string>>(new Set());
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function toggle(setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openDraft(next: Draft) {
    setDraft(next);
    setError(null);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);

    const values: Record<string, unknown> = { ...draft.values };
    // Normalise numeric/boolean fields coming straight from inputs.
    for (const key of ["sortOrder", "weight"]) {
      if (typeof values[key] === "string") values[key] = Number(values[key]) || 0;
    }
    if (values.isActive !== undefined && typeof values.isActive === "string") {
      values.isActive = values.isActive === "true";
    }

    const payload: Record<string, unknown> = { entity: draft.entity, values };
    if (draft.id) payload.id = draft.id;
    if (draft.entity === "subject") (values as Record<string, unknown>).courseId = draft.parentId;
    if (draft.entity === "topic") (values as Record<string, unknown>).subjectId = draft.parentId;
    if (draft.entity === "subtopic") (values as Record<string, unknown>).topicId = draft.parentId;

    try {
      const response = await fetch("/api/admin/taxonomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "সংরক্ষণ করা যায়নি।");
        return;
      }
      setDraft(null);
      router.refresh();
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() =>
            openDraft({
              entity: "course",
              values: {
                slug: "",
                titleEn: "",
                titleBn: "",
                summaryBn: "",
                level: "foundation",
                icon: "graduation-cap",
                accent: "indigo",
                status: "draft",
                sortOrder: 0,
              },
            })
          }
        >
          <Plus className="size-3.5" aria-hidden />
          নতুন কোর্স
        </Button>
      </div>

      {courses.map((course) => {
        const open = expandedCourses.has(course.id);
        return (
          <div key={course.id} className="jh-card overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5">
              <button
                type="button"
                onClick={() => toggle(setExpandedCourses, course.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                aria-expanded={open}
              >
                {open ? <ChevronDown className="size-4 shrink-0 text-[var(--text-subtle)]" /> : <ChevronRight className="size-4 shrink-0 text-[var(--text-subtle)]" />}
                <span className="min-w-0">
                  <span className="block truncate text-[0.875rem] font-semibold text-[var(--text)]">{course.title_bn}</span>
                  <span className="block truncate text-[0.625rem] text-[var(--text-subtle)]">
                    /{course.slug} · {formatNumber(course.subjects.length)} বিষয় ·{" "}
                    {formatNumber(course.subjects.reduce((sum, s) => sum + s.topics.length, 0))} টপিক
                  </span>
                </span>
              </button>
              <Badge tone={course.status === "published" ? "success" : course.status === "archived" ? "neutral" : "warning"}>
                {course.status === "published" ? "প্রকাশিত" : course.status === "archived" ? "আর্কাইভ" : "ড্রাফট"}
              </Badge>
              <button
                type="button"
                onClick={() =>
                  openDraft({
                    entity: "course",
                    id: course.id,
                    values: {
                      slug: course.slug,
                      titleEn: course.title_en,
                      titleBn: course.title_bn,
                      summaryBn: course.summary_bn ?? "",
                      level: course.level,
                      icon: course.icon,
                      accent: course.accent,
                      status: course.status,
                      sortOrder: course.sort_order,
                    },
                  })
                }
                className="rounded-lg p-1.5 text-[var(--text-subtle)] hover:text-[var(--brand)]"
                aria-label={`Edit ${course.title_bn}`}
              >
                <Pencil className="size-3.5" />
              </button>
            </div>

            {open ? (
              <div className="border-t border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-subtle)]">বিষয়</p>
                  <button
                    type="button"
                    onClick={() =>
                      openDraft({
                        entity: "subject",
                        parentId: course.id,
                        values: { slug: "", titleEn: "", titleBn: "", weight: 1, sortOrder: 0, isActive: true },
                      })
                    }
                    className="inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-[var(--brand)] hover:underline"
                  >
                    <Plus className="size-3" aria-hidden /> বিষয় যোগ
                  </button>
                </div>

                {course.subjects.length === 0 ? (
                  <p className="rounded-lg bg-[var(--surface)] px-3 py-2 text-[0.6875rem] text-[var(--text-subtle)]">
                    এই কোর্সে এখনো কোনো বিষয় নেই।
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {course.subjects.map((subject) => {
                      const subjectOpen = expandedSubjects.has(subject.id);
                      return (
                        <li key={subject.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5">
                            <button
                              type="button"
                              onClick={() => toggle(setExpandedSubjects, subject.id)}
                              className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                              aria-expanded={subjectOpen}
                            >
                              {subjectOpen ? <ChevronDown className="size-3 shrink-0 text-[var(--text-subtle)]" /> : <ChevronRight className="size-3 shrink-0 text-[var(--text-subtle)]" />}
                              <span className="truncate text-[0.8125rem] font-medium text-[var(--text)]">{subject.title_bn}</span>
                              <span className="shrink-0 text-[0.5625rem] text-[var(--text-subtle)]">
                                {formatNumber(subject.topics.length)} টপিক
                              </span>
                              {!subject.is_active ? <Badge tone="neutral">নিষ্ক্রিয়</Badge> : null}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                openDraft({
                                  entity: "subject",
                                  id: subject.id,
                                  parentId: course.id,
                                  values: {
                                    slug: subject.slug,
                                    titleEn: subject.title_en,
                                    titleBn: subject.title_bn,
                                    weight: subject.weight,
                                    sortOrder: subject.sort_order,
                                    isActive: subject.is_active,
                                  },
                                })
                              }
                              className="rounded p-1 text-[var(--text-subtle)] hover:text-[var(--brand)]"
                              aria-label={`Edit ${subject.title_bn}`}
                            >
                              <Pencil className="size-3" />
                            </button>
                          </div>

                          {subjectOpen ? (
                            <div className="border-t border-[var(--border)] px-3 py-2">
                              <div className="mb-1.5 flex items-center justify-between">
                                <p className="text-[0.5625rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-subtle)]">টপিক</p>
                                <button
                                  type="button"
                                  onClick={() =>
                                    openDraft({
                                      entity: "topic",
                                      parentId: subject.id,
                                      values: { slug: "", titleEn: "", titleBn: "", sortOrder: 0, isActive: true },
                                    })
                                  }
                                  className="inline-flex items-center gap-0.5 text-[0.625rem] font-semibold text-[var(--brand)]"
                                >
                                  <Plus className="size-2.5" aria-hidden /> যোগ
                                </button>
                              </div>
                              {subject.topics.length === 0 ? (
                                <p className="text-[0.625rem] text-[var(--text-subtle)]">কোনো টপিক নেই।</p>
                              ) : (
                                <ul className="space-y-0.5">
                                  {subject.topics.map((topic) => {
                                    const topicOpen = expandedTopics.has(topic.id);
                                    return (
                                      <li key={topic.id}>
                                        <div className="flex items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => toggle(setExpandedTopics, topic.id)}
                                            className="flex min-w-0 flex-1 items-center gap-1 text-left text-[0.75rem] text-[var(--text-muted)] hover:text-[var(--text)]"
                                            aria-expanded={topicOpen}
                                          >
                                            {topicOpen ? <ChevronDown className="size-2.5" /> : <ChevronRight className="size-2.5" />}
                                            <span className="truncate">{topic.title_bn}</span>
                                            {topic.subtopics.length > 0 ? (
                                              <span className="shrink-0 text-[0.5625rem] text-[var(--text-subtle)]">
                                                ({formatNumber(topic.subtopics.length)})
                                              </span>
                                            ) : null}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              openDraft({
                                                entity: "topic",
                                                id: topic.id,
                                                parentId: subject.id,
                                                values: {
                                                  slug: topic.slug,
                                                  titleEn: topic.title_en,
                                                  titleBn: topic.title_bn,
                                                  sortOrder: topic.sort_order,
                                                  isActive: topic.is_active,
                                                },
                                              })
                                            }
                                            className="rounded p-0.5 text-[var(--text-subtle)] hover:text-[var(--brand)]"
                                            aria-label={`Edit ${topic.title_bn}`}
                                          >
                                            <Pencil className="size-2.5" />
                                          </button>
                                        </div>
                                        {topicOpen ? (
                                          <div className="ml-4 mt-0.5 space-y-0.5 border-l border-[var(--border)] pl-2">
                                            {topic.subtopics.map((subtopic) => (
                                              <div key={subtopic.id} className="flex items-center gap-1">
                                                <span className="min-w-0 flex-1 truncate text-[0.6875rem] text-[var(--text-subtle)]">
                                                  ↳ {subtopic.title_bn}
                                                </span>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    openDraft({
                                                      entity: "subtopic",
                                                      id: subtopic.id,
                                                      parentId: topic.id,
                                                      values: {
                                                        slug: subtopic.slug,
                                                        titleEn: subtopic.title_bn,
                                                        titleBn: subtopic.title_bn,
                                                        sortOrder: subtopic.sort_order,
                                                        isActive: subtopic.is_active,
                                                      },
                                                    })
                                                  }
                                                  className="rounded p-0.5 text-[var(--text-subtle)] hover:text-[var(--brand)]"
                                                  aria-label={`Edit ${subtopic.title_bn}`}
                                                >
                                                  <Pencil className="size-2.5" />
                                                </button>
                                              </div>
                                            ))}
                                            <button
                                              type="button"
                                              onClick={() =>
                                                openDraft({
                                                  entity: "subtopic",
                                                  parentId: topic.id,
                                                  values: { slug: "", titleEn: "", titleBn: "", sortOrder: 0, isActive: true },
                                                })
                                              }
                                              className="inline-flex items-center gap-0.5 text-[0.625rem] font-semibold text-[var(--brand)]"
                                            >
                                              <Plus className="size-2.5" aria-hidden /> সাবটপিক
                                            </button>
                                          </div>
                                        ) : null}
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        );
      })}

      {draft ? (
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 pt-12" role="dialog" aria-modal="true" aria-labelledby="taxonomy-dialog">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 id="taxonomy-dialog" className="text-[0.9375rem] font-semibold text-[var(--text)]">
                  {draft.id ? "সম্পাদনা" : "নতুন যোগ করুন"} —{" "}
                  {draft.entity === "course" ? "কোর্স" : draft.entity === "subject" ? "বিষয়" : draft.entity === "topic" ? "টপিক" : "সাবটপিক"}
                </h2>
                <p className="text-[0.625rem] text-[var(--text-subtle)]">
                  পরিবর্তন সংরক্ষণের সাথে সাথেই পাবলিক সাইটে প্রতিফলিত হয় (ড্রাফট কোর্স ছাড়া)।
                </p>
              </div>
              <button type="button" onClick={() => setDraft(null)} className="rounded-lg p-1 text-[var(--text-subtle)]" aria-label="Close">
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-3 space-y-2.5">
              <Field label="নাম (বাংলা)" required>
                <Input
                  value={String(draft.values.titleBn ?? "")}
                  onChange={(e) => setDraft({ ...draft, values: { ...draft.values, titleBn: e.target.value } })}
                  className="h-9 font-bangla text-[0.8125rem]"
                />
              </Field>
              <Field label="নাম (ইংরেজি)" required>
                <Input
                  value={String(draft.values.titleEn ?? "")}
                  onChange={(e) => setDraft({ ...draft, values: { ...draft.values, titleEn: e.target.value } })}
                  className="h-9 text-[0.8125rem]"
                />
              </Field>

              {draft.entity === "course" || draft.entity === "subject" || draft.entity === "topic" || draft.entity === "subtopic" ? (
                <Field label="Slug (URL)" required hint="শুধু a-z, 0-9, হাইফেন">
                  <Input
                    value={String(draft.values.slug ?? "")}
                    onChange={(e) => setDraft({ ...draft, values: { ...draft.values, slug: e.target.value.toLowerCase() } })}
                    className="h-9 font-mono text-[0.75rem]"
                  />
                </Field>
              ) : null}

              {draft.entity === "course" ? (
                <>
                  <Field label="সারসংক্ষেপ">
                    <Textarea
                      value={String(draft.values.summaryBn ?? "")}
                      onChange={(e) => setDraft({ ...draft, values: { ...draft.values, summaryBn: e.target.value } })}
                      rows={2}
                      className="font-bangla text-[0.8125rem]"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="লেভেল">
                      <select
                        value={String(draft.values.level)}
                        onChange={(e) => setDraft({ ...draft, values: { ...draft.values, level: e.target.value } })}
                        className="jh-select"
                      >
                        <option value="foundation">বেসিক</option>
                        <option value="intermediate">মধ্যম</option>
                        <option value="advanced">উচ্চতর</option>
                      </select>
                    </Field>
                    <Field label="অবস্থা">
                      <select
                        value={String(draft.values.status)}
                        onChange={(e) => setDraft({ ...draft, values: { ...draft.values, status: e.target.value } })}
                        className="jh-select"
                      >
                        <option value="draft">ড্রাফট</option>
                        <option value="published">প্রকাশিত</option>
                        <option value="archived">আর্কাইভ</option>
                      </select>
                    </Field>
                  </div>
                </>
              ) : null}

              {draft.entity === "subject" ? (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="ওজন" hint="১–১০০">
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={String(draft.values.weight ?? 1)}
                      onChange={(e) => setDraft({ ...draft, values: { ...draft.values, weight: Number(e.target.value) } })}
                      className="h-9 text-[0.8125rem]"
                    />
                  </Field>
                  <Field label="সক্রিয়">
                    <select
                      value={String(draft.values.isActive)}
                      onChange={(e) => setDraft({ ...draft, values: { ...draft.values, isActive: e.target.value } })}
                      className="jh-select"
                    >
                      <option value="true">হ্যাঁ</option>
                      <option value="false">না</option>
                    </select>
                  </Field>
                </div>
              ) : null}

              <Field label="ক্রম (sort order)">
                <Input
                  type="number"
                  min={0}
                  value={String(draft.values.sortOrder ?? 0)}
                  onChange={(e) => setDraft({ ...draft, values: { ...draft.values, sortOrder: Number(e.target.value) } })}
                  className="h-9 text-[0.8125rem]"
                />
              </Field>

              {draft.entity !== "course" && draft.entity !== "subject" ? (
                <Field label="সক্রিয়">
                  <select
                    value={String(draft.values.isActive)}
                    onChange={(e) => setDraft({ ...draft, values: { ...draft.values, isActive: e.target.value } })}
                    className="jh-select"
                  >
                    <option value="true">হ্যাঁ</option>
                    <option value="false">না</option>
                  </select>
                </Field>
              ) : null}
            </div>

            {error ? (
              <p role="alert" className="mt-2 flex items-start gap-1.5 text-[0.75rem] font-medium text-[var(--danger)]">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {error}
              </p>
            ) : null}

            <div className="mt-4 flex justify-end gap-2 border-t border-[var(--border)] pt-3">
              <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>বাতিল</Button>
              <Button size="sm" onClick={save} loading={saving}>
                <Save className="size-3.5" aria-hidden />
                সংরক্ষণ
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="jh-label">
        {label} {required ? <span className="text-[var(--danger)]">*</span> : null}
        {hint ? <span className="ml-1 font-normal text-[0.5625rem] text-[var(--text-subtle)]">({hint})</span> : null}
      </span>
      {children}
    </label>
  );
}
