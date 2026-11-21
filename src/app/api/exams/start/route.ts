import { z } from "zod";
import { assertSameOrigin, fail, fromDbError, fromZodError, ok, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { startScheduledAttempt } from "@/lib/exam-service";

export const runtime = "nodejs";

const schema = z.object({ scheduleId: z.string().uuid() });

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return fail("Cross-origin request rejected.", 403);

  const user = await getCurrentUser();
  if (!user) return fail("Please sign in to start this exam.", 401);

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await readJson(request));
  } catch (error) {
    if (error instanceof z.ZodError) return fromZodError(error);
    return fail("Invalid submission.", 400);
  }

  try {
    const result = await startScheduledAttempt(body.scheduleId);
    return ok(result);
  } catch (error) {
    return fromDbError(error);
  }
}
