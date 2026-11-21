import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { fromZodError, fail } from "@/lib/api";
import { signUpSchema } from "@/lib/validation";
import { isSupabaseConfigured, supabaseEnv } from "@/lib/supabase/env";
import { getServerClient } from "@/lib/supabase/server";

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

  return NextResponse.json({
    ok: true,
    needsConfirmation: !data.session,
    email: body.email,
  });
}
