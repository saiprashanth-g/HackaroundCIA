import { createSupabaseServerClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { APP } from "@/lib/config";
import { groqChatJSON, GroqError, type GroqContentPart } from "@/lib/groq";
import {
  EXTRACTION_SYSTEM,
  USER_IMAGE_INTRO,
  USER_TEXT_INTRO,
} from "@/lib/extraction/prompt";
import { parseExtraction } from "@/lib/extraction/schema";
import { estimateCost } from "@/lib/extraction/cost";
import type { Json } from "@/lib/supabase/database.types";

export type ExtractOutcome = {
  documentId: string;
  filename?: string;
  status: "extracted" | "parse_failed" | "skipped" | "error";
  message?: string;
};

type Kind = "image" | "pdf" | "docx" | "other";

const MAX_TEXT_CHARS = 60_000; // bound tokens/cost per call
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function kindOf(filename: string): { kind: Kind; mime: string } {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "png":
      return { kind: "image", mime: "image/png" };
    case "jpg":
    case "jpeg":
      return { kind: "image", mime: "image/jpeg" };
    case "webp":
      return { kind: "image", mime: "image/webp" };
    case "pdf":
      return { kind: "pdf", mime: "application/pdf" };
    case "docx":
      return { kind: "docx", mime: DOCX_MIME };
    default:
      return { kind: "other", mime: "application/octet-stream" };
  }
}

async function pdfToText(buf: ArrayBuffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n\n") : text;
}

async function docxToText(buf: ArrayBuffer): Promise<string> {
  const mod = (await import("mammoth")) as unknown as {
    default?: { extractRawText: (o: { buffer: Buffer }) => Promise<{ value: string }> };
    extractRawText?: (o: { buffer: Buffer }) => Promise<{ value: string }>;
  };
  const extractRawText = mod.default?.extractRawText ?? mod.extractRawText;
  if (!extractRawText) throw new Error("mammoth unavailable");
  const { value } = await extractRawText({ buffer: Buffer.from(buf) });
  return value;
}

type ServerClient = NonNullable<
  Awaited<ReturnType<typeof createSupabaseServerClient>>
>;

async function logAttempt(
  supabase: ServerClient,
  studentId: string,
  documentId: string,
  attemptNo: number,
  inTokens: number | null,
  outTokens: number | null,
) {
  await supabase.from("extraction_log").insert({
    student_id: studentId,
    document_id: documentId,
    model: env.groqModel,
    in_tokens: inTokens,
    out_tokens: outTokens,
    est_cost: estimateCost(inTokens, outTokens),
    attempt_no: attemptNo,
  });
}

async function markFailed(supabase: ServerClient, documentId: string) {
  await supabase
    .from("documents")
    .update({ extraction_status: "parse_failed" })
    .eq("id", documentId);
}

/**
 * Extract ONE document (Layer A). Never throws — every failure is captured and
 * the document degrades to `parse_failed` (→ manual entry on Screen 3) so it
 * never blocks its siblings. Rate-limits re-extraction per document.
 */
export async function extractDocument(
  documentId: string,
): Promise<ExtractOutcome> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { documentId, status: "error", message: "Supabase not configured." };
  }

  const { data: doc, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .single();
  if (error || !doc) {
    return { documentId, status: "error", message: "Document not found." };
  }
  const filename = doc.original_filename;
  if (doc.extraction_status === "confirmed") {
    return { documentId, filename, status: "skipped", message: "Already confirmed." };
  }

  // ── Re-extraction rate limit + attempt number ──
  const { data: lastLogs, count } = await supabase
    .from("extraction_log")
    .select("created_at", { count: "exact" })
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(1);
  const attemptNo = (count ?? 0) + 1;
  const last = lastLogs?.[0];
  if (last) {
    const elapsed = Date.now() - new Date(last.created_at).getTime();
    if (elapsed < APP.reextractCooldownMs) {
      return {
        documentId,
        filename,
        status: "skipped",
        message: "Re-extraction is rate-limited — try again in a moment.",
      };
    }
  }

  if (!env.groqApiKey) {
    return { documentId, filename, status: "error", message: "Groq not configured." };
  }
  if (!doc.raw_file_ref) {
    await markFailed(supabase, documentId);
    return {
      documentId,
      filename,
      status: "parse_failed",
      message: "Raw file is no longer available.",
    };
  }

  // ── Download raw file ──
  const { data: blob, error: dlErr } = await supabase.storage
    .from("raw-uploads")
    .download(doc.raw_file_ref);
  if (dlErr || !blob) {
    await markFailed(supabase, documentId);
    return {
      documentId,
      filename,
      status: "parse_failed",
      message: "Could not download the raw file.",
    };
  }
  const ab = await blob.arrayBuffer();
  const { kind, mime } = kindOf(filename);

  // ── Build model input (text or multimodal image) ──
  let content: string | GroqContentPart[];
  try {
    if (kind === "image") {
      const b64 = Buffer.from(ab).toString("base64");
      content = [
        { type: "text", text: USER_IMAGE_INTRO },
        { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
      ];
    } else if (kind === "pdf" || kind === "docx") {
      const raw = kind === "pdf" ? await pdfToText(ab) : await docxToText(ab);
      const text = raw.trim();
      if (text.length < 20) {
        // No usable text layer (likely a scan) — degrade to manual entry.
        await markFailed(supabase, documentId);
        await logAttempt(supabase, doc.student_id, documentId, attemptNo, null, null);
        return {
          documentId,
          filename,
          status: "parse_failed",
          message: "Couldn't read text — try re-uploading as a photo.",
        };
      }
      content = `${USER_TEXT_INTRO}\n\n${text.slice(0, MAX_TEXT_CHARS)}`;
    } else {
      await markFailed(supabase, documentId);
      return {
        documentId,
        filename,
        status: "parse_failed",
        message: "Unsupported file type.",
      };
    }
  } catch {
    await markFailed(supabase, documentId);
    await logAttempt(supabase, doc.student_id, documentId, attemptNo, null, null);
    return {
      documentId,
      filename,
      status: "parse_failed",
      message: "Could not read the file contents.",
    };
  }

  // ── Groq call ──
  let json: unknown;
  let inTokens: number | null = null;
  let outTokens: number | null = null;
  try {
    const r = await groqChatJSON({
      system: EXTRACTION_SYSTEM,
      content,
      model: env.groqModel,
    });
    json = r.json;
    inTokens = r.usage.inTokens;
    outTokens = r.usage.outTokens;
  } catch (e) {
    await markFailed(supabase, documentId);
    await logAttempt(supabase, doc.student_id, documentId, attemptNo, null, null);
    return {
      documentId,
      filename,
      status: "parse_failed",
      message: e instanceof GroqError ? e.message : "Extraction call failed.",
    };
  }

  // ── Validate against contract ──
  const parsed = parseExtraction(json);
  await logAttempt(supabase, doc.student_id, documentId, attemptNo, inTokens, outTokens);
  if (!parsed) {
    await markFailed(supabase, documentId);
    return {
      documentId,
      filename,
      status: "parse_failed",
      message: "Model output did not match the contract.",
    };
  }

  await supabase
    .from("documents")
    .update({
      document_type: parsed.document_type,
      document_type_confidence: parsed.document_type_confidence,
      extracted_json: parsed as unknown as Json,
      extraction_status: "extracted",
    })
    .eq("id", documentId);

  return { documentId, filename, status: "extracted" };
}

/**
 * Extract all still-pending documents for a term, sequentially (bounded cost,
 * gentle on rate limits). Each failure is isolated.
 */
export async function extractPendingForTerm(
  termId: string,
): Promise<ExtractOutcome[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data: docs } = await supabase
    .from("documents")
    .select("id")
    .eq("term_id", termId)
    .eq("extraction_status", "pending");

  const outcomes: ExtractOutcome[] = [];
  for (const d of docs ?? []) {
    outcomes.push(await extractDocument(d.id));
  }
  return outcomes;
}
