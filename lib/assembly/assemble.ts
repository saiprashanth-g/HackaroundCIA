import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseExtraction, type ExtractionResult } from "@/lib/extraction/schema";
import { groupDocuments } from "@/lib/assembly/group";
import { reconcileItems, weightSum } from "@/lib/assembly/reconcile";
import type { DocForGrouping, DocItems } from "@/lib/assembly/types";
import type { Json } from "@/lib/supabase/database.types";

export type AssembleSummary = {
  ok: boolean;
  subjects: number;
  needsConfirmGroupings: number;
  conflictItems: number;
  weightWarnings: { subject: string; sum: number }[];
  alreadyAssembled?: boolean;
  message?: string;
};

const WEIGHT_TOLERANCE = 2; // ±2 around 100 before we soft-warn

function collectReadingLists(
  docIds: string[],
  parsedByDoc: Map<string, ExtractionResult>,
): Json {
  const lists: ExtractionResult["reading_lists"] = [];
  for (const id of docIds) {
    const ex = parsedByDoc.get(id);
    if (ex) lists.push(...ex.reading_lists);
  }
  return lists as unknown as Json;
}

/**
 * Layer B. Groups a term's extracted documents into subjects, reconciles each
 * subject's assessment items with field-level conflict provenance, and writes
 * the reconciled view the planner renders. Idempotent: if subjects already exist
 * for the term it no-ops (so re-entry after a partial run is safe).
 */
export async function assembleTerm(termId: string): Promise<AssembleSummary> {
  const empty: AssembleSummary = {
    ok: true,
    subjects: 0,
    needsConfirmGroupings: 0,
    conflictItems: 0,
    weightWarnings: [],
  };

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ...empty, ok: false, message: "Supabase not configured." };
  }

  const { count: existing } = await supabase
    .from("subjects")
    .select("id", { count: "exact", head: true })
    .eq("term_id", termId);
  if ((existing ?? 0) > 0) {
    return { ...empty, subjects: existing ?? 0, alreadyAssembled: true };
  }

  const { data: term } = await supabase
    .from("terms")
    .select("week1_start_date")
    .eq("id", termId)
    .single();
  const week1 = term?.week1_start_date ?? null;

  const { data: docs } = await supabase
    .from("documents")
    .select("id, extracted_json")
    .eq("term_id", termId)
    .eq("extraction_status", "extracted");
  if (!docs || docs.length === 0) return empty;

  const parsedByDoc = new Map<string, ExtractionResult>();
  const forGrouping: DocForGrouping[] = [];
  for (const d of docs) {
    const ex = parseExtraction(d.extracted_json);
    if (!ex) continue;
    parsedByDoc.set(d.id, ex);
    forGrouping.push({
      documentId: d.id,
      codeField: ex.course.code_from_code_field,
      codeTitle: ex.course.code_from_title,
      title: ex.course.title,
      programClass: ex.course.program_class,
    });
  }

  const groups = groupDocuments(forGrouping);

  let conflictItems = 0;
  let needsConfirmGroupings = 0;
  const weightWarnings: { subject: string; sum: number }[] = [];

  for (const g of groups) {
    if (g.needsConfirm) needsConfirmGroupings++;
    const subjectTitle = g.title ?? "Untitled subject";

    const { data: subject, error: subErr } = await supabase
      .from("subjects")
      .insert({
        term_id: termId,
        course_code: g.courseCode,
        title: subjectTitle,
        program_class: g.programClass,
        grouping_method: g.groupingMethod,
        grouping_confidence: g.groupingConfidence,
        grouping_status: "auto",
        reading_lists: collectReadingLists(g.documentIds, parsedByDoc),
      })
      .select("id")
      .single();
    if (subErr || !subject) continue;

    await supabase.from("subject_documents").insert(
      g.documentIds.map((documentId) => ({
        subject_id: subject.id,
        document_id: documentId,
      })),
    );

    const docItems: DocItems[] = g.documentIds.map((id) => ({
      documentId: id,
      items: parsedByDoc.get(id)?.assessment_items ?? [],
    }));
    const reconciled = reconcileItems(docItems, week1);

    const sum = weightSum(reconciled);
    if (sum > 0 && Math.abs(sum - 100) > WEIGHT_TOLERANCE) {
      weightWarnings.push({ subject: subjectTitle, sum });
    }

    for (const item of reconciled) {
      if (item.resolutionStatus === "unresolved_conflict") conflictItems++;
      const { data: ai, error: aiErr } = await supabase
        .from("assessment_items")
        .insert({
          subject_id: subject.id,
          label: item.label,
          resolved_weight: item.resolvedWeight,
          resolved_due_date: item.resolvedDueDate,
          due_date_type: item.dueDateType,
          resolved_deliverable: item.resolvedDeliverable,
          resolution_status: item.resolutionStatus,
          status: item.status,
        })
        .select("id")
        .single();
      if (aiErr || !ai) continue;

      if (item.candidates.length) {
        await supabase.from("item_values").insert(
          item.candidates.map((c) => ({
            assessment_item_id: ai.id,
            source_document_id: c.sourceDocumentId,
            field_name: c.fieldName,
            candidate_value: c.value,
            extraction_confidence: c.confidence,
          })),
        );
      }
    }
  }

  return {
    ok: true,
    subjects: groups.length,
    needsConfirmGroupings,
    conflictItems,
    weightWarnings,
  };
}
