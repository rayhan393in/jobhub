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
 * POST /api/admin/study-plan/sync-common — common-topic synchronization.
 *
 * "Same common topics → same study day; different specialized topics →
 * separate study schedules." Commonality comes ONLY from the canonical
 * taxonomy links; the DB function moves first-study assignments onto the
 * anchor (earliest) date and only where a published study slot already
 * exists — it never invents routine rows and never touches specialized
 * content. apply=false returns a dry-run preview for the admin.
 */

const bodySchema = z.object({
  courseIds: z.array(z.string().uuid()).min(2).max(9),
  apply: z.boolean().default(false),
});

const getSchema = z.object({
  courseIds: z.array(z.string().uuid()).min(2).max(9),
});

/**
 * GET ?courseIds=a,b — read-only synchronization preview.
 *
 * Lists every canonical topic that at least two of the selected programs
 * share (via taxonomy links, never name matching), with each program's
 * current first-study date, so the admin sees both the already-synchronized
 * topics and the out-of-sync ones BEFORE deciding to apply the sync.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
  if (!can(user.role, "routine.manage")) {
    return NextResponse.json({ error: "রুটিন পরিচালনার অনুমতি নেই।" }, { status: 403 });
  }
  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  const url = new URL(request.url);
  const parsed = getSchema.safeParse({
    courseIds: (url.searchParams.get("courseIds") ?? "").split(",").filter(Boolean),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "কমপক্ষে ২টি কোর্স নির্বাচন করুন।" }, { status: 400 });
  }
  const { courseIds } = parsed.data;

  const { data: assignments, error } = await supabase
    .from("study_plan_assignments")
    .select("course_id, first_study_date, topics(id, title_bn, canonical_id, subject_id)")
    .in("course_id", courseIds)
    .limit(5000);
  if (error) return fromDbError(error);

  type Row = {
    course_id: string;
    first_study_date: string;
    topics: { id: string; title_bn: string; canonical_id: string | null; subject_id: string } | null;
  };
  // Per (canonical topic, course): the EARLIEST first-study date — a topic's
  // subtopics may spread over several days; the first day is the anchor.
  const perCanonical = new Map<
    string,
    Map<string, { date: string; topic_bn: string; subject_id: string }>
  >();
  for (const raw of (assignments ?? []) as unknown as Row[]) {
    const topic = Array.isArray(raw.topics) ? (raw.topics as Row["topics"][])[0] : raw.topics;
    if (!topic?.canonical_id) continue;
    const byCourse = perCanonical.get(topic.canonical_id) ?? new Map();
    const existing = byCourse.get(raw.course_id);
    if (!existing || raw.first_study_date < existing.date) {
      byCourse.set(raw.course_id, {
        date: raw.first_study_date,
        topic_bn: topic.title_bn,
        subject_id: topic.subject_id,
      });
    }
    perCanonical.set(topic.canonical_id, byCourse);
  }

  // Only topics genuinely shared by ≥2 of the SELECTED programs.
  const sharedIds = [...perCanonical.keys()].filter((id) => perCanonical.get(id)!.size >= 2);

  const subjectIds = new Set<string>();
  for (const id of sharedIds) {
    for (const entry of perCanonical.get(id)!.values()) subjectIds.add(entry.subject_id);
  }
  const [{ data: canonicalRows }, { data: subjectRows }] = await Promise.all([
    sharedIds.length > 0
      ? supabase.from("canonical_topics").select("id, title_bn, title_en").in("id", sharedIds)
      : Promise.resolve({ data: [] as { id: string; title_bn: string | null; title_en: string | null }[] }),
    subjectIds.size > 0
      ? supabase.from("subjects").select("id, title_bn").in("id", [...subjectIds])
      : Promise.resolve({ data: [] as { id: string; title_bn: string }[] }),
  ]);
  const canonicalName = new Map((canonicalRows ?? []).map((r) => [r.id, r.title_bn ?? r.title_en ?? "—"]));
  const subjectName = new Map((subjectRows ?? []).map((r) => [r.id, r.title_bn]));

  const shared = sharedIds
    .map((canonicalId) => {
      const byCourse = perCanonical.get(canonicalId)!;
      const entries = [...byCourse.entries()].map(([courseId, entry]) => ({
        course_id: courseId,
        subject_bn: subjectName.get(entry.subject_id) ?? "—",
        topic_bn: entry.topic_bn,
        first_study_date: entry.date,
      }));
      const dates = new Set(entries.map((e) => e.first_study_date));
      return {
        canonical_id: canonicalId,
        canonical_bn: canonicalName.get(canonicalId) ?? "—",
        in_sync: dates.size === 1,
        courses: entries.sort((a, b) => a.first_study_date.localeCompare(b.first_study_date)),
      };
    })
    .sort((a, b) => Number(a.in_sync) - Number(b.in_sync) || a.canonical_bn.localeCompare(b.canonical_bn, "bn"));

  return NextResponse.json(
    { shared, sharedTotal: shared.length, outOfSync: shared.filter((s) => !s.in_sync).length },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
  if (!can(user.role, "routine.manage")) {
    return NextResponse.json({ error: "রুটিন পরিচালনার অনুমতি নেই।" }, { status: 403 });
  }
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });
  }
  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "অবৈধ ডেটা — কমপক্ষে ২টি কোর্স নির্বাচন করুন।" }, { status: 422 });
  }

  const { data, error } = await supabase.rpc("jh_sync_common_topics", {
    p_course_ids: body.courseIds,
    p_apply: body.apply,
  });
  if (error) return fromDbError(error);

  if (body.apply) {
    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "study_plan.sync_common",
      entity_type: "study_plan_assignments",
      entity_id: body.courseIds.join(","),
      details: { course_ids: body.courseIds, result: data },
    });
  }

  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
