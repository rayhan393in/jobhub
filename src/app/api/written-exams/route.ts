import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";
import { fromDbError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Student side of written exams (লিখিত পরীক্ষা).
 *
 * GET    → published written exams (+ own attempt state, + questions and own
 *          answers for an active/finished attempt). RLS keeps everyone honest.
 * POST   → start the single allowed attempt { examId }.
 * PATCH  → autosave typed answers { attemptId, answers[] } or submit
 *          { attemptId, action: 'submit' }.
 */

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  return !origin || !host || new URL(origin).host === host;
}

async function guard() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 }) };
  const supabase = await getServerClient();
  if (!supabase) return { error: NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 }) };
  return { user, supabase };
}

export async function GET() {
  const g = await guard();
  if ("error" in g) return g.error;
  const { user, supabase } = g;

  const [{ data: exams, error: eErr }, { data: attempts, error: aErr }] = await Promise.all([
    supabase
      .from("written_exams")
      .select("id, course_id, title_bn, instructions_bn, mode, duration_minutes, total_marks, opens_at, closes_at, status, courses(slug, title_bn), written_questions(id, question_bn, marks, sort_order)")
      .in("status", ["published", "closed"])
      .order("created_at", { ascending: false }),
    supabase
      .from("written_attempts")
      .select("id, exam_id, status, started_at, submitted_at, graded_at, total_awarded, examiner_note_bn, written_answers(id, question_id, answer_text, awarded_marks, examiner_note_bn), written_uploads(id, file_name, mime_type, uploaded_at)")
      .eq("user_id", user.id),
  ]);
  if (eErr) return fromDbError(eErr);
  if (aErr) return fromDbError(aErr);

  const byExam = new Map((attempts ?? []).map((a) => [a.exam_id, a]));
  return NextResponse.json(
    {
      exams: (exams ?? []).map((e) => ({
        ...e,
        written_questions: (e.written_questions ?? []).sort(
          (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order,
        ),
        my_attempt: byExam.get(e.id) ?? null,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

const startSchema = z.object({ examId: z.string().uuid() });

export async function POST(request: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { user, supabase } = g;
  if (!sameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

  let body: z.infer<typeof startSchema>;
  try {
    body = startSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 422 });
  }

  const { data, error } = await supabase
    .from("written_attempts")
    .insert({ exam_id: body.examId, user_id: user.id })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "এই পরীক্ষায় আপনার একটি খাতা ইতিমধ্যে আছে।" }, { status: 409 });
    }
    if (error.code === "42501") {
      return NextResponse.json({ error: "পরীক্ষাটি এখন খোলা নেই।" }, { status: 403 });
    }
    return fromDbError(error);
  }

  return NextResponse.json({ ok: true, attemptId: data.id });
}

const saveSchema = z.object({
  attemptId: z.string().uuid(),
  action: z.enum(["save", "submit"]).default("save"),
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        answerText: z.string().max(20000),
      }),
    )
    .max(50)
    .default([]),
});

export async function PATCH(request: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { user, supabase } = g;
  if (!sameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

  let body: z.infer<typeof saveSchema>;
  try {
    body = saveSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 422 });
  }

  // Own, in-progress attempt only (RLS re-checks everything anyway).
  const { data: attempt, error: aErr } = await supabase
    .from("written_attempts")
    .select("id, status, user_id")
    .eq("id", body.attemptId)
    .eq("user_id", user.id)
    .single();
  if (aErr) return fromDbError(aErr);
  if (attempt.status !== "in_progress") {
    return NextResponse.json({ error: "খাতাটি ইতিমধ্যে জমা হয়ে গেছে।" }, { status: 422 });
  }

  for (const ans of body.answers) {
    const { error } = await supabase
      .from("written_answers")
      .upsert(
        { attempt_id: body.attemptId, question_id: ans.questionId, answer_text: ans.answerText },
        { onConflict: "attempt_id,question_id" },
      );
    if (error) return fromDbError(error);
  }

  if (body.action === "submit") {
    const { error } = await supabase
      .from("written_attempts")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", body.attemptId);
    if (error) return fromDbError(error);
  }

  return NextResponse.json({ ok: true });
}
