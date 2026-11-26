import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Guards the two behaviours that were previously re-implemented (and subtly
 * broken) in every API route handler:
 *
 *   1. `assertSameOrigin` must fail CLOSED on a malformed Origin header. The 23
 *      hand-rolled copies compared `new URL(origin)` directly, which throws
 *      TypeError — turning a request that should be a 403 into a 500.
 *   2. `requireApiPermission` must reject signed-out callers (401) and callers
 *      without the permission (403), and must never treat `student` as staff
 *      even if the permission matrix is later widened.
 */

const getCurrentUser = vi.fn();
vi.mock("@/lib/auth", () => ({
  getCurrentUser: () => getCurrentUser(),
}));

const { assertSameOrigin, requireApiPermission } = await import("@/lib/api");

function req(headers: Record<string, string>) {
  return new Request("https://app.example.com/api/x", { method: "POST", headers });
}

beforeEach(() => {
  getCurrentUser.mockReset();
});

describe("assertSameOrigin", () => {
  it("allows a same-origin post", () => {
    expect(assertSameOrigin(req({ origin: "https://app.example.com", host: "app.example.com" }))).toBe(
      true,
    );
  });

  it("rejects a cross-origin post", () => {
    expect(assertSameOrigin(req({ origin: "https://evil.example", host: "app.example.com" }))).toBe(
      false,
    );
  });

  it("allows a request with no Origin header (curl, server-to-server)", () => {
    expect(assertSameOrigin(req({ host: "app.example.com" }))).toBe(true);
  });

  it("fails closed on a malformed Origin instead of throwing a 500", () => {
    // Regression: `new URL('not-a-url')` throws, which used to escape the
    // handler and surface as a 500 rather than a 403.
    expect(() => assertSameOrigin(req({ origin: "not a url", host: "app.example.com" }))).not.toThrow();
    expect(assertSameOrigin(req({ origin: "not a url", host: "app.example.com" }))).toBe(false);
  });
});

describe("requireApiPermission", () => {
  it("returns 401 when signed out", async () => {
    getCurrentUser.mockResolvedValue(null);
    const result = await requireApiPermission("question.edit");
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error.status).toBe(401);
  });

  it("returns 403 for a student", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", role: "student", email: null, profile: null });
    const result = await requireApiPermission("question.edit");
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error.status).toBe(403);
  });

  it("returns 403 for staff lacking the permission", async () => {
    // A content editor may edit questions but may not manage settings.
    getCurrentUser.mockResolvedValue({
      id: "u2",
      role: "content_editor",
      email: null,
      profile: null,
    });
    const result = await requireApiPermission("settings.manage");
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error.status).toBe(403);
  });

  it("allows staff holding the permission", async () => {
    getCurrentUser.mockResolvedValue({
      id: "u3",
      role: "content_editor",
      email: null,
      profile: null,
    });
    const result = await requireApiPermission("question.edit");
    expect("error" in result).toBe(false);
    if (!("error" in result)) expect(result.user.id).toBe("u3");
  });

  it("lets a super admin manage roles but not an admin", async () => {
    getCurrentUser.mockResolvedValue({ id: "a", role: "admin", email: null, profile: null });
    const adminResult = await requireApiPermission("role.manage");
    expect("error" in adminResult).toBe(true);

    getCurrentUser.mockResolvedValue({ id: "s", role: "super_admin", email: null, profile: null });
    const superResult = await requireApiPermission("role.manage");
    expect("error" in superResult).toBe(false);
  });

  it("uses the supplied Bangla message for the 403 body", async () => {
    getCurrentUser.mockResolvedValue({ id: "u4", role: "admin", email: null, profile: null });
    const result = await requireApiPermission("role.manage", { message: "কাস্টম বার্তা" });
    if ("error" in result) {
      const body = (await result.error.json()) as { error: string };
      expect(body.error).toBe("কাস্টম বার্তা");
    } else {
      throw new Error("expected a 403");
    }
  });
});
