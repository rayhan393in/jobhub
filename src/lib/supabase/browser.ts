import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabaseEnv } from "./env";

let browserClient: SupabaseClient | null = null;

/**
 * Browser Supabase client. Uses the publishable key only, so every query is
 * still filtered by Row Level Security.
 */
export function getBrowserClient(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured for this deployment.");
  }
  if (!browserClient) {
    browserClient = createBrowserClient(supabaseEnv.url, supabaseEnv.anonKey);
  }
  return browserClient;
}
