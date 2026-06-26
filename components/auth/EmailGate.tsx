"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { buttonBase, buttonPrimary } from "@/lib/buttonStyles";

/**
 * Email gate at the PDF/save moment. Sends a magic link that links the email to
 * the EXISTING anonymous session (Supabase updateUser → same user id), so all
 * in-progress work carries over. Returns the student to `redirectNext` verified.
 */
export function EmailGate({
  open,
  onClose,
  redirectNext,
}: {
  open: boolean;
  onClose: () => void;
  redirectNext: string;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [msg, setMsg] = useState("");

  if (!open) return null;

  async function submit() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setState("error");
      setMsg("Sign-in isn't configured yet.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setState("error");
      setMsg("That doesn't look like an email.");
      return;
    }
    setState("sending");
    const redirectTo = `${location.origin}/auth/confirm?next=${encodeURIComponent(
      redirectNext,
    )}`;
    const { error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: redirectTo },
    );
    if (error) {
      setState("error");
      setMsg(error.message);
      return;
    }
    setState("sent");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-ink/10 bg-paper p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {state === "sent" ? (
          <>
            <h2 className="font-serif text-2xl text-ink">Check your inbox</h2>
            <p className="mt-3 text-sm leading-relaxed text-navy-mid">
              We sent a sign-in link to <span className="text-ink">{email}</span>.
              Open it and you&rsquo;ll come right back to download your planner.
            </p>
            <button
              type="button"
              onClick={onClose}
              className={cn(buttonBase, buttonPrimary, "mt-6")}
            >
              Got it
            </button>
          </>
        ) : (
          <>
            <h2 className="font-serif text-2xl text-ink">
              Save your planner &amp; get the PDF
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-navy-mid">
              Pop in your email to keep your planner and download the survival
              guide. No password — we send a one-tap link, and your work carries
              over.
            </p>
            <input
              type="email"
              autoFocus
              placeholder="you@christuniversity.in"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (state === "error") setState("idle");
              }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="mt-5 w-full rounded-lg border border-ink/20 bg-paper px-4 py-3 text-sm text-ink outline-none focus:border-gold"
            />
            {state === "error" ? (
              <p className="mt-2 text-sm text-status-urgent">{msg}</p>
            ) : null}
            <div className="mt-6 flex items-center gap-4">
              <button
                type="button"
                disabled={state === "sending"}
                onClick={submit}
                className={cn(buttonBase, buttonPrimary)}
              >
                {state === "sending" ? "Sending…" : "Send my link"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-navy-mid hover:text-ink"
              >
                Not now
              </button>
            </div>
            <p className="mt-5 text-xs leading-relaxed text-navy-mid/70">
              We only use your email to save your planner. You can export or
              delete everything anytime.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
