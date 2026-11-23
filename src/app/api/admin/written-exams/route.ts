import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getServerClient } from "@/lib/supabase/server";
import { fromDbError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Admin management of written exams (লিখিত পরীক্ষা).
 *
 * GET              → eligible courses (registry has a published written
 *                    stage) + all written exams with their questions and
 *                    attempt counts.
 * POST             → create a draft exam with its questions. Creation is
 *                    REFUSED for courses without a written stage in the
 *                    exam registry — the stage is data, not a code switch.
 * PATCH            → update a draft exam / replace questions / publish /
 *                    close.
 * DELETE ?examId   → remove a draft exam (never a published one).
 */

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  return !origin || !host || new URL(origin).host === host;
}

async function guard() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 }) };
  if (!can(user.role, "exam.publish")) {
    return { error: NextResponse.json({ error: "পরীক্ষা পরিচালনার অনুমতি নেই।" }, { status: 403 }) };
  }
  const supabase = await getServerClient();
  if (!supabase) return { error: NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 }) };
  return { user, supabase };
}

async function eligibleCourseIds(supabase: NonNullable<Awaited<ReturnType<typeof getServerClient>>>) {
  const { data, error } = await supabase
    .from("exam_registry")
    .select("course_id")
    .eq("exam_stage", "written")
    .eq("status", "published")
    .not("course_id", "is", null);
  if (error) return { error };
  return { ids: [...new Set((data ?? []).map((r) => r.course_id as string))] };
}

export async function GET() {
  const g = await guard();
  if ("error" in g) return g.error;
  const { supabase } = g;

  const eligible = await eligibleCourseIds(supabase);
  if ("error" in eligible) return fromDbError(eligible.error);

  const [{ data: courses, error: cErr }, { data: exams, error: eErr }] = await Promise.all([
    supabase.from("courses").select("id, slug, title_bn").in("id", eligible.ids.length ? eligible.ids : ["00000000-0000-0000-0000-000000000000"]),
    supabase
      .from("written_exams")
      .select("*, written_questions(id, question_bn, marks, sort_order), written_attempts(id, status)")
      .order("created_at", { ascending: false }),
  ]);
  if (cErr) return fromDbError(cErr);
  if (eErr) return fromDbError(eErr);

  return NextResponse.json(
    {
      eligibleCourses: courses ?? [],
      exams: (exams ?? []).map((e) => ({
        ...e,
        written_questions: (e.written_questions ?? []).sort(
          (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order,
        ),
        attempt_counts: {
          total: (e.written_attempts ?? []).length,
          submitted: (e.written_attempts ?? []).filter((a: { status: string }) => a.status === "submitted").length,
          graded: (e.written_attempts ?? []).filter((a: { status: string }) => a.status === "graded").length,
        },
        written_attempts: undefined,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

const questionSchema = z.object({
  questionBn: z.string().trim().min(5),
  marks: z.number().positive().max(100),
});

const createSchema = z.object({
  courseId: z.string().uuid(),
  titleBn: z.string().trim().min(3),
  instructionsBn: z.string().trim().max(4000).optional(),
  mode: z.enum(["typed", "upload", "both"]).default("both"),
  durationMinutes: z.number().int().min(10).max(600).default(180),
  totalMarks: z.number().positive().max(1000).default(100),
  opensAt: z.string().datetime().nullish(),
  closesAt: z.string().datetime().nullish(),
  questions: z.array(questionSchema).min(1).max(50),
});

export async function POST(request: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { user, supabase } = g;
  if (!sameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "অবৈধ ডেটা — শিরোনাম, কোর্স ও কমপক্ষে ১টি প্রশ্ন দিন।" }, { status: 422 });
  }

  const eligible = await eligibleCourseIds(supabase);
  if ("error" in eligible) return fromDbError(eligible.error);
  if (!eligible.ids.includes(body.courseId)) {
    return NextResponse.json(
      { error: "এই কোর্সের কোনো লিখিত পরীক্ষার স্টেজ নিবন্ধিত নেই। আগে এক্সাম রেজিস্ট্রিতে written স্টেজ যোগ করুন।" },
      { status: 422 },
    );
  }

  const { data: exam, error } = await supabase
    .from("written_exams")
    .insert({
      course_id: body.courseId,
      title_bn: body.titleBn,
      instructions_bn: body.instructionsBn ?? null,
      mode: body.mode,
      duration_minutes: body.durationMinutes,
      total_marks: body.totalMarks,
      opens_at: body.opensAt ?? null,
      closes_at: body.closesAt ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return fromDbError(error);

  const { error: qErr } = await supabase.from("written_questions").insert(
    body.questions.map((q, i) => ({
      exam_id: exam.id,
      question_bn: q.questionBn,
      marks: q.marks,
      sort_order: i,
    })),
  );
  if (qErr) return fromDbError(qErr);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "written_exam.create",
    entity_type: "written_exams",
    entity_id: exam.id,
    details: { course_id: body.courseId, title_bn: body.titleBn, questions: body.questions.length },
  });

  return NextResponse.json({ ok: true, examId: exam.id });
}

const patchSchema = z.object({
  examId: z.string().uuid(),
  action: z.enum(["update", "publish", "close"]),
  titleBn: z.string().trim().min(3).optional(),
  instructionsBn: z.string().trim().max(4000).nullish(),
  mode: z.enum(["typed", "upload", "both"]).optional(),
  durationMinutes: z.number().int().min(10).max(600).optional(),
  totalMarks: z.number().positive().max(1000).optional(),
  opensAt: z.string().datetime().nullish(),
  closesAt: z.string().datetime().nullish(),
  questions: z.array(questionSchema).min(1).max(50).optional(),
});

export async function PATCH(request: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { user, supabase } = g;
  if (!sameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 422 });
  }

  const { data: exam, error: exErr } = await supabase
    .from("written_exams")
    .select("id, status")
    .eq("id", body.examId)
    .single();
  if (exErr) return fromDbError(exErr);

  if (body.action === "publish") {
    if (exam.status !== "draft") {
      return NextResponse.json({ error: "শুধুমাত্র খসড়া পরীক্ষা প্রকাশ করা যায়।" }, { status: 422 });
    }
    const { count } = await supabase
      .from("written_questions")
      .select("id", { count: "exact", head: true })
      .eq("exam_id", body.examId);
    if (!count) {
      return NextResponse.json({ error: "প্রশ্ন ছাড়া পরীক্ষা প্রকাশ করা যাবে না।" }, { status: 422 });
    }
    const { error } = await supabase.from("written_exams").update({ status: "published" }).eq("id", body.examId);
    if (error) return fromDbError(error);
  } else if (body.action === "close") {
    const { error } = await supabase.from("written_exams").update({ status: "closed" }).eq("id", body.examId);
    if (error) return fromDbError(error);
  } else {
    if (exam.status !== "draft") {
      return NextResponse.json({ error: "প্রকাশিত পরীক্ষার গঠন বদলানো যাবে না — আগে বন্ধ করুন।" }, { status: 422 });
    }
    const patch: Record<string, unknown> = {};
    if (body.titleBn !== undefined) patch.title_bn = body.titleBn;
    if (body.instructionsBn !== undefined) patch.instructions_bn = body.instructionsBn;
    if (body.mode !== undefined) patch.mode = body.mode;
    if (body.durationMinutes !== undefined) patch.duration_minutes = body.durationMinutes;
    if (body.totalMarks !== undefined) patch.total_marks = body.totalMarks;
    if (body.opensAt !== undefined) patch.opens_at = body.opensAt;
    if (body.closesAt !== undefined) patch.closes_at = body.closesAt;
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from("written_exams").update(patch).eq("id", body.examId);
      if (error) return fromDbError(error);
    }
    if (body.questions) {
      const { error: delErr } = await supabase.from("written_questions").delete().eq("exam_id", body.examId);
      if (delErr) return fromDbError(delErr);
      const { error: insErr } = await supabase.from("written_questions").insert(
        body.questions.map((q, i) => ({
          exam_id: body.examId,
          question_bn: q.questionBn,
          marks: q.marks,
          sort_order: i,
        })),
      );
      if (insErr) return fromDbError(insErr);
    }
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: `written_exam.${body.action}`,
    entity_type: "written_exams",
    entity_id: body.examId,
    details: { action: body.action },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { user, supabase } = g;
  if (!sameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

  const examId = new URL(request.url).searchParams.get("examId");
  if (!examId) return NextResponse.json({ error: "examId প্রয়োজন।" }, { status: 422 });

  const { data: exam, error: exErr } = await supabase
    .from("written_exams")
    .select("id, status")
    .eq("id", examId)
    .single();
  if (exErr) return fromDbError(exErr);
  if (exam.status !== "draft") {
    return NextResponse.json({ error: "শুধুমাত্র খসড়া পরীক্ষা মুছে ফেলা যায়।" }, { status: 422 });
  }

  const { error } = await supabase.from("written_exams").delete().eq("id", examId);
  if (error) return fromDbError(error);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "written_exam.delete",
    entity_type: "written_exams",
    entity_id: examId,
    details: {},
  });

  return NextResponse.json({ ok: true });
}
