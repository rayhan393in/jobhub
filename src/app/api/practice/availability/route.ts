import { fail, fromDbError, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { availability } from "@/lib/exam-service";

export const runtime = "nodejs";

/** Returns verified question counts for a scope. Counts only — never content. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please sign in.", 401);

  const params = new URL(request.url).searchParams;
  const courseId = params.get("courseId");
  if (!courseId || !/^[0-9a-f-]{36}$/i.test(courseId)) {
    return fail("A valid course id is required.", 400);
  }

  try {
    const count = await availability(courseId, {
      subjectId: params.get("subjectId"),
      topicId: params.get("topicId"),
      subtopicId: params.get("subtopicId"),
    });
    return ok({ available: count }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fromDbError(error);
  }
}
