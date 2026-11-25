import type { Metadata } from "next";
import Link from "next/link";
import {
  BookCopy, BookOpenCheck, CheckCircle2, ChartPie, Clock3, Download, Eye,
  GraduationCap, History, Landmark, Layers, List, Pencil, PenLine, RotateCcw,
  Search, SlidersHorizontal, Sparkles, TrendingUp, X, XCircle, Zap,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import {
  listQuestions, getQuestionBankStats, getQuestionBankInsights, getQuestionById,
  getQuestionAudit, type QuestionAuditEntry, type QuestionFilters, type QuestionListRow,
} from "@/lib/admin-queries";
import { listCourses, listSubjects, listTopicsWithSubtopics } from "@/lib/queries";
import { requirePermission } from "@/lib/permissions";
import { formatDate, formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import { BulkBar, SelectAllBox } from "./bulk-controls";
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

const KIND_LABELS: Record<string, string> = {
  exact_pyq: "পূর্ববর্তী",
  practice: "প্র্যাকটিস",
  ai_generated: "AI",
};
const KIND_CHIP: Record<string, string> = {
  exact_pyq: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  practice: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  ai_generated: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300",
};

const BULK_ACTION_LABELS: Record<string, string> = {
  approve: "অনুমোদিত হয়েছে",
  reject: "প্রত্যাখ্যাত হয়েছে",
  archive: "আর্কাইভ হয়েছে",
};

/** Course chip palette — cycled by index so every course gets a stable hue. */
const COURSE_CHIP = [
  "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
];

/** Donut + legend palette for the course breakdown chart. */
const DONUT_COLORS = ["#7c3aed", "#0ea5e9", "#10b981", "#f59e0b", "#94a3b8"];

const PAGE_SIZES = [10, 20, 50];

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
  const viewParam = params.view && UUID.test(params.view) ? params.view : undefined;
  const subtopicParam = params.subtopic && UUID.test(params.subtopic) ? params.subtopic : undefined;
  const kindParam =
    params.kind && ["exact_pyq", "practice", "ai_generated"].includes(params.kind)
      ? params.kind
      : undefined;
  const pageSize = PAGE_SIZES.includes(Number(params.ps)) ? Number(params.ps) : 20;
  const filters: QuestionFilters = {
    status: params.status,
    courseId: courseParam,
    subjectId: subjectParam,
    topicId: topicParam,
    difficulty: params.difficulty,
    sourceType: params.source,
    kind: kindParam,
    subtopicId: subtopicParam,
    examName: params.exam,
    verified: params.verified === "yes" || params.verified === "no" ? params.verified : undefined,
    year: params.year,
    search: params.q,
    sort: params.sort,
    page: Math.max(1, Number(params.page) || 1),
    pageSize,
  };

  const courses = await listCourses();
  const [result, stats, insights, subjects, allTopics] = await Promise.all([
    listQuestions(filters),
    getQuestionBankStats(),
    getQuestionBankInsights(courses.map((c) => c.id)),
    courseParam ? listSubjects(courseParam) : Promise.resolve([]),
    courseParam && subjectParam ? listTopicsWithSubtopics(courseParam) : Promise.resolve([]),
  ]);
  const topics = allTopics.filter((t) => t.subject_id === subjectParam);
  const subtopics = topicParam ? allTopics.find((t) => t.id === topicParam)?.subtopics ?? [] : [];
  const page = filters.page ?? 1;
  const pages = Math.max(1, Math.ceil(result.total / pageSize));
  const rangeFrom = result.total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeTo = Math.min(result.total, page * pageSize);
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const courseTone = new Map(courses.map((c, i) => [c.id, COURSE_CHIP[i % COURSE_CHIP.length]]));
  const query = new URLSearchParams(
    Object.entries(params).filter(([key, value]) => Boolean(value) && key !== "bulk") as [string, string][],
  );
  const yearOptions = Array.from({ length: 27 }, (_, i) => 2026 - i);

  function hrefWith(next: Record<string, string | undefined>) {
    const search = new URLSearchParams(query);
    for (const [key, value] of Object.entries(next)) {
      if (value) search.set(key, value);
      else search.delete(key);
    }
    return `/admin/questions${search.toString() ? `?${search}` : ""}`;
  }

  const pct = (part: number) => (stats.total > 0 ? (part / stats.total) * 100 : 0);

  // ---- Six headline stat cards (মোট / পূর্ববর্তী / প্র্যাকটিস / অনুমোদিত / পেন্ডিং / প্রত্যাখ্যাত)
  const statCards = [
    {
      label: "মোট প্রশ্ন", value: stats.total, icon: Layers, note: "সব কোর্স মিলিয়ে", pctOf: null,
      tone: "border-violet-200/70 from-violet-50 to-violet-100/60 dark:border-violet-500/20 dark:from-violet-500/10 dark:to-violet-500/5",
      text: "text-violet-700/80 dark:text-violet-300/80", num: "text-violet-900 dark:text-violet-200",
      iconBg: "bg-violet-600", badge: "bg-violet-600/10 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300",
    },
    {
      label: "পূর্ববর্তী প্রশ্ন", value: stats.previous, icon: Landmark, note: null, pctOf: pct(stats.previous),
      tone: "border-indigo-200/70 from-indigo-50 to-indigo-100/60 dark:border-indigo-500/20 dark:from-indigo-500/10 dark:to-indigo-500/5",
      text: "text-indigo-700/80 dark:text-indigo-300/80", num: "text-indigo-900 dark:text-indigo-200",
      iconBg: "bg-indigo-600", badge: "bg-indigo-600/10 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-300",
    },
    {
      label: "প্র্যাকটিস প্রশ্ন", value: stats.practice, icon: BookOpenCheck, note: null, pctOf: pct(stats.practice),
      tone: "border-teal-200/70 from-teal-50 to-teal-100/60 dark:border-teal-500/20 dark:from-teal-500/10 dark:to-teal-500/5",
      text: "text-teal-700/80 dark:text-teal-300/80", num: "text-teal-900 dark:text-teal-200",
      iconBg: "bg-teal-600", badge: "bg-teal-600/10 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300",
    },
    {
      label: "AI প্রশ্ন", value: stats.ai, icon: Sparkles, note: null, pctOf: pct(stats.ai),
      tone: "border-fuchsia-200/70 from-fuchsia-50 to-fuchsia-100/60 dark:border-fuchsia-500/20 dark:from-fuchsia-500/10 dark:to-fuchsia-500/5",
      text: "text-fuchsia-700/80 dark:text-fuchsia-300/80", num: "text-fuchsia-900 dark:text-fuchsia-200",
      iconBg: "bg-fuchsia-600", badge: "bg-fuchsia-600/10 text-fuchsia-700 dark:bg-fuchsia-400/10 dark:text-fuchsia-300",
    },
    {
      label: "অনুমোদিত", value: stats.approved, icon: CheckCircle2, note: null, pctOf: pct(stats.approved),
      tone: "border-emerald-200/70 from-emerald-50 to-emerald-100/60 dark:border-emerald-500/20 dark:from-emerald-500/10 dark:to-emerald-500/5",
      text: "text-emerald-700/80 dark:text-emerald-300/80", num: "text-emerald-900 dark:text-emerald-200",
      iconBg: "bg-emerald-600", badge: "bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400",
    },
    {
      label: "রিভিউ অপেক্ষমাণ", value: stats.pending, icon: Clock3, note: null, pctOf: pct(stats.pending),
      tone: "border-orange-200/70 from-orange-50 to-orange-100/60 dark:border-orange-500/20 dark:from-orange-500/10 dark:to-orange-500/5",
      text: "text-orange-700/80 dark:text-orange-300/80", num: "text-orange-900 dark:text-orange-200",
      iconBg: "bg-orange-500", badge: "bg-orange-600/10 text-orange-700 dark:bg-orange-400/10 dark:text-orange-400",
    },
    {
      label: "প্রত্যাখ্যাত", value: stats.rejected, icon: XCircle, note: null, pctOf: pct(stats.rejected),
      tone: "border-red-200/70 from-red-50 to-red-100/60 dark:border-red-500/20 dark:from-red-500/10 dark:to-red-500/5",
      text: "text-red-700/80 dark:text-red-300/80", num: "text-red-900 dark:text-red-200",
      iconBg: "bg-red-500", badge: "bg-red-600/10 text-red-700 dark:bg-red-400/10 dark:text-red-400",
    },
  ];

  // ---- Course donut: top 4 courses + "অন্যান্য", drawn with a conic-gradient
  const donutTotal = insights.byCourse.reduce((sum, c) => sum + c.count, 0);
  const topCourses = insights.byCourse.slice(0, 4);
  const otherCount = insights.byCourse.slice(4).reduce((sum, c) => sum + c.count, 0);
  const donutEntries = [
    ...topCourses.map((c, i) => ({
      label: courseById.get(c.courseId)?.title_bn ?? "—",
      count: c.count,
      color: DONUT_COLORS[i],
    })),
    ...(otherCount > 0 ? [{ label: "অন্যান্য", count: otherCount, color: DONUT_COLORS[4] }] : []),
  ];
  let acc = 0;
  const donutStops = donutEntries
    .map((entry) => {
      const from = donutTotal > 0 ? (acc / donutTotal) * 100 : 0;
      acc += entry.count;
      const to = donutTotal > 0 ? (acc / donutTotal) * 100 : 0;
      return `${entry.color} ${from.toFixed(2)}% ${to.toFixed(2)}%`;
    })
    .join(", ");

  // ---- Monthly additions bar chart (last 6 months)
  const monthMax = Math.max(1, ...insights.byMonth.map((m) => m.count));

  // ---- Source breakdown rows
  const otherSources = Math.max(
    0,
    stats.total - stats.previous - stats.manual - stats.ai - stats.imported,
  );
  const sourceRows = [
    { label: "পূর্ববর্তী পরীক্ষা (Actual)", count: stats.previous },
    { label: "ম্যানুয়াল (Admin)", count: stats.manual },
    { label: "AI Generated", count: stats.ai },
    { label: "ইমপোর্টেড (Bulk)", count: stats.imported },
    { label: "অন্যান্য", count: otherSources },
  ];

  // ---- Kind tabs (সব / পূর্ববর্তী / প্র্যাকটিস / AI / ম্যানুয়াল)
  const tabs = [
    {
      key: "all", label: "সব প্রশ্ন", count: stats.total, icon: List,
      href: hrefWith({ source: undefined, kind: undefined, page: undefined }),
      active: !params.source && !kindParam,
    },
    {
      key: "previous", label: "পূর্ববর্তী প্রশ্ন", count: stats.previous, icon: Landmark,
      href: hrefWith({ source: "previous", kind: undefined, page: undefined }),
      active: params.source === "previous" && !kindParam,
    },
    {
      key: "practice", label: "প্র্যাকটিস প্রশ্ন", count: stats.practice, icon: BookOpenCheck,
      href: hrefWith({ kind: "practice", source: undefined, page: undefined }),
      active: kindParam === "practice",
    },
    {
      key: "ai", label: "AI প্রশ্ন", count: stats.ai, icon: Sparkles,
      href: hrefWith({ source: "ai_assisted", kind: undefined, page: undefined }),
      active: params.source === "ai_assisted" && !kindParam,
    },
    {
      key: "manual", label: "ম্যানুয়াল প্রশ্ন", count: stats.manual, icon: PenLine,
      href: hrefWith({ source: "manual", kind: undefined, page: undefined }),
      active: params.source === "manual" && !kindParam,
    },
  ];

  // ---- Detail side panel data (?view=<id>)
  const viewQuestion: QuestionListRow | null = viewParam
    ? result.rows.find((r) => r.id === viewParam) ?? (await getQuestionById(viewParam))
    : null;
  const viewHistory: QuestionAuditEntry[] = viewQuestion ? await getQuestionAudit(viewQuestion.id) : [];
  const bulkFlag = params.bulk;
  const [bulkAction, bulkCount] = bulkFlag?.includes(":") ? bulkFlag.split(":") : [undefined, undefined];

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-7xl",
        viewQuestion && "xl:grid xl:max-w-[100rem] xl:grid-cols-[minmax(0,1fr)_21rem] xl:items-start xl:gap-4",
      )}
    >
      {/* ===================== Detail side panel ===================== */}
      {viewQuestion ? (
        <QuestionDetailPanel
          question={viewQuestion}
          closeHref={hrefWith({ view: undefined })}
          courseTitle={courseById.get(viewQuestion.course_id)?.title_bn ?? "—"}
          history={viewHistory}
        />
      ) : null}

      <div className="min-w-0 xl:order-first">
        {/* Header — title + primary actions, matching the reference layout */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">
              Dashboard › Question Bank
            </p>
            <h1 className="mt-0.5 text-balance text-[1.25rem] font-bold leading-tight tracking-[-0.03em] text-[var(--text)] sm:text-[1.5rem]">
              প্রশ্ন ব্যাংক ব্যবস্থাপনা (Question Bank Management)
            </h1>
            <p className="mt-1.5 max-w-2xl text-pretty text-[0.75rem] leading-relaxed text-[var(--text-muted)]">
              সকল কোর্সের পূর্ববর্তী ও প্র্যাকটিস প্রশ্নের কেন্দ্রীয় ব্যবস্থাপনা — শুধু অনুমোদিত ও যাচাইকৃত প্রশ্ন পরীক্ষায় ব্যবহার হয়।
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
            <Link
              href="/admin/import"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 text-[0.75rem] font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand)]/40 hover:text-[var(--brand)]"
            >
              <Zap className="size-3.5" aria-hidden />
              বাল্ক ইমপোর্ট
            </Link>
            <a
              href={`/api/admin/questions/export${query.toString() ? `?${query}` : ""}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 text-[0.75rem] font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand)]/40 hover:text-[var(--brand)]"
            >
              <Download className="size-3.5" aria-hidden />
              এক্সপোর্ট (CSV)
            </a>
          </div>
        </div>

        {bulkFlag ? (
          <div
            className={cn(
              "mb-4 rounded-xl border px-3.5 py-2.5 text-[0.75rem] font-semibold",
              bulkAction && BULK_ACTION_LABELS[bulkAction]
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                : "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200",
            )}
            role="status"
          >
            {bulkAction && BULK_ACTION_LABELS[bulkAction]
              ? `${formatNumber(Number(bulkCount) || 0)}টি প্রশ্ন ${BULK_ACTION_LABELS[bulkAction]}।`
              : "বাল্ক অ্যাকশন সম্পন্ন করা যায়নি — আবার চেষ্টা করুন।"}
          </div>
        ) : null}

        {/* Stat cards — mockup-এর মতো (মোট / পূর্ববর্তী / প্র্যাকটিস / AI / অনুমোদিত / পেন্ডিং / প্রত্যাখ্যাত) */}
        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className={cn("flex items-center gap-2.5 rounded-xl border bg-gradient-to-br px-3 py-2.5", card.tone)}
              >
                <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg text-white shadow-sm", card.iconBg)}>
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className={cn("truncate text-[0.625rem] font-semibold leading-tight", card.text)}>
                    {card.label}
                  </p>
                  <div className="flex items-baseline gap-1.5">
                    <p className={cn("text-[1rem] font-extrabold tabular-nums leading-tight", card.num)}>
                      {formatNumber(card.value)}
                    </p>
                    {card.pctOf !== null ? (
                      <span className={cn("rounded-full px-1.5 py-px text-[0.5625rem] font-bold", card.badge)}>
                        {formatPercent(card.pctOf)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Analytics row — কোর্স donut · মাসভিত্তিক bar chart · উৎস breakdown */}
        <div className="mb-5 grid gap-3 lg:grid-cols-3">
          {/* Course-wise donut */}
          <div className="jh-card p-4">
            <h2 className="flex items-center gap-1.5 text-[0.75rem] font-bold text-[var(--text)]">
              <ChartPie className="size-3.5 text-[var(--brand)]" aria-hidden />
              কোর্সভিত্তিক প্রশ্ন সংখ্যা
            </h2>
            {donutTotal > 0 ? (
              <div className="mt-3 flex items-center gap-4">
                <div
                  className="relative size-28 shrink-0 rounded-full"
                  style={{ background: `conic-gradient(${donutStops})` }}
                  role="img"
                  aria-label="কোর্সভিত্তিক প্রশ্ন বণ্টন"
                >
                  <div className="absolute inset-[18%] flex flex-col items-center justify-center rounded-full bg-[var(--surface)]">
                    <span className="text-[0.8125rem] font-extrabold tabular-nums text-[var(--text)]">
                      {formatNumber(donutTotal)}
                    </span>
                    <span className="text-[0.5rem] font-medium text-[var(--text-subtle)]">মোট প্রশ্ন</span>
                  </div>
                </div>
                <ul className="min-w-0 flex-1 space-y-1.5">
                  {donutEntries.map((entry) => (
                    <li key={entry.label} className="flex items-center gap-1.5 text-[0.6875rem]">
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-[var(--text-muted)]">{entry.label}</span>
                      <span className="shrink-0 font-bold tabular-nums text-[var(--text)]">
                        {formatPercent((entry.count / donutTotal) * 100)}
                      </span>
                      <span className="shrink-0 text-[0.5625rem] tabular-nums text-[var(--text-subtle)]">
                        ({formatNumber(entry.count)})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-3 text-[0.75rem] text-[var(--text-subtle)]">এখনো কোনো প্রশ্ন নেই।</p>
            )}
          </div>

          {/* Monthly additions */}
          <div className="jh-card p-4">
            <h2 className="flex items-center gap-1.5 text-[0.75rem] font-bold text-[var(--text)]">
              <TrendingUp className="size-3.5 text-[var(--brand)]" aria-hidden />
              মাসভিত্তিক প্রশ্ন সংযোজন
            </h2>
            <div className="mt-3 flex h-28 items-end gap-2" role="img" aria-label="শেষ ৬ মাসে যোগ হওয়া প্রশ্ন">
              {insights.byMonth.map((month, i) => (
                <div key={month.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <span className="text-[0.5625rem] font-bold tabular-nums text-[var(--text-muted)]">
                    {month.count > 0 ? formatNumber(month.count) : ""}
                  </span>
                  <div
                    className={cn(
                      "w-full rounded-t-md",
                      i === insights.byMonth.length - 1
                        ? "bg-[var(--brand)]"
                        : "bg-violet-300/70 dark:bg-violet-500/30",
                    )}
                    style={{ height: `${Math.max(4, (month.count / monthMax) * 100)}%` }}
                  />
                  <span className="text-[0.5625rem] font-medium text-[var(--text-subtle)]">{month.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Source breakdown */}
          <div className="jh-card p-4">
            <h2 className="flex items-center gap-1.5 text-[0.75rem] font-bold text-[var(--text)]">
              <Layers className="size-3.5 text-[var(--brand)]" aria-hidden />
              প্রশ্নের উৎস (Source)
            </h2>
            <ul className="mt-3 space-y-2.5">
              {sourceRows.map((row) => {
                const rowPct = stats.total > 0 ? (row.count / stats.total) * 100 : 0;
                return (
                  <li key={row.label}>
                    <div className="flex items-baseline justify-between gap-2 text-[0.6875rem]">
                      <span className="text-[var(--text-muted)]">{row.label}</span>
                      <span className="font-bold tabular-nums text-[var(--text)]">{formatPercent(rowPct)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                      <div
                        className="h-full rounded-full bg-[var(--brand)]"
                        style={{ width: `${Math.min(100, rowPct)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Course chips — All Courses + one pill per course */}
        <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="কোর্স ফিল্টার">
          <span className="text-[0.6875rem] font-semibold text-[var(--text-subtle)]">কোর্স নির্বাচন:</span>
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
            সব কোর্স (All)
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

        {/* Kind tabs — সব / পূর্ববর্তী / প্র্যাকটিস / AI / ম্যানুয়াল */}
        <div className="mb-4 flex flex-wrap items-center gap-1 border-b border-[var(--border)]" role="tablist" aria-label="প্রশ্নের ধরন">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                role="tab"
                aria-selected={tab.active}
                className={cn(
                  "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[0.75rem] font-semibold transition",
                  tab.active
                    ? "border-[var(--brand)] text-[var(--brand)]"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {tab.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[0.5625rem] font-bold tabular-nums",
                    tab.active
                      ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                      : "bg-[var(--surface-sunken)] text-[var(--text-subtle)]",
                  )}
                >
                  {formatNumber(tab.count)}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Advanced filters */}
        <form method="get" className="jh-card mb-4 overflow-hidden">
          {courseParam ? <input type="hidden" name="course" value={courseParam} /> : null}
          {pageSize !== 20 ? <input type="hidden" name="ps" value={pageSize} /> : null}
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
            <p className="flex items-center gap-2 text-[0.8125rem] font-semibold text-[var(--text)]">
              <SlidersHorizontal className="size-4 text-[var(--brand)]" aria-hidden />
              ফিল্টার ও অনুসন্ধান
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
            {topicParam && subtopics.length > 0 ? (
              <div>
                <label htmlFor="subtopic" className="jh-label">সাবটপিক</label>
                <select id="subtopic" name="subtopic" defaultValue={subtopicParam ?? ""} className="jh-select h-9 text-[0.75rem]">
                  <option value="">সব সাবটপিক</option>
                  {subtopics.map((subtopic) => (
                    <option key={subtopic.id} value={subtopic.id}>{subtopic.title_bn}</option>
                  ))}
                </select>
              </div>
            ) : null}
            <div>
              <label htmlFor="kind" className="jh-label">প্রশ্নের ধরন</label>
              <select id="kind" name="kind" defaultValue={kindParam ?? ""} className="jh-select h-9 text-[0.75rem]">
                <option value="">সব ধরন</option>
                <option value="exact_pyq">পূর্ববর্তী (PYQ)</option>
                <option value="practice">প্র্যাকটিস</option>
                <option value="ai_generated">AI জেনারেটেড</option>
              </select>
            </div>
            <div>
              <label htmlFor="exam" className="jh-label">পরীক্ষার নাম</label>
              <Input id="exam" name="exam" defaultValue={params.exam} placeholder="যেমন: ৪৬তম BCS" className="h-9 text-[0.75rem]" />
            </div>
            <div>
              <label htmlFor="source" className="jh-label">উৎস (Source)</label>
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
              <label htmlFor="year" className="jh-label">পরীক্ষার বছর</label>
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
              <label htmlFor="verified" className="jh-label">যাচাইকরণ অবস্থা</label>
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
          <form method="post" action="/api/admin/questions/table-bulk" className="jh-card overflow-hidden">
            <input type="hidden" name="back" value={hrefWith({})} />
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-muted)]/60 px-3 py-2">
              <BulkBar />
              <p className="text-[0.625rem] text-[var(--text-subtle)]">
                বাল্ক অ্যাকশন অডিট লগসহ এক লেনদেনে চলে — আর্কাইভ পরে পুনরুদ্ধারযোগ্য
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[64rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-[0.5625rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                    <th scope="col" className="w-8 px-3 py-2.5 text-center"><SelectAllBox /></th>
                    <th scope="col" className="px-3 py-2.5 text-center">#</th>
                    <th scope="col" className="px-3 py-2.5">প্রশ্ন</th>
                    <th scope="col" className="px-3 py-2.5">কোর্স</th>
                    <th scope="col" className="px-3 py-2.5">বিষয় / টপিক</th>
                    <th scope="col" className="px-3 py-2.5">ধরন</th>
                    <th scope="col" className="px-3 py-2.5">উৎস</th>
                    <th scope="col" className="px-3 py-2.5">কঠিনতা</th>
                    <th scope="col" className="px-3 py-2.5">বছর</th>
                    <th scope="col" className="px-3 py-2.5">স্ট্যাটাস</th>
                    <th scope="col" className="px-3 py-2.5 text-right">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {result.rows.map((question, index) => (
                    <tr
                      key={question.id}
                      className={cn(
                        "transition-colors hover:bg-[var(--brand-soft)]/40",
                        viewParam === question.id && "bg-[var(--brand-soft)]/50",
                      )}
                    >
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          name="ids"
                          value={question.id}
                          aria-label="প্রশ্ন নির্বাচন করুন"
                          className="size-3.5 accent-[var(--brand)]"
                        />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <p className="text-[0.6875rem] font-semibold tabular-nums text-[var(--text-subtle)]">
                          {formatNumber(rangeFrom + index)}
                        </p>
                        <p className="font-mono text-[0.5rem] uppercase text-[var(--text-subtle)]/70">
                          Q{question.id.slice(0, 6)}
                        </p>
                      </td>
                      <td className="max-w-[20rem] px-3 py-3">
                        <Link
                          href={hrefWith({ view: question.id })}
                          scroll={false}
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
                        <span className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[0.625rem] font-semibold",
                          KIND_CHIP[question.question_kind ?? ""] ?? "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400",
                        )}>
                          {KIND_LABELS[question.question_kind ?? ""] ?? "—"}
                        </span>
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
                            href={hrefWith({ view: question.id })}
                            scroll={false}
                            className={cn(
                              "rounded-lg p-1.5 transition hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]",
                              viewParam === question.id ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "text-[var(--text-subtle)]",
                            )}
                            aria-label="প্রশ্নের বিস্তারিত দেখুন"
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

            {/* Footer: range + page size + numbered pagination */}
            <div className="flex flex-col gap-2 border-t border-[var(--border)] bg-[var(--surface-muted)]/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-[0.6875rem] text-[var(--text-subtle)]">
                  মোট {formatNumber(result.total)}টি প্রশ্নের মধ্যে {formatNumber(rangeFrom)}–{formatNumber(rangeTo)} দেখানো হচ্ছে
                </p>
                <div className="flex items-center gap-1" role="group" aria-label="প্রতি পৃষ্ঠায় প্রশ্ন">
                  {PAGE_SIZES.map((size) => (
                    <Link
                      key={size}
                      href={hrefWith({ ps: size === 20 ? undefined : String(size), page: undefined })}
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[0.625rem] font-bold tabular-nums transition",
                        pageSize === size
                          ? "bg-[var(--brand)] text-white"
                          : "text-[var(--text-subtle)] hover:text-[var(--brand)]",
                      )}
                    >
                      {formatNumber(size)}
                    </Link>
                  ))}
                  <span className="text-[0.625rem] text-[var(--text-subtle)]">/ পেজ</span>
                </div>
              </div>
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
          </form>
        )}
      </div>
    </div>
  );
}

/** Right-hand "প্রশ্নের বিস্তারিত" panel, opened with ?view=<id>. */
function QuestionDetailPanel({
  question,
  closeHref,
  courseTitle,
  history,
}: {
  question: QuestionListRow;
  closeHref: string;
  courseTitle: string;
  history: QuestionAuditEntry[];
}) {
  const options = [
    { letter: "A", text: question.option_a },
    { letter: "B", text: question.option_b },
    { letter: "C", text: question.option_c },
    { letter: "D", text: question.option_d },
  ];
  const correctLetter = ["A", "B", "C", "D"][question.correct_option] ?? "—";
  const meta: { label: string; value: string }[] = [
    { label: "কোর্স", value: courseTitle },
    { label: "বিষয়", value: question.subject?.title_bn ?? "—" },
    { label: "টপিক", value: question.topic?.title_bn ?? "—" },
    { label: "সাবটপিক", value: question.subtopic?.title_bn ?? "—" },
    { label: "ধরন", value: KIND_LABELS[question.question_kind ?? ""] ?? "—" },
    { label: "উৎস", value: SOURCE_LABELS[question.source_type] ?? question.source_type },
    { label: "পরীক্ষা", value: question.exam_name ?? "—" },
    { label: "কঠিনতা", value: DIFFICULTY_LABELS[question.difficulty] ?? "মধ্যম" },
    { label: "বছর", value: question.year ? formatNumber(question.year) : "—" },
    { label: "যাচাই", value: question.is_verified ? "যাচাইকৃত ✓" : "অযাচাইকৃত" },
    { label: "নিবন্ধিত", value: formatDate(question.created_at) },
  ];

  return (
    <aside
      className="mb-4 overflow-hidden rounded-2xl border border-violet-200/70 bg-[var(--surface)] shadow-[0_18px_40px_-18px_rgba(109,40,217,0.35)] dark:border-violet-500/25 xl:sticky xl:top-20 xl:order-last xl:mb-0 xl:max-h-[calc(100dvh-6rem)] xl:overflow-y-auto"
      aria-label="প্রশ্নের বিস্তারিত"
    >
      <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-[#241b63] to-[#4c1d95] px-4 py-3 text-white">
        <h2 className="text-[0.8125rem] font-bold">প্রশ্নের বিস্তারিত</h2>
        <Link
          href={closeHref}
          scroll={false}
          className="rounded-lg p-1 text-violet-200 transition hover:bg-white/10 hover:text-white"
          aria-label="প্যানেল বন্ধ করুন"
        >
          <X className="size-4" aria-hidden />
        </Link>
      </div>

      <div className="p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[0.625rem] font-bold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
            {SOURCE_LABELS[question.source_type] ?? question.source_type}
          </span>
          <span className={cn(
            "inline-flex rounded-full px-2 py-0.5 text-[0.625rem] font-bold",
            STATUS_CHIP[question.status] ?? STATUS_CHIP.draft,
          )}>
            {STATUS_LABELS[question.status] ?? question.status}
          </span>
          <span className="ml-auto font-mono text-[0.5625rem] uppercase text-[var(--text-subtle)]">
            ID: Q{question.id.slice(0, 6)}
          </span>
        </div>

        <p className="mt-3 text-[0.625rem] font-bold uppercase tracking-wide text-[var(--text-subtle)]">প্রশ্ন:</p>
        <p className="font-bangla mt-1 text-[0.8125rem] font-medium leading-[1.8] text-[var(--text)]">
          {question.statement_bn ?? question.statement}
        </p>

        <ul className="mt-3 space-y-1.5">
          {options.map((option, i) => {
            const correct = i === question.correct_option;
            return (
              <li
                key={option.letter}
                className={cn(
                  "flex items-start gap-2 rounded-xl border px-2.5 py-2 text-[0.75rem] leading-relaxed",
                  correct
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                    : "border-[var(--border)] text-[var(--text-muted)]",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-bold",
                    correct ? "bg-emerald-600 text-white" : "bg-[var(--surface-sunken)] text-[var(--text-subtle)]",
                  )}
                >
                  {option.letter}
                </span>
                <span className="font-bangla min-w-0 flex-1">{option.text}</span>
                {correct ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden /> : null}
              </li>
            );
          })}
        </ul>

        <p className="mt-2 inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[0.6875rem] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckCircle2 className="size-3" aria-hidden />
          সঠিক উত্তর: {correctLetter}
        </p>

        {question.explanation ? (
          <div className="mt-3 rounded-xl bg-[var(--surface-muted)] p-3">
            <p className="text-[0.625rem] font-bold uppercase tracking-wide text-[var(--text-subtle)]">💡 ব্যাখ্যা:</p>
            <p className="font-bangla mt-1 text-[0.75rem] leading-[1.8] text-[var(--text-muted)]">
              {question.explanation}
            </p>
          </div>
        ) : null}

        <div className="mt-3 rounded-xl border border-[var(--border)] p-3">
          <p className="text-[0.625rem] font-bold uppercase tracking-wide text-[var(--text-subtle)]">মেটাডাটা</p>
          <dl className="mt-1.5 space-y-1">
            {meta.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-2 text-[0.6875rem]">
                <dt className="shrink-0 text-[var(--text-subtle)]">{row.label}:</dt>
                <dd className="min-w-0 truncate text-right font-semibold text-[var(--text)]">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-3 rounded-xl border border-[var(--border)] p-3">
          <p className="flex items-center gap-1 text-[0.625rem] font-bold uppercase tracking-wide text-[var(--text-subtle)]">
            <History className="size-3" aria-hidden />
            সংস্করণ ইতিহাস (Version History)
          </p>
          {history.length === 0 ? (
            <p className="mt-1.5 text-[0.6875rem] text-[var(--text-subtle)]">
              এই প্রশ্নে এখনো কোনো পরিবর্তনের রেকর্ড নেই।
            </p>
          ) : (
            <ol className="mt-1.5 space-y-1.5">
              {history.map((entry, i) => (
                <li key={entry.id} className="flex items-start gap-2 text-[0.6875rem]">
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[0.5rem] font-bold text-[var(--brand)]">
                    {formatNumber(history.length - i)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-[var(--text)]">{entry.action}</span>
                    <span className="block text-[0.5625rem] text-[var(--text-subtle)]">
                      {formatDateTime(entry.created_at)}
                      {entry.actor_role ? ` · ${entry.actor_role}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Link
            href={`/admin/questions/${question.id}`}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--brand)] text-[0.75rem] font-bold text-white shadow-[0_6px_16px_-6px_rgba(124,58,237,0.6)] transition hover:brightness-110"
          >
            <Pencil className="size-3.5" aria-hidden />
            সম্পাদনা
          </Link>
          <Link
            href={closeHref}
            scroll={false}
            className="inline-flex h-9 items-center justify-center rounded-xl border border-[var(--border)] px-3.5 text-[0.75rem] font-semibold text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            বন্ধ করুন
          </Link>
        </div>
      </div>
    </aside>
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
