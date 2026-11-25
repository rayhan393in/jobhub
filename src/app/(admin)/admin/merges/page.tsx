import type { Metadata } from "next";
import { GitMerge, ListChecks, Undo2 } from "lucide-react";
import { requirePermission } from "@/lib/permissions";
import { getAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { AdminNote, AdminPageHeader, MiniStat } from "@/components/admin/admin-ui";
import { formatNumber } from "@/lib/format";
import { MergeReview } from "./merge-review";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "মার্জ রিভিউ" };

export type MergeMember = {
  topic_id: string;
  topic_title: string;
  subject_title: string;
  course_slug: string;
  question_count: number;
  routine_count: number;
};

export type MergeRecord = {
  id: string;
  kind: "subject" | "topic";
  canonical_id: string | null;
  canonical_title: string | null;
  member_ids: string[];
  members: MergeMember[];
  status: "proposed" | "applied" | "rejected" | "reverted";
  reason: string | null;
  affected_questions: number;
  affected_routines: number;
  decided_at: string | null;
  created_at: string;
};

/**
 * Merge review centre.
 *
 * Every canonical link — applied automatically by the seeding rule or
 * proposed for ambiguous cases — lives here with its reason and the exact
 * records it touches. Approve links the topics, reject leaves everything
 * untouched, and revert undoes an applied link. No row is ever deleted.
 */
export default async function MergesPage() {
  await requirePermission("taxonomy.manage");

  let merges: MergeRecord[] = [];
  if (isSupabaseConfigured) {
    const supabase = getAdminClient();
    const { data: rows } = await supabase
      .from("taxonomy_merges")
      .select("id, kind, canonical_id, member_ids, status, reason, affected_questions, affected_routines, decided_at, created_at")
      .order("status")
      .order("created_at", { ascending: false })
      .limit(300);

    const base = (rows ?? []) as Array<Omit<MergeRecord, "members" | "canonical_title">>;
    const topicIds = [...new Set(base.filter((merge) => merge.kind === "topic").flatMap((merge) => merge.member_ids))];
    const canonicalIds = [...new Set(base.map((merge) => merge.canonical_id).filter(Boolean))] as string[];

    const [{ data: topicRows }, { data: canonicalRows }] = await Promise.all([
      topicIds.length
        ? supabase
            .from("topics")
            .select("id, title_bn, subjects(title_bn, courses(slug))")
            .in("id", topicIds)
        : Promise.resolve({ data: [] }),
      canonicalIds.length
        ? supabase.from("canonical_topics").select("id, title_bn").in("id", canonicalIds)
        : Promise.resolve({ data: [] }),
    ]);

    const countsByTopic = new Map<string, { q: number; r: number }>();
    if (topicIds.length) {
      const { data: memberCounts } = await supabase
        .from("v_canonical_topic_members")
        .select("topic_id, question_count, routine_count")
        .in("topic_id", topicIds);
      for (const row of (memberCounts ?? []) as Array<{ topic_id: string; question_count: number; routine_count: number }>) {
        countsByTopic.set(row.topic_id, { q: row.question_count, r: row.routine_count });
      }
    }

    type TopicJoin = { id: string; title_bn: string; subjects: { title_bn: string; courses: { slug: string } | null } | null };
    const topicById = new Map(
      ((topicRows ?? []) as unknown as TopicJoin[]).map((topic) => [topic.id, topic]),
    );
    const canonicalById = new Map(
      ((canonicalRows ?? []) as Array<{ id: string; title_bn: string }>).map((canonical) => [canonical.id, canonical.title_bn]),
    );

    merges = base.map((merge) => ({
      ...merge,
      canonical_title: merge.canonical_id ? canonicalById.get(merge.canonical_id) ?? null : null,
      members: merge.member_ids
        .map((topicId) => {
          const topic = topicById.get(topicId);
          if (!topic) return null;
          return {
            topic_id: topicId,
            topic_title: topic.title_bn,
            subject_title: topic.subjects?.title_bn ?? "—",
            course_slug: topic.subjects?.courses?.slug ?? "—",
            question_count: countsByTopic.get(topicId)?.q ?? 0,
            routine_count: countsByTopic.get(topicId)?.r ?? 0,
          };
        })
        .filter(Boolean) as MergeMember[],
    }));
  }

  const proposed = merges.filter((merge) => merge.status === "proposed").length;
  const applied = merges.filter((merge) => merge.status === "applied").length;

  return (
    <div>
      <AdminPageHeader
        eyebrow="ডেটা কোয়ালিটি"
        title="মার্জ রিভিউ"
        description="কোর্সভেদে একই ধারণার টপিকগুলোর ক্যানোনিকাল লিংক — কারণসহ, প্রভাবিত রেকর্ডসহ, রোলব্যাকসহ। মার্জ মানে শুধু লিংক; কোনো টপিক, প্রশ্ন বা আইডি কখনো মুছে যায় না।"
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <MiniStat tone="violet" icon={<ListChecks className="h-4 w-4" />} label="রিভিউর অপেক্ষায়" value={formatNumber(proposed)} />
        <MiniStat tone="emerald" icon={<GitMerge className="h-4 w-4" />} label="প্রয়োগকৃত লিংক" value={formatNumber(applied)} />
        <MiniStat tone="orange" icon={<Undo2 className="h-4 w-4" />} label="মোট রেকর্ড" value={formatNumber(merges.length)} hint="সব সিদ্ধান্তের অডিট ইতিহাস" />
      </div>

      <AdminNote>
        নামের মিল থাকলেই লিংক হয় না — বিসিএসের বেসিক টপিক আর বিশ্ববিদ্যালয় ভর্তির উচ্চতর গণিত আলাদা থাকে।
        অস্পষ্ট গ্রুপগুলো এখানে প্রস্তাব আকারে আসে; অনুমোদন করলে তবেই লিংক হয়।
      </AdminNote>

      <MergeReview merges={merges} />
    </div>
  );
}
