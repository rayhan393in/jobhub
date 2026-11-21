import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serviceRoleKey, supabaseEnv } from "./env";

let adminClient: SupabaseClient | null = null;

/**
 * Privileged server-only client. Bypasses RLS, therefore every caller MUST
 * perform its own authorization check before using it. Importing this module
 * from a Client Component fails the build thanks to `server-only`.
 */
export function getAdminClient(): SupabaseClient {
  if (!supabaseEnv.url || !serviceRoleKey) {
    throw new Error(
      "Server-side Supabase credentials are missing (SUPABASE_SERVICE_ROLE_KEY).",
    );
  }
  if (!adminClient) {
    adminClient = createClient(supabaseEnv.url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return adminClient;
}
