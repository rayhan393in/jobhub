import type { Metadata } from "next";
import Link from "next/link";
import {
  BookCopy, CheckCircle2, Clock3, Eye, GraduationCap, Layers,
  Pencil, RotateCcw, Search, SlidersHorizontal, Zap,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { listQuestions, getQuestionBankStats, type QuestionFilters } from "@/lib/admin-queries";
import { listCourses, listSubjects, listTopicsWithSubtopics } from "@/lib/queries";
import { requirePermission } from "@/lib/permissions";
import { formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/cn";
import { NewQuestionDialog } from "./new-question-dialog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "প্রশ্নব্যাংক" };

const STATUS_LABELS: Record<string, string> = {
  draft: "ড্রাফট",
  pending_review: "পেন্ডিং",
  approved: "অনুমোদিত",
  rejected: "বাতিল",
  archived: "আর্কাইভ",
};

/** Status pill palette, mirroring the design system (green/amber/red/gray). */
const STATUS_CHIP: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  pending_review: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  archived: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400",
};

const DIFFICULTY_LABELS: Record<string, string> = { easy: "সহজ", medium: "মধ্যম", hard: "কঠিন" };
const DIFFICULTY_CHIP: Record<string, string> = {
  easy: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  medium: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  hard: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
};

const SOURCE_LABELS: Record<string, string> = {
  manual: "ম্যানুয়াল",
  previous: "পূর্ববর্তী",
  csv_import: "CSV",
  json_import: "JSON",
  ai_assisted: "AI",
};

/** Course chip palette — cycled by index so every course gets a stable hue. */
const COURSE_CHIP = [
  "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
];

export default async function QuestionBankPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission("question.edit");
  const params = await searchParams;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const courseParam = params.course && UUID.test(params.course) ? params.course : undefined;
  const subjectParam = params.subject && UUID.test(params.subject) ? params.subject : undefined;
  const topicParam = params.topic && UUID.test(params.topic) ? params.topic : undefined;
  const filters: QuestionFilters = {
    status: params.status,
    courseId: courseParam,
    subjectId: subjectParam,
    topicId: topicParam,
    difficulty: params.difficulty,
    sourceType: params.source,
    verified: params.verified === "yes" || params.verified === "no" ? params.verified : undefined,
    year: params.year,
    search: params.q,
    sort: params.sort,
    page: Math.max(1, Number(params.page) || 1),
    pageSize: 20,
  };

  const [result, stats, courses, subjects, allTopics] = await Promise.all([
    listQuestions(filters),
    getQuestionBankStats(),
    listCourses(),
    courseParam ? listSubjects(courseParam) : Promise.resolve([]),
    courseParam && subjectParam ? listTopicsWithSubtopics(courseParam) : Promise.resolve([]),
  ]);
  const topics = allTopics.filter((t) => t.subject_id === subjectParam);
  const page = filters.page ?? 1;
  const pages = Math.max(1, Math.ceil(result.total / 20));
  const rangeFrom = result.total === 0 ? 0 : (page - 1) * 20 + 1;
  const rangeTo = Math.min(result.total, page * 20);
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const courseTone = new Map(courses.map((c, i) => [c.id, COURSE_CHIP[i % COURSE_CHIP.length]]));
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => Boolean(value)) as [string, string][],
  );
  const approvedPct = stats.total > 0 ? (stats.approved / stats.total) * 100 : 0;
  const pendingPct = stats.total > 0 ? (stats.pending / stats.total) * 100 : 0;
  const yearOptions = Array.from({ length: 27 }, (_, i) => 2026 - i);

  function hrefWith(next: Record<string, string | undefined>) {
    const search = new URLSearchParams(query);
    for (const [key, value] of Object.entries(next)) {
      if (value) search.set(key, value);
      else search.delete(key);
    }
    return `/admin/questions${search.toString() ? `?${search}` : ""}`;
  }

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* Header — title + primary actions, matching the reference layout */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">
            Dashboard › Question Bank
          </p>
          <h1 className="mt-0.5 text-balance text-[1.25rem] font-bold leading-tight tracking-[-0.03em] text-[var(--text)] sm:text-[1.5rem]">
            Question Bank (প্রশ্ন ব্যাংক)
          </h1>
          <p className="mt-1.5 max-w-2xl text-pretty text-[0.75rem] leading-relaxed text-[var(--text-muted)]">
            সকল কোর্সের প্রশ্ন ব্যবস্থাপনা — শুধু অনুমোদিত ও যাচাইকৃত প্রশ্ন পরীক্ষা বা প্র্যাকটিসে ব্যবহার হয়।
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <NewQuestionDialog courses={courses.map((c) => ({ id: c.id, title_bn: c.title_bn }))} />
          <Link
            href="/admin/bulk"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 text-[0.75rem] font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand)]/40 hover:text-[var(--brand)]"
          >
            <Zap className="size-3.5" aria-hidden />
            বাল্ক অ্যাকশন
          </Link>
        </div>
      </div>

      {/* Stat cards — violet / green / orange / blue gradients from the reference */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50 to-violet-100/60 p-4 dark:border-violet-500/20 dark:from-violet-500/10 dark:to-violet-500/5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[0.6875rem] font-semibold text-violet-700/80 dark:text-violet-300/80">মোট প্রশ্ন</p>
              <p className="mt-1 text-[1.375rem] font-extrabold tabular-nums leading-none text-violet-900 dark:text-violet-200">
                {formatNumber(stats.total)}
              </p>
            </div>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
              <Layers className="size-4" aria-hidden />
            </span>
          </div>
          <p className="mt-2 text-[0.625rem] font-medium text-violet-600/80 dark:text-violet-300/70">
            সব কোর্স মিলিয়ে
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 to-emerald-100/60 p-4 dark:border-emerald-500/20 dark:from-emerald-500/10 dark:to-emerald-500/5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[0.6875rem] font-semibold text-emerald-700/80 dark:text-emerald-300/80">অনুমোদিত প্রশ্ন</p>
              <p className="mt-1 text-[1.375rem] font-extrabold tabular-nums leading-none text-emerald-900 dark:text-emerald-200">
                {formatNumber(stats.approved)}
              </p>
            </div>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <CheckCircle2 className="size-4" aria-hidden />
            </span>
          </div>
          <p className="mt-2 inline-flex rounded-full bg-emerald-600/10 px-2 py-0.5 text-[0.625rem] font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400">
            {formatPercent(approvedPct)}
          </p>
        </div>
        <div className="rounded-2xl border border-orange-200/70 bg-gradient-to-br from-orange-50 to-orange-100/60 p-4 dark:border-orange-500/20 dark:from-orange-500/10 dark:to-orange-500/5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[0.6875rem] font-semibold text-orange-700/80 dark:text-orange-300/80">রিভিউ অপেক্ষমাণ</p>
              <p className="mt-1 text-[1.375rem] font-extrabold tabular-nums leading-none text-orange-900 dark:text-orange-200">
                {formatNumber(stats.pending)}
              </p>
            </div>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white shadow-sm">
              <Clock3 className="size-4" aria-hidden />
            </span>
          </div>
          <p className="mt-2 inline-flex rounded-full bg-orange-600/10 px-2 py-0.5 text-[0.625rem] font-bold text-orange-700 dark:bg-orange-400/10 dark:text-orange-400">
            {formatPercent(pendingPct)}
          </p>
        </div>
        <div className="rounded-2xl border border-sky-200/70 bg-gradient-to-br from-sky-50 to-sky-100/60 p-4 dark:border-sky-500/20 dark:from-sky-500/10 dark:to-sky-500/5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[0.6875rem] font-semibold text-sky-700/80 dark:text-sky-300/80">মোট পরীক্ষা</p>
              <p className="mt-1 text-[1.375rem] font-extrabold tabular-nums leading-none text-sky-900 dark:text-sky-200">
                {formatNumber(stats.exams)}
              </p>
            </div>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm">
              <GraduationCap className="size-4" aria-hidden />
            </span>
          </div>
          <p className="mt-2 text-[0.625rem] font-medium text-sky-600/80 dark:text-sky-300/70">
            প্রকাশিত ও সম্পন্ন
          </p>
        </div>
      </div>

      {/* Course chips — All Courses + one pill per course */}
      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="কোর্স ফিল্টার">
        <Link
          href={hrefWith({ course: undefined, subject: undefined, topic: undefined, page: undefined })}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-[0.75rem] font-semibold transition",
            !courseParam
              ? "bg-[var(--brand)] text-white shadow-[0_6px_16px_-6px_rgba(124,58,237,0.6)]"
              : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--brand)]/40 hover:text-[var(--brand)]",
          )}
        >
          <Layers className="size-3.5" aria-hidden />
          All Courses
        </Link>
        {courses.map((course) => (
          <Link
            key={course.id}
            href={hrefWith({ course: course.id, subject: undefined, topic: undefined, page: undefined })}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-[0.75rem] font-semibold transition",
              courseParam === course.id
                ? "bg-[var(--brand)] text-white shadow-[0_6px_16px_-6px_rgba(124,58,237,0.6)]"
                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--brand)]/40 hover:text-[var(--brand)]",
            )}
          >
            <GraduationCap className="size-3.5" aria-hidden />
            {course.title_bn}
          </Link>
        ))}
      </div>

      {/* Advanced filters */}
      <form method="get" className="jh-card mb-4 overflow-hidden">
        {courseParam ? <input type="hidden" name="course" value={courseParam} /> : null}
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <p className="flex items-center gap-2 text-[0.8125rem] font-semibold text-[var(--text)]">
            <SlidersHorizontal className="size-4 text-[var(--brand)]" aria-hidden />
            উন্নত অনুসন্ধান (Advanced Filters)
          </p>
          {query.toString() ? (
            <Link
              href="/admin/questions"
              className="inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-[var(--text-subtle)] hover:text-[var(--brand)]"
            >
              <RotateCcw className="size-3" aria-hidden />
              ফিল্টার রিসেট
            </Link>
          ) : null}
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-4">
            <label htmlFor="q" className="jh-label">খুঁজুন</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--text-subtle)]" aria-hidden />
              <Input id="q" name="q" defaultValue={params.q} placeholder="প্রশ্ন, টপিক বা কীওয়ার্ড…" className="h-9 pl-8 text-[0.75rem]" />
            </div>
          </div>
          {courseParam ? (
            <div>
              <label htmlFor="subject" className="jh-label">বিষয়</label>
              <select id="subject" name="subject" defaultValue={subjectParam ?? ""} className="jh-select h-9 text-[0.75rem]">
                <option value="">সব বিষয়</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.title_bn}</option>
                ))}
              </select>
            </div>
          ) : null}
          {subjectParam && topics.length > 0 ? (
            <div>
              <label htmlFor="topic" className="jh-label">টপিক</label>
              <select id="topic" name="topic" defaultValue={topicParam ?? ""} className="jh-select h-9 text-[0.75rem]">
                <option value="">সব টপিক</option>
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>{topic.title_bn}</option>
                ))}
              </select>
            </div>
          ) : null}
          <div>
            <label htmlFor="source" className="jh-label">উৎস</label>
            <select id="source" name="source" defaultValue={params.source ?? ""} className="jh-select h-9 text-[0.75rem]">
              <option value="">সব উৎস</option>
              <option value="manual">ম্যানুয়াল</option>
              <option value="previous">পূর্ববর্তী (PYQ)</option>
              <option value="csv_import">CSV</option>
              <option value="json_import">JSON</option>
              <option value="ai_assisted">AI-সহায়ক</option>
            </select>
          </div>
          <div>
            <label htmlFor="difficulty" className="jh-label">কঠিনতার মাত্রা</label>
            <select id="difficulty" name="difficulty" defaultValue={params.difficulty ?? ""} className="jh-select h-9 text-[0.75rem]">
              <option value="">সব মাত্রা</option>
              <option value="easy">সহজ</option>
              <option value="medium">মধ্যম</option>
              <option value="hard">কঠিন</option>
            </select>
          </div>
          <div>
            <label htmlFor="year" className="jh-label">বছর</label>
            <select id="year" name="year" defaultValue={params.year ?? ""} className="jh-select h-9 text-[0.75rem]">
              <option value="">সব বছর</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>{formatNumber(year)}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="status" className="jh-label">স্ট্যাটাস</label>
            <select id="status" name="status" defaultValue={params.status ?? ""} className="jh-select h-9 text-[0.75rem]">
              <option value="">সব স্ট্যাটাস</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="verified" className="jh-label">যাচাই</label>
            <select id="verified" name="verified" defaultValue={params.verified ?? ""} className="jh-select h-9 text-[0.75rem]">
              <option value="">সব</option>
              <option value="yes">যাচাইকৃত</option>
              <option value="no">অযাচাইকৃত</option>
            </select>
          </div>
          <div>
            <label htmlFor="sort" className="jh-label">সাজান</label>
            <select id="sort" name="sort" defaultValue={params.sort ?? ""} className="jh-select h-9 text-[0.75rem]">
              <option value="">নতুন আগে</option>
              <option value="oldest">পুরনো আগে</option>
              <option value="difficulty">কঠিনতা অনুযায়ী</option>
            </select>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--surface-muted)]/60 px-4 py-3">
          <Link
            href="/admin/questions"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 text-[0.75rem] font-semibold text-[var(--text-muted)]"
          >
            <RotateCcw className="size-3" aria-hidden />
            রিসেট
          </Link>
          <button
            type="submit"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[var(--brand)] px-4 text-[0.75rem] font-bold text-white shadow-[0_6px_16px_-6px_rgba(124,58,237,0.6)] transition hover:brightness-110"
          >
            <Search className="size-3.5" aria-hidden />
            অনুসন্ধান করুন
          </button>
        </div>
      </form>

      {/* Result meta */}
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <p className="text-[0.6875rem] text-[var(--text-subtle)]">
          {formatNumber(result.total)}টি প্রশ্ন{matchSummary(params)}
        </p>
        <Link href="/admin/review" className="text-[0.6875rem] font-semibold text-[var(--brand)] hover:underline">
          রিভিউ কিউ →
        </Link>
      </div>

      {result.rows.length === 0 ? (
        <EmptyState
          icon={<BookCopy className="size-5" />}
          title="কোনো প্রশ্ন পাওয়া যায়নি"
          description="ফিল্টার পরিবর্তন করুন, নতুন প্রশ্ন যোগ করুন, অথবা CSV/JSON ইমপোর্ট করুন।"
        />
      ) : (
        <div className="jh-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-[0.5625rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                  <th scope="col" className="px-3 py-2.5 text-center">#</th>
                  <th scope="col" className="px-3 py-2.5">প্রশ্ন</th>
                  <th scope="col" className="px-3 py-2.5">কোর্স</th>
                  <th scope="col" className="px-3 py-2.5">বিষয় / টপিক</th>
                  <th scope="col" className="px-3 py-2.5">উৎস</th>
                  <th scope="col" className="px-3 py-2.5">কঠিনতা</th>
                  <th scope="col" className="px-3 py-2.5">বছর</th>
                  <th scope="col" className="px-3 py-2.5">স্ট্যাটাস</th>
                  <th scope="col" className="px-3 py-2.5 text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {result.rows.map((question, index) => (
                  <tr key={question.id} className="transition-colors hover:bg-[var(--brand-soft)]/40">
                    <td className="px-3 py-3 text-center text-[0.6875rem] font-semibold tabular-nums text-[var(--text-subtle)]">
                      {formatNumber(rangeFrom + index)}
                    </td>
                    <td className="max-w-[20rem] px-3 py-3">
                      <Link
                        href={`/admin/questions/${question.id}`}
                        className="line-clamp-2 font-bangla text-[0.8125rem] font-medium leading-[1.7] text-[var(--text)] hover:text-[var(--brand)]"
                      >
                        {question.statement_bn ?? question.statement}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[0.625rem] font-bold",
                        courseTone.get(question.course_id) ?? COURSE_CHIP[0],
                      )}>
                        {courseById.get(question.course_id)?.title_bn ?? "—"}
                      </span>
                    </td>
                    <td className="max-w-[11rem] px-3 py-3 text-[0.6875rem] text-[var(--text-muted)]">
                      <p className="truncate">{question.subject?.title_bn ?? "—"}</p>
                      <p className="truncate text-[0.5625rem] text-[var(--text-subtle)]">
                        {question.topic?.title_bn ?? ""}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[0.625rem] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                        {SOURCE_LABELS[question.source_type] ?? question.source_type}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[0.625rem] font-semibold",
                        DIFFICULTY_CHIP[question.difficulty] ?? DIFFICULTY_CHIP.medium,
                      )}>
                        {DIFFICULTY_LABELS[question.difficulty] ?? "মধ্যম"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[0.6875rem] tabular-nums text-[var(--text-muted)]">
                      {question.year ? formatNumber(question.year) : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.625rem] font-bold",
                        STATUS_CHIP[question.status] ?? STATUS_CHIP.draft,
                      )}>
                        {STATUS_LABELS[question.status] ?? question.status}
                        {question.is_verified ? <CheckCircle2 className="size-2.5" aria-hidden /> : null}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/questions/${question.id}`}
                          className="rounded-lg p-1.5 text-[var(--text-subtle)] transition hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
                          aria-label="প্রশ্ন দেখুন"
                        >
                          <Eye className="size-3.5" aria-hidden />
                        </Link>
                        <Link
                          href={`/admin/questions/${question.id}`}
                          className="rounded-lg p-1.5 text-[var(--text-subtle)] transition hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
                          aria-label="প্রশ্ন সম্পাদনা"
                        >
                          <Pencil className="size-3.5" aria-hidden />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer: range + numbered pagination */}
          <div className="flex flex-col gap-2 border-t border-[var(--border)] bg-[var(--surface-muted)]/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[0.6875rem] text-[var(--text-subtle)]">
              মোট {formatNumber(result.total)}টি প্রশ্নের মধ্যে {formatNumber(rangeFrom)}–{formatNumber(rangeTo)} দেখানো হচ্ছে
            </p>
            {pages > 1 ? (
              <nav className="flex items-center gap-1" aria-label="Pagination">
                {page > 1 ? (
                  <Link
                    href={hrefWith({ page: String(page - 1) })}
                    className="flex size-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[0.75rem] font-semibold text-[var(--text-muted)] hover:border-[var(--brand)]/40 hover:text-[var(--brand)]"
                    aria-label="আগের পৃষ্ঠা"
                  >
                    ‹
                  </Link>
                ) : null}
                {pageWindow(page, pages).map((item, i) =>
                  item === "…" ? (
                    <span key={`gap-${i}`} className="px-1 text-[0.75rem] text-[var(--text-subtle)]">…</span>
                  ) : (
                    <Link
                      key={item}
                      href={hrefWith({ page: item === 1 ? undefined : String(item) })}
                      aria-current={item === page ? "page" : undefined}
                      className={cn(
                        "flex size-8 items-center justify-center rounded-lg text-[0.75rem] font-semibold tabular-nums transition",
                        item === page
                          ? "bg-[var(--brand)] text-white shadow-[0_4px_12px_-4px_rgba(124,58,237,0.6)]"
                          : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--brand)]/40 hover:text-[var(--brand)]",
                      )}
                    >
                      {formatNumber(item)}
                    </Link>
                  ),
                )}
                {page < pages ? (
                  <Link
                    href={hrefWith({ page: String(page + 1) })}
                    className="flex size-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[0.75rem] font-semibold text-[var(--text-muted)] hover:border-[var(--brand)]/40 hover:text-[var(--brand)]"
                    aria-label="পরের পৃষ্ঠা"
                  >
                    ›
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

/** Compact page-number window: 1 … (p-1) p (p+1) … last. */
function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: (number | "…")[] = [1];
  const from = Math.max(2, current - 1);
  const to = Math.min(total - 1, current + 1);
  if (from > 2) items.push("…");
  for (let i = from; i <= to; i++) items.push(i);
  if (to < total - 1) items.push("…");
  items.push(total);
  return items;
}

function matchSummary(params: Record<string, string | undefined>) {
  const bits: string[] = [];
  if (params.status) bits.push(STATUS_LABELS[params.status] ?? params.status);
  if (params.verified) bits.push(params.verified === "yes" ? "যাচাইকৃত" : "অযাচাইকৃত");
  if (params.year) bits.push(params.year);
  return bits.length ? ` · ${bits.join(" · ")}` : "";
}
