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
