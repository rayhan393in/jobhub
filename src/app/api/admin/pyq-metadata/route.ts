import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerClient } from "@/lib/supabase/server";
import { fromDbError, assertSameOrigin, requireApiPermission } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * PYQ source-metadata backfill (master-prompt Phase 6.2).
 *
 * 70 of the 71 live PYQs lack exam_name / year, so they cannot count toward
 * the strict 70-PYQ quota. This endpoint lets an admin record the REAL
 * metadata — exam name, year, exam type, source reference — question by
 * question. The admin is the source of truth here; nothing is guessed or
 * auto-filled, and a question without a source reference is rejected.
 */

async function guard() {
  const gate = await requireApiPermission("question.review", {
    message: "প্রশ্ন রিভিউয়ের অনুমতি নেই।",
  });
  if ("error" in gate) return gate;
  const supabase = await getServerClient();
  if (!supabase) return { error: NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 }) };
  return { user: gate.user, supabase };
}

export async function GET(request: Request) {
  const ctx = await guard();
  if ("error" in ctx) return ctx.error;
  const { supabase } = ctx;

  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId");
  if (!courseId || !z.string().uuid().safeParse(courseId).success) {
    return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 400 });
  }

  // Approved + verified PYQs whose strict metadata is incomplete.
  const { data, error } = await supabase
    .from("questions")
    .select(
      "id, statement, statement_bn, exam_name, year, question_type, source, source_url, source_title, subject_id, subjects(title_bn), topics(title_bn)",
    )
    .eq("course_id", courseId)
    .eq("source_type", "previous")
    .eq("status", "approved")
    .eq("is_verified", true)
    .is("archived_at", null)
    .or("exam_name.is.null,year.is.null")
    .order("subject_id")
    .limit(200);
  if (error) return fromDbError(error);

  return NextResponse.json(
    { questions: data ?? [], total: (data ?? []).length },
    { headers: { "Cache-Control": "no-store" } },
  );
}

const patchSchema = z.object({
  questionId: z.string().uuid(),
  examName: z.string().trim().min(3).max(200),
  year: z.number().int().min(1972).max(2026),
  questionType: z.enum(["mcq", "written"]),
  sourceUrl: z.string().trim().url().max(500).optional(),
  sourceRef: z.string().trim().min(3).max(300).optional(),
});

export async function PATCH(request: Request) {
  const ctx = await guard();
  if ("error" in ctx) return ctx.error;
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });
  const { user, supabase } = ctx;

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "অবৈধ ডেটা — পরীক্ষার নাম, সাল (১৯৭২–২০২৬) ও ধরন আবশ্যক।" },
      { status: 422 },
    );
  }
  // A PYQ without a recorded source reference stays unusable — on purpose.
  if (!body.sourceUrl && !body.sourceRef) {
    return NextResponse.json(
      { error: "উৎস আবশ্যক — সোর্স URL বা ডকুমেন্ট-রেফারেন্স অন্তত একটি দিন।" },
      { status: 422 },
    );
  }

  const { data: question } = await supabase
    .from("questions")
    .select("id, source_type, status, is_verified")
    .eq("id", body.questionId)
    .maybeSingle();
  if (!question) return NextResponse.json({ error: "প্রশ্ন পাওয়া যায়নি।" }, { status: 404 });
  if (question.source_type !== "previous") {
    return NextResponse.json(
      { error: "এটি PYQ নয় — practice প্রশ্নকে PYQ বানানো যায় না।" },
      { status: 422 },
    );
  }

  const patch: Record<string, unknown> = {
    exam_name: body.examName,
    year: body.year,
    question_type: body.questionType,
    updated_at: new Date().toISOString(),
  };
  if (body.sourceUrl) patch.source_url = body.sourceUrl;
  if (body.sourceRef) patch.source_title = body.sourceRef;

  const { error } = await supabase.from("questions").update(patch).eq("id", body.questionId);
  if (error) return fromDbError(error);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "pyq.metadata_backfill",
    entity_type: "questions",
    entity_id: body.questionId,
    details: { exam_name: body.examName, year: body.year, question_type: body.questionType, source_url: body.sourceUrl ?? null, source_ref: body.sourceRef ?? null },
  });

  return NextResponse.json({ ok: true });
}
