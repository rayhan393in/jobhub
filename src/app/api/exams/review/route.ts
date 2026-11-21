import { fail, fromDbError, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getAttemptReview } from "@/lib/exam-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please sign in.", 401);

  const attemptId = new URL(request.url).searchParams.get("attemptId");
  if (!attemptId || !/^[0-9a-f-]{36}$/i.test(attemptId)) {
    return fail("A valid attempt id is required.", 400);
  }

  try {
    const review = await getAttemptReview(attemptId);
    return ok(review, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fromDbError(error);
  }
}
