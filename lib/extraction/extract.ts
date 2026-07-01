export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import mammoth from "mammoth";
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

const MAX_TEXT_CHARS = 60000;

function kindOf(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "pdf":
      return { kind: "pdf", mime: "application/pdf" };
    case "docx":
      return { kind: "docx" };
    case "png":
    case "jpg":
    case "jpeg":
      return { kind: "image" };
    default:
      return { kind: "other" };
  }
}

/**
 * Communicates with the isolated /api/extract Route Handler
 * completely separating PDF parsing binaries from Next.js Server Actions.
 */
async function pdfToText(buf: ArrayBuffer, filename: string): Promise<string> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3004");
    const formData = new FormData();
    
    const blob = new Blob([buf], { type: "application/pdf" });
    formData.append("file", blob, filename);

    const response = await fetch(`${baseUrl}/api/extract`, {
      method: "POST",
      body: formData,
      cache: "no-store", 
    });

    if (!response.ok) {
      throw new Error(`Extraction HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data.text || "";
  } catch (err) {
    console.error("PDF ISOLATED ENGINE ERROR:", err);
    return "";
  }
}

/**
 * Main coordinator function invoked by your Server Actions
 */
export async function extractDocumentData(filename: string, arrayBuffer: ArrayBuffer) {
  const fileType = kindOf(filename);
  let extractedText = "";

  if (fileType.kind === "pdf") {
    extractedText = await pdfToText(arrayBuffer, filename);
  } else if (fileType.kind === "docx") {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) });
    extractedText = result.value || "";
  } else if (fileType.kind === "image") {
    extractedText = "";
  }

  if (!extractedText && fileType.kind !== "image") {
    throw new Error("Could not extract any readable text content from the file.");
  }

  const truncatedText = extractedText.slice(0, MAX_TEXT_CHARS);

  // Remaining processing pipeline continues below (Groq calls, parsing, database operations)
  // ...
}

/**
 * Iterates through all unprocessed or pending documents for a given academic term,
 * downloads their source files, and processes them through the engine.
 */
export async function extractPendingForTerm(termId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    throw new Error("Database connectivity context unavailable.");
  }

  // Fetch pending documents for this specific term
  const { data: pendingDocs, error } = await supabase
    .from("documents")
    .select("id, filename, file_path")
    .eq("term_id", termId)
    .eq("extraction_status", "pending");

  if (error) {
    console.error("❌ Failed to query pending documents:", error);
    throw error;
  }

  if (!pendingDocs || pendingDocs.length === 0) {
    return;
  }

  for (const doc of pendingDocs) {
    try {
      // Defensive Type Check: Ensure the file path exists and is a valid string before running download
      if (!doc.file_path) {
        throw new Error(`Missing storage file path reference for document ID: ${doc.id}`);
      }

      // 1. Mark status as processing to prevent race conditions
      await supabase
        .from("documents")
        .update({ extraction_status: "processing" as any })
        .eq("id", doc.id);

      // 2. Download file blob from Supabase Storage
      const { data: fileData, error: downloadError } = await supabase
        .storage
        .from("course-plans")
        .download(doc.file_path);

      if (downloadError || !fileData) {
        throw new Error(downloadError?.message || "Storage retrieval failed.");
      }

      // 3. Convert to ArrayBuffer and trigger engine
      const arrayBuffer = await fileData.arrayBuffer();
      await extractDocumentData(doc.filename, arrayBuffer);

      // 4. Update status to completed
      await supabase
        .from("documents")
        .update({ extraction_status: "completed" as any })
        .eq("id", doc.id);

    } catch (docError: any) {
      console.error(`❌ Extraction failed for document [${doc.id}]:`, docError);
      
      // Mark as failed so the UI reflects the engine failure state
      await supabase
        .from("documents")
        .update({ extraction_status: "failed" as any })
        .eq("id", doc.id);
    }
  }
}