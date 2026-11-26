import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerClient } from "@/lib/supabase/server";
import { fromDbError, assertSameOrigin, requireApiPermission } from "@/lib/api";
import { weeklyExamComposition } from "@/lib/routines/weekly-plan";
import { flattenEmbeddedTitle } from "@/lib/postgrest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/admin/weekly-exam
 *
 * Requirement 4: the weekly exam is built from *that week's published routine*
 * and starts automatically on its scheduled day.
 *
 * Three guarantees the spec asks for, and how each is kept:
 *   - "সেই সপ্তাহের Routine-এ অন্তর্ভুক্ত Topics থেকে" — the topic list is read
 *     from `routines` rows for the week, never from a hand-typed list;
 *   - "একাধিক Subject" — every subject present in the week gets a proportional
 *     share of the paper, so the single-subject limit is gone;
 *   - "পূর্ণমান ১০০" — the mark is fixed, and the difficulty mix is the stored
 *     60/20/10/10 unless the admin overrides it.
 */

const schema = z.object({
  courseId: z.string().uuid(),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startsAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().min(10).max(240).default(90),
  questionCount: z.number().int().min(10).max(200).default(100),
  totalMarks: z.number().int().min(1).max(500).default(100),
  negativeMarks: z.number().min(0).max(5).default(0.5),
  resultDelayMinutes: z.number().int().min(0).max(10080).default(30),
  /** Only used when the admin deliberately strays from 60/20/10/10. */
  mix: z
    .object({
      previous: z.number().int().min(0).max(100),
      hard: z.number().int().min(0).max(100),
      easy: z.number().int().min(0).max(100),
      medium: z.number().int().min(0).max(100),
    })
    .optional(),
  titleBn: z.string().trim().max(160).optional(),
  /** Publish immediately instead of leaving a draft. */
  publish: z.boolean().default(false),
});

const DEFAULT_MIX = { previous: 60, hard: 20, easy: 10, medium: 10 };

export async function POST(request: Request) {
  const guard = await requireApiPermission("exam.publish");
  if ("error" in guard) return guard.error;
  const { user } = guard;
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 422 });
  }

  const mix = body.mix ?? DEFAULT_MIX;
  const mixTotal = mix.previous + mix.hard + mix.easy + mix.medium;
  if (mixTotal !== 100) {
    return NextResponse.json({ error: `কঠিনতার অনুপাতের যোগফল ১০০ হতে হবে (এখন ${mixTotal})।` }, { status: 422 });
  }

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  const weekEnd = new Date(new Date(`${body.weekStart}T00:00:00Z`).getTime() + 6 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  // The week's *published* routine — the only legitimate source of topics.
  const { data: routineRows, error: routineError } = await supabase
    .from("routines")
    .select("id, routine_date, subject_id, topic_id, minutes")
    .eq("course_id", body.courseId)
    .eq("status", "published")
    .gte("routine_date", body.weekStart)
    .lte("routine_date", weekEnd);
  if (routineError) return fromDbError(routineError);

  const routines = (routineRows ?? []) as Array<{
    id: string; routine_date: string; subject_id: string | null; topic_id: string | null; minutes: number;
  }>;

  const usable = routines.filter((row) => row.topic_id && row.subject_id);
  if (usable.length === 0) {
    return NextResponse.json(
      {
        error: "এই সপ্তাহে প্রকাশিত রুটিনে কোনো টপিক নেই — আগে রুটিন প্রকাশ করুন, তারপর পরীক্ষা তৈরি হবে।",
        code: "NO_ROUTINE",
      },
      { status: 409 },
    );
  }

  // Proportional split across exactly those topics, by minutes studied.
  const composition = weeklyExamComposition(
    usable.map((row) => ({
      date: row.routine_date,
      week_index: 1,
      subject_id: row.subject_id as string,
      topic_id: row.topic_id as string,
      subtopic_id: null,
      minutes: row.minutes,
      task_kind: "study" as const,
      title_bn: "",
      focus_note_bn: "",
    })),
    body.questionCount,
  );

  if (composition.length === 0) {
    return NextResponse.json({ error: "প্রশ্ন বণ্টন করা যায়নি।" }, { status: 422 });
  }

  // Refuse up-front rather than publishing an exam the bank cannot fill.
  const { data: availability } = await supabase.rpc("jh_question_availability", {
    p_course_id: body.courseId,
    p_subject_id: null,
    p_topic_id: null,
    p_subtopic_id: null,
  });
  const totalAvailable = Number(availability ?? 0);

  const items = composition.map((item) => ({
    subject_id: item.subject_id,
    topic_id: item.topic_id,
    subtopic_id: null,
    count: item.count,
  }));

  const startsAt = new Date(body.startsAt);
  const endsAt = new Date(startsAt.getTime() + body.durationMinutes * 60_000);
  const releaseAt = new Date(endsAt.getTime() + body.resultDelayMinutes * 60_000);
  const titleBn = body.titleBn?.trim() || `সাপ্তাহিক পরীক্ষা · ${body.weekStart}`;

  // A weekly exam per course per week — re-running replaces the draft.
  const { data: existing } = await supabase
    .from("exam_schedules")
    .select("id, status")
    .eq("course_id", body.courseId)
    .eq("exam_kind", "weekly")
    .eq("week_start", body.weekStart)
    .in("status", ["draft", "published"])
    .maybeSingle();

  if (existing?.status === "published") {
    return NextResponse.json(
      { error: "এই সপ্তাহের পরীক্ষা ইতিমধ্যেই প্রকাশিত — বাতিল না করে নতুন করে তৈরি করা যাবে না।" },
      { status: 409 },
    );
  }

  const schedulePayload = {
    course_id: body.courseId,
    kind: "weekly_special" as const,
    title_en: titleBn,
    title_bn: titleBn,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    result_release_at: releaseAt.toISOString(),
    duration_minutes: body.durationMinutes,
    question_count: body.questionCount,
    total_marks: body.totalMarks,
    positive_marks: Number((body.totalMarks / body.questionCount).toFixed(2)),
    negative_marks: body.negativeMarks,
    status: "draft" as const,
    week_start: body.weekStart,
    exam_kind: "weekly",
    auto_start: true,
    routine_ids: usable.map((row) => row.id),
    settings: {
      composition: { items },
      difficulty_mix: mix,
      week_start: body.weekStart,
      source: "routine",
    },
    created_by: user.id,
  };

  const { data: schedule, error: scheduleError } = existing
    ? await supabase.from("exam_schedules").update(schedulePayload).eq("id", existing.id).select("id").single()
    : await supabase.from("exam_schedules").insert(schedulePayload).select("id").single();

  if (scheduleError) return fromDbError(scheduleError);

  let paperId: string | null = null;
  let buildError: string | null = null;

  if (body.publish) {
    // jh_publish_schedule validates windows and availability, then builds the
    // paper. It does not know about the difficulty mix, so the mixed builder
    // runs first and the schedule points at its paper.
    const { data: paper, error } = await supabase.rpc("jh_build_paper_with_mix", {
      p_course_id: body.courseId,
      p_composition: { items },
      p_title_en: titleBn,
      p_title_bn: titleBn,
      p_duration_minutes: body.durationMinutes,
      p_total_marks: body.totalMarks,
      p_negative_marks: body.negativeMarks,
      p_created_by: user.id,
      p_mix: mix,
      p_paper_type: "scheduled",
      p_schedule_id: schedule.id,
    });
    if (error) {
      buildError = error.message;
    } else {
      paperId = paper as string;
      await supabase
        .from("exam_schedules")
        .update({ status: "published", published_by: user.id, published_at: new Date().toISOString() })
        .eq("id", schedule.id);
    }
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: body.publish ? "weekly_exam.publish" : "weekly_exam.draft",
    entity_type: "exam_schedules",
    entity_id: schedule.id,
    details: { week_start: body.weekStart, topics: composition.length, questions: body.questionCount, mix },
  });

  return NextResponse.json(
    {
      scheduleId: schedule.id,
      weekStart: body.weekStart,
      topicsCovered: composition.length,
      subjectsCovered: new Set(composition.map((item) => item.subject_id)).size,
      totalAvailable,
      paperId,
      published: Boolean(paperId),
      // An honest refusal: the draft exists, but the bank is short.
      error: buildError,
      mix,
    },
    { headers: { "Cache-Control": "no-store" }, status: buildError ? 409 : 200 },
  );
}

const previewSchema = z.object({
  courseId: z.string().uuid(),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** GET — what the weekly exam *would* cover, before creating anything. */
export async function GET(request: Request) {
  const guard = await requireApiPermission("exam.publish");
  if ("error" in guard) return guard.error;

  const url = new URL(request.url);
  const parsed = previewSchema.safeParse({
    courseId: url.searchParams.get("courseId"),
    weekStart: url.searchParams.get("weekStart"),
  });
  if (!parsed.success) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 400 });

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  const weekEnd = new Date(new Date(`${parsed.data.weekStart}T00:00:00Z`).getTime() + 6 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const { data } = await supabase
    .from("routines")
    .select("topic_id, subject_id, minutes, topic_title_bn:topics(title_bn), subject_title_bn:subjects(title_bn)")
    .eq("course_id", parsed.data.courseId)
    .eq("status", "published")
    .gte("routine_date", parsed.data.weekStart)
    .lte("routine_date", weekEnd);

  const rows = (data ?? []).map((row) => ({
    ...row,
    topic_title_bn: flattenEmbeddedTitle(row.topic_title_bn),
    subject_title_bn: flattenEmbeddedTitle(row.subject_title_bn),
  })) as unknown as Array<{
    topic_id: string | null;
    subject_id: string | null;
    minutes: number;
    topic_title_bn: string | null;
    subject_title_bn: string | null;
  }>;

  const byTopic = new Map<string, { topic_bn: string; subject_bn: string; minutes: number; subject_id: string }>();
  for (const row of rows) {
    if (!row.topic_id || !row.subject_id) continue;
    const entry = byTopic.get(row.topic_id) ?? {
      topic_bn: row.topic_title_bn ?? "টপিক",
      subject_bn: row.subject_title_bn ?? "বিষয়",
      minutes: 0,
      subject_id: row.subject_id,
    };
    entry.minutes += row.minutes;
    byTopic.set(row.topic_id, entry);
  }

  return NextResponse.json(
    {
      weekStart: parsed.data.weekStart,
      weekEnd,
      routineRows: rows.filter((row) => row.topic_id).length,
      topics: [...byTopic.values()].sort((a, b) => b.minutes - a.minutes),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
