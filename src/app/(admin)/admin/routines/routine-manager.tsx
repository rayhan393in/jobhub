"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, CalendarPlus, Check, Pencil, Printer, Trash2, TriangleAlert, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { formatDate, formatNumber } from "@/lib/format";
import type { AdminRoutine } from "./page";

type Course = { id: string; title_bn: string };
type Subject = { id: string; title_bn: string };
type Topic = {
  id: string;
  title_bn: string;
  subject_id?: string;
  subtopics?: Array<{ id: string; title_bn: string }>;
};

const TASK_KIND_LABELS: Record<string, string> = {
  study: "পড়া",
  practice: "প্র্যাকটিস",
  revision: "রিভিশন",
  exam: "পরীক্ষা",
  rest: "বিশ্রাম",
};

export function RoutineManager({
  routines,
  courses,
  today,
}: {
  routines: AdminRoutine[];
  courses: Course[];
  today: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const [form, setForm] = React.useState({
    courseId: courses[0]?.id ?? "",
    kind: "daily",
    routineDate: today,
    titleBn: "",
    subjectId: "",
    topicIds: [] as string[],
    subtopicIds: [] as string[],
    taskKind: "study",
    minutes: 45,
    focusNoteBn: "",
    status: "draft",
  });
  const [subjects, setSubjects] = React.useState<Subject[]>([]);
  const [topics, setTopics] = React.useState<Topic[]>([]);

  React.useEffect(() => {
    if (!form.courseId) return;
    let cancelled = false;
    (async () => {
      const response = await fetch(`/api/taxonomy?courseId=${form.courseId}`);
      const payload = await response.json();
      if (cancelled) return;
      setSubjects(payload.subjects ?? []);
      setTopics(payload.topics ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [form.courseId]);

  function reset() {
    setForm({
      courseId: courses[0]?.id ?? "",
      kind: "daily",
      routineDate: today,
      titleBn: "",
      subjectId: "",
      topicIds: [],
      subtopicIds: [],
      taskKind: "study",
      minutes: 45,
      focusNoteBn: "",
      status: "draft",
    });
    setEditing(null);
    setCreating(false);
    setError(null);
  }

  function edit(routine: AdminRoutine) {
    setForm({
      courseId: routine.course_id,
      kind: routine.kind,
      routineDate: routine.routine_date,
      titleBn: routine.title_bn,
      subjectId: routine.subject_id ?? "",
      topicIds:
        routine.topic_ids && routine.topic_ids.length > 0
          ? routine.topic_ids
          : routine.topic_id
            ? [routine.topic_id]
            : [],
      subtopicIds: routine.subtopic_ids ?? [],
      taskKind: routine.task_kind ?? "study",
      minutes: routine.minutes,
      focusNoteBn: routine.focus_note_bn ?? "",
      status: routine.status,
    });
    setEditing(routine.id);
    setCreating(true);
    setError(null);
    setNotice(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/routines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing ?? undefined,
          courseId: form.courseId,
          kind: form.kind,
          routineDate: form.routineDate,
          titleBn: form.titleBn,
          subjectId: form.subjectId || null,
          topicId: form.topicIds[0] ?? null,
          topicIds: form.topicIds,
          subtopicIds: form.subtopicIds,
          taskKind: form.taskKind,
          minutes: form.minutes,
          focusNoteBn: form.focusNoteBn,
          status: form.status,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "সংরক্ষণ করা যায়নি।");
        return;
      }
      setNotice(payload.note ?? "সংরক্ষিত হয়েছে।");
      reset();
      router.refresh();
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
    } finally {
      setBusy(false);
    }
  }

  async function archive(id: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/routines", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "আর্কাইভ করা যায়নি।");
        return;
      }
      setNotice("রুটিন আর্কাইভ হয়েছে — শিক্ষার্থীরা আর দেখবে না।");
      router.refresh();
    } catch {
      setError("নেটওয়ার্ক সমস্যা।");
    } finally {
      setBusy(false);
    }
  }

  async function remove(routine: AdminRoutine) {
    const ok = window.confirm(
      `"${routine.title_bn}" স্থায়ীভাবে মুছে ফেলা হবে।\n\nমুছে ফেললে ফেরানো যাবে না। আর্কাইভ করলে শিক্ষার্থীরা দেখতে পাবে না, কিন্তু রেকর্ড থেকে যায়।\n\nতবুও মুছবেন?`,
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/routines", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: routine.id }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "মুছে ফেলা যায়নি।");
        return;
      }
      if (editing === routine.id) reset();
      setNotice(`"${routine.title_bn}" মুছে ফেলা হয়েছে।`);
      router.refresh();
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
    } finally {
      setBusy(false);
    }
  }

  /** Print the current list — the browser's own "Save as PDF" is the PDF path. */
  function printRoutine() {
    window.print();
  }

  const availableTopics = topics.filter((topic) => !form.subjectId || topic.subject_id === form.subjectId);

  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <div className="space-y-3">
        {!creating ? (
          <Button
            size="sm"
            className="w-full"
            onClick={() => {
              setCreating(true);
              setNotice(null);
            }}
          >
            <CalendarPlus className="size-3.5" aria-hidden />
            নতুন রুটিন
          </Button>
        ) : (
          <div className="jh-card p-4">
            <div className="flex items-start justify-between">
              <h2 className="text-[0.8125rem] font-semibold text-[var(--text)]">
                {editing ? "রুটিন সম্পাদনা" : "নতুন রুটিন"}
              </h2>
              <button type="button" onClick={reset} className="rounded p-1 text-[var(--text-subtle)]" aria-label="Close">
                <X className="size-3.5" />
              </button>
            </div>

            <div className="mt-2.5 space-y-2">
              <label className="block">
                <span className="jh-label">কোর্স</span>
                <select
                  value={form.courseId}
                  onChange={(e) => setForm({ ...form, courseId: e.target.value, subjectId: "", topicIds: [], subtopicIds: [] })}
                  className="jh-select"
                >
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>{course.title_bn}</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="jh-label">ধরন</span>
                  <select
                    value={form.kind}
                    onChange={(e) => setForm({ ...form, kind: e.target.value })}
                    className="jh-select"
                  >
                    <option value="daily">দৈনিক</option>
                    <option value="weekly_special">সাপ্তাহিক</option>
                  </select>
                </label>
                <label className="block">
                  <span className="jh-label">তারিখ</span>
                  <Input
                    type="date"
                    value={form.routineDate}
                    onChange={(e) => setForm({ ...form, routineDate: e.target.value })}
                    className="h-[2.15rem] text-[0.75rem]"
                  />
                </label>
              </div>

              <label className="block">
                <span className="jh-label">শিরোনাম</span>
                <Input
                  value={form.titleBn}
                  onChange={(e) => setForm({ ...form, titleBn: e.target.value })}
                  className="h-9 font-bangla text-[0.8125rem]"
                  placeholder="যেমন: বাংলা ব্যাকরণ — সমাস"
                />
              </label>

              <label className="block">
                <span className="jh-label">বিষয়</span>
                <select
                  value={form.subjectId}
                  onChange={(e) => setForm({ ...form, subjectId: e.target.value, topicIds: [], subtopicIds: [] })}
                  className="jh-select"
                >
                  <option value="">নির্বাচন করুন</option>
                  {subjects.map((subject: Subject) => (
                    <option key={subject.id} value={subject.id}>{subject.title_bn}</option>
                  ))}
                </select>
              </label>

              {form.subjectId ? (
                <div className="block">
                  <span className="jh-label">
                    টপিক (একাধিক নির্বাচন করা যায়
                    {form.topicIds.length > 0 ? ` · ${formatNumber(form.topicIds.length)}টি নির্বাচিত` : ""})
                  </span>
                  <div className="max-h-44 space-y-0.5 overflow-y-auto rounded-lg border border-[var(--border)] p-1.5">
                    {availableTopics.length === 0 ? (
                      <p className="px-1 py-0.5 text-[0.6875rem] text-[var(--text-subtle)]">এই বিষয়ে টপিক নেই।</p>
                    ) : (
                      availableTopics.map((topic: Topic) => {
                        const checked = form.topicIds.includes(topic.id);
                        return (
                          <div key={topic.id}>
                            <label className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 hover:bg-[var(--surface-muted)]">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setForm((prev) => ({
                                    ...prev,
                                    topicIds: checked
                                      ? prev.topicIds.filter((id) => id !== topic.id)
                                      : [...prev.topicIds, topic.id],
                                    subtopicIds: checked
                                      ? prev.subtopicIds.filter(
                                          (id) => !(topic.subtopics ?? []).some((sub) => sub.id === id),
                                        )
                                      : prev.subtopicIds,
                                  }))
                                }
                                className="size-3.5 accent-[var(--brand)]"
                              />
                              <span className="truncate font-bangla text-[0.75rem] text-[var(--text)]">
                                {topic.title_bn}
                              </span>
                            </label>
                            {checked && (topic.subtopics ?? []).length > 0 ? (
                              <div className="ml-5 space-y-0.5">
                                {(topic.subtopics ?? []).map((sub) => {
                                  const subChecked = form.subtopicIds.includes(sub.id);
                                  return (
                                    <label
                                      key={sub.id}
                                      className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 hover:bg-[var(--surface-muted)]"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={subChecked}
                                        onChange={() =>
                                          setForm((prev) => ({
                                            ...prev,
                                            subtopicIds: subChecked
                                              ? prev.subtopicIds.filter((id) => id !== sub.id)
                                              : [...prev.subtopicIds, sub.id],
                                          }))
                                        }
                                        className="size-3 accent-[var(--brand)]"
                                      />
                                      <span className="truncate font-bangla text-[0.6875rem] text-[var(--text-muted)]">
                                        {sub.title_bn}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="jh-label">কাজের ধরন</span>
                  <select
                    value={form.taskKind}
                    onChange={(e) => setForm({ ...form, taskKind: e.target.value })}
                    className="jh-select"
                  >
                    {Object.entries(TASK_KIND_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="jh-label">মিনিট</span>
                  <Input
                    type="number"
                    min={5}
                    max={480}
                    value={form.minutes}
                    onChange={(e) => setForm({ ...form, minutes: Number(e.target.value) })}
                    className="h-9 text-[0.8125rem]"
                  />
                </label>
              </div>

              <label className="block">
                <span className="jh-label">অবস্থা</span>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="jh-select"
                >
                  <option value="draft">ড্রাফট</option>
                  <option value="published">প্রকাশিত</option>
                </select>
              </label>

              <label className="block">
                <span className="jh-label">ফোকাস নোট</span>
                <Textarea
                  value={form.focusNoteBn}
                  onChange={(e) => setForm({ ...form, focusNoteBn: e.target.value })}
                  rows={2}
                  className="font-bangla text-[0.75rem]"
                />
              </label>
            </div>

            {error ? (
              <p role="alert" className="mt-2 flex items-start gap-1 text-[0.6875rem] font-medium text-[var(--danger)]">
                <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
                {error}
              </p>
            ) : null}

            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={save} loading={busy} disabled={form.titleBn.trim().length < 2} className="flex-1">
                <Check className="size-3" aria-hidden />
                সংরক্ষণ
              </Button>
              <Button size="sm" variant="ghost" onClick={reset}>বাতিল</Button>
            </div>

            <p className="mt-2 text-[0.5625rem] leading-relaxed text-[var(--text-subtle)]">
              সংরক্ষণ করলে কোনো পরীক্ষা প্রকাশ পাবে না। পরীক্ষা প্রকাশ আলাদা মডিউল থেকে করতে হবে।
            </p>
          </div>
        )}

        {routines.length > 0 ? (
          <button
            type="button"
            onClick={printRoutine}
            className="no-print flex items-center gap-1 text-[0.6875rem] font-medium text-[var(--brand)] hover:underline"
          >
            <Printer className="size-3" aria-hidden />
            রুটিন প্রিন্ট / PDF
          </button>
        ) : null}

        {notice ? (
          <p role="status" className="rounded-lg bg-mint-50 px-2.5 py-2 text-[0.6875rem] font-medium text-mint-800 dark:bg-mint-600/10 dark:text-mint-300">
            {notice}
          </p>
        ) : null}
      </div>

      <div>
        {routines.length === 0 ? (
          <div className="jh-card p-6 text-center">
            <p className="text-[0.8125rem] font-semibold text-[var(--text)]">কোনো রুটিন নেই</p>
            <p className="mt-1 text-[0.6875rem] text-[var(--text-subtle)]">বাঁ দিকের ফর্ম দিয়ে প্রথম রুটিন তৈরি করুন।</p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...new Set(routines.map((r) => r.routine_date))].sort().map((date) => {
              const items = routines.filter((r) => r.routine_date === date);
              const totalMinutes = items.reduce((sum, r) => sum + r.minutes, 0);
              return (
            <section key={date} className="jh-card overflow-hidden">
              <header className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
                <h3 className="text-[0.75rem] font-semibold text-[var(--text)]">
                  {formatDate(`${date}T12:00:00`, "bn", { weekday: "long", day: "numeric", month: "long" })}
                  {date === today ? " · আজ" : ""}
                </h3>
                <span className="text-[0.625rem] text-[var(--text-subtle)]">
                  {formatNumber(items.length)}টি এন্ট্রি · {formatNumber(totalMinutes)} মিনিট
                </span>
              </header>
              <div className="divide-y divide-[var(--border)]">
            {items.map((routine) => (
              <div key={routine.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.75rem] font-medium text-[var(--text)]">
                    {routine.title_bn}
                    {routine.task_kind && routine.task_kind !== "study" ? (
                      <span className="ml-1 text-[0.5625rem] font-semibold text-[var(--brand)]">
                        [{TASK_KIND_LABELS[routine.task_kind] ?? routine.task_kind}]
                      </span>
                    ) : null}
                  </span>
                  <span className="block truncate text-[0.5625rem] text-[var(--text-subtle)]">
                    {routine.subject_title_bn ?? "বিষয় নেই"}
                    {routine.topic_titles_bn && routine.topic_titles_bn.length > 0
                      ? ` · ${routine.topic_titles_bn.join(", ")}`
                      : routine.topic_title_bn
                        ? ` · ${routine.topic_title_bn}`
                        : ""} · {formatNumber(routine.minutes)} মিনিট
                  </span>
                </span>
                <Badge tone={routine.status === "published" ? "success" : routine.status === "draft" ? "warning" : "neutral"}>
                  {routine.status === "published" ? "প্রকাশিত" : routine.status === "draft" ? "ড্রাফট" : routine.status}
                </Badge>
                <button
                  type="button"
                  onClick={() => edit(routine)}
                  className="rounded p-1 text-[var(--text-subtle)] hover:text-[var(--brand)]"
                  aria-label="Edit routine"
                >
                  <Pencil className="size-3" />
                </button>
                {routine.status !== "archived" ? (
                  <button
                    type="button"
                    onClick={() => archive(routine.id)}
                    className="rounded p-1 text-[var(--text-subtle)] hover:text-[var(--danger)]"
                    aria-label="Archive routine"
                    title="আর্কাইভ (রেকর্ড থাকে)"
                  >
                    <Archive className="size-3" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => remove(routine)}
                  disabled={busy}
                  className="no-print rounded p-1 text-[var(--text-subtle)] hover:text-[var(--danger)] disabled:opacity-40"
                  aria-label="Delete routine"
                  title="স্থায়ীভাবে মুছুন"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
              </div>
            </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
