import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getAdminClient } from "@/lib/supabase/admin";
import { parseCsvRows } from "@/lib/routines/parse";
import {
  normaliseStatement,
  pick,
  STATEMENT_ALIASES,
  validateEvidenceCsv,
  type MatchedQuestion,
} from "@/lib/evidence/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/admin/evidence — the previous-year evidence engine's write path.
 *
 * Ground rules (from the data-quality spec):
 *  - evidence is only ever recorded with BOTH an exam name and an exam year;
 *    a row missing either is rejected, never inferred from the question text;
 *  - adding evidence never changes the question row itself — flipping a
 *    question to source_type='previous' stays an explicit, separate admin act
 *    (and the DB trigger refuses it without an evidence record);
 *  - CSV rows that do not match an existing question can OPTIONALLY create a
 *    new DRAFT question (unverified, pending review) when the row carries the
 *    full question body; otherwise the row is reported back as unmatched;
 *  - every mutation is written to audit_logs with the acting admin.
 */

const matchKind = z.enum(["exact", "same_concept", "related"]);

const addSchema = z.object({
  action: z.literal("add"),
  questionId: z.string().uuid(),
  examName: z.string().trim().min(2).max(160),
  examYear: z.coerce.number().int().min(1971).max(2100),
  matchKind: matchKind.default("exact"),
  sourceRef: z.string().trim().max(300).optional().default(""),
  sourceUrl: z.string().trim().max(500).optional().default(""),
  originalText: z.string().trim().max(2000).optional().default(""),
});

const deleteSchema = z.object({
  action: z.literal("delete"),
  id: z.string().uuid(),
});

const bulkSchema = z.object({
  action: z.literal("bulk"),
  courseId: z.string().uuid(),
  csv: z.string().min(1).max(2_000_000),
  dryRun: z.boolean().default(true),
});

const bodySchema = z.discriminatedUnion("action", [addSchema, deleteSchema, bulkSchema]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
  if (user.role === "student" || !can(user.role, "question.review")) {
    return NextResponse.json({ error: "এভিডেন্স যাচাইয়ের অনুমতি নেই।" }, { status: 403 });
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
    return NextResponse.json({ error: "অবৈধ ডেটা। পরীক্ষার নাম ও সাল (১৯৭১–২১০০) উভয়ই বাধ্যতামূলক।" }, { status: 422 });
  }

  const supabase = getAdminClient();

  const audit = async (action: string, entityId: string | null, details: Record<string, unknown>) => {
    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action,
      entity_type: "evidence_records",
      entity_id: entityId,
      details,
    });
  };

  if (body.action === "delete") {
    const { data: existing } = await supabase
      .from("evidence_records")
      .select("question_id, exam_name, exam_year")
      .eq("id", body.id)
      .single();
    const { error } = await supabase.from("evidence_records").delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await audit("evidence.delete", body.id, existing ?? {});
    await supabase.rpc("jh_recompute_topic_priorities");
    return NextResponse.json({ ok: true });
  }

  if (body.action === "add") {
    // Link to the exam registry when a record with the SAME name+year already
    // exists there — never created implicitly, so the registry stays curated.
    const { data: registryMatch } = await supabase
      .from("exam_registry")
      .select("id")
      .ilike("exam_name", body.examName)
      .eq("exam_year", body.examYear)
      .limit(1)
      .maybeSingle();

    const { data: inserted, error } = await supabase
      .from("evidence_records")
      .insert({
        question_id: body.questionId,
        exam_name: body.examName,
        exam_year: body.examYear,
        match_kind: body.matchKind,
        source_ref: body.sourceRef || null,
        source_url: body.sourceUrl || null,
        original_text: body.originalText || null,
        verified_by: user.id,
        exam_id: (registryMatch as { id: string } | null)?.id ?? null,
      })
      .select("id")
      .single();
    if (error) {
      const friendly = error.code === "23505"
        ? "এই প্রশ্নের জন্য এই পরীক্ষা+সালের এভিডেন্স আগেই আছে।"
        : error.message;
      return NextResponse.json({ error: friendly }, { status: 409 });
    }
    await audit("evidence.add", (inserted as { id: string } | null)?.id ?? null, {
      question_id: body.questionId,
      exam_name: body.examName,
      exam_year: body.examYear,
      match_kind: body.matchKind,
      exam_id: (registryMatch as { id: string } | null)?.id ?? null,
    });
    await supabase.rpc("jh_recompute_topic_priorities");
    return NextResponse.json({ ok: true });
  }

  // ---- bulk CSV ----
  const rawRows = parseCsvRows(body.csv);
  if (rawRows.length === 0) return NextResponse.json({ error: "CSV-তে কোনো সারি নেই।" }, { status: 422 });
  if (rawRows.length > 2000) return NextResponse.json({ error: "একবারে সর্বোচ্চ ২০০০ সারি।" }, { status: 422 });

  // Resolve statements against the live question bank of this course.
  const statements = rawRows.map((row) => normaliseStatement(pick(row, STATEMENT_ALIASES)));
  const uniqueStatements = [...new Set(statements.filter((statement) => statement.length >= 8))];

  const byStatement = new Map<string, MatchedQuestion>();
  for (let i = 0; i < uniqueStatements.length; i += 100) {
    const slice = uniqueStatements.slice(i, i + 100);
    const { data } = await supabase
      .from("questions")
      .select("id, statement, source_type")
      .eq("course_id", body.courseId)
      .in("statement", slice);
    for (const question of (data ?? []) as Array<{ id: string; statement: string; source_type: string }>) {
      byStatement.set(normaliseStatement(question.statement), { id: question.id, source_type: question.source_type });
    }
  }

  const { verdicts, evidenceInserts, draftInserts, summary } = validateEvidenceCsv(rawRows, byStatement);

  if (body.dryRun) {
    return NextResponse.json({ ok: true, dryRun: true, summary, verdicts });
  }
  if (summary.matched + summary.drafts === 0) {
    return NextResponse.json({ error: "কোনো বৈধ সারি নেই।", summary, verdicts }, { status: 422 });
  }

  let inserted = 0;
  let createdDrafts = 0;
  const failures: Array<{ row: number; reason: string }> = [];

  if (evidenceInserts.length > 0) {
    const payload = evidenceInserts.map((record) => ({ ...record, verified_by: user.id }));
    const { error, count } = await supabase
      .from("evidence_records")
      .upsert(payload, { onConflict: "question_id,exam_name,exam_year", ignoreDuplicates: true, count: "exact" });
    if (error) return NextResponse.json({ error: error.message, summary, verdicts }, { status: 500 });
    inserted = count ?? evidenceInserts.length;
  }

  for (const draft of draftInserts) {
    const { data: question, error } = await supabase
      .from("questions")
      .insert({ ...draft.question, course_id: body.courseId, created_by: user.id })
      .select("id")
      .single();
    if (error || !question) {
      failures.push({ row: draft.row, reason: error?.code === "23505" ? "ডুপ্লিকেট প্রশ্ন (fingerprint)।" : error?.message ?? "অজানা ত্রুটি" });
      continue;
    }
    createdDrafts += 1;
    const { error: evidenceError } = await supabase
      .from("evidence_records")
      .insert({ ...draft.evidence, question_id: (question as { id: string }).id, verified_by: user.id });
    if (evidenceError) failures.push({ row: draft.row, reason: `প্রশ্ন তৈরি হয়েছে কিন্তু এভিডেন্স ব্যর্থ: ${evidenceError.message}` });
  }

  await audit("evidence.bulk_import", null, {
    course_id: body.courseId,
    total: summary.total,
    evidence_inserted: inserted,
    drafts_created: createdDrafts,
    rejected: summary.errors,
    failures,
  });
  await supabase.rpc("jh_recompute_topic_priorities");

  return NextResponse.json({ ok: true, dryRun: false, summary, verdicts, inserted, createdDrafts, failures });
}
