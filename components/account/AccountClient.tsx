"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteMyData, exportMyData } from "@/app/account/actions";
import { cn } from "@/lib/utils";
import { buttonBase, buttonOutline, buttonPrimary } from "@/lib/buttonStyles";

export default function AccountClient({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "export" | "delete">(null);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onExport() {
    setBusy("export");
    setMsg(null);
    const r = await exportMyData();
    setBusy(null);
    if (!r.ok || !r.data) {
      setMsg(r.message ?? "Couldn't export your data.");
      return;
    }
    const blob = new Blob([JSON.stringify(r.data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hackaroundcia-data-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function onDelete() {
    setBusy("delete");
    setMsg(null);
    const r = await deleteMyData();
    setBusy(null);
    setConfirming(false);
    if (!r.ok) {
      setMsg(r.message ?? "Couldn't delete your data.");
      return;
    }
    router.push("/?deleted=1");
  }

  if (!configured) {
    return (
      <p className="max-w-xl rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-ink">
        These actions need Supabase connected. Once it&rsquo;s wired, you can
        export or permanently delete everything from here.
      </p>
    );
  }

  return (
    <div className="grid max-w-3xl gap-5 md:grid-cols-2">
      {msg ? (
        <p className="md:col-span-2 rounded-xl border border-status-urgent/40 bg-status-urgent/10 px-4 py-3 text-sm text-ink">
          {msg}
        </p>
      ) : null}

      <div className="rounded-2xl border border-ink/10 bg-paper p-6">
        <h2 className="font-serif text-2xl text-ink">Export my data</h2>
        <p className="mt-2 text-sm leading-relaxed text-navy-mid">
          Download everything we hold — your subjects, deadlines, and account —
          as a single JSON file.
        </p>
        <button
          type="button"
          onClick={onExport}
          disabled={busy !== null}
          className={cn(buttonBase, buttonOutline, "mt-5")}
        >
          {busy === "export" ? "Preparing…" : "Download my data"}
        </button>
      </div>

      <div className="rounded-2xl border border-status-urgent/30 bg-status-urgent/[0.06] p-6">
        <h2 className="font-serif text-2xl text-ink">Delete my data</h2>
        <p className="mt-2 text-sm leading-relaxed text-navy-mid">
          Permanently remove every subject, deadline, uploaded file, and your
          email/account. This can&rsquo;t be undone.
        </p>
        {confirming ? (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onDelete}
              disabled={busy !== null}
              className={cn(
                buttonBase,
                "bg-status-urgent text-ink hover:-translate-y-0.5",
              )}
            >
              {busy === "delete" ? "Deleting…" : "Yes, delete everything"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-sm text-navy-mid hover:text-ink"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={busy !== null}
            className={cn(
              buttonBase,
              "mt-5 border border-status-urgent/50 text-ink hover:-translate-y-0.5",
            )}
          >
            Delete everything
          </button>
        )}
      </div>
    </div>
  );
}
