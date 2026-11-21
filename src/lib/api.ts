import { NextResponse } from "next/server";
import { ZodError } from "zod";

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
    return false;
  }
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("INVALID_JSON");
  }
}
