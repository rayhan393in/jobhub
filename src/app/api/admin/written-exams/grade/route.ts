import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { fromDbError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Examiner side of written exams.
 *
 * GET ?examId → every attempt of the exam with typed answers and খাতা
 *               uploads (private bucket → short-lived signed URLs).
 * PATCH       → save per-answer marks/notes; finalize=true sums the marks,
 *               stamps the examiner and flips the attempt to 'graded'.
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
    return { error: NextResponse.json({ error: "খাতা দেখার অনুমতি নেই।" }, { status: 403 }) };
  }
  const supabase = await getServerClient();
  if (!supabase) return { error: NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 }) };
  return { user, supabase };
}

export async function GET(request: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { supabase } = g;

  const examId = new URL(request.url).searchParams.get("examId");
  if (!examId) return NextResponse.json({ error: "examId প্রয়োজন।" }, { status: 422 });

  const { data: attempts, error } = await supabase
    .from("written_attempts")
    .select(
      `id, user_id, status, started_at, submitted_at, graded_at, total_awarded, examiner_note_bn,
       profiles:user_id (full_name, email),
       written_answers (id, question_id, answer_text, awarded_marks, examiner_note_bn),
       written_uploads (id, storage_path, file_name, mime_type, uploaded_at)`,
    )
    .eq("exam_id", examId)
    .order("submitted_at", { ascending: true, nullsFirst: false });
  if (error) return fromDbError(error);

  // Signed URLs for খাতা pages (bucket is private by design).
  const admin = getAdminClient();
  const withUrls = await Promise.all(
    (attempts ?? []).map(async (a) => ({
      ...a,
      written_uploads: await Promise.all(
        (a.written_uploads ?? []).map(async (u: { storage_path: string } & Record<string, unknown>) => {
          const { data: signed } = await admin.storage
            .from("written-scripts")
            .createSignedUrl(u.storage_path, 60 * 30);
          return { ...u, signed_url: signed?.signedUrl ?? null };
        }),
      ),
    })),
  );

  return NextResponse.json({ attempts: withUrls }, { headers: { "Cache-Control": "no-store" } });
}

const gradeSchema = z.object({
  attemptId: z.string().uuid(),
  grades: z
    .array(
      z.object({
        answerId: z.string().uuid(),
        awardedMarks: z.number().min(0).max(1000).nullable(),
        examinerNoteBn: z.string().trim().max(2000).nullish(),
      }),
    )
    .max(100)
    .default([]),
  examinerNoteBn: z.string().trim().max(4000).nullish(),
  finalize: z.boolean().default(false),
});

export async function PATCH(request: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { user, supabase } = g;
  if (!sameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

  let body: z.infer<typeof gradeSchema>;
  try {
    body = gradeSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 422 });
  }

  const { data: attempt, error: aErr } = await supabase
    .from("written_attempts")
    .select("id, status, exam_id")
    .eq("id", body.attemptId)
    .single();
  if (aErr) return fromDbError(aErr);
  if (attempt.status === "in_progress") {
    return NextResponse.json({ error: "শিক্ষার্থী এখনো জমা দেয়নি — খাতা দেখা যাবে না।" }, { status: 422 });
  }

  for (const grade of body.grades) {
    const { error } = await supabase
      .from("written_answers")
      .update({
        awarded_marks: grade.awardedMarks,
        examiner_note_bn: grade.examinerNoteBn ?? null,
      })
      .eq("id", grade.answerId)
      .eq("attempt_id", body.attemptId);
    if (error) return fromDbError(error);
  }

  if (body.finalize) {
    const { data: answers, error: sumErr } = await supabase
      .from("written_answers")
      .select("awarded_marks")
      .eq("attempt_id", body.attemptId);
    if (sumErr) return fromDbError(sumErr);
    const total = (answers ?? []).reduce((s, a) => s + (Number(a.awarded_marks) || 0), 0);

    const { error } = await supabase
      .from("written_attempts")
      .update({
        status: "graded",
        graded_at: new Date().toISOString(),
        total_awarded: total,
        examiner_id: user.id,
        examiner_note_bn: body.examinerNoteBn ?? null,
      })
      .eq("id", body.attemptId);
    if (error) return fromDbError(error);
  } else if (body.examinerNoteBn !== undefined) {
    const { error } = await supabase
      .from("written_attempts")
      .update({ examiner_note_bn: body.examinerNoteBn ?? null, examiner_id: user.id })
      .eq("id", body.attemptId);
    if (error) return fromDbError(error);
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: body.finalize ? "written_exam.finalize_grade" : "written_exam.grade",
    entity_type: "written_attempts",
    entity_id: body.attemptId,
    details: { graded_answers: body.grades.length, finalize: body.finalize },
  });

  return NextResponse.json({ ok: true });
}
