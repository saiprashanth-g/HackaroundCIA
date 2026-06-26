"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { APP, maxFileBytes } from "@/lib/config";
import { cn } from "@/lib/utils";
import { buttonBase, buttonPrimary } from "@/lib/buttonStyles";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { startUpload, type UploadMeta } from "@/app/upload/actions";

type ItemStatus = "queued" | "uploading" | "uploaded" | "error";
type Item = { id: string; file: File; status: ItemStatus; error?: string };

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.docx";

function validate(file: File): string | null {
  if (file.size === 0) return "Empty file";
  if (file.size > maxFileBytes()) return `Over ${APP.maxFileMB}MB`;
  const okType =
    APP.acceptedMimes.includes(file.type) ||
    /\.(pdf|png|jpe?g|webp|docx)$/i.test(file.name);
  if (!okType) return "Unsupported type";
  return null;
}

function extOf(name: string) {
  const ext = name.split(".").pop();
  return (ext ? ext.toUpperCase() : "FILE").slice(0, 4);
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function UploadClient() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const validCount = items.filter((i) => i.status !== "error").length;
  const canSubmit = validCount > 0 && !busy;

  function addFiles(incoming: File[]) {
    const additions: Item[] = [];
    let count = items.length;
    let overflow = false;
    for (const file of incoming) {
      if (count >= APP.maxFilesPerBatch) {
        overflow = true;
        continue;
      }
      const dup =
        items.some((i) => i.file.name === file.name && i.file.size === file.size) ||
        additions.some(
          (i) => i.file.name === file.name && i.file.size === file.size,
        );
      if (dup) continue;
      const error = validate(file);
      additions.push({
        id: crypto.randomUUID(),
        file,
        status: error ? "error" : "queued",
        error: error ?? undefined,
      });
      count++;
    }
    if (additions.length) setItems((prev) => [...prev, ...additions]);
    setNotice(
      overflow
        ? `You can upload up to ${APP.maxFilesPerBatch} files — extra files were skipped.`
        : null,
    );
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function handleSubmit() {
    const uploadable = items.filter((i) => i.status !== "error");
    if (!uploadable.length) return;
    setBusy(true);
    setNotice(null);

    const metas: UploadMeta[] = uploadable.map((i) => ({
      name: i.file.name,
      size: i.file.size,
      type: i.file.type,
    }));

    const res = await startUpload(metas);
    if (!res.ok) {
      setNotice(res.message);
      setBusy(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setNotice("Supabase isn't connected — can't upload the raw files.");
      setBusy(false);
      return;
    }

    let failed = false;
    for (let k = 0; k < uploadable.length; k++) {
      const item = uploadable[k];
      const target = res.files[k];
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: "uploading" } : i)),
      );
      const { error } = await supabase.storage
        .from("raw-uploads")
        .upload(target.path, item.file, {
          contentType: item.file.type || undefined,
          upsert: false,
        });
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                status: error ? "error" : "uploaded",
                error: error?.message,
              }
            : i,
        ),
      );
      if (error) failed = true;
    }

    if (failed) {
      setNotice("Some files didn't upload. Remove them and try again.");
      setBusy(false);
      return;
    }

    router.push(`/processing?t=${res.termId}`);
  }

  return (
    <div>
      {notice ? (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-gold/50 bg-gold/10 px-4 py-3 text-sm leading-relaxed text-ink">
          <span aria-hidden className="mt-0.5 text-gold">
            &#9432;
          </span>
          <span>{notice}</span>
        </div>
      ) : null}

      {/* Dropzone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Add course plan files"
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !busy) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy && e.dataTransfer.files?.length) {
            addFiles(Array.from(e.dataTransfer.files));
          }
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed px-8 py-16 text-center outline-none transition-colors",
          dragging
            ? "border-gold bg-card"
            : "border-ink/15 bg-card/40 hover:border-ink/30 hover:bg-card/60",
          busy && "pointer-events-none opacity-60",
        )}
      >
        <UploadGlyph />
        <div>
          <p className="font-serif text-xl text-ink">
            Drag your course &amp; CIA plans here
          </p>
          <p className="mt-1 text-sm text-navy-mid">
            or{" "}
            <span className="underline decoration-gold decoration-2 underline-offset-4">
              browse your files
            </span>
          </p>
        </div>
        <p className="text-xs text-navy-mid/60">
          PDF, JPG, PNG or DOCX &middot; up to {APP.maxFilesPerBatch} files
          &middot; max {APP.maxFileMB}MB each
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(Array.from(e.target.files));
            e.target.value = "";
          }}
        />
      </div>

      {/* File list */}
      {items.length > 0 ? (
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-navy-mid">
              Your files
            </h2>
            <span className="text-sm text-navy-mid/70">
              {validCount} / {APP.maxFilesPerBatch}
            </span>
          </div>
          <ul className="flex flex-col gap-2.5">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-4 rounded-xl border border-ink/10 bg-paper px-4 py-3"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink/5 text-[10px] font-semibold tracking-wide text-navy-mid">
                  {extOf(item.file.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{item.file.name}</p>
                  <p className="text-xs text-navy-mid/70">
                    {formatBytes(item.file.size)}
                  </p>
                </div>
                <StatusPill status={item.status} error={item.error} />
                {!busy ? (
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    aria-label={`Remove ${item.file.name}`}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-navy-mid/50 transition-colors hover:bg-ink/5 hover:text-ink"
                  >
                    &times;
                  </button>
                ) : (
                  <span className="h-7 w-7" />
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Submit */}
      <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={cn(buttonBase, buttonPrimary)}
        >
          {busy ? "Uploading…" : "Build my planner"}
          <Arrow />
        </button>
        <p className="text-sm text-navy-mid/70">
          We delete the raw files the moment you confirm your plan.
        </p>
      </div>
    </div>
  );
}

function StatusPill({ status, error }: { status: ItemStatus; error?: string }) {
  const map: Record<ItemStatus, { label: string; cls: string }> = {
    queued: { label: "Ready", cls: "bg-navy-mid/10 text-navy-mid" },
    uploading: { label: "Uploading…", cls: "bg-gold/25 text-ink" },
    uploaded: { label: "Uploaded", cls: "bg-status-done/45 text-ink" },
    error: { label: error ?? "Error", cls: "bg-status-urgent/30 text-ink" },
  };
  const s = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
        s.cls,
      )}
    >
      <StatusDot status={status} />
      {s.label}
    </span>
  );
}

function StatusDot({ status }: { status: ItemStatus }) {
  if (status === "uploaded") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path
          d="M2.5 6.2l2.2 2.3L9.5 3.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (status === "error") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path
          d="M6 3v3.2M6 8.4v.2"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "h-1.5 w-1.5 rounded-full bg-current",
        status === "uploading" && "animate-pulse",
      )}
    />
  );
}

function Arrow() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className="transition-transform duration-300 group-hover:translate-x-0.5"
    >
      <path
        d="M2 8h12M9 3l5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UploadGlyph() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden
      className="text-gold"
    >
      <path
        d="M20 26V12m0 0l-6 6m6-6l6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 24v3a3 3 0 003 3h16a3 3 0 003-3v-3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}
