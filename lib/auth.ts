import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Server-side: return the current user, creating an anonymous session if none
 * exists (defence-in-depth — the client AnonSessionGate normally creates it
 * first). Returns nulls when Supabase isn't configured.
 *
 * Only import from server code (Server Actions / Components) — it reaches into
 * next/headers cookies.
 */
export async function getOrCreateAnonUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { supabase: null, userId: null as string | null };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return { supabase, userId: user.id };

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) return { supabase, userId: null as string | null };
  return { supabase, userId: data.user.id };
}
