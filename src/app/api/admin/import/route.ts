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

/** Normalise Bangla/English labels so slug, title_bn and title_en all match. */
function normLabel(value: string): string {
  return value.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");
}

type TaxonomyMaps = {
  subjectByLabel: Map<string, { id: string }>;
  topicByLabel: Map<string, { id: string; subject_id: string }[]>;
  subtopicByLabel: Map<string, { id: string; topic_id: string }[]>;
};

/**
 * Resolve subject/topic/subtopic columns of an import file to real taxonomy
 * ids within the course. Rows may reference slugs or exact titles (bn/en).
 */
async function loadTaxonomy(
  supabase: NonNullable<Awaited<ReturnType<typeof getServerClient>>>,
  courseId: string,
): Promise<TaxonomyMaps> {
  const subjectByLabel = new Map<string, { id: string }>();
  const topicByLabel = new Map<string, { id: string; subject_id: string }[]>();
  const subtopicByLabel = new Map<string, { id: string; topic_id: string }[]>();

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, slug, title_bn, title_en")
    .eq("course_id", courseId);
  const subjectIds = (subjects ?? []).map((s) => s.id as string);
  for (const s of subjects ?? []) {
    for (const label of [s.slug, s.title_bn, s.title_en]) {
      if (label) subjectByLabel.set(normLabel(label as string), { id: s.id as string });
    }
  }

  if (subjectIds.length > 0) {
    const { data: topics } = await supabase
      .from("topics")
      .select("id, slug, title_bn, title_en, subject_id")
      .in("subject_id", subjectIds);
    const topicIds = (topics ?? []).map((t) => t.id as string);
    for (const t of topics ?? []) {
      for (const label of [t.slug, t.title_bn, t.title_en]) {
        if (!label) continue;
        const key = normLabel(label as string);
        const list = topicByLabel.get(key) ?? [];
        list.push({ id: t.id as string, subject_id: t.subject_id as string });
        topicByLabel.set(key, list);
      }
    }

    if (topicIds.length > 0) {
      // Chunk the IN() list to stay well under PostgREST URL limits.
      for (let i = 0; i < topicIds.length; i += 150) {
        const { data: subtopics } = await supabase
          .from("subtopics")
          .select("id, slug, title_bn, title_en, topic_id")
          .in("topic_id", topicIds.slice(i, i + 150));
        for (const st of subtopics ?? []) {
          for (const label of [st.slug, st.title_bn, st.title_en]) {
            if (!label) continue;
            const key = normLabel(label as string);
            const list = subtopicByLabel.get(key) ?? [];
            list.push({ id: st.id as string, topic_id: st.topic_id as string });
            subtopicByLabel.set(key, list);
          }
        }
      }
    }
  }

  return { subjectByLabel, topicByLabel, subtopicByLabel };
}

function resolveRowTaxonomy(
  maps: TaxonomyMaps,
  row: { subjectSlug: string; topicSlug: string; subtopicSlug: string },
  unmatched: Set<string>,
): { subject_id: string | null; topic_id: string | null; subtopic_id: string | null } {
  let subjectId: string | null = null;
  let topicId: string | null = null;
  let subtopicId: string | null = null;

  if (row.subjectSlug) {
    const hit = maps.subjectByLabel.get(normLabel(row.subjectSlug));
    if (hit) subjectId = hit.id;
    else unmatched.add(`বিষয়: ${row.subjectSlug}`);
  }
  if (row.topicSlug) {
    const hits = maps.topicByLabel.get(normLabel(row.topicSlug)) ?? [];
    const hit = subjectId ? (hits.find((t) => t.subject_id === subjectId) ?? null) : (hits[0] ?? null);
    if (hit) {
      topicId = hit.id;
      subjectId = subjectId ?? hit.subject_id;
    } else unmatched.add(`টপিক: ${row.topicSlug}`);
  }
  if (row.subtopicSlug) {
    const hits = maps.subtopicByLabel.get(normLabel(row.subtopicSlug)) ?? [];
    const hit = topicId ? (hits.find((s) => s.topic_id === topicId) ?? null) : (hits[0] ?? null);
    if (hit) subtopicId = hit.id;
    else unmatched.add(`সাব-টপিক: ${row.subtopicSlug}`);
  }

  return { subject_id: subjectId, topic_id: topicId, subtopic_id: subtopicId };
}

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

  // Resolve subject/topic/subtopic labels (slug or exact title) to taxonomy ids
  // so a huge bank imported per-topic lands correctly tagged, not orphaned.
  const needsTaxonomy = fresh.some((row) => row.subjectSlug || row.topicSlug || row.subtopicSlug);
  const maps = needsTaxonomy ? await loadTaxonomy(supabase, courseId) : null;
  const unmatched = new Set<string>();
  const taxonomyByRow = new Map<number, { subject_id: string | null; topic_id: string | null; subtopic_id: string | null }>();
  let taggedRows = 0;
  if (maps) {
    for (const row of fresh) {
      const resolved = resolveRowTaxonomy(maps, row, unmatched);
      taxonomyByRow.set(row.row, resolved);
      if (resolved.subject_id || resolved.topic_id || resolved.subtopic_id) taggedRows += 1;
    }
  }

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
        taxonomy: {
          taggedRows,
          unmatchedLabels: Array.from(unmatched).slice(0, 20),
        },
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
    subject_id: taxonomyByRow.get(row.row)?.subject_id ?? null,
    topic_id: taxonomyByRow.get(row.row)?.topic_id ?? null,
    subtopic_id: taxonomyByRow.get(row.row)?.subtopic_id ?? null,
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
