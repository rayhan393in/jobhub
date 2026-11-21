import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bookmark, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";
import { relativeFromNow } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "বুকমার্ক" };

type Row = {
  id: string;
  note: string | null;
  created_at: string;
  question: { id: string; statement_bn: string; subject: { title_bn: string } | null } | null;
};

export default async function BookmarksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await getServerClient();
  let rows: Row[] = [];
  if (supabase) {
    const { data } = await supabase
      .from("bookmarks")
      .select("id, note, created_at, question:questions(id, statement_bn, subject:subjects(title_bn))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    rows = (data ?? []) as unknown as Row[];
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        eyebrow="বুকমার্ক"
        title="সংরক্ষিত প্রশ্ন"
        description="পরীক্ষার সময় বুকমার্ক করা প্রশ্ন এখানে জমা হয় — পরে এগুলো নিয়ে আলাদা প্র্যাকটিস করা যাবে।"
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Bookmark className="size-5" />}
          title="এখনো কোনো বুকমার্ক নেই"
          description="পরীক্ষার সময় 'বুকমার্ক' বোতাম চাপলে প্রশ্ন এখানে সংরক্ষিত হবে।"
          action={
            <ButtonLink href="/practice" size="sm" variant="secondary">
              প্র্যাকটিস শুরু করুন
            </ButtonLink>
          }
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="jh-card p-4">
              <div className="flex items-start gap-2">
                <Bookmark className="mt-0.5 size-3.5 shrink-0 text-[var(--brand)]" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-bangla text-[0.875rem] leading-relaxed text-[var(--text)]">
                    {row.question?.statement_bn ?? "প্রশ্ন আর পাওয়া যায়নি"}
                  </p>
                  <p className="mt-1 text-[0.625rem] text-[var(--text-subtle)]">
                    {row.question?.subject?.title_bn ?? "—"} · {relativeFromNow(row.created_at)}
                  </p>
                  {row.note ? (
                    <p className="mt-1.5 rounded-lg bg-[var(--surface-muted)] px-2.5 py-1.5 text-[0.6875rem] text-[var(--text-muted)]">
                      {row.note}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/dashboard"
        className="mt-4 inline-flex items-center gap-1 text-[0.75rem] font-medium text-[var(--brand)] hover:underline"
      >
        ড্যাশবোর্ডে ফিরুন
        <ArrowRight className="size-3" aria-hidden />
      </Link>
    </div>
  );
}
