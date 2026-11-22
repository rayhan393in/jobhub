import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getAdminClient } from "@/lib/supabase/admin";
import { parseCsvRows } from "@/lib/routines/parse";

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
 *    full question body; otherwise the row is reported back as unmatched.
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

function fingerprintOf(statement: string): string {
  return createHash("sha256").update(statement).digest("hex");
}

function normalise(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function pick(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value.trim() !== "") return value.trim();
  }
  return "";
}

const CORRECT_MAP: Record<string, number> = {
  a: 0, b: 1, c: 2, d: 3, "0": 0, "1": 1, "2": 2, "3": 3,
  "ক": 0, "খ": 1, "গ": 2, "ঘ": 3,
};

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

  if (body.action === "delete") {
    const { error } = await supabase.from("evidence_records").delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabase.rpc("jh_recompute_topic_priorities");
    return NextResponse.json({ ok: true });
  }

  if (body.action === "add") {
    const { error } = await supabase.from("evidence_records").insert({
      question_id: body.questionId,
      exam_name: body.examName,
      exam_year: body.examYear,
      match_kind: body.matchKind,
      source_ref: body.sourceRef || null,
      source_url: body.sourceUrl || null,
      original_text: body.originalText || null,
      verified_by: user.id,
    });
    if (error) {
      const friendly = error.code === "23505"
        ? "এই প্রশ্নের জন্য এই পরীক্ষা+সালের এভিডেন্স আগেই আছে।"
        : error.message;
      return NextResponse.json({ error: friendly }, { status: 409 });
    }
    await supabase.rpc("jh_recompute_topic_priorities");
    return NextResponse.json({ ok: true });
  }

  // ---- bulk CSV ----
  const rawRows = parseCsvRows(body.csv);
  if (rawRows.length === 0) return NextResponse.json({ error: "CSV-তে কোনো সারি নেই।" }, { status: 422 });
  if (rawRows.length > 2000) return NextResponse.json({ error: "একবারে সর্বোচ্চ ২০০০ সারি।" }, { status: 422 });

  type Verdict = {
    row: number;
    examName: string;
    examYear: number | null;
    statement: string;
    outcome: "match" | "create_draft" | "error";
    detail: string;
  };
  const verdicts: Verdict[] = [];

  // Resolve statements against the live question bank of this course.
  const statements = rawRows.map((row) => normalise(pick(row, ["question", "statement", "প্রশ্ন", "original_question"])));
  const uniqueStatements = [...new Set(statements.filter((statement) => statement.length >= 8))];

  const byStatement = new Map<string, { id: string; source_type: string }>();
  for (let i = 0; i < uniqueStatements.length; i += 100) {
    const slice = uniqueStatements.slice(i, i + 100);
    const { data } = await supabase
      .from("questions")
      .select("id, statement, source_type")
      .eq("course_id", body.courseId)
      .in("statement", slice);
    for (const question of (data ?? []) as Array<{ id: string; statement: string; source_type: string }>) {
      byStatement.set(normalise(question.statement), { id: question.id, source_type: question.source_type });
    }
  }

  const evidenceInserts: Array<Record<string, unknown>> = [];
  const draftInserts: Array<{ question: Record<string, unknown>; evidence: Record<string, unknown>; row: number }> = [];

  rawRows.forEach((row, index) => {
    const rowNumber = index + 2; // header is row 1
    const examName = pick(row, ["exam_name", "পরীক্ষা", "exam"]);
    const yearRaw = pick(row, ["exam_year", "year", "সাল"]);
    const examYear = /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : null;
    const statement = statements[index];
    const kindRaw = pick(row, ["match_kind", "kind"]).toLowerCase();
    const kind = ["exact", "same_concept", "related"].includes(kindRaw) ? kindRaw : "exact";

    const fail = (detail: string) =>
      verdicts.push({ row: rowNumber, examName, examYear, statement: statement.slice(0, 80), outcome: "error", detail });

    if (examName.length < 2) return fail("exam_name খালি — অনুমান করা হয় না, সারি বাতিল।");
    if (examYear === null || examYear < 1971 || examYear > 2100) {
      return fail("exam_year অনুপস্থিত/অবৈধ (১৯৭১–২১০০) — অনুমান করা হয় না, সারি বাতিল।");
    }
    if (statement.length < 8) return fail("question কলাম খালি বা খুব ছোট।");

    const matched = byStatement.get(statement);
    if (matched) {
      verdicts.push({ row: rowNumber, examName, examYear, statement: statement.slice(0, 80), outcome: "match", detail: "বিদ্যমান প্রশ্নের সাথে মিলেছে — এভিডেন্স যুক্ত হবে।" });
      evidenceInserts.push({
        question_id: matched.id,
        exam_name: examName,
        exam_year: examYear,
        match_kind: kind,
        source_ref: pick(row, ["source_ref", "source", "উৎস"]) || null,
        source_url: pick(row, ["source_url", "url"]) || null,
        original_text: statement,
        verified_by: user.id,
      });
      return;
    }

    // Unmatched: create a DRAFT question only when the row carries a full body.
    const options = [
      pick(row, ["option_a", "a", "ক"]),
      pick(row, ["option_b", "b", "খ"]),
      pick(row, ["option_c", "c", "গ"]),
      pick(row, ["option_d", "d", "ঘ"]),
    ];
    const correctRaw = pick(row, ["correct_option", "correct", "answer", "সঠিক"]).toLowerCase();
    const correct = CORRECT_MAP[correctRaw];

    if (options.some((option) => !option) || correct === undefined) {
      return fail("প্রশ্নব্যাংকে পাওয়া যায়নি এবং অপশন/সঠিক উত্তর অসম্পূর্ণ — আগে ইমপোর্ট করুন বা কলামগুলো পূরণ করুন।");
    }

    verdicts.push({ row: rowNumber, examName, examYear, statement: statement.slice(0, 80), outcome: "create_draft", detail: "নতুন খসড়া প্রশ্ন (অযাচাইকৃত, রিভিউ কিউতে যাবে) + এভিডেন্স।" });
    draftInserts.push({
      row: rowNumber,
      question: {
        course_id: body.courseId,
        statement,
        option_a: options[0],
        option_b: options[1],
        option_c: options[2],
        option_d: options[3],
        correct_option: correct,
        explanation: pick(row, ["explanation", "ব্যাখ্যা"]),
        source_type: "previous",
        status: "draft",
        is_verified: false,
        year: examYear,
        exam_name: examName,
        source_title: pick(row, ["source_ref", "source", "উৎস"]) || null,
        source_url: pick(row, ["source_url", "url"]) || null,
        fingerprint: fingerprintOf(statement),
        created_by: user.id,
      },
      evidence: {
        exam_name: examName,
        exam_year: examYear,
        match_kind: kind,
        source_ref: pick(row, ["source_ref", "source", "উৎস"]) || null,
        source_url: pick(row, ["source_url", "url"]) || null,
        original_text: statement,
        verified_by: user.id,
      },
    });
  });

  const summary = {
    total: rawRows.length,
    matched: verdicts.filter((verdict) => verdict.outcome === "match").length,
    drafts: verdicts.filter((verdict) => verdict.outcome === "create_draft").length,
    errors: verdicts.filter((verdict) => verdict.outcome === "error").length,
  };

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
    const { error, count } = await supabase
      .from("evidence_records")
      .upsert(evidenceInserts, { onConflict: "question_id,exam_name,exam_year", ignoreDuplicates: true, count: "exact" });
    if (error) return NextResponse.json({ error: error.message, summary, verdicts }, { status: 500 });
    inserted = count ?? evidenceInserts.length;
  }

  for (const draft of draftInserts) {
    const { data: question, error } = await supabase
      .from("questions")
      .insert(draft.question)
      .select("id")
      .single();
    if (error || !question) {
      failures.push({ row: draft.row, reason: error?.code === "23505" ? "ডুপ্লিকেট প্রশ্ন (fingerprint)।" : error?.message ?? "অজানা ত্রুটি" });
      continue;
    }
    createdDrafts += 1;
    const { error: evidenceError } = await supabase
      .from("evidence_records")
      .insert({ ...draft.evidence, question_id: (question as { id: string }).id });
    if (evidenceError) failures.push({ row: draft.row, reason: `প্রশ্ন তৈরি হয়েছে কিন্তু এভিডেন্স ব্যর্থ: ${evidenceError.message}` });
  }

  await supabase.rpc("jh_recompute_topic_priorities");

  return NextResponse.json({ ok: true, dryRun: false, summary, verdicts, inserted, createdDrafts, failures });
}
