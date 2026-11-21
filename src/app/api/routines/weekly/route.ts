import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";
import { buildWeekPlan, mondayOf, weeklyExamComposition, type SyllabusSubject } from "@/lib/routines/weekly-plan";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/routines/weekly
 *
 * Generates one week of a student's plan from the real syllabus, and returns the
 * composition of the weekly exam that covers exactly the topics it scheduled.
 *
 * Ordering comes from `jh_topic_frequency` — counted questions per topic from
 * past papers the admin actually loaded. A topic with no count is ranked last
 * and labelled "no data"; it is never presented as low-frequency evidence.
 *
 * The plan is written to `student_routines` (the student's own table) rather
 * than `routines` (staff-owned, course-wide). Unfinished topics from the
 * previous week are folded in first, which is the carry-forward requirement.
 */

const schema = z.object({
  courseId: z.string().uuid(),
  /** ISO Monday. Omitted = this week in Dhaka. */
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  weekIndex: z.number().int().min(1).max(104).optional(),
  dailyMinutes: z.number().int().min(30).max(600).default(180),
  subjectsPerDay: z.number().int().min(2).max(3).default(3),
  save: z.boolean().default(false),
  /** Exam paper size; 0 skips the exam suggestion. */
  examQuestions: z.number().int().min(0).max(200).default(100),
});

function dhakaToday(): string {
  // Dhaka is UTC+6 with no DST; formatting the UTC clock with the offset keeps
  // this pure and testable instead of relying on the server's locale.
  const now = new Date();
  return new Date(now.getTime() + 6 * 3600_000).toISOString().slice(0, 10);
}

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

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  const { data: course } = await supabase
    .from("courses")
    .select("id, status, title_bn")
    .eq("id", body.courseId)
    .maybeSingle();
  if (!course || course.status !== "published") {
    return NextResponse.json({ error: "কোর্সটি প্রকাশিত নয়।" }, { status: 409 });
  }

  const weekStart = mondayOf(body.weekStart ?? dhakaToday());
  const weekIndex = body.weekIndex ?? 1;
  const previousWeek = new Date(new Date(`${weekStart}T00:00:00Z`).getTime() - 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  // The real syllabus for this course. `topics` has no course_id: it hangs off
  // subjects, so the join goes through them.
  const { data: subjectRows } = await supabase
    .from("subjects")
    .select("id, title_bn")
    .eq("course_id", body.courseId)
    .eq("is_active", true)
    .order("sort_order");
  const subjects = (subjectRows ?? []) as Array<{ id: string; title_bn: string }>;

  const { data: topicRows } = subjects.length
    ? await supabase
        .from("topics")
        .select("id, subject_id, title_bn")
        .in("subject_id", subjects.map((subject) => subject.id))
        .eq("is_active", true)
        .order("sort_order")
    : { data: [] as Array<{ id: string; subject_id: string; title_bn: string }> };
  const topics = (topicRows ?? []) as Array<{ id: string; subject_id: string; title_bn: string }>;

  if (topics.length === 0) {
    return NextResponse.json(
      {
        error: "এই কোর্সে এখনো কোনো টপিক নেই — আগে সিলেবাস যোগ করুন।",
        code: "EMPTY_SYLLABUS",
      },
      { status: 409 },
    );
  }

  // Counted frequency. Empty is a legitimate answer ("no exam data loaded yet").
  const frequency = new Map<string, { total: number; band: "high" | "medium" | "low" }>();
  const { data: freqRows, error: freqError } = await supabase.rpc("jh_topic_frequency", {
    p_course_id: body.courseId,
  });
  if (!freqError) {
    for (const row of (freqRows ?? []) as Array<{ topic_id: string; total_questions: number; band: string }>) {
      if (!row.topic_id) continue;
      frequency.set(row.topic_id, {
        total: Number(row.total_questions) || 0,
        band: row.band === "high" || row.band === "low" ? row.band : "medium",
      });
    }
  }

  // What the student already finished, so it is never re-scheduled.
  const { data: doneRows } = await supabase
    .from("routine_progress")
    .select("topic_id")
    .eq("user_id", user.id)
    .eq("course_id", body.courseId)
    .eq("status", "done");
  const completed = new Set(((doneRows ?? []) as Array<{ topic_id: string | null }>).map((row) => row.topic_id).filter(Boolean) as string[]);

  // Unfinished topics from last week become this week's first slots.
  const { data: lastWeek } = await supabase
    .from("student_routines")
    .select("id, topic_id, subject_id")
    .eq("user_id", user.id)
    .eq("course_id", body.courseId)
    .gte("routine_date", previousWeek)
    .lte("routine_date", new Date(new Date(`${previousWeek}T00:00:00Z`).getTime() + 6 * 86_400_000).toISOString().slice(0, 10));
  const lastWeekTopics = new Set(((lastWeek ?? []) as Array<{ topic_id: string | null }>).map((row) => row.topic_id).filter(Boolean) as string[]);

  let carryOver: string[] = [];
  if (lastWeekTopics.size > 0) {
    const { data: finished } = await supabase
      .from("routine_progress")
      .select("topic_id")
      .eq("user_id", user.id)
      .eq("course_id", body.courseId)
      .eq("status", "done")
      .in("topic_id", [...lastWeekTopics]);
    const finishedTopics = new Set(((finished ?? []) as Array<{ topic_id: string }>).map((row) => row.topic_id));
    carryOver = [...lastWeekTopics].filter((id) => !finishedTopics.has(id));
  }

  const syllabus: SyllabusSubject[] = subjects.map((subject) => ({
    id: subject.id,
    title_bn: subject.title_bn,
    topics: topics
      .filter((topic) => topic.subject_id === subject.id)
      .map((topic) => ({
        id: topic.id,
        subject_id: topic.subject_id,
        title_bn: topic.title_bn,
        frequency: frequency.get(topic.id)?.total ?? 0,
        band: frequency.get(topic.id)?.band ?? "none",
      })),
  }));

  const slots = buildWeekPlan(syllabus, {
    weekStart,
    weekIndex,
    dailyMinutes: body.dailyMinutes,
    subjectsPerDay: body.subjectsPerDay,
    completedTopicIds: completed,
    priorityTopicIds: carryOver,
  });

  const composition = weeklyExamComposition(slots, body.examQuestions);

  let saved = 0;
  if (body.save && slots.length > 0) {
    // Replace only this week; earlier weeks are history and stay untouched.
    const dates = [...new Set(slots.map((slot) => slot.date))];
    const { error: deleteError } = await supabase
      .from("student_routines")
      .delete()
      .eq("user_id", user.id)
      .eq("course_id", body.courseId)
      .gte("routine_date", dates[0])
      .lte("routine_date", dates[dates.length - 1]);
    if (deleteError) {
      return NextResponse.json({ error: "পুরনো সপ্তাহ মুছতে সমস্যা হয়েছে।" }, { status: 500 });
    }

    const rows = slots.map((slot) => ({
      user_id: user.id,
      course_id: body.courseId,
      kind: "daily" as const,
      routine_date: slot.date,
      plan_day: Math.max(
        1,
        Math.min(31, Math.round((new Date(`${slot.date}T00:00:00Z`).getTime() - new Date(`${weekStart}T00:00:00Z`).getTime()) / 86_400_000) + 1),
      ),
      plan_kind: slot.task_kind,
      title_en: "",
      title_bn: slot.title_bn,
      subject_id: slot.subject_id,
      topic_id: slot.topic_id,
      subtopic_id: slot.subtopic_id,
      minutes: slot.minutes,
      focus_note_bn: slot.focus_note_bn,
      status: "published" as const,
      created_by: user.id,
    }));

    // A day can hold two slots for the same subject; `student_routines_slot_idx`
    // keys on (user, course, plan_day), so save through an upsert on that key
    // after collapsing duplicates. Losing a slot is worse than merging it, so
    // minutes are summed rather than dropped.
    const byKey = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const key = `${row.plan_day}:${row.subject_id}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.minutes = Math.min(480, existing.minutes + row.minutes);
        existing.focus_note_bn = `${existing.focus_note_bn ?? ""} · ${row.title_bn}`.slice(0, 600);
      } else {
        byKey.set(key, { ...row });
      }
    }

    const { data: inserted, error } = await supabase
      .from("student_routines")
      .upsert([...byKey.values()], { onConflict: "user_id,course_id,plan_day" })
      .select("id");
    if (error) {
      return NextResponse.json({ error: `সপ্তাহের প্ল্যান সংরক্ষণ ব্যর্থ: ${error.message}` }, { status: 500 });
    }
    saved = inserted?.length ?? 0;
  }

  const weekEnd = new Date(new Date(`${weekStart}T00:00:00Z`).getTime() + 6 * 86_400_000).toISOString().slice(0, 10);

  return NextResponse.json(
    {
      weekStart,
      weekEnd,
      weekIndex,
      course: { id: course.id, title_bn: course.title_bn },
      slots,
      exam: {
        weekStart,
        questionCount: body.examQuestions,
        composition,
        // Honest statement of what the exam can be built from.
        topicsCovered: new Set(slots.map((slot) => slot.topic_id)).size,
        subjectsCovered: new Set(slots.map((slot) => slot.subject_id)).size,
      },
      carryOver: carryOver.length,
      frequencyAvailable: frequency.size,
      saved,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** GET — the current week's saved plan, read through the caller's own RLS. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });

  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId");
  if (!courseId) return NextResponse.json({ error: "courseId প্রয়োজন।" }, { status: 400 });

  const weekStart = mondayOf(url.searchParams.get("weekStart") ?? dhakaToday());
  const weekEnd = new Date(new Date(`${weekStart}T00:00:00Z`).getTime() + 6 * 86_400_000).toISOString().slice(0, 10);

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  const { data, error } = await supabase
    .from("student_routines")
    .select("id, routine_date, plan_day, title_bn, subject_id, topic_id, subtopic_id, minutes, focus_note_bn, status, plan_kind")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .gte("routine_date", weekStart)
    .lte("routine_date", weekEnd)
    .order("routine_date")
    .order("minutes", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const planIds = (data ?? []).map((row) => row.id as string);
  const progress = new Map<string, { status: string; completion: number }>();
  if (planIds.length > 0) {
    const { data: progressRows } = await supabase
      .from("routine_progress")
      .select("plan_id, status, completion")
      .eq("user_id", user.id)
      .in("plan_id", planIds);
    for (const row of progressRows ?? []) {
      if (row.plan_id) progress.set(row.plan_id as string, { status: row.status as string, completion: Number(row.completion) });
    }
  }

  return NextResponse.json(
    {
      weekStart,
      weekEnd,
      days: (data ?? []).map((row) => ({
        ...row,
        progress: progress.get(row.id as string) ?? { status: "pending", completion: 0 },
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
