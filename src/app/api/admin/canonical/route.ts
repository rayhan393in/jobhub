import { NextResponse } from "next/server";
import { assertSameOrigin, requireApiPermission } from "@/lib/api";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/admin/canonical — the course↔canonical subject mapping surface.
 *
 * Mapping rules (from the central-taxonomy spec):
 *  - linking a course subject to a canonical subject NEVER rewrites the course
 *    subject itself — titles, ordering, marks and weights stay per-course;
 *  - unmapping simply clears the pointer; nothing is merged or deleted;
 *  - a canonical subject that any course subject still points at cannot be
 *    hard-deleted — it is archived (is_active=false) so references survive;
 *  - similar names with different meanings stay unmapped until a human maps
 *    them here deliberately.
 */

const mapSchema = z.object({
  action: z.literal("map"),
  subjectId: z.string().uuid(),
  canonicalSubjectId: z.string().uuid(),
});
const unmapSchema = z.object({ action: z.literal("unmap"), subjectId: z.string().uuid() });
const createSchema = z.object({
  action: z.literal("create"),
  slug: z.string().trim().regex(/^cs-[a-z0-9-]{2,60}$/, "slug must look like cs-example"),
  titleEn: z.string().trim().min(2).max(160),
  titleBn: z.string().trim().min(1).max(160),
});
const archiveSchema = z.object({
  action: z.literal("archive"),
  canonicalSubjectId: z.string().uuid(),
  restore: z.boolean().default(false),
});

const bodySchema = z.discriminatedUnion("action", [mapSchema, unmapSchema, createSchema, archiveSchema]);

export async function POST(request: Request) {
  const guard = await requireApiPermission("taxonomy.manage");
  if ("error" in guard) return guard.error;
  const { user } = guard;
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 422 });
  }

  const supabase = getAdminClient();
  const audit = async (action: string, entityId: string | null, details: Record<string, unknown>) => {
    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action,
      entity_type: "canonical_subjects",
      entity_id: entityId,
      details,
    });
  };

  if (body.action === "map") {
    const { data: canonical } = await supabase
      .from("canonical_subjects")
      .select("id, is_active")
      .eq("id", body.canonicalSubjectId)
      .single();
    if (!canonical) return NextResponse.json({ error: "ক্যানোনিকাল বিষয়টি পাওয়া যায়নি।" }, { status: 404 });
    if (canonical.is_active === false) {
      return NextResponse.json({ error: "আর্কাইভ করা ক্যানোনিকাল বিষয়ে নতুন ম্যাপিং করা যায় না।" }, { status: 409 });
    }
    const { error } = await supabase
      .from("subjects")
      .update({ canonical_subject_id: body.canonicalSubjectId })
      .eq("id", body.subjectId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await audit("canonical.map", body.canonicalSubjectId, { subject_id: body.subjectId });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "unmap") {
    const { error } = await supabase
      .from("subjects")
      .update({ canonical_subject_id: null })
      .eq("id", body.subjectId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await audit("canonical.unmap", null, { subject_id: body.subjectId });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "create") {
    const { data, error } = await supabase
      .from("canonical_subjects")
      .insert({ slug: body.slug, title_en: body.titleEn, title_bn: body.titleBn })
      .select("id")
      .single();
    if (error) {
      const duplicate = error.code === "23505";
      return NextResponse.json(
        { error: duplicate ? "এই slug-এর ক্যানোনিকাল বিষয় ইতিমধ্যে আছে।" : error.message },
        { status: duplicate ? 409 : 400 },
      );
    }
    await audit("canonical.create", data.id, { slug: body.slug, title_en: body.titleEn });
    return NextResponse.json({ ok: true, id: data.id });
  }

  // archive / restore — soft only; mapped subjects keep their pointer.
  const { error } = await supabase
    .from("canonical_subjects")
    .update({ is_active: body.restore, archived_at: body.restore ? null : new Date().toISOString() })
    .eq("id", body.canonicalSubjectId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await audit(body.restore ? "canonical.restore" : "canonical.archive", body.canonicalSubjectId, {});
  return NextResponse.json({ ok: true });
}
