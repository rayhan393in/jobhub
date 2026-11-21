import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { formatNumber, relativeFromNow } from "@/lib/format";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { QuestionEditor } from "./question-editor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "প্রশ্ন সম্পাদনা" };

export default async function QuestionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("question.edit");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await getServerClient();
  if (!supabase) notFound();

  const [{ data: question }, { data: reviews }] = await Promise.all([
    supabase
      .from("questions")
      .select("*, course:courses(title_bn, slug), subject:subjects(title_bn), topic:topics(title_bn)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("question_reviews")
      .select("id, action, previous_status, new_status, notes, created_at, reviewer:profiles(full_name, full_name_bn)")
      .eq("question_id", id)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  if (!question) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl">
      <AdminPageHeader
        back={{ href: "/admin/questions", label: "প্রশ্নব্যাংক" }}
        eyebrow="প্রশ্ন সম্পাদনা"
        title="প্রশ্নের বিস্তারিত ও রিভিউ ইতিহাস"
        description="যেকোনো সম্পাদনা প্রশ্নটিকে পুনরায় 'রিভিউ অপেক্ষায়' পাঠায় এবং যাচাই-অবস্থা বাতিল করে।"
        action={
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={question.is_verified ? "success" : "warning"}>
              {question.is_verified ? "যাচাইকৃত" : "অযাচাইকৃত"}
            </Badge>
            <Badge tone="neutral">
              {question.status === "pending_review" ? "রিভিউ অপেক্ষায়" : question.status === "approved" ? "অনুমোদিত" : question.status === "rejected" ? "বাতিল" : question.status === "archived" ? "আর্কাইভ" : "ড্রাফট"}
            </Badge>
            {question.source_type === "ai_assisted" ? <Badge tone="accent">AI-সহায়ক</Badge> : null}
          </div>
        }
      />

      <QuestionEditor
        question={{
          id: question.id as string,
          courseTitle: (question.course as { title_bn?: string } | null)?.title_bn ?? "",
          subjectTitle: (question.subject as { title_bn?: string } | null)?.title_bn ?? "",
          topicTitle: (question.topic as { title_bn?: string } | null)?.title_bn ?? "",
          statement: question.statement as string,
          statementBn: (question.statement_bn as string | null) ?? "",
          options: [question.option_a, question.option_b, question.option_c, question.option_d] as string[],
          correctOption: question.correct_option as number,
          explanation: (question.explanation as string) ?? "",
          difficulty: question.difficulty as string,
          sourceType: question.source_type as string,
          status: question.status as string,
          fingerprint: question.fingerprint as string,
          year: question.year as number | null,
          createdAt: question.created_at as string,
        }}
      />

      <section className="jh-card mt-4 p-5" aria-labelledby="history">
        <h2 id="history" className="text-[0.875rem] font-semibold text-[var(--text)]">রিভিউ ইতিহাস</h2>
        {!reviews || reviews.length === 0 ? (
          <p className="mt-2 text-[0.75rem] text-[var(--text-subtle)]">এখনো কোনো রিভিউ হয়নি।</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {reviews.map((review) => (
              <li key={review.id as string} className="flex items-start gap-2 py-2">
                <Badge tone="neutral">{String(review.action)}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.75rem] text-[var(--text)]">
                    {String(review.previous_status ?? "—")} → {String(review.new_status ?? "—")}
                  </p>
                  <p className="text-[0.625rem] text-[var(--text-subtle)]">
                    {(review.reviewer as { full_name_bn?: string; full_name?: string } | null)?.full_name_bn ??
                      (review.reviewer as { full_name?: string } | null)?.full_name ??
                      "সিস্টেম"}{" "}
                    · {relativeFromNow(review.created_at as string)}
                  </p>
                  {review.notes ? (
                    <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-[var(--text-muted)]">{String(review.notes)}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[0.625rem] text-[var(--text-subtle)]">
          ফিঙ্গারপ্রিন্ট: <code className="break-all">{String(question.fingerprint).slice(0, 20)}…</code> ·
          তৈরি {formatNumber(new Date(question.created_at as string).getUTCFullYear())}
        </p>
      </section>
    </div>
  );
}
