import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerClient } from "@/lib/supabase/server";
import { fromDbError, assertSameOrigin, requireApiPermission } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Marks distribution editor (নম্বর বিভাজন).
 *
 * Marks belong to a stage of an examination, so each row is one paper of one
 * stage of one course. Every figure is nullable because many official tables
 * publish only the total (e.g. a written paper's marks without a question
 * count) — the editor must be able to express exactly what the circular says.
 */

const stageEnum = z.enum(["preliminary", "written", "viva", "total"]);

const optionalPositive = z
  .number()
  .int()
  .positive()
  .max(100000)
  .nullable()
  .optional();

const rowSchema = z.object({
  id: z.string().uuid().optional(),
  stage: stageEnum,
  stageBn: z.string().trim().min(2).max(60),
  paperBn: z.string().trim().max(120).optional().default(""),
  questionCount: optionalPositive,
  marksPerQuestion: z.number().positive().max(1000).nullable().optional(),
  negativeMarks: z.number().min(0).max(100).default(0),
  durationMinutes: optionalPositive,
  totalMarks: z.number().positive().max(10000),
  passMarks: z.number().min(0).max(10000).nullable().optional(),
  noteBn: z.string().trim().max(400).optional().default(""),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

const bodySchema = z.object({
  courseId: z.string().uuid(),
  rows: z.array(rowSchema).min(0).max(60),
});

async function requireManager() {
  return requireApiPermission("taxonomy.manage", {
    message: "নম্বর বিভাজন পরিবর্তনের অনুমতি নেই।",
  });
}

/** GET ?courseId=… — every marks row of one course (staff view, drafts included). */
export async function GET(request: Request) {
  const gate = await requireManager();
  if ("error" in gate) return gate.error;

  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId");
  if (!courseId || !z.string().uuid().safeParse(courseId).success) {
    return NextResponse.json({ error: "courseId প্রয়োজন।" }, { status: 422 });
  }

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  const { data, error } = await supabase
    .from("exam_marks")
    .select(
      "id, course_id, stage, stage_bn, paper_bn, question_count, marks_per_question, negative_marks, duration_minutes, total_marks, pass_marks, note_bn, sort_order",
    )
    .eq("course_id", courseId)
    .order("sort_order");
  if (error) return fromDbError(error);

  return NextResponse.json({ rows: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * PUT — replace one course's marks table atomically-ish: upsert every row sent,
 * then delete the rows of that course the client no longer lists. Rows from
 * other courses are never touched.
 */
export async function PUT(request: Request) {
  const gate = await requireManager();
  if ("error" in gate) return gate.error;
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue ? `${issue.path.join(".")}: ${issue.message}` : "অবৈধ ডেটা।" },
      { status: 422 },
    );
  }

  const { courseId, rows } = parsed.data;
  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  // (course, stage, paper) is unique — reject a payload that names it twice
  // before Postgres does, with a message a human can act on.
  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.stage}::${row.paperBn}`;
    if (seen.has(key)) {
      return NextResponse.json(
        { error: `একই ধাপে “${row.paperBn || row.stageBn}” দুইবার আছে।` },
        { status: 422 },
      );
    }
    seen.add(key);
  }

  const payload = rows.map((row) => ({
    ...(row.id ? { id: row.id } : {}),
    course_id: courseId,
    stage: row.stage,
    stage_bn: row.stageBn,
    paper_bn: row.paperBn ?? "",
    question_count: row.questionCount ?? null,
    marks_per_question: row.marksPerQuestion ?? null,
    negative_marks: row.negativeMarks,
    duration_minutes: row.durationMinutes ?? null,
    total_marks: row.totalMarks,
    pass_marks: row.passMarks ?? null,
    note_bn: row.noteBn ?? "",
    sort_order: row.sortOrder,
  }));

  let saved: Array<{ id: string }> = [];
  if (payload.length > 0) {
    const { data, error } = await supabase
      .from("exam_marks")
      .upsert(payload, { onConflict: "id" })
      .select("id");
    if (error) return fromDbError(error);
    saved = data ?? [];
  }

  const keepIds = saved.map((row) => row.id);
  let removal = supabase.from("exam_marks").delete().eq("course_id", courseId);
  if (keepIds.length > 0) removal = removal.not("id", "in", `(${keepIds.join(",")})`);
  const { error: deleteError } = await removal;
  if (deleteError) return fromDbError(deleteError);

  return NextResponse.json({ saved: keepIds.length }, { headers: { "Cache-Control": "no-store" } });
}
