import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "./auth";
import { can } from "./permission-matrix";
import type { PermissionKey } from "./permission-matrix";

export { ROLE_PERMISSIONS, can, ALL_PERMISSIONS } from "./permission-matrix";
export type { PermissionKey } from "./permission-matrix";

/**
 * Page-level guards live here. Route handlers use `requireApiPermission()` from
 * `@/lib/api` instead, because a handler must return a 401/403 response rather
 * than a redirect — the two guards in `@/lib/auth` (`requireStaff`,
 * `requireAdmin`) were never called and have been removed to stop anyone
 * picking one of four subtly different implementations.
 *
 * Only client components may import `permission-matrix` directly; this module
 * is server-only because it reaches for the session cookie.
 */

export type StaffUser = {
  id: string;
  email: string | null;
  role: "student" | "content_editor" | "admin" | "super_admin";
  name: string;
};

/** Any signed-in staff member (content editor and above). */
export async function requireStaff(): Promise<StaffUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role === "student") redirect("/dashboard");
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.profile?.full_name_bn || user.profile?.full_name || user.email || "স্টাফ",
  };
}

/** Requires a specific permission; staff without it land on the admin overview. */
export async function requirePermission(permission: PermissionKey): Promise<StaffUser> {
  const staff = await requireStaff();
  if (!can(staff.role, permission)) redirect("/admin?denied=" + encodeURIComponent(permission));
  return staff;
}

/**
 * The admin layout's guard: any signed-in staff member may enter `/admin`.
 * Per-module access is enforced by `requirePermission()` in each page, so a
 * content editor can still reach the overview and only the modules they own.
 */
export async function requireAdminAccess(): Promise<StaffUser> {
  return requireStaff();
}
