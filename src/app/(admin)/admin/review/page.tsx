import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCheck, CircleSlash, Clock3, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { listQuestions, type QuestionListRow } from "@/lib/admin-queries";
import { listCourses } from "@/lib/queries";
import { requirePermission } from "@/lib/permissions";
import { formatNumber, relativeFromNow } from "@/lib/format";
import { AdminNote, AdminPageHeader } from "@/components/admin/admin-ui";
import { ReviewActions } from "./review-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "রিভিউ কিউ" };

const STATUS_TABS: { id: string; label: string; icon: React.ReactNode }[] = [
  { id: "pending_review", label: "রিভিউ অপেক্ষায়", icon: <Clock3 className="size-3" aria-hidden /> },
  { id: "draft", label: "ড্রাফট", icon: <Inbox className="size-3" aria-hidden /> },
  { id: "approved", label: "অনুমোদিত", icon: <CheckCheck className="size-3" aria-hidden /> },
  { id: "rejected", label: "বাতিল", icon: <CircleSlash className="size-3" aria-hidden /> },
];

export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; source?: string; page?: string }>;
}) {
  await requirePermission("question.review");
  const params = await searchParams;
  const status = STATUS_TABS.some((tab) => tab.id === params.status) ? params.status! : "pending_review";
  const page = Math.max(1, Number(params.page) || 1);

  const [result, courses] = await Promise.all([
    listQuestions({ status, page, pageSize: 20, sourceType: params.source }),
    listCourses(),
  ]);

  const pages = Math.max(1, Math.ceil(result.total / 20));
  const courseById = new Map(courses.map((c) => [c.id, c]));

  return (
    <div className="mx-auto w-full max-w-5xl">
      <AdminPageHeader
        eyebrow="রিভিউ কিউ"
        title="প্রশ্ন অনুমোদন ও বাতিল"
        description="অনুমোদন = is_verified সত্য হওয়া। AI-সহায়ক প্রশ্নও এখানেই হাতে যাচাই করতে হয় — কোনো স্বয়ংক্রিয় অনুমোদন নেই।"
        action={
          <ButtonLink href="/admin/bulk" variant="secondary" size="sm">
            বাল্ক অ্যাকশন
          </ButtonLink>
        }
      />

      <div className="mb-3 flex flex-wrap gap-1.5">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.id}
            href={`/admin/review?status=${tab.id}`}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[0.75rem] font-semibold transition-colors ${
              status === tab.id
                ? "bg-[var(--brand)] text-white"
                : "bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {tab.icon}
            {tab.label}
          </Link>
        ))}
        {params.source ? (
          <Link
            href={`/admin/review?status=${status}`}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[0.6875rem] font-medium text-[var(--text-subtle)]"
          >
            ফিল্টার: {params.source === "ai_assisted" ? "AI-সহায়ক" : params.source} ✕
          </Link>
        ) : null}
      </div>

      <AdminNote tone="brand">
        রিভিউ কার্যক্রম <code className="text-[0.6875rem]">jh_bulk_review</code> ফাংশনের মাধ্যমে সম্পন্ন হয় — একই
        লেনদেনে status, verified_by, review history ও audit log সংরক্ষিত হয়। অনুমোদনের আগে সঠিক উত্তর
        ও ব্যাখ্যা নিজে যাচাই করুন।
      </AdminNote>

      <div className="mt-4 space-y-2.5">
        {result.rows.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={<CheckCheck className="size-5" />}
              title={status === "pending_review" ? "রিভিউ কিউ খালি" : "এই অবস্থায় কোনো প্রশ্ন নেই"}
              description={
                status === "pending_review"
                  ? "নতুন প্রশ্ন জমা হলে বা ইমপোর্ট করলে এখানে দেখা যাবে।"
                  : "অন্য ট্যাব বেছে দেখুন।"
              }
            />
          </div>
        ) : (
          result.rows.map((question) => (
            <QuestionReviewCard
              key={question.id}
              question={question}
              courseTitle={courseById.get(question.course_id)?.title_bn}
            />
          ))
        )}
      </div>

      {pages > 1 ? (
        <nav className="mt-4 flex items-center justify-between gap-2" aria-label="Pagination">
          <p className="text-[0.6875rem] text-[var(--text-subtle)]">
            পৃষ্ঠা {formatNumber(page)} / {formatNumber(pages)} · মোট {formatNumber(result.total)}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={`/admin/review?status=${status}&page=${page - 1}`}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1 text-[0.6875rem] font-semibold text-[var(--text-muted)]"
              >
                <ArrowLeft className="size-3" aria-hidden /> আগের
              </Link>
            ) : null}
            {page < pages ? (
              <Link
                href={`/admin/review?status=${status}&page=${page + 1}`}
                className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-[0.6875rem] font-semibold text-[var(--text-muted)]"
              >
                পরের →
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}

const OPTION_KEYS = ["ক", "খ", "গ", "ঘ"];

function QuestionReviewCard({ question, courseTitle }: { question: QuestionListRow; courseTitle?: string }) {
  const options = [question.option_a, question.option_b, question.option_c, question.option_d];
  return (
    <article className="jh-card p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge
          tone={
            question.status === "approved"
              ? "success"
              : question.status === "rejected"
                ? "danger"
                : question.status === "pending_review"
                  ? "warning"
                  : "neutral"
          }
        >
          {question.status === "pending_review"
            ? "রিভিউ অপেক্ষায়"
            : question.status === "approved"
              ? "অনুমোদিত"
              : question.status === "rejected"
                ? "বাতিল"
                : question.status === "archived"
                  ? "আর্কাইভ"
                  : "ড্রাফট"}
        </Badge>
        {question.is_verified ? <Badge tone="success">যাচাইকৃত</Badge> : null}
        {question.source_type === "ai_assisted" ? <Badge tone="accent">AI-সহায়ক</Badge> : null}
        <span className="text-[0.625rem] text-[var(--text-subtle)]">
          {courseTitle} · {question.subject?.title_bn ?? "বিষয় নেই"} ·{" "}
          {question.topic?.title_bn ?? "টপিক নেই"} · {relativeFromNow(question.created_at)}
        </span>
      </div>

      <p className="mt-2 font-bangla text-[0.875rem] font-medium leading-[1.85] text-[var(--text)]">
        {question.statement_bn ?? question.statement}
      </p>

      <ul className="mt-2 grid gap-1 sm:grid-cols-2">
        {options.map((option, index) => (
          <li
            key={index}
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[0.75rem] ${
              index === question.correct_option
                ? "border-mint-200 bg-mint-50 font-semibold text-mint-800 dark:border-mint-600/40 dark:bg-mint-600/10 dark:text-mint-300"
                : "border-[var(--border)] text-[var(--text-muted)]"
            }`}
          >
            <span className="flex size-4 items-center justify-center rounded bg-[var(--surface-sunken)] text-[0.5625rem] font-bold">
              {OPTION_KEYS[index]}
            </span>
            {option}
          </li>
        ))}
      </ul>

      {question.explanation ? (
        <p className="mt-2 rounded-lg bg-[var(--surface-muted)] px-2.5 py-1.5 text-[0.6875rem] leading-relaxed text-[var(--text-muted)]">
          <span className="font-semibold">ব্যাখ্যা:</span> {question.explanation}
        </p>
      ) : (
        <p className="mt-2 text-[0.625rem] font-medium text-[var(--danger)]">ব্যাখ্যা নেই — অনুমোদনের আগে যোগ করা উচিত।</p>
      )}

      <ReviewActions questionId={question.id} status={question.status} />
    </article>
  );
}
