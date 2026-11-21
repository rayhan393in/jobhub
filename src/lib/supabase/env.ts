/**
 * Supabase environment resolution.
 *
 * Only the public URL and the publishable/anon key may reach the browser.
 * The service role key is read exclusively by server modules and never
 * imported from a `"use client"` file.
 */

export type SupabaseEnv = {
  url: string;
  anonKey: string;
};

const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const configuredAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ??
  "";

/** True when the project is wired to a real Supabase instance. */
export const isSupabaseConfigured = Boolean(configuredUrl && configuredAnonKey);

export const supabaseEnv: SupabaseEnv = {
  url: configuredUrl,
  anonKey: configuredAnonKey,
};

export const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

/** The server key is only usable in a Node runtime (never bundled). */
export const hasServiceRole = Boolean(configuredUrl && serviceRoleKey);

export const PUBLIC_ENV_KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;

export function assertServerEnv() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for privileged server operations.");
  }
}
