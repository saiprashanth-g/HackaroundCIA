import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseExtraction } from "@/lib/extraction/schema";
import { normalizeLabel } from "@/lib/assembly/normalize";
import { reconcileItems } from "@/lib/assembly/reconcile";
import type { DocItems } from "@/lib/assembly/types";

/**
 * Re-resolve `week_number` deadlines for a term once its `week1_start_date` is
 * set. Re-reads each subject's documents (extracted_json persists through
 * confirmation) and updates the matching assessment items' resolved date +
 * status. Calendar-date and conflicting items are left untouched.
 */
export async function resolveWeekDatesForTerm(termId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;

  const { data: term } = await supabase
    .from("terms")
    .select("week1_start_date")
    .eq("id", termId)
    .single();
  const week1 = term?.week1_start_date ?? null;
  if (!week1) return;

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id")
    .eq("term_id", termId);

  for (const s of subjects ?? []) {
    const { data: links } = await supabase
      .from("subject_documents")
      .select("document_id")
      .eq("subject_id", s.id);
    const docIds = (links ?? []).map((l) => l.document_id);
    if (!docIds.length) continue;

    const { data: docs } = await supabase
      .from("documents")
      .select("id, extracted_json")
      .in("id", docIds);
    const docItems: DocItems[] = (docs ?? []).map((d) => ({
      documentId: d.id,
      items: parseExtraction(d.extracted_json)?.assessment_items ?? [],
    }));
    const reconciled = reconcileItems(docItems, week1);

    const { data: existing } = await supabase
      .from("assessment_items")
      .select("id, label, due_date_type, resolution_status")
      .eq("subject_id", s.id);

    for (const ex of existing ?? []) {
      if (ex.due_date_type !== "week_number") continue;
      // Don't override an item the user is still resolving by hand.
      if (ex.resolution_status === "unresolved_conflict") continue;
      const match = reconciled.find(
        (r) => normalizeLabel(r.label) === normalizeLabel(ex.label),
      );
      if (match?.resolvedDueDate) {
        await supabase
          .from("assessment_items")
          .update({ resolved_due_date: match.resolvedDueDate, status: match.status })
          .eq("id", ex.id);
      }
    }
  }
}
