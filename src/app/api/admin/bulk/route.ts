import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getServerClient } from "@/lib/supabase/server";
import { fromDbError } from "@/lib/api";

export const dynamic = "force-dynamic";

const schema = z
  .object({
    action: z.enum(["approve", "reject", "archive", "restore", "submit"]),
    questionIds: z.array(z.string().uuid()).max(500).optional(),
    filters: z
      .object({
        course_id: z.string().uuid().optional(),
        subject_id: z.string().uuid().optional(),
        topic_id: z.string().uuid().optional(),
        status: z.enum(["draft", "pending_review", "approved", "rejected", "archived"]).optional(),
        difficulty: z.enum(["easy", "medium", "hard"]).optional(),
        source_type: z.enum(["manual", "csv_import", "json_import", "ai_assisted"]).optional(),
      })
      .optional(),
    notes: z.string().trim().max(1000).optional(),
    expectedCount: z.number().int().min(0).optional(),
  })
  .refine((value) => Boolean(value.questionIds?.length) || Boolean(value.filters && Object.keys(value.filters).length), {
    message: "প্রশ্ন নির্বাচন করুন অথবা অন্তত একটি ফিল্টার দিন।",
  });

/** Preview how many rows a filter-scoped bulk action would touch. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
  if (!can(user.role, "question.review")) {
    return NextResponse.json({ error: "রিভিউয়ের অনুমতি নেই।" }, { status: 403 });
  }

  const url = new URL(request.url);
  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  let query = supabase.from("questions").select("id", { count: "exact", head: true });
  const map: [string, string][] = [
    ["course", "course_id"],
    ["subject", "subject_id"],
    ["topic", "topic_id"],
    ["status", "status"],
    ["difficulty", "difficulty"],
    ["source", "source_type"],
  ];
  for (const [param, column] of map) {
    const value = url.searchParams.get(param);
    if (value) query = query.eq(column, value);
  }

  const { count, error } = await query;
  if (error) return fromDbError(error);
  return NextResponse.json({ count: count ?? 0 }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
  if (!can(user.role, "question.review")) {
    return NextResponse.json({ error: "রিভিউয়ের অনুমতি নেই।" }, { status: 403 });
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "অবৈধ ডেটা।" }, { status: 422 });
  }

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  // Filter-scoped actions are deliberately two-step: the UI first shows the
  // count, then passes `expectedCount` so a changed dataset cannot be approved
  // by mistake.
  if (parsed.data.filters && !parsed.data.questionIds?.length && parsed.data.expectedCount !== undefined) {
    let query = supabase.from("questions").select("id", { count: "exact", head: true });
    for (const [key, value] of Object.entries(parsed.data.filters)) {
      if (value) query = query.eq(key, value);
    }
    const { count } = await query;
    if ((count ?? 0) !== parsed.data.expectedCount) {
      return NextResponse.json(
        {
          error: `স্কোপ বদলে গেছে (${count ?? 0} সারি এখন মিলছে, প্রত্যাশিত ${parsed.data.expectedCount})। আবার পূর্বরূপ দেখুন।`,
          count: count ?? 0,
        },
        { status: 409 },
      );
    }
  }

  const { data, error } = await supabase.rpc("jh_bulk_review", {
    p_action: parsed.data.action,
    p_question_ids: parsed.data.questionIds ?? null,
    p_filters: parsed.data.filters ?? {},
    p_notes: parsed.data.notes ?? null,
  });

  if (error) return fromDbError(error);
  return NextResponse.json({ result: data }, { headers: { "Cache-Control": "no-store" } });
}
