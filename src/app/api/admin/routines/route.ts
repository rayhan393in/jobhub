import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getServerClient } from "@/lib/supabase/server";
import { fromDbError } from "@/lib/api";

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
  minutes: z.number().int().min(5).max(480).default(45),
  focusNoteBn: z.string().trim().max(600).optional().default(""),
  status: z.enum(["draft", "published", "archived", "cancelled"]).default("draft"),
});

const idSchema = z.object({ id: z.string().uuid() });

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  return !origin || !host || new URL(origin).host === host;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
  if (!can(user.role, "routine.manage")) {
    return NextResponse.json({ error: "রুটিন ব্যবস্থাপনার অনুমতি নেই।" }, { status: 403 });
  }
  if (!sameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

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
  const payload = {
    course_id: data.courseId,
    kind: data.kind,
    routine_date: data.routineDate,
    title_bn: data.titleBn,
    title_en: data.titleEn || data.titleBn,
    subject_id: data.subjectId ?? null,
    topic_id: data.topicId ?? null,
    subtopic_id: data.subtopicId ?? null,
    minutes: data.minutes,
    focus_note_bn: data.focusNoteBn || null,
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
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
  if (!can(user.role, "routine.manage")) {
    return NextResponse.json({ error: "রুটিন ব্যবস্থাপনার অনুমতি নেই।" }, { status: 403 });
  }
  if (!sameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

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
