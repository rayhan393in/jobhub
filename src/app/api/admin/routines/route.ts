import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerClient } from "@/lib/supabase/server";
import { fromDbError, assertSameOrigin, requireApiPermission } from "@/lib/api";

export const dynamic = "force-dynamic";

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  courseId: z.string().uuid(),
  kind: z.enum(["daily", "weekly_special"]).default("daily"),
  routineDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "তারিখ YYYY-MM-DD হতে হবে।"),
  titleBn: z.string().trim().min(2).max(160),
  titleEn: z.string().trim().max(160).optional().default(""),
  subjectId: z.string().uuid().nullable().optional(),
  topicId: z.string().uuid().nullable().optional(),
  subtopicId: z.string().uuid().nullable().optional(),
  topicIds: z.array(z.string().uuid()).max(20).optional().default([]),
  subtopicIds: z.array(z.string().uuid()).max(30).optional().default([]),
  minutes: z.number().int().min(5).max(480).default(45),
  focusNoteBn: z.string().trim().max(600).optional().default(""),
  taskKind: z.enum(["study", "practice", "revision", "exam", "rest"]).default("study"),
  slotLabel: z.string().trim().max(40).optional().default(""),
  status: z.enum(["draft", "published", "archived", "cancelled"]).default("draft"),
});

const idSchema = z.object({ id: z.string().uuid() });

export async function POST(request: Request) {
  const guard = await requireApiPermission("routine.manage");
  if ("error" in guard) return guard.error;
  const { user } = guard;
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 400 });
  }
  const parsed = upsertSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "অবৈধ ডেটা।" }, { status: 422 });
  }

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  const data = parsed.data;
  // A single-select topic also lands in topic_ids so every consumer can rely
  // on one field; the legacy topic_id column keeps old rows and tooling alive.
  const topicIds = [...new Set([...(data.topicId ? [data.topicId] : []), ...data.topicIds])];
  const subtopicIds = [...new Set([...(data.subtopicId ? [data.subtopicId] : []), ...data.subtopicIds])];
  const payload = {
    course_id: data.courseId,
    kind: data.kind,
    routine_date: data.routineDate,
    title_bn: data.titleBn,
    title_en: data.titleEn || data.titleBn,
    subject_id: data.subjectId ?? null,
    topic_id: data.topicId ?? topicIds[0] ?? null,
    subtopic_id: data.subtopicId ?? null,
    topic_ids: topicIds,
    subtopic_ids: subtopicIds,
    minutes: data.minutes,
    focus_note_bn: data.focusNoteBn || null,
    task_kind: data.taskKind,
    slot_label: data.slotLabel || null,
    status: data.status,
    created_by: user.id,
  };

  const query = data.id
    ? supabase.from("routines").update(payload).eq("id", data.id)
    : supabase.from("routines").insert(payload);
  const { data: row, error } = await query.select("id, status, routine_date").single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "একই তারিখ ও একই বিষয়/টপিকে ইতিমধ্যেই একটি রুটিন আছে।" },
        { status: 409 },
      );
    }
    return fromDbError(error);
  }

  // Saving a routine never publishes an exam — that is a separate, explicit step.
  return NextResponse.json(
    { routine: row, note: "রুটিন সংরক্ষিত। এটি কোনো পরীক্ষা প্রকাশ করেনি।" },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request) {
  const guard = await requireApiPermission("routine.manage");
  if ("error" in guard) return guard.error;
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

  const parsed = idSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "অবৈধ আইডি।" }, { status: 422 });

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  const { data, error } = await supabase
    .from("routines")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .select("id, status")
    .single();
  if (error) return fromDbError(error);
  return NextResponse.json({ routine: data }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * DELETE — remove a routine row outright.
 *
 * Archiving is the safe default and stays on PATCH; this exists because the
 * spec explicitly asks for delete, and a wrongly imported CSV row (a typo in
 * the date, a topic from the wrong subject) should not linger as an archived
 * ghost in every future export. A row that a *published* exam was built from is
 * refused: the exam's provenance would silently lose its source.
 */
export async function DELETE(request: Request) {
  const guard = await requireApiPermission("routine.manage");
  if ("error" in guard) return guard.error;
  const { user } = guard;
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

  const parsed = idSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "অবৈধ আইডি।" }, { status: 422 });

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  const { data: linked } = await supabase
    .from("exam_schedules")
    .select("id, status")
    .contains("routine_ids", [parsed.data.id])
    .in("status", ["published", "completed"])
    .limit(1);

  if (linked && linked.length > 0) {
    return NextResponse.json(
      { error: "এই রুটিন থেকে একটি প্রকাশিত পরীক্ষা তৈরি হয়েছে — মুছলে পরীক্ষার উৎস হারাবে। আর্কাইভ করুন।" },
      { status: 409 },
    );
  }

  const { error } = await supabase.from("routines").delete().eq("id", parsed.data.id);
  if (error) return fromDbError(error);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "routine.delete",
    entity_type: "routines",
    entity_id: parsed.data.id,
    details: {},
  });

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
