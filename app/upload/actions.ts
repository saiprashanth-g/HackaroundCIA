"use server";

import { getOrCreateAnonUser } from "@/lib/auth";
import { APP, maxFileBytes } from "@/lib/config";

export type UploadMeta = { name: string; size: number; type: string };

export type StartUploadResult =
  | { ok: true; termId: string; files: { docId: string; path: string }[] }
  | {
      ok: false;
      reason: "not_configured" | "invalid" | "error";
      message: string;
    };

/**
 * Creates the term + one `documents` row (status `pending`) per file, and
 * returns the storage paths the client should upload the raw blobs to. Re-checks
 * the caps server-side — never trusts the client.
 *
 * The raw file itself is uploaded client-side (direct to Storage, RLS-scoped to
 * the user's own folder), then extraction runs in step 5.
 */
export async function startUpload(
  metas: UploadMeta[],
): Promise<StartUploadResult> {
  // ── Cap re-validation (server is the source of truth) ──
  if (!metas.length) {
    return { ok: false, reason: "invalid", message: "No files to upload." };
  }
  if (metas.length > APP.maxFilesPerBatch) {
    return {
      ok: false,
      reason: "invalid",
      message: `You can upload up to ${APP.maxFilesPerBatch} files at once.`,
    };
  }
  for (const m of metas) {
    if (m.size > maxFileBytes()) {
      return {
        ok: false,
        reason: "invalid",
        message: `"${m.name}" is larger than ${APP.maxFileMB}MB.`,
      };
    }
    const okType =
      APP.acceptedMimes.includes(m.type) ||
      /\.(pdf|png|jpe?g|webp|docx)$/i.test(m.name);
    if (!okType) {
      return {
        ok: false,
        reason: "invalid",
        message: `"${m.name}" is not a supported file type.`,
      };
    }
  }

  const { supabase, userId } = await getOrCreateAnonUser();
  if (!supabase || !userId) {
    return {
      ok: false,
      reason: "not_configured",
      message:
        "Supabase isn't connected yet, so files can't be saved. Wire .env.local to enable uploads.",
    };
  }

  // One term per upload batch (the active planner). week1_start_date is set
  // later, on the Review screen.
  const termName = `Planner · ${new Date().toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  })}`;
  const { data: term, error: termErr } = await supabase
    .from("terms")
    .insert({ name: termName })
    .select("id")
    .single();
  if (termErr || !term) {
    return {
      ok: false,
      reason: "error",
      message: termErr?.message ?? "Could not create a term.",
    };
  }

  const files: { docId: string; path: string }[] = [];
  for (const m of metas) {
    const safe = m.name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
    const path = `${userId}/${term.id}/${crypto.randomUUID()}-${safe}`;
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .insert({
        term_id: term.id,
        original_filename: m.name,
        raw_file_ref: path,
        extraction_status: "pending",
      })
      .select("id")
      .single();
    if (docErr || !doc) {
      return {
        ok: false,
        reason: "error",
        message: docErr?.message ?? "Could not create a document row.",
      };
    }
    files.push({ docId: doc.id, path });
  }

  return { ok: true, termId: term.id, files };
}
