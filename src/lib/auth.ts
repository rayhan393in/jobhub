import "server-only";
import { cache } from "react";
import { getServerClient } from "./supabase/server";
import type { Profile, RoleId } from "./types";

export type SessionUser = {
  id: string;
  email: string | null;
  profile: Profile | null;
  role: RoleId;
};

/** Roles allowed into the admin control center. */
export const STAFF_ROLES: RoleId[] = ["content_editor", "admin", "super_admin"];

export function isStaff(role: RoleId) {
  return STAFF_ROLES.includes(role);
}

export function isAdmin(role: RoleId) {
  return role === "admin" || role === "super_admin";
}

/**
 * Current visitor resolved from Supabase cookies. Cached per request so pages
 * and layouts do not repeat the same round trip.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await getServerClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, full_name_bn, phone, role_id, target_course_id, locale, avatar_url, is_active, onboarded_at, created_at",
    )
    .eq("id", user.id)
    .maybeSingle<Profile>();

  return {
    id: user.id,
    email: user.email ?? profile?.email ?? null,
    profile: profile ?? null,
    role: (profile?.role_id as RoleId) ?? "student",
  };
});

/**
 * Session resolution only. Authorization lives in exactly two places, so there
 * is no ambiguity about which guard a new route should use:
 *   - `requireApiPermission()` in `@/lib/api`  → route handlers (401/403 JSON)
 *   - `requirePermission()`  in `@/lib/permissions` → pages (redirects)
 * The previous `requireStaff` / `requireAdmin` / `getUserClient` helpers existed
 * here but had no call sites, and their names collided with a second
 * `requireStaff` in `@/lib/permissions` — a genuine footgun when adding routes.
 */

export function displayName(user: SessionUser | null): { en: string; bn: string } {
  const full = user?.profile?.full_name?.trim();
  const fullBn = user?.profile?.full_name_bn?.trim();
  const fallback = user?.email?.split("@")[0] ?? "শিক্ষার্থী";
  return { en: full || fallback, bn: fullBn || full || fallback };
}
