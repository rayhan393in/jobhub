import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getServerClient } from "@/lib/supabase/server";
import { fromDbError } from "@/lib/api";

export const dynamic = "force-dynamic";

const roleSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.enum(["student", "content_editor", "admin", "super_admin"]),
});

const activeSchema = z.object({
  userId: z.string().uuid(),
  isActive: z.boolean(),
});

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  return !origin || !host || new URL(origin).host === host;
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 400 });
  }

  const isRole = typeof raw === "object" && raw !== null && "roleId" in raw;
  const parsed = isRole ? roleSchema.safeParse(raw) : activeSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 422 });

  // Role changes are super-admin only; activation uses student.manage.
  if (isRole) {
    if (!can(user.role, "role.manage")) {
      return NextResponse.json({ error: "রোল পরিবর্তনের অনুমতি নেই (শুধু সুপার অ্যাডমিন)।" }, { status: 403 });
    }
  } else if (!can(user.role, "student.manage")) {
    return NextResponse.json({ error: "শিক্ষার্থী ব্যবস্থাপনার অনুমতি নেই।" }, { status: 403 });
  }

  const payload = parsed.data as { userId: string; roleId?: string; isActive?: boolean };
  if (payload.userId === user.id && payload.roleId && payload.roleId !== user.role) {
    return NextResponse.json({ error: "নিজের রোল পরিবর্তন করা যায় না।" }, { status: 409 });
  }

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (payload.roleId) patch.role_id = payload.roleId;
  if (payload.isActive !== undefined) patch.is_active = payload.isActive;

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", payload.userId)
    .select("id, role_id, is_active")
    .single();
  if (error) return fromDbError(error);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: payload.roleId ? "student.role_update" : "student.activation_update",
    entity_type: "profile",
    entity_id: payload.userId,
    details: payload.roleId ? { role_id: payload.roleId } : { is_active: payload.isActive },
  });

  return NextResponse.json({ profile: data }, { headers: { "Cache-Control": "no-store" } });
}
