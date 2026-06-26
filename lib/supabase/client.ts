"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env, isSupabaseConfigured } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Browser Supabase client (cookie-backed via @supabase/ssr). Returns null when
 * Supabase isn't configured so the UI can render a "connect Supabase" state
 * rather than throwing.
 */
export function createSupabaseBrowserClient() {
  if (!isSupabaseConfigured) return null;
  return createBrowserClient<Database>(env.supabaseUrl, env.supabaseAnonKey);
}
