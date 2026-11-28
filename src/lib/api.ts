import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, type SessionUser } from "./auth";
import { can, type PermissionKey } from "./permission-matrix";

export type ApiError = {
  error: string;
  code?: string;
  details?: unknown;
};

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

const PG_MESSAGES: Array<{ test: RegExp; status: number; message: string }> = [
  { test: /Not authorized|Authentication required|not authorized/i, status: 403, message: "You are not authorized for this action." },
  { test: /not found|P0002/i, status: 404, message: "The requested record was not found." },
  { test: /has not started yet/i, status: 409, message: "This exam has not started yet." },
  { test: /entry window .* closed|has closed/i, status: 409, message: "The entry window for this exam has closed." },
  { test: /already been submitted/i, status: 409, message: "This attempt has already been submitted." },
  { test: /Time is up/i, status: 409, message: "Time is up for this attempt." },
  { test: /Only \d+ verified question/i, status: 422, message: "Not enough verified questions for this selection." },
  { test: /limited to \d+ questions/i, status: 422, message: "The requested question count exceeds the limit." },
  { test: /Duration must be/i, status: 422, message: "The requested duration is outside the allowed range." },
  { test: /Insufficient verified questions/i, status: 422, message: "Not enough verified questions to publish this exam." },
  { test: /not part of this paper/i, status: 422, message: "That question is not part of this paper." },
  { test: /up to date|row-level security|permission denied|42501/i, status: 403, message: "You are not allowed to perform this action." },
];

/**
 * Translate a database/PostgREST error into a safe client response.
 * Raw SQL text is never returned to the browser.
 */
export function fromDbError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  for (const rule of PG_MESSAGES) {
    if (rule.test.test(message)) {
      return fail(rule.message, rule.status);
    }
  }
  if (/duplicate key/i.test(message)) {
    return fail("This record already exists.", 409);
  }
  if (/violates check constraint|invalid input syntax|22023/i.test(message)) {
    return fail("The submitted values are not valid.", 422);
  }
  console.error("[api] unhandled database error:", message);
  return fail("Something went wrong. Please try again.", 500);
}

export function fromZodError(error: ZodError) {
  const first = error.issues[0];
  return fail(first?.message ?? "Invalid submission.", 422, {
    details: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  });
}

/** Guards mutating requests against cross-site form posts. */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin navigation / non-browser client
  try {
    const host = request.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    // A malformed Origin header must fail closed as a 403, never throw a 500.
    return false;
  }
}

export type PermissionDenied = { error: NextResponse };

/**
 * The single authorization entry point for API route handlers.
 *
 * Returns `{ user }` when the caller holds `permission`, or `{ error }` with a
 * ready-to-return 401/403 response. Every admin handler used to inline its own
 * `if (!user) … if (!can(...) …` pair (39 copies, several missing the
 * `role === 'student'` pre-check), so adding a route meant re-deriving the
 * rules from a neighbour. `student` is checked explicitly rather than left to
 * the matrix so a future permission added to `ROLE_PERMISSIONS.student` can
 * never quietly grant admin API access.
 */
export async function requireApiPermission(
  permission: PermissionKey,
  options?: { message?: string },
): Promise<{ user: SessionUser } | PermissionDenied> {
  const user = await getCurrentUser();
  if (!user) return { error: fail("লগইন প্রয়োজন।", 401) };
  if (user.role === "student" || !can(user.role, permission)) {
    return { error: fail(options?.message ?? "এই কাজটি করার অনুমতি নেই।", 403) };
  }
  return { user };
}

/**
 * Same as {@link requireApiPermission} but also rejects cross-origin form
 * posts — the combination almost every mutating admin route needs.
 */
export async function requireApiPermissionSameOrigin(
  request: Request,
  permission: PermissionKey,
): Promise<{ user: SessionUser } | PermissionDenied> {
  const guard = await requireApiPermission(permission);
  if ("error" in guard) return guard;
  if (!assertSameOrigin(request)) return { error: fail("অবৈধ অনুরোধ।", 403) };
  return guard;
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("INVALID_JSON");
  }
}
