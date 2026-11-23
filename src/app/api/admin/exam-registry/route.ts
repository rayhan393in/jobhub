import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/admin/exam-registry — examinations as first-class records.
 *
 * Honesty rules enforced here AND by the DB check constraint:
 *  - exam_year is optional; an unknown year is stored as NULL and the exam is
 *    marked year_verified=false — a year is never guessed from the name;
 *  - year_verified can only be set when a year is actually present;
 *  - deleting an exam that evidence records point at is refused — archive it
 *    instead so the provenance chain stays intact.
 */

const STAGES = ["preliminary", "written", "viva", "technical", "practical", "other"] as const;

const baseFields = {
  examName: z.string().trim().min(3).max(200),
  examNameBn: z.string().trim().max(200).optional().default(""),
  examBody: z.string().trim().max(120).optional().default(""),
  examYear: z.coerce.number().int().min(1971).max(2100).nullable().optional(),
  examStage: z.enum(STAGES).default("preliminary"),
  positionTitle: z.string().trim().max(200).optional().default(""),
  courseId: z.string().uuid().nullable().optional(),
  yearVerified: z.boolean().default(false),
  sourceUrl: z.string().trim().max(500).optional().default(""),
  notes: z.string().trim().max(1000).optional().default(""),
};

const createSchema = z.object({ action: z.literal("create"), ...baseFields });
const updateSchema = z.object({ action: z.literal("update"), id: z.string().uuid(), ...baseFields });
const statusSchema = z.object({
  action: z.literal("status"),
  id: z.string().uuid(),
  status: z.enum(["draft", "published", "archived"]),
});
const deleteSchema = z.object({ action: z.literal("delete"), id: z.string().uuid() });

const bodySchema = z.discriminatedUnion("action", [createSchema, updateSchema, statusSchema, deleteSchema]);

function makeSlug(name: string, year: number | null | undefined, stage: string) {
  const ascii = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const base = ascii || "exam";
  return `${base}-${year ?? "ny"}-${stage}-${randomBytes(3).toString("hex")}`;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
  if (user.role === "student" || !can(user.role, "question.review")) {
    return NextResponse.json({ error: "পরীক্ষা রেজিস্ট্রি পরিচালনার অনুমতি নেই।" }, { status: 403 });
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
    return NextResponse.json({ error: "অবৈধ ডেটা। পরীক্ষার নাম কমপক্ষে ৩ অক্ষর; সাল দিলে ১৯৭১–২১০০।" }, { status: 422 });
  }

  const supabase = getAdminClient();
  const audit = async (action: string, entityId: string | null, details: Record<string, unknown>) => {
    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action,
      entity_type: "exam_registry",
      entity_id: entityId,
      details,
    });
  };

  if (body.action === "create" || body.action === "update") {
    const year = body.examYear ?? null;
    // Honesty invariant, mirrored from the DB check: no year ⇒ not verifiable.
    if (body.yearVerified && year === null) {
      return NextResponse.json({ error: "সাল ছাড়া year_verified দেওয়া যায় না — আগে যাচাইকৃত সাল লিখুন।" }, { status: 422 });
    }
    const row = {
      exam_name: body.examName,
      exam_name_bn: body.examNameBn || null,
      exam_body: body.examBody || null,
      exam_year: year,
      exam_stage: body.examStage,
      position_title: body.positionTitle || null,
      course_id: body.courseId ?? null,
      year_verified: body.yearVerified,
      source_url: body.sourceUrl || null,
      notes: body.notes || null,
      updated_at: new Date().toISOString(),
    };

    if (body.action === "create") {
      const { data, error } = await supabase
        .from("exam_registry")
        .insert({ ...row, slug: makeSlug(body.examName, year, body.examStage), created_by: user.id })
        .select("id")
        .single();
      if (error) {
        const duplicate = error.code === "23505";
        return NextResponse.json(
          { error: duplicate ? "একই নাম+সাল+ধাপ+পদের পরীক্ষা ইতিমধ্যে রেজিস্ট্রিতে আছে।" : error.message },
          { status: duplicate ? 409 : 400 },
        );
      }
      await audit("exam_registry.create", data.id, { exam_name: body.examName, exam_year: year, exam_stage: body.examStage });
      return NextResponse.json({ ok: true, id: data.id });
    }

    const { error } = await supabase.from("exam_registry").update(row).eq("id", body.id);
    if (error) {
      const duplicate = error.code === "23505";
      return NextResponse.json(
        { error: duplicate ? "একই নাম+সাল+ধাপ+পদের পরীক্ষা ইতিমধ্যে রেজিস্ট্রিতে আছে।" : error.message },
        { status: duplicate ? 409 : 400 },
      );
    }
    await audit("exam_registry.update", body.id, { exam_name: body.examName, exam_year: year, year_verified: body.yearVerified });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "status") {
    const { error } = await supabase
      .from("exam_registry")
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await audit("exam_registry.status", body.id, { status: body.status });
    return NextResponse.json({ ok: true });
  }

  // delete — refused when evidence references the exam; archive instead.
  const { count } = await supabase
    .from("evidence_records")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", body.id);
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: `${count}টি এভিডেন্স রেকর্ড এই পরীক্ষার সাথে যুক্ত — মুছে ফেলা যাবে না, আর্কাইভ করুন।` },
      { status: 409 },
    );
  }
  const { error } = await supabase.from("exam_registry").delete().eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await audit("exam_registry.delete", body.id, {});
  return NextResponse.json({ ok: true });
}
