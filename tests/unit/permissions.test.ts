import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, ROLE_PERMISSIONS, can } from "@/lib/permission-matrix";

describe("role permissions", () => {
  it("gives students no privileged permission", () => {
    expect(ROLE_PERMISSIONS.student).toEqual([]);
    for (const permission of ALL_PERMISSIONS) {
      expect(can("student", permission)).toBe(false);
    }
  });

  it("keeps role management exclusive to super admins", () => {
    expect(can("super_admin", "role.manage")).toBe(true);
    expect(can("admin", "role.manage")).toBe(false);
    expect(can("content_editor", "role.manage")).toBe(false);
  });

  it("keeps exam publishing away from content editors", () => {
    expect(can("content_editor", "exam.publish")).toBe(false);
    expect(can("admin", "exam.publish")).toBe(true);
  });

  it("lets content editors review and import but not manage students", () => {
    expect(can("content_editor", "question.review")).toBe(true);
    expect(can("content_editor", "question.import")).toBe(true);
    expect(can("content_editor", "student.manage")).toBe(false);
    expect(can("content_editor", "routine.manage")).toBe(false);
  });

  it("grants super admin every declared permission", () => {
    for (const permission of ALL_PERMISSIONS) {
      expect(can("super_admin", permission)).toBe(true);
    }
  });

  it("never accumulates permissions as the role gets weaker", () => {
    const levels = ["super_admin", "admin", "content_editor", "student"] as const;
    for (let index = 0; index < levels.length - 1; index += 1) {
      const stronger = new Set(ROLE_PERMISSIONS[levels[index]]);
      for (const permission of ROLE_PERMISSIONS[levels[index + 1]]) {
        expect(stronger.has(permission)).toBe(true);
      }
    }
  });
});
