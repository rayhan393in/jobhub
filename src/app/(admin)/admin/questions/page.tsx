import type { Metadata } from "next";
import Link from "next/link";
import { BookCopy, Filter, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { listQuestions, type QuestionFilters } from "@/lib/admin-queries";
import { listCourses, listSubjects, listTopicsWithSubtopics } from "@/lib/queries";
import { requirePermission } from "@/lib/permissions";
import { formatNumber } from "@/lib/format";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { NewQuestionDialog } from "./new-question-dialog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "প্রশ্নব্যাংক" };

const STATUS_LABELS: Record<string, string> = {
  draft: "ড্রাফট",
  pending_review: "রিভিউ অপেক্ষায়",
  approved: "অনুমোদিত",
  rejected: "বাতিল",
  archived: "আর্কাইভ",
};

const STATUS_TONE: Record<string, "neutral" | "warning" | "success" | "danger"> = {
  draft: "neutral",
  pending_review: "warning",
  approved: "success",
  rejected: "danger",
  archived: "neutral",
};

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
    search: params.q,
    sort: params.sort,
    page: Math.max(1, Number(params.page) || 1),
    pageSize: 20,
  };

  const [result, courses, subjects, allTopics] = await Promise.all([
    listQuestions(filters),
    listCourses(),
    courseParam ? listSubjects(courseParam) : Promise.resolve([]),
    courseParam && subjectParam ? listTopicsWithSubtopics(courseParam) : Promise.resolve([]),
  ]);
  const topics = allTopics.filter((t) => t.subject_id === subjectParam);
  const pages = Math.max(1, Math.ceil(result.total / 20));
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => Boolean(value)) as [string, string][],
  );

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
      <AdminPageHeader
        eyebrow="প্রশ্নব্যাংক"
        title="সব প্রশ্ন — অনুসন্ধান, ফিল্টার, সম্পাদনা"
        description="শুধু অনুমোদিত ও যাচাইকৃত প্রশ্ন পরীক্ষা বা প্র্যাকটিসে ব্যবহার হয়। সম্পাদনা করলে যাচাই-অবস্থা স্বয়ংক্রিয়ভাবে বাতিল হয়ে পুনরায় রিভিউতে যায়।"
        action={<NewQuestionDialog courses={courses.map((c) => ({ id: c.id, title_bn: c.title_bn }))} />}
      />

      <form method="get" className="jh-card mb-4 flex flex-wrap items-end gap-2 p-3">
        <div className="min-w-0 flex-1 sm:min-w-[14rem]">
          <label htmlFor="q" className="jh-label">খুঁজুন</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--text-subtle)]" aria-hidden />
            <Input id="q" name="q" defaultValue={params.q} placeholder="প্রশ্নের অংশ…" className="h-9 pl-8 text-[0.75rem]" />
          </div>
        </div>
        <div>
          <label htmlFor="status" className="jh-label">অবস্থা</label>
          <select id="status" name="status" defaultValue={params.status ?? ""} className="jh-select h-9 text-[0.75rem]">
            <option value="">সব</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="course" className="jh-label">কোর্স</label>
          <select id="course" name="course" defaultValue={params.course ?? ""} className="jh-select h-9 text-[0.75rem]">
            <option value="">সব</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>{course.title_bn}</option>
            ))}
          </select>
        </div>
        {courseParam ? (
          <div>
            <label htmlFor="subject" className="jh-label">বিষয়</label>
            <select id="subject" name="subject" defaultValue={subjectParam ?? ""} className="jh-select h-9 text-[0.75rem]">
              <option value="">সব</option>
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
              <option value="">সব</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>{topic.title_bn}</option>
              ))}
            </select>
          </div>
        ) : null}
        <div>
          <label htmlFor="verified" className="jh-label">যাচাই</label>
          <select id="verified" name="verified" defaultValue={params.verified ?? ""} className="jh-select h-9 text-[0.75rem]">
            <option value="">সব</option>
            <option value="yes">যাচাইকৃত</option>
            <option value="no">অযাচাইকৃত</option>
          </select>
        </div>
        <div>
          <label htmlFor="source" className="jh-label">উৎস</label>
          <select id="source" name="source" defaultValue={params.source ?? ""} className="jh-select h-9 text-[0.75rem]">
            <option value="">সব</option>
            <option value="manual">ম্যানুয়াল</option>
            <option value="csv_import">CSV</option>
            <option value="json_import">JSON</option>
            <option value="ai_assisted">AI-সহায়ক</option>
          </select>
        </div>
        <div>
          <label htmlFor="difficulty" className="jh-label">কঠিনতা</label>
          <select id="difficulty" name="difficulty" defaultValue={params.difficulty ?? ""} className="jh-select h-9 text-[0.75rem]">
            <option value="">সব</option>
            <option value="easy">সহজ</option>
            <option value="medium">মধ্যম</option>
            <option value="hard">কঠিন</option>
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
        <button
          type="submit"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 text-[0.75rem] font-semibold text-white"
        >
          <Filter className="size-3" aria-hidden />
          ফিল্টার
        </button>
        {query.toString() ? (
          <Link href="/admin/questions" className="text-[0.6875rem] font-medium text-[var(--text-subtle)] hover:text-[var(--brand)]">
            রিসেট
          </Link>
        ) : null}
      </form>

      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <p className="text-[0.6875rem] text-[var(--text-subtle)]">
          {formatNumber(result.total)}টি প্রশ্ন{matchSummary(params)}
        </p>
        <Link href="/admin/bulk" className="text-[0.6875rem] font-semibold text-[var(--brand)] hover:underline">
          বাল্ক অ্যাকশন →
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
          <div className="hidden grid-cols-[minmax(0,1fr)_8rem_7rem_6rem] gap-3 border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2 text-[0.5625rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)] sm:grid">
            <span>প্রশ্ন</span>
            <span>কোর্স / বিষয়</span>
            <span>অবস্থা</span>
            <span className="text-right">উৎস</span>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {result.rows.map((question) => (
              <li key={question.id} className="grid grid-cols-1 gap-1.5 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_8rem_7rem_6rem] sm:items-center sm:gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/admin/questions/${question.id}`}
                    className="line-clamp-2 font-bangla text-[0.8125rem] font-medium leading-[1.7] text-[var(--text)] hover:text-[var(--brand)]"
                  >
                    {question.statement_bn ?? question.statement}
                  </Link>
                  <p className="mt-0.5 text-[0.5625rem] text-[var(--text-subtle)]">
                    {question.difficulty === "easy" ? "সহজ" : question.difficulty === "hard" ? "কঠিন" : "মধ্যম"}
                    {question.year ? ` · ${formatNumber(question.year)}` : ""}
                  </p>
                </div>
                <div className="min-w-0 text-[0.6875rem] text-[var(--text-muted)]">
                  <p className="truncate">{courseById.get(question.course_id)?.title_bn}</p>
                  <p className="truncate text-[0.5625rem] text-[var(--text-subtle)]">
                    {question.subject?.title_bn}
                    {question.topic?.title_bn ? ` · ${question.topic.title_bn}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Badge tone={STATUS_TONE[question.status] ?? "neutral"}>{STATUS_LABELS[question.status]}</Badge>
                  {question.is_verified ? <Badge tone="success">✓</Badge> : null}
                </div>
                <div className="text-[0.625rem] text-[var(--text-subtle)] sm:text-right">
                  {question.source_type === "ai_assisted"
                    ? "AI"
                    : question.source_type === "csv_import"
                      ? "CSV"
                      : question.source_type === "json_import"
                        ? "JSON"
                        : "ম্যানুয়াল"}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pages > 1 ? (
        <nav className="mt-3 flex items-center justify-between" aria-label="Pagination">
          <span className="text-[0.6875rem] text-[var(--text-subtle)]">
            পৃষ্ঠা {formatNumber(filters.page ?? 1)} / {formatNumber(pages)}
          </span>
          <div className="flex gap-2">
            {Number(filters.page) > 1 ? (
              <Link href={hrefWith({ page: String((filters.page ?? 1) - 1) })} className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-[0.6875rem] font-semibold text-[var(--text-muted)]">
                ← আগের
              </Link>
            ) : null}
            {Number(filters.page) < pages ? (
              <Link href={hrefWith({ page: String((filters.page ?? 1) + 1) })} className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-[0.6875rem] font-semibold text-[var(--text-muted)]">
                পরের →
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}

function matchSummary(params: Record<string, string | undefined>) {
  const bits: string[] = [];
  if (params.status) bits.push(STATUS_LABELS[params.status] ?? params.status);
  if (params.verified) bits.push(params.verified === "yes" ? "যাচাইকৃত" : "অযাচাইকৃত");
  return bits.length ? ` · ${bits.join(" · ")}` : "";
}
