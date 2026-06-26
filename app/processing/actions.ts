"use server";

import { extractPendingForTerm } from "@/lib/extraction/extract";
import { assembleTerm, type AssembleSummary } from "@/lib/assembly/assemble";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Run Layer A (extract pending docs) then Layer B (assemble) for a term. */
export async function runProcessing(
  termId: string,
): Promise<{ ok: boolean; summary?: AssembleSummary }> {
  await extractPendingForTerm(termId);
  const summary = await assembleTerm(termId);
  return { ok: true, summary };
}

/** Lightweight per-document status for the loading dashboard's live progress. */
export async function getProcessingStatus(
  termId: string,
): Promise<{ docs: { id: string; status: string }[] }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { docs: [] };
  const { data } = await supabase
    .from("documents")
    .select("id, extraction_status")
    .eq("term_id", termId);
  return {
    docs: (data ?? []).map((d) => ({ id: d.id, status: d.extraction_status })),
  };
}
