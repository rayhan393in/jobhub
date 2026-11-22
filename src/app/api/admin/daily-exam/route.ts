import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getServerClient } from "@/lib/supabase/server";
import { fromDbError } from "@/lib/api";
import {
  hasCriticalFailure,
  planSubject,
  resolveRotation,
  splitNinetyTen,
  validateDailyPlan,
  type DifficultyMix,
  type RotationSlot,
  type SubjectPlan,
  type ValidationCheck,
} from "@/lib/daily-exam";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Daily 100-mark live exam (90:10) — built ON TOP of the existing engine:
 * the rotation tables pick the day's subject pair, the planner scopes the
 * composition to routine topics, and the actual paper/attempt/result flow is
 * the same exam_schedules → jh_build_paper_with_mix path the weekly exam uses.
 *
 * GET    ?courseId&date[&days]  → resolved rotation, 90:10 plan, validation
 *                                 checklist, and an upcoming-days preview.
 * POST   { courseId, date, … }  → draft or publish that day's schedule.
 * PATCH  { courseId, … }        → update config / set or clear an override.
 */

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  return !origin || !host || new URL(origin).host === host;
}

type Supabase = SupabaseClient;

type DayContext = {
  config: {
    anchor_date: string;
    question_count: number;
    duration_minutes: number;
    negative_marks: number;
    difficulty_mix: DifficultyMix;
    cumulative_revision: boolean;
    allow_whole_subject_fallback: boolean;
  };
  slots: RotationSlot[];
};

async function loadContext(supabase: Supabase, courseId: string): Promise<DayContext | null> {
  const [{ data: config }, { data: slots }] = await Promise.all([
    supabase.from("daily_exam_config").select("*").eq("course_id", courseId).maybeSingle(),
    supabase
      .from("daily_rotation_slots")
      .select("position, main_subject_id, secondary_subject_id, is_grand")
      .eq("course_id", courseId)
      .order("position"),
  ]);
  if (!config || !slots?.length) return null;
  const mix = (config.difficulty_mix ?? {}) as Partial<DifficultyMix>;
  return {
    config: {
      anchor_date: config.anchor_date,
      question_count: config.question_count,
      duration_minutes: config.duration_minutes,
      negative_marks: Number(config.negative_marks),
      difficulty_mix: {
        previous: mix.previous ?? 0,
        easy: mix.easy ?? 30,
        medium: mix.medium ?? 50,
        hard: mix.hard ?? 20,
      },
      cumulative_revision: config.cumulative_revision,
      allow_whole_subject_fallback: config.allow_whole_subject_fallback,
    },
    slots: (slots ?? []) as RotationSlot[],
  };
}

/**
 * Eligible topics for a subject on an exam date = topics from the *published*
 * routine. Cumulative revision mode looks back over everything scheduled so
 * far; otherwise only the exam week (last 7 days) counts.
 */
async function eligibleTopicIds(
  supabase: Supabase,
  courseId: string,
  subjectId: string,
  examDate: string,
  cumulative: boolean,
): Promise<string[]> {
  let query = supabase
    .from("routines")
    .select("topic_id, topic_ids")
    .eq("course_id", courseId)
    .eq("subject_id", subjectId)
    .eq("status", "published")
    .lte("routine_date", examDate);
  if (!cumulative) {
    const weekAgo = new Date(new Date(`${examDate}T00:00:00Z`).getTime() - 6 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    query = query.gte("routine_date", weekAgo);
  }
  const { data } = await query;
  const ids = new Set<string>();
  for (const row of (data ?? []) as { topic_id: string | null; topic_ids: string[] | null }[]) {
    if (row.topic_id) ids.add(row.topic_id);
    for (const id of row.topic_ids ?? []) if (id) ids.add(id);
  }
  return [...ids];
}

/** Approved + verified question counts, per eligible topic and whole-subject. */
async function subjectPools(
  supabase: Supabase,
  courseId: string,
  subjectId: string,
  topicIds: string[],
): Promise<{ topicPools: { topicId: string; available: number }[]; wholeSubject: number }> {
  const wholeSubjectPromise = supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId)
    .eq("subject_id", subjectId)
    .eq("status", "approved")
    .eq("is_verified", true);

  if (topicIds.length === 0) {
    const { count } = await wholeSubjectPromise;
    return { topicPools: [], wholeSubject: count ?? 0 };
  }

  const [{ count }, { data: rows }] = await Promise.all([
    wholeSubjectPromise,
    supabase
      .from("questions")
      .select("topic_id")
      .eq("course_id", courseId)
      .eq("subject_id", subjectId)
      .eq("status", "approved")
      .eq("is_verified", true)
      .in("topic_id", topicIds)
      .limit(5000),
  ]);

  const counts = new Map<string, number>();
  for (const row of rows ?? []) {
    const id = row.topic_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return {
    topicPools: topicIds.map((topicId) => ({ topicId, available: counts.get(topicId) ?? 0 })),
    wholeSubject: count ?? 0,
  };
}

type DailyPlan = {
  kind: "daily";
  position: number;
  overridden: boolean;
  mainSubjectId: string;
  secondarySubjectId: string;
  mainPlan: SubjectPlan;
  secondaryPlan: SubjectPlan;
  items: { subject_id?: string; topic_id?: string; subtopic_id?: string; count: number }[];
  checks: ValidationCheck[];
  blocked: boolean;
};

async function buildDayPlan(
  supabase: Supabase,
  courseId: string,
  examDate: string,
  context: DayContext,
  startsInFuture: boolean,
): Promise<DailyPlan | { kind: "grand"; position: number } | { kind: "none" }> {
  const { data: override } = await supabase
    .from("daily_rotation_overrides")
    .select("main_subject_id, secondary_subject_id")
    .eq("course_id", courseId)
    .eq("exam_date", examDate)
    .maybeSingle();

  const day = resolveRotation(context.config.anchor_date, examDate, context.slots, override ?? null);
  if (!day) return { kind: "none" };
  if (day.kind === "grand") return { kind: "grand", position: day.position };

  const { main, secondary } = splitNinetyTen(context.config.question_count);
  const [mainTopics, secondaryTopics] = await Promise.all([
    eligibleTopicIds(supabase, courseId, day.mainSubjectId, examDate, context.config.cumulative_revision),
    eligibleTopicIds(supabase, courseId, day.secondarySubjectId, examDate, context.config.cumulative_revision),
  ]);
  const [mainPools, secondaryPools] = await Promise.all([
    subjectPools(supabase, courseId, day.mainSubjectId, mainTopics),
    subjectPools(supabase, courseId, day.secondarySubjectId, secondaryTopics),
  ]);

  const mainPlan = planSubject(
    day.mainSubjectId, main, mainPools.topicPools,
    mainPools.wholeSubject, context.config.allow_whole_subject_fallback,
  );
  const secondaryPlan = planSubject(
    day.secondarySubjectId, secondary, secondaryPools.topicPools,
    secondaryPools.wholeSubject, context.config.allow_whole_subject_fallback,
  );

  // Both subjects must belong to this course — override values are the only
  // way a foreign subject could sneak in, so verify them against the DB.
  const { count: subjectCount } = await supabase
    .from("subjects")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId)
    .in("id", [day.mainSubjectId, day.secondarySubjectId]);

  const checks = validateDailyPlan({
    questionCount: context.config.question_count,
    mainPlan,
    secondaryPlan,
    mainSubjectId: day.mainSubjectId,
    secondarySubjectId: day.secondarySubjectId,
    subjectsBelongToCourse: (subjectCount ?? 0) === 2,
    durationMinutes: context.config.duration_minutes,
    mix: context.config.difficulty_mix,
    startsInFuture,
  });

  return {
    kind: "daily",
    position: day.position,
    overridden: day.overridden,
    mainSubjectId: day.mainSubjectId,
    secondarySubjectId: day.secondarySubjectId,
    mainPlan,
    secondaryPlan,
    items: [...mainPlan.items, ...secondaryPlan.items],
    checks,
    blocked: hasCriticalFailure(checks),
  };
}

const getSchema = z.object({
  courseId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.coerce.number().int().min(1).max(30).default(14),
});

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
  if (!can(user.role, "exam.publish")) return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 403 });

  const url = new URL(request.url);
  const parsed = getSchema.safeParse({
    courseId: url.searchParams.get("courseId"),
    date: url.searchParams.get("date"),
    days: url.searchParams.get("days") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 400 });

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  const context = await loadContext(supabase, parsed.data.courseId);
  if (!context) {
    return NextResponse.json(
      { error: "এই কোর্সের জন্য দৈনিক পরীক্ষার রোটেশন কনফিগার করা হয়নি।", code: "NO_CONFIG" },
      { status: 404 },
    );
  }

  const plan = await buildDayPlan(supabase, parsed.data.courseId, parsed.data.date, context, true);

  // Subject titles for the admin UI, plus the upcoming rotation preview.
  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, title_bn")
    .eq("course_id", parsed.data.courseId);
  const titleOf = new Map((subjects ?? []).map((row) => [row.id as string, row.title_bn as string]));

  const { data: overrides } = await supabase
    .from("daily_rotation_overrides")
    .select("exam_date, main_subject_id, secondary_subject_id")
    .eq("course_id", parsed.data.courseId)
    .gte("exam_date", parsed.data.date);
  const overrideByDate = new Map(
    (overrides ?? []).map((row) => [row.exam_date as string, row]),
  );

  const start = new Date(`${parsed.data.date}T00:00:00Z`);
  const upcoming = Array.from({ length: parsed.data.days }, (_, index) => {
    const date = new Date(start.getTime() + index * 86_400_000).toISOString().slice(0, 10);
    const dayOverride = overrideByDate.get(date);
    const day = resolveRotation(
      context.config.anchor_date, date, context.slots,
      dayOverride
        ? { main_subject_id: dayOverride.main_subject_id, secondary_subject_id: dayOverride.secondary_subject_id }
        : null,
    );
    if (!day) return { date, kind: "none" as const };
    if (day.kind === "grand") return { date, kind: "grand" as const, position: day.position };
    return {
      date,
      kind: "daily" as const,
      position: day.position,
      overridden: day.overridden,
      main: { id: day.mainSubjectId, title_bn: titleOf.get(day.mainSubjectId) ?? "?" },
      secondary: { id: day.secondarySubjectId, title_bn: titleOf.get(day.secondarySubjectId) ?? "?" },
    };
  });

  // Existing schedule for that date, if any (draft or published).
  const { data: existing } = await supabase
    .from("exam_schedules")
    .select("id, status, starts_at, title_bn")
    .eq("course_id", parsed.data.courseId)
    .eq("exam_kind", "daily")
    .eq("settings->>exam_date", parsed.data.date)
    .in("status", ["draft", "published"])
    .maybeSingle();

  return NextResponse.json(
    {
      config: context.config,
      date: parsed.data.date,
      plan:
        plan.kind === "daily"
          ? {
              ...plan,
              mainTitle: titleOf.get(plan.mainSubjectId) ?? "?",
              secondaryTitle: titleOf.get(plan.secondarySubjectId) ?? "?",
            }
          : plan,
      upcoming,
      existing: existing ?? null,
      subjects: (subjects ?? []).map((row) => ({ id: row.id as string, title_bn: row.title_bn as string })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

const postSchema = z.object({
  courseId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Local start time, e.g. "21:00" Dhaka. Stored with explicit +06:00. */
  startTime: z.string().regex(/^\d{2}:\d{2}$/).default("21:00"),
  resultDelayMinutes: z.number().int().min(0).max(10080).default(30),
  publish: z.boolean().default(false),
  titleBn: z.string().trim().max(160).optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
  if (!can(user.role, "exam.publish")) {
    return NextResponse.json({ error: "পরীক্ষা প্রকাশের অনুমতি নেই।" }, { status: 403 });
  }
  if (!sameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

  let body: z.infer<typeof postSchema>;
  try {
    body = postSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 422 });
  }

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  const context = await loadContext(supabase, body.courseId);
  if (!context) {
    return NextResponse.json(
      { error: "এই কোর্সের জন্য দৈনিক পরীক্ষার রোটেশন কনফিগার করা হয়নি।", code: "NO_CONFIG" },
      { status: 404 },
    );
  }

  const startsAt = new Date(`${body.date}T${body.startTime}:00+06:00`);
  const startsInFuture = startsAt.getTime() > Date.now();
  const plan = await buildDayPlan(supabase, body.courseId, body.date, context, startsInFuture);

  if (plan.kind === "grand") {
    return NextResponse.json(
      { error: "এই দিনটি সাপ্তাহিক গ্র্যান্ড পরীক্ষার — সাপ্তাহিক পরীক্ষা প্যানেল থেকে তৈরি করুন।", code: "GRAND_DAY" },
      { status: 409 },
    );
  }
  if (plan.kind !== "daily") {
    return NextResponse.json({ error: "রোটেশন নির্ধারণ করা যায়নি।" }, { status: 409 });
  }
  // Critical validation failures block PUBLISHING; a draft may still be saved
  // so the admin can see the shortfall in context.
  if (body.publish && plan.blocked) {
    return NextResponse.json(
      {
        error: "প্রি-পাবলিশ যাচাইকরণে গুরুতর সমস্যা — প্রকাশ বন্ধ রাখা হয়েছে।",
        code: "VALIDATION_FAILED",
        checks: plan.checks,
      },
      { status: 409 },
    );
  }

  const { data: mainSubject } = await supabase
    .from("subjects").select("title_bn").eq("id", plan.mainSubjectId).maybeSingle();
  const titleBn =
    body.titleBn?.trim() ||
    `দৈনিক লাইভ পরীক্ষা · ${mainSubject?.title_bn ?? "মূল বিষয়"} · ${body.date}`;

  const endsAt = new Date(startsAt.getTime() + context.config.duration_minutes * 60_000);
  const releaseAt = new Date(endsAt.getTime() + body.resultDelayMinutes * 60_000);
  const questionCount = context.config.question_count;

  // One daily exam per course per date — re-running replaces the draft.
  const { data: existing } = await supabase
    .from("exam_schedules")
    .select("id, status")
    .eq("course_id", body.courseId)
    .eq("exam_kind", "daily")
    .eq("settings->>exam_date", body.date)
    .in("status", ["draft", "published"])
    .maybeSingle();
  if (existing?.status === "published") {
    return NextResponse.json(
      { error: "এই তারিখের দৈনিক পরীক্ষা ইতিমধ্যেই প্রকাশিত — বাতিল না করে নতুন করে তৈরি করা যাবে না।" },
      { status: 409 },
    );
  }

  const schedulePayload = {
    course_id: body.courseId,
    kind: "daily_live" as const,
    title_en: titleBn,
    title_bn: titleBn,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    result_release_at: releaseAt.toISOString(),
    duration_minutes: context.config.duration_minutes,
    question_count: questionCount,
    total_marks: questionCount,
    positive_marks: 1,
    negative_marks: context.config.negative_marks,
    status: "draft" as const,
    exam_kind: "daily",
    auto_start: true,
    settings: {
      composition: { items: plan.items },
      difficulty_mix: context.config.difficulty_mix,
      exam_date: body.date,
      source: "daily_rotation",
      rotation_position: plan.position,
      overridden: plan.overridden,
      main_subject_id: plan.mainSubjectId,
      secondary_subject_id: plan.secondarySubjectId,
      main_count: plan.mainPlan.planned,
      secondary_count: plan.secondaryPlan.planned,
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
    // jh_build_paper_with_mix flattens its composition and loses the section
    // split, so the daily exam uses the sectioned builder: exact per-subject
    // counts (90:10 by construction), eligible-topic restriction per section,
    // difficulty top-up only inside the section, loud failure when short.
    const sections = [
      {
        subject_id: plan.mainSubjectId,
        count: plan.mainPlan.planned,
        topic_ids: plan.mainPlan.items.map((item) => item.topic_id).filter(Boolean),
      },
      {
        subject_id: plan.secondarySubjectId,
        count: plan.secondaryPlan.planned,
        topic_ids: plan.secondaryPlan.items.map((item) => item.topic_id).filter(Boolean),
      },
    ];
    const { data: paper, error } = await supabase.rpc("jh_build_paper_sectioned", {
      p_course_id: body.courseId,
      p_sections: sections,
      p_title_en: titleBn,
      p_title_bn: titleBn,
      p_duration_minutes: context.config.duration_minutes,
      p_total_marks: questionCount,
      p_negative_marks: context.config.negative_marks,
      p_created_by: user.id,
      p_mix: context.config.difficulty_mix,
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
    action: body.publish ? "daily_exam.publish" : "daily_exam.draft",
    entity_type: "exam_schedules",
    entity_id: schedule.id,
    details: {
      exam_date: body.date,
      rotation_position: plan.position,
      overridden: plan.overridden,
      main_subject_id: plan.mainSubjectId,
      secondary_subject_id: plan.secondarySubjectId,
      main_count: plan.mainPlan.planned,
      secondary_count: plan.secondaryPlan.planned,
      mix: context.config.difficulty_mix,
    },
  });

  return NextResponse.json(
    {
      scheduleId: schedule.id,
      date: body.date,
      main: { subjectId: plan.mainSubjectId, count: plan.mainPlan.planned },
      secondary: { subjectId: plan.secondarySubjectId, count: plan.secondaryPlan.planned },
      checks: plan.checks,
      paperId,
      published: Boolean(paperId),
      error: buildError,
    },
    { headers: { "Cache-Control": "no-store" }, status: buildError ? 409 : 200 },
  );
}

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("config"),
    courseId: z.string().uuid(),
    questionCount: z.number().int().min(20).max(200).optional(),
    durationMinutes: z.number().int().min(10).max(240).optional(),
    negativeMarks: z.number().min(0).max(5).optional(),
    difficultyMix: z
      .object({
        previous: z.number().int().min(0).max(100),
        easy: z.number().int().min(0).max(100),
        medium: z.number().int().min(0).max(100),
        hard: z.number().int().min(0).max(100),
      })
      .optional(),
    cumulativeRevision: z.boolean().optional(),
    allowWholeSubjectFallback: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("override"),
    courseId: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    mainSubjectId: z.string().uuid(),
    secondarySubjectId: z.string().uuid(),
    note: z.string().trim().max(400).optional(),
  }),
  z.object({
    action: z.literal("clear_override"),
    courseId: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
]);

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
  if (!can(user.role, "exam.publish")) return NextResponse.json({ error: "অনুমতি নেই।" }, { status: 403 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 422 });
  }

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  if (body.action === "config") {
    if (body.difficultyMix) {
      const total =
        body.difficultyMix.previous + body.difficultyMix.easy + body.difficultyMix.medium + body.difficultyMix.hard;
      if (total !== 100) {
        return NextResponse.json({ error: `কঠিনতার অনুপাতের যোগফল ১০০ হতে হবে (এখন ${total})।` }, { status: 422 });
      }
    }
    const patch: Record<string, unknown> = { updated_by: user.id, updated_at: new Date().toISOString() };
    if (body.questionCount !== undefined) patch.question_count = body.questionCount;
    if (body.durationMinutes !== undefined) patch.duration_minutes = body.durationMinutes;
    if (body.negativeMarks !== undefined) patch.negative_marks = body.negativeMarks;
    if (body.difficultyMix !== undefined) patch.difficulty_mix = body.difficultyMix;
    if (body.cumulativeRevision !== undefined) patch.cumulative_revision = body.cumulativeRevision;
    if (body.allowWholeSubjectFallback !== undefined) patch.allow_whole_subject_fallback = body.allowWholeSubjectFallback;

    const { error } = await supabase.from("daily_exam_config").update(patch).eq("course_id", body.courseId);
    if (error) return fromDbError(error);

    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "daily_exam.config",
      entity_type: "daily_exam_config",
      entity_id: body.courseId,
      details: patch,
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "override") {
    if (body.mainSubjectId === body.secondarySubjectId) {
      return NextResponse.json({ error: "মূল ও সহ-বিষয় একই হতে পারে না।" }, { status: 422 });
    }
    const { count } = await supabase
      .from("subjects")
      .select("id", { count: "exact", head: true })
      .eq("course_id", body.courseId)
      .in("id", [body.mainSubjectId, body.secondarySubjectId]);
    if ((count ?? 0) !== 2) {
      return NextResponse.json({ error: "নির্বাচিত বিষয় এই কোর্সের নয়।" }, { status: 422 });
    }
    const { error } = await supabase.from("daily_rotation_overrides").upsert(
      {
        course_id: body.courseId,
        exam_date: body.date,
        main_subject_id: body.mainSubjectId,
        secondary_subject_id: body.secondarySubjectId,
        note: body.note ?? null,
        created_by: user.id,
      },
      { onConflict: "course_id,exam_date" },
    );
    if (error) return fromDbError(error);

    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "daily_exam.override",
      entity_type: "daily_rotation_overrides",
      entity_id: body.courseId,
      details: { exam_date: body.date, main: body.mainSubjectId, secondary: body.secondarySubjectId, note: body.note },
    });
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from("daily_rotation_overrides")
    .delete()
    .eq("course_id", body.courseId)
    .eq("exam_date", body.date);
  if (error) return fromDbError(error);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "daily_exam.override_clear",
    entity_type: "daily_rotation_overrides",
    entity_id: body.courseId,
    details: { exam_date: body.date },
  });
  return NextResponse.json({ ok: true });
}
