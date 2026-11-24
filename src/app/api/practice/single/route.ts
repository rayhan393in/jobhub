import { z, ZodError } from "zod";
import { assertSameOrigin, fail, fromZodError, ok, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  questionId: z.string().uuid(),
  durationMinutes: z.number().int().min(1).max(60).optional(),
});

/**
 * POST /api/practice/single — start a one-question practice attempt.
 * The question is re-validated server-side (approved + verified only) inside
 * `jh_start_single_question`; nothing about the answer key leaves the server.
 */
export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return fail("Cross-origin request rejected.", 403);

  const user = await getCurrentUser();
  if (!user) return fail("অনুশীলনের জন্য লগইন করুন।", 401);

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await readJson(request));
  } catch (error) {
    if (error instanceof ZodError) return fromZodError(error);
    return fail("অবৈধ অনুরোধ।", 400);
  }

  const supabase = await getServerClient();
  if (!supabase) return fail("সার্ভার কনফিগারেশন নেই।", 500);

  const { data, error } = await supabase.rpc("jh_start_single_question", {
    p_question_id: body.questionId,
    p_duration_minutes: body.durationMinutes ?? 5,
  });
  if (error) {
    if (/not available/i.test(error.message)) {
      return fail("এই প্রশ্নটি অনুশীলনের জন্য উপলব্ধ নয়।", 404);
    }
    if (/authentication/i.test(error.message)) {
      return fail("অনুশীলনের জন্য লগইন করুন।", 401);
    }
    return fail("অনুশীলন শুরু করা যায়নি।", 400);
  }
  const payload = data as { attempt_id?: string; deadline_at?: string } | null;
  if (!payload?.attempt_id) return fail("অনুশীলন শুরু করা যায়নি।", 500);
  return ok({ attemptId: payload.attempt_id, deadlineAt: payload.deadline_at ?? null });
}
