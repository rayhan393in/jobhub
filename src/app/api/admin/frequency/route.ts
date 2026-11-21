import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getServerClient } from "@/lib/supabase/server";
import { fromDbError } from "@/lib/api";
import { parseCsvRows } from "@/lib/routines/parse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /  POST /api/admin/frequency
 *
 * The evidence table behind "smart study priority": how many questions each
 * topic contributed to each past paper.
 *
 * The rule the spec insists on — "Frequency analysis-এর প্রকৃত Data ও Source
 * দেখাতে হবে; অনুমানকে নিশ্চিত ভবিষ্যদ্বাণী হিসেবে দেখানো যাবে না" — is enforced
 * structurally:
 *   - every row names the exam it was counted from and its source;
 *   - a row with no exam name is rejected, because an unattributed count is
 *     indistinguishable from a guess;
 *   - a topic with no rows is reported by the UI as "no data", never as low.
 */

const rowSchema = z.object({
  exam_name: z.string().trim().min(2).max(160),
  exam_year: z.coerce.number().int().min(1971).max(2100).nullable().optional(),
  subject_id: z.string().uuid().nullable().optional(),
  topic_id: z.string().uuid().nullable().optional(),
  subtopic_id: z.string().uuid().nullable().optional(),
  question_count: z.coerce.number().int().min(0).max(1000),
  source_title: z.string().trim().max(300).optional().default(""),
  source_file_id: z.string().trim().max(200).optional().default(""),
  source_url: z.string().trim().max(500).optional().default(""),
  notes: z.string().trim().max(600).optional().default(""),
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("upsert"),
    courseId: z.string().uuid(),
    rows: z.array(rowSchema).min(1).max(2000),
  }),
  z.object({
    action: z.literal("delete"),
    courseId: z.string().uuid(),
    id: z.string().uuid(),
  }),
  z.object({
    action: z.literal("clear"),
    courseId: z.string().uuid(),
    examName: z.string().trim().min(2).max(160).optional(),
  }),
]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
  if (!can(user.role, "question.import")) {
    return NextResponse.json({ error: "প্রশ্ন-বিশ্লেষণ যোগ করার অনুমতি নেই।" }, { status: 403 });
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

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  if (body.action === "delete") {
    const { error } = await supabase.from("question_frequency").delete().eq("id", body.id).eq("course_id", body.courseId);
    if (error) return fromDbError(error);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  }

  if (body.action === "clear") {
    let query = supabase.from("question_frequency").delete().eq("course_id", body.courseId);
    if (body.examName) query = query.eq("exam_name", body.examName);
    const { error } = await query;
    if (error) return fromDbError(error);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  }

  // Every id must belong to this course — otherwise a typo silently attributes
  // one course's questions to another course's topic.
  const { data: courseSubjects } = await supabase
    .from("subjects")
    .select("id")
    .eq("course_id", body.courseId);
  const subjectIds = new Set(((courseSubjects ?? []) as Array<{ id: string }>).map((row) => row.id));

  const { data: courseTopics } = subjectIds.size
    ? await supabase.from("topics").select("id, subject_id").in("subject_id", [...subjectIds])
    : { data: [] as Array<{ id: string; subject_id: string }> };
  const topicById = new Map(((courseTopics ?? []) as Array<{ id: string; subject_id: string }>).map((row) => [row.id, row]));

  const payload: Array<{
    course_id: string;
    subject_id: string | null;
    topic_id: string | null;
    subtopic_id: string | null;
    exam_name: string;
    exam_year: number | null;
    question_count: number;
    source_title: string;
    source_file_id: string | null;
    source_url: string | null;
    notes: string | null;
    created_by: string;
    updated_at: string;
  }> = [];
  const rejected: Array<{ row: number; reason: string }> = [];

  body.rows.forEach((row, index) => {
    if (row.topic_id && !topicById.has(row.topic_id)) {
      rejected.push({ row: index + 1, reason: "টপিকটি এই কোর্সের নয়।" });
      return;
    }
    if (row.subject_id && !subjectIds.has(row.subject_id)) {
      rejected.push({ row: index + 1, reason: "বিষয়টি এই কোর্সের নয়।" });
      return;
    }
    if (!row.topic_id && !row.subtopic_id && !row.subject_id) {
      rejected.push({ row: index + 1, reason: "বিষয়/টপিক ছাড়া গণনা সংরক্ষণ করা যায় না।" });
      return;
    }

    payload.push({
      course_id: body.courseId,
      subject_id: row.subject_id ?? (row.topic_id ? topicById.get(row.topic_id)?.subject_id ?? null : null),
      topic_id: row.topic_id ?? null,
      subtopic_id: row.subtopic_id ?? null,
      exam_name: row.exam_name,
      exam_year: row.exam_year ?? null,
      question_count: row.question_count,
      source_title: row.source_title,
      source_file_id: row.source_file_id || null,
      source_url: row.source_url || null,
      notes: row.notes || null,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    });
  });

  if (payload.length === 0) {
    return NextResponse.json({ error: "কোনো বৈধ সারি নেই।", rejected }, { status: 422 });
  }

  const { error } = await supabase
    .from("question_frequency")
    .upsert(payload, {
      onConflict: "course_id,exam_name,exam_year,subject_id,topic_id,subtopic_id",
    });
  if (error) return fromDbError(error);

  return NextResponse.json(
    { ok: true, saved: payload.length, rejected },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * PUT — bulk CSV import of a frequency table.
 *
 * Expected columns: exam_name, exam_year, subject, topic, subtopic, count,
 * source_title. Names are resolved against the real syllabus; an unresolved
 * name is reported rather than guessed.
 */
const csvSchema = z.object({
  courseId: z.string().uuid(),
  content: z.string().min(1).max(1_000_000),
  mode: z.enum(["dry_run", "commit"]).default("dry_run"),
});

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
  if (!can(user.role, "question.import")) {
    return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 403 });
  }

  let body: z.infer<typeof csvSchema>;
  try {
    body = csvSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 422 });
  }

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  const rows = parseCsvRows(body.content);
  if (rows.length === 0) return NextResponse.json({ error: "ফাইলে কোনো সারি নেই।" }, { status: 422 });
  if (rows.length > 2000) return NextResponse.json({ error: "সর্বোচ্চ ২০০০ সারি।" }, { status: 413 });

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, title_bn, title_en")
    .eq("course_id", body.courseId);
  const subjectRows = (subjects ?? []) as Array<{ id: string; title_bn: string; title_en: string | null }>;
  const subjectByName = new Map<string, string>();
  for (const row of subjectRows) {
    subjectByName.set(row.title_bn.trim().toLowerCase(), row.id);
    if (row.title_en) subjectByName.set(row.title_en.trim().toLowerCase(), row.id);
  }

  const { data: topics } = subjectRows.length
    ? await supabase
        .from("topics")
        .select("id, subject_id, title_bn")
        .in("subject_id", subjectRows.map((row) => row.id))
    : { data: [] as Array<{ id: string; subject_id: string; title_bn: string }> };
  const topicByKey = new Map<string, string>();
  for (const row of (topics ?? []) as Array<{ id: string; subject_id: string; title_bn: string }>) {
    topicByKey.set(`${row.subject_id}::${row.title_bn.trim().toLowerCase()}`, row.id);
  }

  const pick = (row: Record<string, string>, keys: string[]) => {
    for (const key of keys) if (row[key]) return row[key];
    return "";
  };

  const unresolvedSubjects = new Set<string>();
  const unresolvedTopics = new Set<string>();
  const ready: z.infer<typeof rowSchema>[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  rows.forEach((row, index) => {
    const examName = pick(row, ["exam_name", "exam", "পরীক্ষা"]);
    const subjectName = pick(row, ["subject", "বিষয়"]);
    const topicName = pick(row, ["topic", "টপিক"]);
    const countRaw = pick(row, ["count", "question_count", "questions", "সংখ্যা"]);

    if (!examName) {
      errors.push({ row: index + 1, message: "পরীক্ষার নাম নেই।" });
      return;
    }
    const subjectId = subjectName ? subjectByName.get(subjectName.trim().toLowerCase()) : undefined;
    if (subjectName && !subjectId) {
      unresolvedSubjects.add(subjectName);
      return;
    }
    const topicId = subjectId && topicName ? topicByKey.get(`${subjectId}::${topicName.trim().toLowerCase()}`) : undefined;
    if (topicName && !topicId) {
      unresolvedTopics.add(`${subjectName} → ${topicName}`);
      return;
    }

    const count = Number(countRaw);
    if (!Number.isInteger(count) || count < 0) {
      errors.push({ row: index + 1, message: "প্রশ্নসংখ্যা অ-ঋণাত্মক পূর্ণসংখ্যা হতে হবে।" });
      return;
    }

    const yearRaw = pick(row, ["exam_year", "year", "সাল"]);
    const year = yearRaw ? Number(yearRaw) : null;

    ready.push({
      exam_name: examName,
      exam_year: year && year >= 1971 && year <= 2100 ? year : null,
      subject_id: subjectId ?? null,
      topic_id: topicId ?? null,
      subtopic_id: null,
      question_count: count,
      source_title: pick(row, ["source_title", "source", "উৎস"]),
      source_file_id: "",
      source_url: "",
      notes: "",
    });
  });

  if (body.mode === "dry_run") {
    return NextResponse.json(
      {
        ready: ready.length,
        errors: errors.slice(0, 25),
        missingSubjects: [...unresolvedSubjects],
        missingTopics: [...unresolvedTopics],
        preview: ready.slice(0, 10),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (ready.length === 0) {
    return NextResponse.json({ error: "মেলানো যায় এমন সারি নেই।", missingSubjects: [...unresolvedSubjects] }, { status: 422 });
  }

  const payload = ready.map((row) => ({
    course_id: body.courseId,
    subject_id: row.subject_id ?? null,
    topic_id: row.topic_id ?? null,
    subtopic_id: null,
    exam_name: row.exam_name,
    exam_year: row.exam_year ?? null,
    question_count: row.question_count,
    source_title: row.source_title ?? "",
    created_by: user.id,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("question_frequency").upsert(payload, {
    onConflict: "course_id,exam_name,exam_year,subject_id,topic_id,subtopic_id",
  });
  if (error) return fromDbError(error);

  return NextResponse.json(
    { ok: true, saved: payload.length, errors, missingSubjects: [...unresolvedSubjects], missingTopics: [...unresolvedTopics] },
    { headers: { "Cache-Control": "no-store" } },
  );
}
