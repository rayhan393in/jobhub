import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getServerClient } from "@/lib/supabase/server";
import { fromDbError } from "@/lib/api";

export const dynamic = "force-dynamic";

const schema = z.object({
  key: z.enum(["platform", "exam_limits", "marking", "pdf_downloads"]),
  value: z.record(z.string(), z.unknown()),
});

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
  if (!can(user.role, "settings.manage")) {
    return NextResponse.json({ error: "সেটিংস পরিবর্তনের অনুমতি নেই।" }, { status: 403 });
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 422 });

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  // Server-side sanity limits so the platform can never be configured into an
  // unsafe state (e.g. 10 000 questions per exam).
  const value: Record<string, unknown> = { ...parsed.data.value };
  if (parsed.data.key === "exam_limits") {
    const maxQuestions = Number(value.max_questions ?? 100);
    const maxDuration = Number(value.max_duration_minutes ?? 180);
    if (!Number.isFinite(maxQuestions) || maxQuestions < 1 || maxQuestions > 200) {
      return NextResponse.json({ error: "সর্বোচ্চ প্রশ্নসংখ্যা ১–২০০ এর মধ্যে হতে হবে।" }, { status: 422 });
    }
    if (!Number.isFinite(maxDuration) || maxDuration < 1 || maxDuration > 240) {
      return NextResponse.json({ error: "সর্বোচ্চ সময় ১–২৪০ মিনিটের মধ্যে হতে হবে।" }, { status: 422 });
    }
    value.max_questions = Math.round(maxQuestions);
    value.max_duration_minutes = Math.round(maxDuration);
  }
  if (parsed.data.key === "marking") {
    const positive = Number(value.positive_marks ?? 1);
    const negative = Number(value.negative_marks ?? 0.5);
    if (!Number.isFinite(positive) || positive <= 0 || positive > 10) {
      return NextResponse.json({ error: "সঠিক উত্তরের নম্বর ০–১০ এর মধ্যে হতে হবে।" }, { status: 422 });
    }
    if (!Number.isFinite(negative) || negative < 0 || negative > positive) {
      return NextResponse.json({ error: "ভুল উত্তরের কাটা ০ থেকে সঠিক নম্বরের মধ্যে হতে হবে।" }, { status: 422 });
    }
    value.positive_marks = positive;
    value.negative_marks = negative;
    value.unanswered_marks = Number(value.unanswered_marks ?? 0) || 0;
  }

  // Requirement 7: the admin decides which PDF downloads students may take.
  // Anything not supplied keeps its previous value, so toggling one switch never
  // silently switches the others off.
  if (parsed.data.key === "pdf_downloads") {
    const flags = ["question_paper", "answer_key", "performance_report", "embed_exam_id", "embed_user_info"] as const;
    const next: Record<string, boolean> = {};
    for (const flag of flags) next[flag] = value[flag] === true;
    const { data: existing } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "pdf_downloads")
      .maybeSingle();
    const previous = (existing?.value ?? {}) as Record<string, unknown>;
    for (const flag of flags) {
      if (value[flag] === undefined) next[flag] = previous[flag] === true;
    }
    Object.assign(value, next);
  }

  const { error } = await supabase
    .from("system_settings")
    .upsert({ key: parsed.data.key, value, updated_by: user.id, updated_at: new Date().toISOString() });
  if (error) return fromDbError(error);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "settings.update",
    entity_type: "system_settings",
    entity_id: parsed.data.key,
    details: { key: parsed.data.key, value },
  });

  return NextResponse.json({ ok: true, key: parsed.data.key, value }, { headers: { "Cache-Control": "no-store" } });
}
