import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/admin/merges — decisions on canonical-topic link proposals.
 *
 * A "merge" here is never a delete: it only sets `topics.canonical_id` so the
 * same concept is recognised across courses. Every decision is recorded on
 * the taxonomy_merges row itself (status, decided_at, merged_by), and an
 * applied link can always be reverted — reverting simply clears
 * `canonical_id` on the member topics. Questions, routines and IDs are never
 * touched.
 */

const bodySchema = z.object({
  action: z.enum(["approve", "reject", "revert"]),
  id: z.string().uuid(),
  /** Canonical title to create when approving a proposal that has none. */
  canonicalTitle: z.string().trim().min(2).max(200).optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
  if (user.role === "student" || !can(user.role, "taxonomy.manage")) {
    return NextResponse.json({ error: "ট্যাক্সোনমি পরিবর্তনের অনুমতি নেই।" }, { status: 403 });
  }
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 422 });
  }

  const supabase = getAdminClient();
  const { data: merge } = await supabase
    .from("taxonomy_merges")
    .select("id, kind, canonical_id, member_ids, status")
    .eq("id", body.id)
    .single();
  if (!merge) return NextResponse.json({ error: "রেকর্ড পাওয়া যায়নি।" }, { status: 404 });

  const record = merge as { id: string; kind: string; canonical_id: string | null; member_ids: string[]; status: string };
  const now = new Date().toISOString();

  const audit = async (action: string, details: Record<string, unknown>) => {
    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action,
      entity_type: "taxonomy_merges",
      entity_id: record.id,
      details: { kind: record.kind, member_ids: record.member_ids, ...details },
    });
  };

  if (body.action === "reject") {
    if (record.status !== "proposed") {
      return NextResponse.json({ error: "শুধু প্রস্তাবিত রেকর্ড বাতিল করা যায়।" }, { status: 409 });
    }
    const { error } = await supabase
      .from("taxonomy_merges")
      .update({ status: "rejected", decided_at: now, merged_by: user.id })
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await audit("merge.reject", {});
    return NextResponse.json({ ok: true });
  }

  if (body.action === "revert") {
    if (record.status !== "applied") {
      return NextResponse.json({ error: "শুধু প্রয়োগকৃত লিংক ফেরানো যায়।" }, { status: 409 });
    }
    if (record.kind === "topic") {
      const { error } = await supabase
        .from("topics")
        .update({ canonical_id: null })
        .in("id", record.member_ids);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await supabase
        .from("subjects")
        .update({ canonical_subject_id: null })
        .in("id", record.member_ids);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const { error } = await supabase
      .from("taxonomy_merges")
      .update({ status: "reverted", reverted_at: now, merged_by: user.id })
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await audit("merge.revert", { canonical_id: record.canonical_id });
    await supabase.rpc("jh_recompute_topic_priorities");
    return NextResponse.json({ ok: true });
  }

  // approve
  if (record.status !== "proposed") {
    return NextResponse.json({ error: "শুধু প্রস্তাবিত রেকর্ড অনুমোদন করা যায়।" }, { status: 409 });
  }

  if (record.kind === "topic") {
    let canonicalId = record.canonical_id;
    if (!canonicalId) {
      if (!body.canonicalTitle) {
        return NextResponse.json({ error: "ক্যানোনিকাল টপিকের নাম দিন।" }, { status: 422 });
      }
      const slug = `ct-m-${record.id.slice(0, 8)}`;
      const { data: canonical, error } = await supabase
        .from("canonical_topics")
        .upsert(
          { slug, title_bn: body.canonicalTitle, title_en: body.canonicalTitle, subject_group: "admin-approved", approval_status: "approved" },
          { onConflict: "slug" },
        )
        .select("id")
        .single();
      if (error || !canonical) return NextResponse.json({ error: error?.message ?? "ক্যানোনিকাল তৈরি ব্যর্থ।" }, { status: 500 });
      canonicalId = (canonical as { id: string }).id;
    }
    const { error: linkError } = await supabase
      .from("topics")
      .update({ canonical_id: canonicalId })
      .in("id", record.member_ids);
    if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });

    const { error } = await supabase
      .from("taxonomy_merges")
      .update({ status: "applied", canonical_id: canonicalId, decided_at: now, merged_by: user.id })
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await audit("merge.approve", { canonical_id: canonicalId });
    await supabase.rpc("jh_recompute_topic_priorities");
    return NextResponse.json({ ok: true });
  }

  // subject merge approval
  let canonicalId = record.canonical_id;
  if (!canonicalId) {
    if (!body.canonicalTitle) {
      return NextResponse.json({ error: "ক্যানোনিকাল বিষয়ের নাম দিন।" }, { status: 422 });
    }
    const slug = `cs-m-${record.id.slice(0, 8)}`;
    const { data: canonical, error } = await supabase
      .from("canonical_subjects")
      .upsert({ slug, title_bn: body.canonicalTitle, title_en: body.canonicalTitle }, { onConflict: "slug" })
      .select("id")
      .single();
    if (error || !canonical) return NextResponse.json({ error: error?.message ?? "ক্যানোনিকাল তৈরি ব্যর্থ।" }, { status: 500 });
    canonicalId = (canonical as { id: string }).id;
  }
  const { error: subjectError } = await supabase
    .from("subjects")
    .update({ canonical_subject_id: canonicalId })
    .in("id", record.member_ids);
  if (subjectError) return NextResponse.json({ error: subjectError.message }, { status: 500 });

  const { error } = await supabase
    .from("taxonomy_merges")
    .update({ status: "applied", canonical_id: canonicalId, decided_at: now, merged_by: user.id })
    .eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await audit("merge.approve", { canonical_id: canonicalId });
  return NextResponse.json({ ok: true });
}
