import { ZodError } from "zod";
import { assertSameOrigin, fail, fromDbError, fromZodError, ok, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { startCustomAttempt, startStructuredAttempt } from "@/lib/exam-service";
import { startCustomExamSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return fail("Cross-origin request rejected.", 403);

  const user = await getCurrentUser();
  if (!user) return fail("Please sign in to start a practice paper.", 401);

  let body: ReturnType<typeof startCustomExamSchema.parse>;
  try {
    body = startCustomExamSchema.parse(await readJson(request));
  } catch (error) {
    if (error instanceof ZodError) return fromZodError(error);
    return fail("Invalid submission.", 400);
  }

  try {
    const result = body.structured
      ? await startStructuredAttempt({
          courseId: body.courseId,
          composition: body.composition,
          durationMinutes: body.durationMinutes,
          mode: body.mode,
          titleEn: body.titleEn,
          titleBn: body.titleBn,
          totalMarks: body.structured.totalMarks,
          mix: body.structured.mix,
        })
      : await startCustomAttempt({
          courseId: body.courseId,
          composition: body.composition,
          durationMinutes: body.durationMinutes,
          mode: body.mode,
          titleEn: body.titleEn,
          titleBn: body.titleBn,
        });
    return ok(result);
  } catch (error) {
    return fromDbError(error);
  }
}
