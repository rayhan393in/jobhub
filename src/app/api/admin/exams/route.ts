import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerClient } from "@/lib/supabase/server";
import { fromDbError, assertSameOrigin, requireApiPermission } from "@/lib/api";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  courseId: z.string().uuid(),
  kind: z.enum(["daily_live", "weekly_special", "scheduled_mock"]).default("daily_live"),
  titleBn: z.string().trim().min(3).max(160),
  titleEn: z.string().trim().max(160).optional().default(""),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().min(1).max(240),
  questionCount: z.number().int().min(1).max(200),
  positiveMarks: z.number().min(0.01).max(10).default(1),
  negativeMarks: z.number().min(0).max(10).default(0.5),
  resultDelayMinutes: z.number().int().min(0).max(10080).default(10),
  composition: z
    .array(
      z.object({
        subjectId: z.string().uuid().nullish(),
        topicId: z.string().uuid().nullish(),
        subtopicId: z.string().uuid().nullish(),
        count: z.number().int().min(1).max(200),
      }),
    )
    .max(20)
    .optional(),
});

const actionSchema = z.object({
  scheduleId: z.string().uuid(),
  action: z.enum(["publish", "cancel"]),
});

/** Pre-flight validation used by the publisher UI before anything is written. */
export async function GET(request: Request) {
  const guard = await requireApiPermission("exam.publish");
  if ("error" in guard) return guard.error;

  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId");
  if (!courseId) return NextResponse.json({ error: "courseId প্রয়োজন।" }, { status: 400 });

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  const { data, error } = await supabase.rpc("jh_question_availability", {
    p_course_id: courseId,
    p_subject_id: url.searchParams.get("subjectId"),
    p_topic_id: null,
    p_subtopic_id: null,
  });
  if (error) return fromDbError(error);

  const { count: pending } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId)
    .eq("status", "pending_review");

  const { count: unverifiedAi } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId)
    .eq("source_type", "ai_assisted")
    .eq("is_verified", false);

  return NextResponse.json(
    {
      verifiedAvailable: data ?? 0,
      pendingInCourse: pending ?? 0,
      unverifiedAiInCourse: unverifiedAi ?? 0,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const guard = await requireApiPermission("exam.publish");
  if ("error" in guard) return guard.error;
  const { user } = guard;
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue ? `${issue.path.join(".")}: ${issue.message}` : "অবৈধ ডেটা।" },
      { status: 422 },
    );
  }

  const data = parsed.data;
  const starts = new Date(data.startsAt);
  const ends = new Date(data.endsAt);

  if (ends <= starts) {
    return NextResponse.json({ error: "শেষ সময় শুরুর পরে হতে হবে।" }, { status: 422 });
  }
  if (ends.getTime() - starts.getTime() < data.durationMinutes * 60_000) {
    return NextResponse.json(
      { error: "এন্ট্রি উইন্ডো পরীক্ষার সময়কালের চেয়ে ছোট — শিক্ষার্থী সময়মতো শেষ করতে পারবে না।" },
      { status: 422 },
    );
  }

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  const resultRelease = new Date(ends.getTime() + data.resultDelayMinutes * 60_000);
  const composition = data.composition?.length
    ? { items: data.composition }
    : {
        items: [
          {
            subject_id: null,
            topic_id: null,
            subtopic_id: null,
            count: data.questionCount,
          },
        ],
      };

  const { data: row, error } = await supabase
    .from("exam_schedules")
    .insert({
      course_id: data.courseId,
      kind: data.kind,
      title_bn: data.titleBn,
      title_en: data.titleEn || data.titleBn,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      result_release_at: resultRelease.toISOString(),
      duration_minutes: data.durationMinutes,
      question_count: data.questionCount,
      total_marks: Number((data.questionCount * data.positiveMarks).toFixed(2)),
      positive_marks: data.positiveMarks,
      negative_marks: data.negativeMarks,
      status: "draft",
      settings: { composition },
      created_by: user.id,
    })
    .select("id, status, starts_at, ends_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "একই কোর্সে একই ধরনের ও একই সময়ে আরেকটি খসড়া বা প্রকাশিত পরীক্ষা আছে।" },
        { status: 409 },
      );
    }
    return fromDbError(error);
  }

  return NextResponse.json(
    { schedule: row, note: "ড্রাফট তৈরি হয়েছে — এখনো শিক্ষার্থীদের কাছে দৃশ্যমান নয়।" },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request) {
  const guard = await requireApiPermission("exam.publish");
  if ("error" in guard) return guard.error;
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 422 });

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  if (parsed.data.action === "cancel") {
    const { data, error } = await supabase
      .from("exam_schedules")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", parsed.data.scheduleId)
      .eq("status", "draft")
      .select("id, status")
      .single();
    if (error) return fromDbError(error);
    return NextResponse.json({ schedule: data }, { headers: { "Cache-Control": "no-store" } });
  }

  // Publishing is a single audited, transactional RPC that re-checks question
  // availability and builds the immutable paper.
  const { data, error } = await supabase.rpc("jh_publish_schedule", { p_schedule_id: parsed.data.scheduleId });
  if (error) {
    const message = error.message ?? "";
    if (error.code === "42501") {
      return NextResponse.json({ error: "আপনার এই পরীক্ষা প্রকাশের অনুমতি নেই।" }, { status: 403 });
    }
    if (message.includes("Insufficient verified questions")) {
      return NextResponse.json(
        { error: "পর্যাপ্ত যাচাইকৃত প্রশ্ন নেই — প্রকাশ সম্ভব নয়। প্রশ্ন অনুমোদন করে আবার চেষ্টা করুন।" },
        { status: 409 },
      );
    }
    if (message.includes("Start time must be in the future")) {
      return NextResponse.json({ error: "শুরুর সময় অতীত — ভবিষ্যতের সময় নির্বাচন করুন।" }, { status: 409 });
    }
    if (message.includes("not published")) {
      return NextResponse.json({ error: "কোর্সটি প্রকাশিত নয় — আগে কোর্স প্রকাশ করুন।" }, { status: 409 });
    }
    return fromDbError(error);
  }

  return NextResponse.json({ result: data }, { headers: { "Cache-Control": "no-store" } });
}
