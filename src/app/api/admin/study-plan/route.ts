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
 * Subtopic-level 60-day study plan (master-prompt Phase 3–4).
 *
 * GET    ?courseId[&date]  → coverage summary + publish checklist (+ one
 *                            day's assignments when date given).
 * POST   { courseId }      → run the generator (never overwrites existing
 *                            first-study assignments).
 * PATCH  { assignmentId …} → move / edit one assignment (admin editing
 *                            before — and after — publication).
 * DELETE { assignmentId }  → remove one assignment.
 *
 * All DB access is user-scoped: RLS + the routine.manage permission do the
 * enforcement server-side.
 */

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  return !origin || !host || new URL(origin).host === host;
}

async function guard() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 }) };
  if (!can(user.role, "routine.manage")) {
    return { error: NextResponse.json({ error: "রুটিন পরিচালনার অনুমতি নেই।" }, { status: 403 }) };
  }
  const supabase = await getServerClient();
  if (!supabase) return { error: NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 }) };
  return { user, supabase };
}

const getSchema = z.object({
  courseId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function GET(request: Request) {
  const ctx = await guard();
  if ("error" in ctx) return ctx.error;
  const { supabase } = ctx;

  const url = new URL(request.url);
  const parsed = getSchema.safeParse({
    courseId: url.searchParams.get("courseId"),
    date: url.searchParams.get("date") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 400 });
  const { courseId, date } = parsed.data;

  const [{ data: summary }, { data: unassigned }, { data: integrity }] = await Promise.all([
    supabase.rpc("jh_coverage_summary", { p_course_id: courseId }),
    supabase.rpc("jh_coverage_unassigned", { p_course_id: courseId }),
    supabase.rpc("jh_coverage_integrity", { p_course_id: courseId }),
  ]);

  const rows = (summary ?? []) as {
    subject_id: string; title_bn: string; topics_total: number; subtopics_total: number;
    units_total: number; units_assigned: number; units_unassigned: number;
  }[];
  const totals = rows.reduce(
    (acc, row) => ({
      topics: acc.topics + Number(row.topics_total),
      subtopics: acc.subtopics + Number(row.subtopics_total),
      units: acc.units + Number(row.units_total),
      assigned: acc.assigned + Number(row.units_assigned),
      unassigned: acc.unassigned + Number(row.units_unassigned),
    }),
    { topics: 0, subtopics: 0, units: 0, assigned: 0, unassigned: 0 },
  );

  // The master prompt's publish checklist — every number from live data.
  const checklist = [
    { rule: "১০টি বিষয় অন্তর্ভুক্ত", ok: rows.length === 10, detail: `${rows.length}/১০` },
    { rule: "১৩৭টি টপিক অন্তর্ভুক্ত", ok: totals.topics === 137, detail: `${totals.topics}/১৩৭` },
    { rule: "৩৬৬টি সাবটপিক অন্তর্ভুক্ত", ok: totals.subtopics === 366, detail: `${totals.subtopics}/৩৬৬` },
    {
      rule: "প্রতিটি ইউনিটের first-study বরাদ্দ",
      ok: totals.unassigned === 0,
      detail: `${totals.assigned}/${totals.units} বরাদ্দকৃত (সাবটপিকবিহীন ${totals.units - totals.subtopics}টি টপিকসহ) — অবরাদ্দ ${totals.unassigned}টি`,
    },
    {
      rule: "অবৈধ/অর্ফান সিলেবাস-রেফারেন্স নেই",
      ok: (integrity ?? []).length === 0,
      detail: `${(integrity ?? []).length}টি সমস্যা`,
    },
    {
      rule: "ডুপ্লিকেট first-study অসম্ভব",
      ok: true,
      detail: "unique index (course, topic, subtopic) — রিভিশন কখনো first-study গণনায় ঢোকে না",
    },
  ];

  let dayAssignments: unknown[] | null = null;
  if (date) {
    const { data } = await supabase
      .from("study_plan_assignments")
      .select(
        "id, subject_id, topic_id, subtopic_id, routine_id, plan_day, first_study_date, minutes, objective_bn, priority, subjects(title_bn), topics(title_bn), subtopics(title_bn)",
      )
      .eq("course_id", courseId)
      .eq("first_study_date", date)
      .order("subject_id")
      .order("topic_id");
    dayAssignments = data ?? [];
  }

  // Per-day load for the calendar strip.
  const { data: perDay } = await supabase
    .from("study_plan_assignments")
    .select("first_study_date, plan_day")
    .eq("course_id", courseId)
    .order("first_study_date");
  const dayCounts = new Map<string, { planDay: number; count: number }>();
  for (const row of (perDay ?? []) as { first_study_date: string; plan_day: number }[]) {
    const entry = dayCounts.get(row.first_study_date) ?? { planDay: row.plan_day, count: 0 };
    entry.count += 1;
    dayCounts.set(row.first_study_date, entry);
  }

  return NextResponse.json(
    {
      summary: rows,
      totals,
      checklist,
      publishable: checklist.every((check) => check.ok),
      unassigned: (unassigned ?? []).slice(0, 100),
      unassignedTotal: (unassigned ?? []).length,
      integrity: integrity ?? [],
      days: [...dayCounts.entries()].map(([d, value]) => ({ date: d, ...value })),
      dayAssignments,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

const postSchema = z.object({
  courseId: z.string().uuid(),
  defaultMinutes: z.number().int().min(5).max(480).default(30),
});

export async function POST(request: Request) {
  const ctx = await guard();
  if ("error" in ctx) return ctx.error;
  if (!sameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });
  const { user, supabase } = ctx;

  let body: z.infer<typeof postSchema>;
  try {
    body = postSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 422 });
  }

  const { data, error } = await supabase.rpc("jh_generate_study_plan", {
    p_course_id: body.courseId,
    p_created_by: user.id,
    p_default_minutes: body.defaultMinutes,
  });
  if (error) return fromDbError(error);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "study_plan.generate",
    entity_type: "study_plan_assignments",
    entity_id: body.courseId,
    details: data,
  });

  return NextResponse.json({ ok: true, result: data });
}

const patchSchema = z.object({
  assignmentId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  minutes: z.number().int().min(5).max(480).optional(),
  objectiveBn: z.string().trim().max(500).nullable().optional(),
  priority: z.enum(["high", "normal", "low"]).optional(),
});

export async function PATCH(request: Request) {
  const ctx = await guard();
  if ("error" in ctx) return ctx.error;
  if (!sameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });
  const { user, supabase } = ctx;

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 422 });
  }

  const { data: assignment } = await supabase
    .from("study_plan_assignments")
    .select("id, course_id, subject_id, routine_id, first_study_date")
    .eq("id", body.assignmentId)
    .maybeSingle();
  if (!assignment) return NextResponse.json({ error: "বরাদ্দ পাওয়া যায়নি।" }, { status: 404 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.minutes !== undefined) patch.minutes = body.minutes;
  if (body.objectiveBn !== undefined) patch.objective_bn = body.objectiveBn;
  if (body.priority !== undefined) patch.priority = body.priority;

  const touchedRoutines: string[] = [];
  if (assignment.routine_id) touchedRoutines.push(assignment.routine_id as string);

  if (body.date && body.date !== assignment.first_study_date) {
    // The new date must be a REAL published study day for this subject — the
    // plan never invents a slot.
    const { data: target } = await supabase
      .from("routines")
      .select("id, routine_date")
      .eq("course_id", assignment.course_id)
      .eq("subject_id", assignment.subject_id)
      .eq("kind", "daily")
      .eq("status", "published")
      .eq("routine_date", body.date)
      .in("task_kind", ["study", "practice"])
      .limit(1)
      .maybeSingle();
    if (!target) {
      return NextResponse.json(
        { error: "নির্বাচিত তারিখে এই বিষয়ের কোনো প্রকাশিত অধ্যয়ন-টাস্ক নেই — আগে রুটিনে দিনটি যোগ করুন।" },
        { status: 422 },
      );
    }
    const { data: day0 } = await supabase
      .from("routines")
      .select("routine_date")
      .eq("course_id", assignment.course_id)
      .eq("kind", "daily")
      .eq("status", "published")
      .order("routine_date")
      .limit(1)
      .maybeSingle();
    const planDay = day0
      ? Math.min(
          60,
          Math.max(
            1,
            Math.round(
              (Date.parse(`${body.date}T00:00:00Z`) - Date.parse(`${day0.routine_date}T00:00:00Z`)) / 86_400_000,
            ) + 1,
          ),
        )
      : 1;
    patch.first_study_date = body.date;
    patch.routine_id = target.id;
    patch.plan_day = planDay;
    touchedRoutines.push(target.id as string);
  }

  const { error } = await supabase
    .from("study_plan_assignments")
    .update(patch)
    .eq("id", body.assignmentId);
  if (error) return fromDbError(error);

  if (touchedRoutines.length > 0) {
    await supabase.rpc("jh_sync_routine_scope", {
      p_course_id: assignment.course_id,
      p_routine_ids: touchedRoutines,
    });
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "study_plan.edit",
    entity_type: "study_plan_assignments",
    entity_id: body.assignmentId,
    details: patch,
  });

  return NextResponse.json({ ok: true });
}

const deleteSchema = z.object({ assignmentId: z.string().uuid() });

export async function DELETE(request: Request) {
  const ctx = await guard();
  if ("error" in ctx) return ctx.error;
  if (!sameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });
  const { user, supabase } = ctx;

  let body: z.infer<typeof deleteSchema>;
  try {
    body = deleteSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 422 });
  }

  const { data: assignment } = await supabase
    .from("study_plan_assignments")
    .select("id, course_id, routine_id")
    .eq("id", body.assignmentId)
    .maybeSingle();
  if (!assignment) return NextResponse.json({ error: "বরাদ্দ পাওয়া যায়নি।" }, { status: 404 });

  const { error } = await supabase
    .from("study_plan_assignments")
    .delete()
    .eq("id", body.assignmentId);
  if (error) return fromDbError(error);

  if (assignment.routine_id) {
    await supabase.rpc("jh_sync_routine_scope", {
      p_course_id: assignment.course_id,
      p_routine_ids: [assignment.routine_id],
    });
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "study_plan.delete",
    entity_type: "study_plan_assignments",
    entity_id: body.assignmentId,
    details: {},
  });

  return NextResponse.json({ ok: true });
}
