import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";
import { fromDbError } from "@/lib/api";

export const dynamic = "force-dynamic";

const schema = z.object({
  fullName: z.string().trim().max(80).optional().default(""),
  fullNameBn: z.string().trim().max(80).optional().default(""),
  phone: z
    .string()
    .trim()
    .max(20)
    .refine((v) => v === "" || /^\+?[0-9 -]{6,20}$/.test(v), { message: "অবৈধ ফোন নম্বর।" })
    .optional()
    .default(""),
  locale: z.enum(["bn", "en"]).optional().default("bn"),
  targetCourseId: z.string().uuid().nullable().optional(),
});

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });

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
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "অবৈধ ডেটা।" },
      { status: 422 },
    );
  }

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName || null,
      full_name_bn: parsed.data.fullNameBn || null,
      phone: parsed.data.phone || null,
      locale: parsed.data.locale,
      target_course_id: parsed.data.targetCourseId ?? null,
    })
    .eq("id", user.id);

  if (error) return fromDbError(error);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
