import { z } from "zod";
import { assertSameOrigin, fail, fromDbError, fromZodError, ok, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { submitAttempt } from "@/lib/exam-service";
import { submitAttemptSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return fail("Cross-origin request rejected.", 403);

  const user = await getCurrentUser();
  if (!user) return fail("Please sign in.", 401);

  let body: z.infer<typeof submitAttemptSchema>;
  try {
    body = submitAttemptSchema.parse(await readJson(request));
  } catch (error) {
    if (error instanceof z.ZodError) return fromZodError(error);
    return fail("Invalid submission.", 400);
  }

  try {
    const result = await submitAttempt(body.attemptId, body.reason);
    return ok(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fromDbError(error);
  }
}
