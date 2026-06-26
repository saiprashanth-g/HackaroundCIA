import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env, isSupabaseConfigured } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Server Supabase client bound to the request cookie store. Use inside Server
 * Components, Server Actions, and Route Handlers. Returns null when Supabase
 * isn't configured.
 *
 * Next 15: cookies() is async.
 */
export async function createSupabaseServerClient() {
  if (!isSupabaseConfigured) return null;
  const cookieStore = await cookies();

  return createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component where cookies are read-only.
          // Middleware (updateSession) refreshes the auth cookie instead.
        }
      },
    },
  });
}

/**
 * Privileged server client using the service-role key. Bypasses RLS — only for
 * trusted server-side operations (e.g. deleting a storage object on document
 * confirmation). Never import into client code.
 */
export function createSupabaseAdminClient() {
  if (!env.supabaseUrl || !env.supabaseServiceRole) return null;
  return createClient<Database>(env.supabaseUrl, env.supabaseServiceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
