import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
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

  // A disabled profile must not retain access through an otherwise valid Auth session.
  if (profile && profile.is_active === false) return null;

  return {
    id: user.id,
    email: user.email ?? profile?.email ?? null,
    profile: profile ?? null,
    role: (profile?.role_id as RoleId) ?? "student",
  };
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }
  return user;
}

/** Server-side guard for admin routes and API handlers. */
export async function requireStaff(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isStaff(user.role)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isAdmin(user.role)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

/**
 * The visitor's client, or null when unauthenticated. Callers must treat null
 * as "signed out" rather than assuming an identity.
 */
export async function getUserClient(userId: string): Promise<SupabaseClient | null> {
  const supabase = await getServerClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== userId) return null;
  return supabase;
}

export function displayName(user: SessionUser | null): { en: string; bn: string } {
  const full = user?.profile?.full_name?.trim();
  const fullBn = user?.profile?.full_name_bn?.trim();
  const fallback = user?.email?.split("@")[0] ?? "শিক্ষার্থী";
  return { en: full || fallback, bn: fullBn || full || fallback };
}
