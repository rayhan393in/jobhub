/**
 * Pure permission matrix — no `server-only` import so it can be unit-tested and
 * shared with client components. The database `role_permissions` table is the
 * authority; this mirrors it for UI affordances only.
 */

export type RoleIdLike = "student" | "content_editor" | "admin" | "super_admin";

export type PermissionKey =
  | "question.review"
  | "question.import"
  | "question.edit"
  | "taxonomy.manage"
  | "routine.manage"
  | "exam.publish"
  | "attempt.inspect"
  | "student.manage"
  | "analytics.view"
  | "audit.view"
  | "settings.manage"
  | "role.manage";

export const ROLE_PERMISSIONS: Record<RoleIdLike, PermissionKey[]> = {
  student: [],
  content_editor: ["question.review", "question.import", "question.edit", "taxonomy.manage", "analytics.view"],
  admin: [
    "question.review", "question.import", "question.edit", "taxonomy.manage", "routine.manage",
    "exam.publish", "attempt.inspect", "student.manage", "analytics.view", "audit.view", "settings.manage",
  ],
  super_admin: [
    "question.review", "question.import", "question.edit", "taxonomy.manage", "routine.manage",
    "exam.publish", "attempt.inspect", "student.manage", "analytics.view", "audit.view", "settings.manage",
    "role.manage",
  ],
};

export const ALL_PERMISSIONS: PermissionKey[] = [
  "question.review", "question.import", "question.edit", "taxonomy.manage", "routine.manage",
  "exam.publish", "attempt.inspect", "student.manage", "analytics.view", "audit.view",
  "settings.manage", "role.manage",
];

export function can(role: RoleIdLike, permission: PermissionKey): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
