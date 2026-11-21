import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/routines/progress
 *
 * Records that the student studied a routine slot — or did not.
 *
 * This is what turns the plan into a progress tracker. It writes
 * `routine_progress` (per-slot completion) and leaves `study_progress` alone:
 * that table measures practice accuracy from submitted exams and must not be
 * editable from a client at all.
 *
 * Idempotent: the same slot ticked twice updates rather than duplicates, and
 * marking a slot done is what stops it being carried into next week.
 */

const schema = z.object({
  courseId: z.string().uuid(),
  planId: z.string().uuid().nullable().optional(),
  routineId: z.string().uuid().nullable().optional(),
  subjectId: z.string().uuid().nullable().optional(),
  topicId: z.string().uuid().nullable().optional(),
  subtopicId: z.string().uuid().nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["pending", "in_progress", "done", "skipped"]),
  completion: z.number().int().min(0).max(100).optional(),
  minutesSpent: z.number().int().min(0).max(1440).optional(),
  note: z.string().max(600).optional().default(""),
});

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 400 });
  }

  if (!body.planId && !body.routineId && !body.topicId) {
    return NextResponse.json({ error: "কোনো টপিক বা রুটিন নির্বাচন করা হয়নি।" }, { status: 422 });
  }

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  // A personal plan slot must belong to the caller. RLS enforces this too, but
  // checking here produces a clear error instead of a silent zero-row update.
  if (body.planId) {
    const { data: plan } = await supabase
      .from("student_routines")
      .select("id, user_id, course_id")
      .eq("id", body.planId)
      .maybeSingle();
    if (!plan || plan.user_id !== user.id) {
      return NextResponse.json({ error: "এই প্ল্যানটি আপনার নয়।" }, { status: 403 });
    }
  }

  const completion = body.completion ?? (body.status === "done" ? 100 : body.status === "in_progress" ? 50 : 0);

  const { data, error } = await supabase
    .from("routine_progress")
    .upsert(
      {
        user_id: user.id,
        course_id: body.courseId,
        plan_id: body.planId ?? null,
        routine_id: body.routineId ?? null,
        subject_id: body.subjectId ?? null,
        topic_id: body.topicId ?? null,
        subtopic_id: body.subtopicId ?? null,
        progress_date: body.date,
        status: body.status,
        completion: body.status === "done" ? 100 : completion,
        minutes_spent: body.minutesSpent ?? 0,
        note_bn: body.note || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,progress_date,subject_id,topic_id,subtopic_id" },
    )
    .select("id, status, completion")
    .single();

  if (error) {
    return NextResponse.json({ error: `অগ্রগতি সংরক্ষণ ব্যর্থ: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ progress: data }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * GET /api/routines/progress?courseId=…&from=…&to=…
 *
 * The numbers the dashboard shows: how much of the plan is actually done, per
 * topic. Measured against the student's own scheduled slots — a percentage that
 * means "of what you were told to study", not "of the whole syllabus".
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });

  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!courseId) return NextResponse.json({ error: "courseId প্রয়োজন।" }, { status: 400 });

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  let query = supabase
    .from("routine_progress")
    .select("progress_date, status, completion, minutes_spent, subject_id, topic_id")
    .eq("user_id", user.id)
    .eq("course_id", courseId);
  if (from) query = query.gte("progress_date", from);
  if (to) query = query.lte("progress_date", to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as Array<{
    status: string; completion: number; minutes_spent: number;
    subject_id: string | null; topic_id: string | null;
  }>;

  const byTopic = new Map<string, { subject_id: string | null; done: number; total: number; minutes: number }>();
  let done = 0;
  let minutes = 0;
  for (const row of rows) {
    if (row.status === "done") done += 1;
    minutes += Number(row.minutes_spent) || 0;
    const key = row.topic_id ?? "none";
    const entry = byTopic.get(key) ?? { subject_id: row.subject_id, done: 0, total: 0, minutes: 0 };
    entry.total += 1;
    if (row.status === "done") entry.done += 1;
    entry.minutes += Number(row.minutes_spent) || 0;
    byTopic.set(key, entry);
  }

  return NextResponse.json(
    {
      slots: rows.length,
      done,
      completion: rows.length === 0 ? 0 : Math.round((done / rows.length) * 100),
      minutes,
      topics: [...byTopic.entries()].map(([topicId, entry]) => ({
        topic_id: topicId === "none" ? null : topicId,
        subject_id: entry.subject_id,
        done: entry.done,
        total: entry.total,
        completion: Math.round((entry.done / entry.total) * 100),
        minutes: entry.minutes,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
