import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminClient } from "@/lib/supabase/admin";
import { fromDbError, assertSameOrigin, requireApiPermission } from "@/lib/api";
import {
  hasCriticalFailure,
  planSubject,
  resolveRotation,
  splitNinetyTen,
  splitPyqAcrossSections,
  strict7030Checks,
  validateDailyPlan,
  type DifficultyMix,
  type PyqAvailability,
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
    pyq_count: number;
    practice_count: number;
    strict_pyq_validation: boolean;
  };
  slots: RotationSlot[];
};

/**
 * The config/rotation tables are service-role-only by design (privilege
 * lockdown), so this route talks to the DB through the admin client — AFTER
 * the exam.publish permission check in each handler.
 */
function adminDb(): Supabase | null {
  try {
    return getAdminClient();
  } catch {
    return null;
  }
}

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
      pyq_count: config.pyq_count ?? 70,
      practice_count: config.practice_count ?? 30,
      strict_pyq_validation: Boolean(config.strict_pyq_validation),
    },
    slots: (slots ?? []) as RotationSlot[],
  };
}

const EMPTY_AVAILABILITY: PyqAvailability = {
  pyq_total: 0, pyq_ready: 0, pyq_missing_meta: 0, practice_pool: 0, missing_explanation: 0,
};

/** Real pool counts for one section scope, from jh_pyq_availability. */
async function sectionAvailability(
  supabase: Supabase,
  courseId: string,
  subjectId: string,
  topicIds: string[],
): Promise<PyqAvailability> {
  const { data } = await supabase.rpc("jh_pyq_availability", {
    p_course_id: courseId,
    p_subject_id: subjectId,
    p_topic_ids: topicIds.length > 0 ? topicIds : null,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return EMPTY_AVAILABILITY;
  return {
    pyq_total: Number(row.pyq_total ?? 0),
    pyq_ready: Number(row.pyq_ready ?? 0),
    pyq_missing_meta: Number(row.pyq_missing_meta ?? 0),
    practice_pool: Number(row.practice_pool ?? 0),
    missing_explanation: Number(row.missing_explanation ?? 0),
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

type StrictInfo = {
  pyqCount: number;
  practiceCount: number;
  mainPyqNeed: number;
  secondaryPyqNeed: number;
  mainAvailability: PyqAvailability;
  secondaryAvailability: PyqAvailability;
};

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
  strict: StrictInfo | null;
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

  // Strict 70:30 mode — the 8-point checklist with REAL pool counts. A PYQ
  // shortfall blocks publishing; it is never patched over with practice
  // questions (master-prompt core rule).
  let strict: StrictInfo | null = null;
  if (context.config.strict_pyq_validation) {
    const [mainPyqNeed, secondaryPyqNeed] = splitPyqAcrossSections(
      [main, secondary], context.config.pyq_count,
    );
    const mainScope = mainPlan.usedWholeSubjectFallback
      ? [] : mainPlan.items.map((item) => item.topic_id).filter((id): id is string => Boolean(id));
    const secondaryScope = secondaryPlan.usedWholeSubjectFallback
      ? [] : secondaryPlan.items.map((item) => item.topic_id).filter((id): id is string => Boolean(id));
    const [mainAvailability, secondaryAvailability] = await Promise.all([
      sectionAvailability(supabase, courseId, day.mainSubjectId, mainScope),
      sectionAvailability(supabase, courseId, day.secondarySubjectId, secondaryScope),
    ]);
    strict = {
      pyqCount: context.config.pyq_count,
      practiceCount: context.config.practice_count,
      mainPyqNeed,
      secondaryPyqNeed,
      mainAvailability,
      secondaryAvailability,
    };
    checks.push(
      ...strict7030Checks({
        questionCount: context.config.question_count,
        pyqCount: context.config.pyq_count,
        practiceCount: context.config.practice_count,
        sections: [
          { label: "মূল", count: main, pyqNeed: mainPyqNeed, availability: mainAvailability },
          { label: "সহ", count: secondary, pyqNeed: secondaryPyqNeed, availability: secondaryAvailability },
        ],
      }),
    );
  }

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
    strict,
  };
}

const getSchema = z.object({
  courseId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.coerce.number().int().min(1).max(30).default(14),
});

export async function GET(request: Request) {
  const guard = await requireApiPermission("exam.publish");
  if ("error" in guard) return guard.error;

  const url = new URL(request.url);
  const parsed = getSchema.safeParse({
    courseId: url.searchParams.get("courseId"),
    date: url.searchParams.get("date"),
    days: url.searchParams.get("days") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 400 });

  const supabase = adminDb();
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
  const guard = await requireApiPermission("exam.publish");
  if ("error" in guard) return guard.error;
  const { user } = guard;
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

  let body: z.infer<typeof postSchema>;
  try {
    body = postSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 422 });
  }

  const supabase = adminDb();
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
      mode: plan.strict ? "70_30_strict" : "legacy",
      pyq_total: plan.strict?.pyqCount ?? null,
      practice_total: plan.strict?.practiceCount ?? null,
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
    // Strict mode uses the 70:30 builder: exact PYQ + practice totals, loud
    // P0001 with the real pool counts on any shortfall — never substituted.
    const { data: paper, error } = plan.strict
      ? await supabase.rpc("jh_build_paper_7030", {
          p_course_id: body.courseId,
          p_sections: sections,
          p_pyq_total: plan.strict.pyqCount,
          p_practice_total: plan.strict.practiceCount,
          p_title_en: titleBn,
          p_title_bn: titleBn,
          p_duration_minutes: context.config.duration_minutes,
          p_total_marks: questionCount,
          p_negative_marks: context.config.negative_marks,
          p_created_by: user.id,
          p_paper_type: "scheduled",
          p_schedule_id: schedule.id,
        })
      : await supabase.rpc("jh_build_paper_sectioned", {
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
    pyqCount: z.number().int().min(0).max(200).optional(),
    practiceCount: z.number().int().min(0).max(200).optional(),
    strictPyqValidation: z.boolean().optional(),
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
  const guard = await requireApiPermission("exam.publish");
  if ("error" in guard) return guard.error;
  const { user } = guard;
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 422 });
  }

  const supabase = adminDb();
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
    if (body.pyqCount !== undefined) patch.pyq_count = body.pyqCount;
    if (body.practiceCount !== undefined) patch.practice_count = body.practiceCount;
    if (body.strictPyqValidation !== undefined) patch.strict_pyq_validation = body.strictPyqValidation;

    // Strict mode demands pyq + practice === total — verified on the MERGED
    // config (DB CHECK daily_exam_config_strict_sum is the backstop).
    const { data: current } = await supabase
      .from("daily_exam_config")
      .select("question_count, pyq_count, practice_count, strict_pyq_validation")
      .eq("course_id", body.courseId)
      .maybeSingle();
    if (current) {
      const merged = {
        question_count: body.questionCount ?? current.question_count,
        pyq_count: body.pyqCount ?? current.pyq_count ?? 70,
        practice_count: body.practiceCount ?? current.practice_count ?? 30,
        strict: body.strictPyqValidation ?? current.strict_pyq_validation ?? false,
      };
      if (merged.strict && merged.pyq_count + merged.practice_count !== merged.question_count) {
        return NextResponse.json(
          {
            error: `Strict মোডে PYQ (${merged.pyq_count}) + practice (${merged.practice_count}) = মোট প্রশ্ন (${merged.question_count}) হতে হবে।`,
          },
          { status: 422 },
        );
      }
    }

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
