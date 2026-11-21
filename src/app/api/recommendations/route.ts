import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";
import { buildRecommendations, summariseRecommendations, type AttemptEvidence, type TopicEvidence } from "@/lib/routines/recommendations";
import { mondayOf } from "@/lib/routines/weekly-plan";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/recommendations?courseId=…
 *
 * Evidence for the study recommendations on the dashboard. Three real sources,
 * each optional:
 *
 *   jh_topic_frequency   counted past-paper questions per topic
 *   jh_student_analytics this student's own right/wrong counts per topic
 *   jh_unfinished_topics last week's scheduled-but-unfinished topics
 *
 * The route does not decide what to recommend — `buildRecommendations` does,
 * and it returns `blocked` reasons alongside suggestions so the page can say
 * "no exam taken yet" instead of inventing a priority.
 */
export async function GET(request: Request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "অনুরোধের উৎস যাচাই করা যায়নি।" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
  }

  const courseId = new URL(request.url).searchParams.get("courseId");
  if (courseId && !z.string().uuid().safeParse(courseId).success) {
    return NextResponse.json({ error: "কোর্স আইডি সঠিক নয়।" }, { status: 422 });
  }

  const supabase = await getServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "ডেটাবেস সংযোগ নেই।" }, { status: 503 });
  }

  const [frequencyResult, analyticsResult, unfinishedResult] = await Promise.all([
    courseId
      ? supabase.rpc("jh_topic_frequency", { p_course_id: courseId })
      : Promise.resolve({ data: [], error: null }),
    supabase.rpc("jh_student_analytics", { p_course_id: courseId ?? null }),
    courseId
      ? supabase.rpc("jh_unfinished_topics", { p_course_id: courseId, p_week_start: mondayOf(dhakaToday()) })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (analyticsResult.error) {
    console.error("[recommendations] analytics", analyticsResult.error.message);
    return NextResponse.json({ error: "আপনার ফলাফল পড়া যায়নি।" }, { status: 500 });
  }

  type FrequencyRow = {
    topic_id: string;
    topic_bn: string;
    subject_id: string;
    subject_bn: string;
    total_questions: number;
    paper_count: number;
    band: TopicEvidence["band"];
  };

  const frequency: TopicEvidence[] = ((frequencyResult.data ?? []) as FrequencyRow[]).map((row) => ({
    topic_id: row.topic_id,
    topic_bn: row.topic_bn,
    subject_id: row.subject_id,
    subject_bn: row.subject_bn,
    frequency: Number(row.total_questions) || 0,
    papers: Number(row.paper_count) || 0,
    band: row.band,
  }));

  const analytics = analyticsResult.data as {
    topics?: { topic_id: string; attempted: number; correct: number; accuracy: number }[];
    history?: { date: string; score: number; attempts: number }[];
  } | null;

  const attempts: AttemptEvidence[] = (analytics?.topics ?? []).map((row) => ({
    topic_id: row.topic_id,
    attempted: Number(row.attempted) ?? 0,
    correct: Number(row.correct) ?? 0,
  }));

  // Topics whose plan row is archived are finished, and never come back.
  const { data: planRows } = courseId
    ? await supabase
        .from("student_routines")
        .select("topic_id, status")
        .eq("user_id", user.id)
        .eq("course_id", courseId)
    : { data: [] as { topic_id: string | null; status: string | null }[] };

  const completedTopicIds = (planRows ?? [])
    .filter((row) => row.status === "archived" && row.topic_id)
    .map((row) => row.topic_id as string);

  const set = buildRecommendations({
    frequency,
    attempts,
    unfinishedTopicIds: ((unfinishedResult.data ?? []) as { topic_id: string }[]).map((row) => row.topic_id),
    completedTopicIds,
    lastResult: null,
  });

  return NextResponse.json(
    {
      ...set,
      summary_bn: summariseRecommendations(set),
      /** What the counts were built from, so the numbers are auditable. */
      sources: {
        frequency_rows: frequency.length,
        counted_topics: frequency.filter((row) => (row.frequency ?? 0) > 0).length,
        attempted_topics: attempts.length,
        unfinished_topics: (unfinishedResult.data ?? []).length,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function dhakaToday(): string {
  const now = new Date();
  const dhaka = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  return dhaka.toISOString().slice(0, 10);
}
