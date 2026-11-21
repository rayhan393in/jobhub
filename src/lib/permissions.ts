import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "./auth";
import { ROLE_PERMISSIONS, can } from "./permission-matrix";
import type { PermissionKey } from "./permission-matrix";

export { ROLE_PERMISSIONS, can, ALL_PERMISSIONS } from "./permission-matrix";
export type { PermissionKey } from "./permission-matrix";

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

export class PermissionError extends Error {
  constructor(public permission: PermissionKey) {
    super(`Missing permission: ${permission}`);
  }
}

/** Route-handler guard: throws instead of redirecting. */
export async function assertPermission(
  permission: PermissionKey,
): Promise<{ id: string; role: StaffUser["role"] }> {
  const user = await getCurrentUser();
  if (!user) throw new PermissionError(permission);
  if (user.role === "student" || !can(user.role, permission)) throw new PermissionError(permission);
  return { id: user.id, role: user.role };
}
