import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getServerClient } from "@/lib/supabase/server";
import { fromDbError } from "@/lib/api";
import { parseCsv, parseJson, validateRows, type RawRow } from "@/lib/import/parse";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  courseId: z.string().uuid(),
  format: z.enum(["csv", "json"]),
  mode: z.enum(["dry_run", "commit"]).default("dry_run"),
  filename: z.string().trim().max(160).optional().default("upload"),
  content: z.string().min(1).max(2_000_000),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
  if (!can(user.role, "question.import")) {
    return NextResponse.json({ error: "ইমপোর্টের অনুমতি নেই।" }, { status: 403 });
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "অবৈধ ডেটা।" }, { status: 422 });
  }
  const { courseId, format, mode, filename, content } = parsed.data;

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  const { data: course } = await supabase
    .from("courses")
    .select("id, title_bn, slug")
    .eq("id", courseId)
    .maybeSingle();
  if (!course) return NextResponse.json({ error: "কোর্স পাওয়া যায়নি।" }, { status: 404 });

  let rows: RawRow[];
  try {
    rows = format === "csv" ? parseCsv(content) : parseJson(content);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 422 });
  }
  if (rows.length === 0) {
    return NextResponse.json({ error: "ফাইলে কোনো সারি পাওয়া যায়নি।" }, { status: 422 });
  }
  if (rows.length > 2000) {
    return NextResponse.json({ error: "একবারে সর্বোচ্চ ২০০০ সারি ইমপোর্ট করা যায়।" }, { status: 413 });
  }

  const result = validateRows(rows, { sourceType: format === "csv" ? "csv_import" : "json_import" });

  // Existing fingerprints in this course — the authoritative duplicate check.
  const fingerprints = result.valid.map((row) => row.fingerprint);
  const existing = new Set<string>();
  if (fingerprints.length > 0) {
    const { data } = await supabase
      .from("questions")
      .select("fingerprint")
      .eq("course_id", courseId)
      .in("fingerprint", fingerprints);
    for (const row of data ?? []) existing.add(row.fingerprint as string);
  }

  const fresh = result.valid.filter((row) => !existing.has(row.fingerprint));
  const alreadyInDb = result.valid.length - fresh.length;

  if (mode === "dry_run") {
    return NextResponse.json(
      {
        mode,
        total: result.total,
        valid: result.valid.length,
        invalid: result.invalid.length,
        duplicatesInFile: result.duplicates.length,
        duplicatesInDb: alreadyInDb,
        toInsert: fresh.length,
        preview: fresh.slice(0, 8).map((row) => ({
          row: row.row,
          statement: row.statement,
          options: row.options,
          correctOption: row.correctOption,
          difficulty: row.difficulty,
          sourceType: row.sourceType,
          examName: row.examName || null,
          sourceTitle: row.sourceTitle || null,
          bookPage: row.bookPage,
        })),
        errors: result.invalid.slice(0, 25).map((row) => ({ row: row.row, issues: row.issues })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!can(user.role, "question.review")) {
    // Committing creates pending questions only, but keep the check explicit.
    return NextResponse.json({ error: "ইমপোর্ট নিশ্চিত করার অনুমতি নেই।" }, { status: 403 });
  }
  if (fresh.length === 0) {
    return NextResponse.json(
      { error: "নতুন কোনো প্রশ্ন নেই — সব সারি ইতিমধ্যেই আছে বা অবৈধ।", toInsert: 0 },
      { status: 409 },
    );
  }

  // Import batches and questions are written in one transaction by the RPC-free
  // path: create the batch, then insert with the batch id.
  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({
      created_by: user.id,
      filename,
      format,
      mode,
      total_rows: result.total,
      created_rows: 0,
      failed_rows: result.invalid.length,
      duplicate_rows: result.duplicates.length + alreadyInDb,
      errors: result.invalid.slice(0, 50).map((row) => ({ row: row.row, issues: row.issues })),
    })
    .select("id")
    .single();
  if (batchError) return fromDbError(batchError);

  const payload = fresh.map((row) => ({
    course_id: courseId,
    statement: row.statement,
    option_a: row.options[0],
    option_b: row.options[1],
    option_c: row.options[2],
    option_d: row.options[3],
    correct_option: row.correctOption,
    explanation: row.explanation,
    difficulty: row.difficulty,
    // AI rows stay unverified; imports never arrive pre-approved.
    source: row.sourceRef || `${filename} (${format === "csv" ? "CSV" : "JSON"} import)`,
    // 'previous' is a real source type now, so a past-exam question keeps its
    // provenance instead of being flattened into a generic CSV import.
    source_type:
      row.sourceType === "previous" || row.sourceType === "ai_assisted"
        ? row.sourceType
        : format === "csv" ? "csv_import" : "json_import",
    year: row.year,
    // Spec §6 — every question carries where it came from.
    exam_name: row.examName || null,
    source_title: row.sourceTitle || null,
    source_locator: row.sourceLocator || null,
    source_url: row.sourceUrl || null,
    source_file_id: row.sourceFileId || null,
    book_chapter: row.bookChapter || null,
    book_page: row.bookPage,
    author: row.author || null,
    edition: row.edition || null,
    status: "pending_review" as const,
    is_verified: false,
    fingerprint: row.fingerprint,
    import_batch_id: batch.id,
    created_by: user.id,
  }));

  let inserted = 0;
  const chunkSize = 200;
  for (let index = 0; index < payload.length; index += chunkSize) {
    const chunk = payload.slice(index, index + chunkSize);
    const { data, error } = await supabase.from("questions").insert(chunk).select("id");
    if (error) {
      // Record what actually landed before surfacing the failure.
      await supabase
        .from("import_batches")
        .update({ created_rows: inserted, failed_rows: payload.length - inserted + result.invalid.length })
        .eq("id", batch.id);
      return fromDbError(error);
    }
    inserted += data?.length ?? 0;
  }

  await supabase.from("import_batches").update({ created_rows: inserted }).eq("id", batch.id);

  return NextResponse.json(
    {
      mode,
      batchId: batch.id,
      inserted,
      skipped: result.invalid.length + result.duplicates.length + alreadyInDb,
      message: `${inserted}টি প্রশ্ন 'রিভিউ অপেক্ষায়' হিসেবে যোগ হয়েছে — অনুমোদন ছাড়া ব্যবহার হবে না।`,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
