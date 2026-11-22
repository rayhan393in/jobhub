import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getServerClient } from "@/lib/supabase/server";
import { fromDbError } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Bulk taxonomy import/export.
 *
 * POST — rows of { subject, topic, subtopic?, … } are upserted into one
 * course's syllabus tree. Existing rows (matched by slug *or* Bengali title
 * under the same parent) are never touched; new topics/subtopics enter as
 * `pending` + inactive, so the admin reviews them before students see them.
 *
 * GET ?courseId=… — full hierarchy as UTF-8 CSV (Excel-compatible).
 */

const rowSchema = z.object({
  subject: z.string().trim().min(1).max(160),
  subjectEn: z.string().trim().max(160).optional().default(""),
  topic: z.string().trim().min(1).max(200),
  topicEn: z.string().trim().max(200).optional().default(""),
  subtopic: z.string().trim().max(200).optional().default(""),
  subtopicEn: z.string().trim().max(200).optional().default(""),
  sourceUrl: z.string().trim().max(500).optional().default(""),
  occurrenceYears: z.array(z.number().int().min(1971).max(2100)).max(80).optional().default([]),
});

const bodySchema = z.object({
  courseId: z.string().uuid(),
  dryRun: z.boolean().default(true),
  rows: z.array(rowSchema).min(1).max(1500),
});

const nfc = (value: string) => value.normalize("NFC").trim();

/** Deterministic ascii slug — latin text slugifies, Bengali falls back to a stable hash. */
function toSlug(preferred: string, fallback: string): string {
  const base = (preferred || fallback).toLowerCase().trim();
  const latin = base
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (latin.length >= 2) return latin.slice(0, 72);
  let hash = 5381;
  const source = nfc(fallback);
  for (let i = 0; i < source.length; i += 1) hash = ((hash << 5) + hash + source.charCodeAt(i)) >>> 0;
  return `bn-${hash.toString(36)}`;
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  return !origin || !host || new URL(origin).host === host;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
  if (!can(user.role, "taxonomy.manage")) {
    return NextResponse.json({ error: "ট্যাক্সোনমি পরিবর্তনের অনুমতি নেই।" }, { status: 403 });
  }
  if (!sameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue ? `${issue.path.join(".")}: ${issue.message}` : "অবৈধ ডেটা।" },
      { status: 422 },
    );
  }

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  const { courseId, dryRun, rows } = parsed.data;

  // Existing tree, indexed by normalized Bengali title and slug.
  const { data: subjects, error: subjectError } = await supabase
    .from("subjects")
    .select("id, slug, title_bn")
    .eq("course_id", courseId);
  if (subjectError) return fromDbError(subjectError);

  const subjectIds = (subjects ?? []).map((s) => s.id);
  const { data: topics } = subjectIds.length
    ? await supabase.from("topics").select("id, subject_id, slug, title_bn").in("subject_id", subjectIds)
    : { data: [] as Array<{ id: string; subject_id: string; slug: string; title_bn: string }> };
  const topicIds = (topics ?? []).map((t) => t.id);
  const { data: subtopics } = topicIds.length
    ? await supabase.from("subtopics").select("id, topic_id, slug, title_bn").in("topic_id", topicIds)
    : { data: [] as Array<{ id: string; topic_id: string; slug: string; title_bn: string }> };

  const subjectKey = new Map<string, string>();
  for (const s of subjects ?? []) {
    subjectKey.set(`t:${nfc(s.title_bn)}`, s.id);
    subjectKey.set(`s:${s.slug}`, s.id);
  }
  const topicKey = new Map<string, string>();
  for (const t of topics ?? []) {
    topicKey.set(`${t.subject_id}|t:${nfc(t.title_bn)}`, t.id);
    topicKey.set(`${t.subject_id}|s:${t.slug}`, t.id);
  }
  const subtopicKey = new Set<string>();
  for (const s of subtopics ?? []) {
    subtopicKey.add(`${s.topic_id}|t:${nfc(s.title_bn)}`);
    subtopicKey.add(`${s.topic_id}|s:${s.slug}`);
  }

  let createdSubjects = 0;
  let createdTopics = 0;
  let createdSubtopics = 0;
  let skipped = 0;
  const warnings: string[] = [];

  for (const [index, row] of rows.entries()) {
    const subjectTitle = nfc(row.subject);
    const subjectSlug = toSlug(row.subjectEn, subjectTitle);
    let subjectId = subjectKey.get(`t:${subjectTitle}`) ?? subjectKey.get(`s:${subjectSlug}`);

    if (!subjectId) {
      if (dryRun) {
        subjectId = `dry-subject-${subjectSlug}`;
        createdSubjects += 1;
      } else {
        const { data: inserted, error } = await supabase
          .from("subjects")
          .insert({
            course_id: courseId,
            slug: subjectSlug,
            title_en: row.subjectEn || subjectTitle,
            title_bn: subjectTitle,
            sort_order: 90 + createdSubjects,
          })
          .select("id")
          .single();
        if (error) {
          warnings.push(`সারি ${index + 1}: বিষয় তৈরি হয়নি (${error.code ?? "ত্রুটি"})`);
          continue;
        }
        subjectId = inserted.id as string;
        createdSubjects += 1;
      }
    }
    subjectKey.set(`t:${subjectTitle}`, subjectId);
    subjectKey.set(`s:${subjectSlug}`, subjectId);

    const topicTitle = nfc(row.topic);
    const topicSlug = toSlug(row.topicEn, topicTitle);
    let topicId = topicKey.get(`${subjectId}|t:${topicTitle}`) ?? topicKey.get(`${subjectId}|s:${topicSlug}`);
    const topicExisted = Boolean(topicId);

    if (!topicId) {
      if (dryRun) {
        topicId = `dry-topic-${topicSlug}`;
        createdTopics += 1;
      } else {
        const { data: inserted, error } = await supabase
          .from("topics")
          .insert({
            subject_id: subjectId,
            slug: topicSlug,
            title_en: row.topicEn || topicTitle,
            title_bn: topicTitle,
            is_active: false,
            approval_status: "pending",
            source_url: row.sourceUrl || null,
            occurrence_years: row.occurrenceYears,
          })
          .select("id")
          .single();
        if (error) {
          warnings.push(`সারি ${index + 1}: টপিক তৈরি হয়নি (${error.code ?? "ত্রুটি"})`);
          continue;
        }
        topicId = inserted.id as string;
        createdTopics += 1;
      }
    }
    topicKey.set(`${subjectId}|t:${topicTitle}`, topicId);
    topicKey.set(`${subjectId}|s:${topicSlug}`, topicId);

    const subtopicTitle = nfc(row.subtopic);
    if (!subtopicTitle) {
      if (topicExisted) skipped += 1;
      continue;
    }
    const subtopicSlug = toSlug(row.subtopicEn, subtopicTitle);
    if (subtopicKey.has(`${topicId}|t:${subtopicTitle}`) || subtopicKey.has(`${topicId}|s:${subtopicSlug}`)) {
      skipped += 1;
      continue;
    }
    if (!dryRun) {
      const { error } = await supabase.from("subtopics").insert({
        topic_id: topicId,
        slug: subtopicSlug,
        title_en: row.subtopicEn || subtopicTitle,
        title_bn: subtopicTitle,
        is_active: false,
        approval_status: "pending",
      });
      if (error) {
        warnings.push(`সারি ${index + 1}: সাব-টপিক তৈরি হয়নি (${error.code ?? "ত্রুটি"})`);
        continue;
      }
    }
    createdSubtopics += 1;
    subtopicKey.add(`${topicId}|t:${subtopicTitle}`);
    subtopicKey.add(`${topicId}|s:${subtopicSlug}`);
  }

  if (!dryRun) {
    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "taxonomy.bulk_import",
      entity_type: "topics",
      entity_id: courseId,
      details: { createdSubjects, createdTopics, createdSubtopics, skipped },
    });
  }

  return NextResponse.json(
    { dryRun, createdSubjects, createdTopics, createdSubtopics, skipped, warnings: warnings.slice(0, 20) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function csvCell(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
  if (!can(user.role, "taxonomy.manage")) {
    return NextResponse.json({ error: "ট্যাক্সোনমি পরিবর্তনের অনুমতি নেই।" }, { status: 403 });
  }

  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId");
  if (!courseId || !z.string().uuid().safeParse(courseId).success) {
    return NextResponse.json({ error: "courseId প্রয়োজন।" }, { status: 422 });
  }

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, slug, title_en, title_bn")
    .eq("course_id", courseId)
    .order("sort_order");
  const subjectIds = (subjects ?? []).map((s) => s.id);
  const { data: topics } = subjectIds.length
    ? await supabase
        .from("topics")
        .select("id, subject_id, slug, title_en, title_bn, approval_status, source_url, occurrence_years")
        .in("subject_id", subjectIds)
        .order("sort_order")
    : { data: [] };
  const topicIds = (topics ?? []).map((t) => t.id);
  const { data: subtopics } = topicIds.length
    ? await supabase
        .from("subtopics")
        .select("id, topic_id, slug, title_en, title_bn, approval_status")
        .in("topic_id", topicIds)
        .order("sort_order")
    : { data: [] };

  const subjectById = new Map((subjects ?? []).map((s) => [s.id, s]));
  const topicById = new Map((topics ?? []).map((t) => [t.id, t]));

  const lines = ["subject,subject_en,topic,topic_en,subtopic,subtopic_en,status,source_url,occurrence_years"];
  for (const topic of topics ?? []) {
    const subject = subjectById.get(topic.subject_id);
    const children = (subtopics ?? []).filter((s) => s.topic_id === topic.id);
    const years = Array.isArray(topic.occurrence_years) ? topic.occurrence_years.join(" ") : "";
    if (children.length === 0) {
      lines.push(
        [
          csvCell(subject?.title_bn), csvCell(subject?.title_en), csvCell(topic.title_bn), csvCell(topic.title_en),
          "", "", csvCell(topic.approval_status), csvCell(topic.source_url), csvCell(years),
        ].join(","),
      );
    }
    for (const sub of children) {
      lines.push(
        [
          csvCell(subject?.title_bn), csvCell(subject?.title_en), csvCell(topic.title_bn), csvCell(topic.title_en),
          csvCell(sub.title_bn), csvCell(sub.title_en), csvCell(sub.approval_status), csvCell(topic.source_url), csvCell(years),
        ].join(","),
      );
    }
  }
  // Orphan check is unnecessary: topics always have a subject (FK).
  void topicById;

  return new NextResponse(`\uFEFF${lines.join("\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="jobhub-taxonomy-${courseId.slice(0, 8)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
