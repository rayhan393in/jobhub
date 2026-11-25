import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { fromZodError, fail } from "@/lib/api";
import { signUpSchema } from "@/lib/validation";
import { isSupabaseConfigured, supabaseEnv, hasServiceRole } from "@/lib/supabase/env";
import { getServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return fail("Supabase is not configured for this deployment.", 503);
  }

  let body: z.infer<typeof signUpSchema>;
  try {
    body = signUpSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) return fromZodError(error);
    return fail("Invalid submission.", 400);
  }

  // A dedicated client: sign-up must not persist a session until the profile
  // row exists, so we create the account server-side and let the client sign in.
  const adminless = createClient(supabaseEnv.url, supabaseEnv.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await adminless.auth.signUp({
    email: body.email,
    password: body.password,
    options: {
      data: {
        full_name: body.fullName,
        full_name_bn: body.fullName,
      },
    },
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("already registered") || message.includes("already exists")) {
      return fail("An account with this email already exists. Please sign in.", 409);
    }
    if (message.includes("password")) {
      return fail("That password does not meet the requirements.", 422);
    }
    console.error("[auth] sign-up failed:", error.message);
    return fail("We could not create your account. Please try again.", 400);
  }

  // Store optional profile details; RLS restricts this to the new user.
  if (data.user && (body.phone || body.targetCourse)) {
    const supabase = await getServerClient();
    if (supabase) {
      await supabase.from("profiles").update({ phone: body.phone || null }).eq("id", data.user.id);
    }
  }

  // V7 multi-course onboarding: resolve the selected slugs to published
  // courses and enroll the new account server-side. The caller has no
  // session yet (email confirmation may be pending), so this uses the
  // service-role client — inputs are validated and scoped to the new user.
  const requestedSlugs = [...new Set([...(body.courses ?? []), body.targetCourse].filter(Boolean))] as string[];
  if (data.user && requestedSlugs.length > 0 && hasServiceRole) {
    try {
      const admin = getAdminClient();
      const { data: courseRows } = await admin
        .from("courses")
        .select("id, slug")
        .eq("status", "published")
        .in("slug", requestedSlugs);
      const ids = (courseRows ?? []).map((c: { id: string }) => c.id);
      if (ids.length > 0) {
        await admin.from("student_course_enrollments").upsert(
          ids.map((courseId) => ({ student_id: data.user!.id, course_id: courseId })),
          { onConflict: "student_id,course_id", ignoreDuplicates: true },
        );
        // Default course = the first slug the student picked.
        const firstSlug = requestedSlugs[0];
        const firstId = (courseRows ?? []).find((c: { slug: string }) => c.slug === firstSlug)?.id ?? ids[0];
        await admin.from("profiles").update({ target_course_id: firstId }).eq("id", data.user.id);
      }
    } catch (error) {
      // Enrollment is best-effort at sign-up; the dashboard self-heals later.
      console.error("[auth] sign-up enrollment failed:", error);
    }
  }

  return NextResponse.json({
    ok: true,
    needsConfirmation: !data.session,
    email: body.email,
  });
}
