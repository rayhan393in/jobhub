import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getServerClient } from "@/lib/supabase/server";
import { fromDbError } from "@/lib/api";

export const dynamic = "force-dynamic";

const UUID = z.string().uuid();

const createSchema = z.object({
  courseId: UUID,
  subjectId: UUID.nullable().optional(),
  topicId: UUID.nullable().optional(),
  subtopicId: UUID.nullable().optional(),
  statement: z.string().trim().min(8).max(2000),
  options: z.array(z.string().trim().min(1).max(500)).length(4),
  correctOption: z.number().int().min(0).max(3),
  explanation: z.string().trim().max(4000).optional().default(""),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  sourceType: z.enum(["manual", "csv_import", "json_import", "ai_assisted"]).default("manual"),
  sourceRef: z.string().trim().max(300).optional().default(""),
  year: z.number().int().min(1970).max(2100).nullable().optional(),
});

const patchSchema = z.object({
  id: UUID,
  action: z.enum(["update", "approve", "reject", "archive", "restore", "submit"]),
  notes: z.string().trim().max(1000).optional(),
  statement: z.string().trim().min(8).max(2000).optional(),
  options: z.array(z.string().trim().min(1).max(500)).length(4).optional(),
  correctOption: z.number().int().min(0).max(3).optional(),
  explanation: z.string().trim().max(4000).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
});

function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return false;
  return true;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
  if (!can(user.role, "question.edit")) {
    return NextResponse.json({ error: "প্রশ্ন যোগ করার অনুমতি নেই।" }, { status: 403 });
  }
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue ? `${issue.path.join(".")}: ${issue.message}` : "অবৈধ ডেটা।" },
      { status: 422 },
    );
  }

  const data = parsed.data;

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  const { fingerprint } = await import("@/lib/question-text");
  const hash = fingerprint(data.statement);

  // Dedupe guard mirrors the (course_id, fingerprint) unique index so the caller
  // gets a friendly message instead of a raw constraint error.
  const { data: existing } = await supabase
    .from("questions")
    .select("id")
    .eq("course_id", data.courseId)
    .eq("fingerprint", hash)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "একই প্রশ্ন ইতিমধ্যেই এই কোর্সে আছে।", duplicateId: existing.id },
      { status: 409 },
    );
  }

  const { data: inserted, error } = await supabase
    .from("questions")
    .insert({
      course_id: data.courseId,
      subject_id: data.subjectId ?? null,
      topic_id: data.topicId ?? null,
      subtopic_id: data.subtopicId ?? null,
      statement: data.statement,
      option_a: data.options[0],
      option_b: data.options[1],
      option_c: data.options[2],
      option_d: data.options[3],
      correct_option: data.correctOption,
      explanation: data.explanation || "",
      difficulty: data.difficulty,
      source: data.sourceRef || "JobHub editorial",
      source_type: data.sourceType,
      year: data.year ?? null,
      fingerprint: hash,
      status: "draft",
      is_verified: false,
      created_by: user.id,
    })
    .select("id, status")
    .single();

  if (error) return fromDbError(error);
  return NextResponse.json({ question: inserted }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "অবৈধ ডেটা।" }, { status: 422 });
  }
  const { id, action, ...fields } = parsed.data;

  const needsReview = action !== "update" && action !== "submit";
  const permission = needsReview ? "question.review" : "question.edit";
  if (!can(user.role, permission)) {
    return NextResponse.json(
      { error: needsReview ? "রিভিউয়ের অনুমতি নেই।" : "সম্পাদনার অনুমতি নেই।" },
      { status: 403 },
    );
  }

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  if (action === "update" || action === "submit") {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (fields.statement !== undefined) {
      patch.statement = fields.statement;
      const { fingerprint } = await import("@/lib/question-text");
      patch.fingerprint = fingerprint(fields.statement);
    }
    if (fields.options !== undefined) {
      patch.option_a = fields.options[0];
      patch.option_b = fields.options[1];
      patch.option_c = fields.options[2];
      patch.option_d = fields.options[3];
    }
    if (fields.correctOption !== undefined) patch.correct_option = fields.correctOption;
    if (fields.explanation !== undefined) patch.explanation = fields.explanation;
    if (fields.difficulty !== undefined) patch.difficulty = fields.difficulty;
    // Editing content always revokes verification until a human re-approves.
    if (Object.keys(fields).length > 0) {
      patch.status = "pending_review";
      patch.is_verified = false;
    } else if (action === "submit") {
      patch.status = "pending_review";
    }

    const { data, error } = await supabase
      .from("questions")
      .update(patch)
      .eq("id", id)
      .select("id, status, is_verified")
      .single();
    if (error) return fromDbError(error);
    return NextResponse.json({ question: data }, { headers: { "Cache-Control": "no-store" } });
  }

  // Review actions go through the audited RPC so permissions, review history
  // and audit logging happen in one transaction.
  const { data, error } = await supabase.rpc("jh_bulk_review", {
    p_action: action === "restore" ? "restore" : action,
    p_question_ids: [id],
    p_filters: {},
    p_notes: parsed.data.notes ?? null,
  });
  if (error) return fromDbError(error);
  return NextResponse.json({ result: data }, { headers: { "Cache-Control": "no-store" } });
}
