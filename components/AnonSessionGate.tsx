"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Silently ensures an anonymous Supabase session exists on first visit, so the
 * student can land + upload with zero friction and all their data is RLS-scoped
 * from the first action. No-op when Supabase isn't configured. Renders nothing.
 */
export default function AnonSessionGate() {
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active || data.session) return;
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        // Most likely "Anonymous sign-ins are disabled" — surface for the dev.
        console.warn("[anon] sign-in failed:", error.message);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return null;
}
