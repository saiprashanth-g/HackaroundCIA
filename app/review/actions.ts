"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseExtraction, type ExtractionResult } from "@/lib/extraction/schema";
import { normalizeLabel } from "@/lib/assembly/normalize";
import { reconcileItems } from "@/lib/assembly/reconcile";
import { resolveWeekDate, statusForDate } from "@/lib/assembly/dates";
import { resolveWeekDatesForTerm } from "@/lib/assembly/resolveWeeks";
import type { DocItems } from "@/lib/assembly/types";
import type { DueDateType } from "@/lib/supabase/database.types";

type ServerClient = NonNullable<
  Awaited<ReturnType<typeof createSupabaseServerClient>>
>;

function dueFromItem(
  item: ExtractionResult["assessment_items"][number],
  week1: string | null,
): { date: string | null; type: DueDateType } {
  const dd = item.due_date;
  if (dd.type === "calendar_date" && dd.value != null) {
    return { date: String(dd.value), type: "calendar_date" };
  }
  if (dd.type === "week_number" && dd.value != null) {
    return { date: resolveWeekDate(Number(dd.value), week1), type: "week_number" };
  }
  return { date: null, type: "unknown" };
}

/** Fields that still conflict for an item (>=2 distinct candidate values). */
async function conflictingFields(
  supabase: ServerClient,
  itemId: string,
): Promise<Set<string>> {
  const { data: vals } = await supabase
    .from("item_values")
    .select("field_name, candidate_value")
    .eq("assessment_item_id", itemId);
  const byField = new Map<string, Set<string>>();
  for (const v of vals ?? []) {
    const set = byField.get(v.field_name) ?? new Set<string>();
    set.add(v.candidate_value ?? "");
    byField.set(v.field_name, set);
  }
  const fields = new Set<string>();
  for (const [f, set] of byField) if (set.size >= 2) fields.add(f);
  return fields;
}

export async function setWeek1Date(
  termId: string,
  date: string,
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Supabase not configured." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, message: "Invalid date." };
  }
  const { error } = await supabase
    .from("terms")
    .update({ week1_start_date: date })
    .eq("id", termId);
  if (error) return { ok: false, message: error.message };
  await resolveWeekDatesForTerm(termId);
  return { ok: true };
}

/** Resolve one conflicting field by picking the value from a source document. */
export async function resolveConflict(
  itemId: string,
  field: string,
  sourceDocumentId: string,
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Supabase not configured." };

  const { data: item } = await supabase
    .from("assessment_items")
    .select("id, subject_id, label")
    .eq("id", itemId)
    .single();
  if (!item) return { ok: false, message: "Item not found." };

  const { data: doc } = await supabase
    .from("documents")
    .select("id, term_id, extracted_json")
    .eq("id", sourceDocumentId)
    .single();
  const extract = doc ? parseExtraction(doc.extracted_json) : null;
  const sourceItem = extract?.assessment_items.find(
    (i) => normalizeLabel(i.label) === normalizeLabel(item.label),
  );
  if (!sourceItem) return { ok: false, message: "Source value unavailable." };

  const { data: term } = doc?.term_id
    ? await supabase.from("terms").select("week1_start_date").eq("id", doc.term_id).single()
    : { data: null };
  const week1 = term?.week1_start_date ?? null;

  let overrideValue = "";
  if (field === "due_date") {
    const { date, type } = dueFromItem(sourceItem, week1);
    await supabase
      .from("assessment_items")
      .update({ resolved_due_date: date, due_date_type: type, status: statusForDate(date) })
      .eq("id", itemId);
    overrideValue = sourceItem.due_date.raw_text ?? date ?? "";
  } else if (field === "weight") {
    await supabase
      .from("assessment_items")
      .update({ resolved_weight: sourceItem.normalized_weight })
      .eq("id", itemId);
    overrideValue = String(sourceItem.normalized_weight ?? "");
  } else if (field === "deliverable") {
    await supabase
      .from("assessment_items")
      .update({ resolved_deliverable: sourceItem.deliverable })
      .eq("id", itemId);
    overrideValue = sourceItem.deliverable ?? "";
  }

  await supabase.from("user_overrides").insert({
    assessment_item_id: itemId,
    field,
    value: overrideValue,
  });

  // If every conflicting field now has an override, the item is resolved.
  const conflicts = await conflictingFields(supabase, itemId);
  const { data: overrides } = await supabase
    .from("user_overrides")
    .select("field")
    .eq("assessment_item_id", itemId);
  const resolved = new Set((overrides ?? []).map((o) => o.field));
  const allResolved = [...conflicts].every((f) => resolved.has(f));
  if (allResolved) {
    await supabase
      .from("assessment_items")
      .update({ resolution_status: "user_confirmed" })
      .eq("id", itemId);
  }
  return { ok: true };
}

export async function confirmGrouping(
  subjectId: string,
): Promise<{ ok: boolean }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };
  await supabase
    .from("subjects")
    .update({ grouping_status: "user_confirmed" })
    .eq("id", subjectId);
  return { ok: true };
}

async function rebuildSubjectItems(
  supabase: ServerClient,
  subjectId: string,
  week1: string | null,
) {
  const { data: links } = await supabase
    .from("subject_documents")
    .select("document_id")
    .eq("subject_id", subjectId);
  const docIds = (links ?? []).map((l) => l.document_id);
  if (!docIds.length) return;
  const { data: docs } = await supabase
    .from("documents")
    .select("id, extracted_json")
    .in("id", docIds);
  const docItems: DocItems[] = (docs ?? []).map((d) => ({
    documentId: d.id,
    items: parseExtraction(d.extracted_json)?.assessment_items ?? [],
  }));
  const reconciled = reconcileItems(docItems, week1);

  await supabase.from("assessment_items").delete().eq("subject_id", subjectId);
  for (const it of reconciled) {
    const { data: ai } = await supabase
      .from("assessment_items")
      .insert({
        subject_id: subjectId,
        label: it.label,
        resolved_weight: it.resolvedWeight,
        resolved_due_date: it.resolvedDueDate,
        due_date_type: it.dueDateType,
        resolved_deliverable: it.resolvedDeliverable,
        resolution_status: it.resolutionStatus,
        status: it.status,
      })
      .select("id")
      .single();
    if (ai && it.candidates.length) {
      await supabase.from("item_values").insert(
        it.candidates.map((c) => ({
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

/** Merge source subject's documents into target, then re-reconcile target. */
export async function mergeSubjects(
  termId: string,
  sourceSubjectId: string,
  targetSubjectId: string,
): Promise<{ ok: boolean }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };

  const { data: srcLinks } = await supabase
    .from("subject_documents")
    .select("document_id")
    .eq("subject_id", sourceSubjectId);
  for (const l of srcLinks ?? []) {
    await supabase
      .from("subject_documents")
      .upsert(
        { subject_id: targetSubjectId, document_id: l.document_id },
        { onConflict: "subject_id,document_id", ignoreDuplicates: true },
      );
  }
  await supabase.from("subjects").delete().eq("id", sourceSubjectId);

  const { data: term } = await supabase
    .from("terms")
    .select("week1_start_date")
    .eq("id", termId)
    .single();
  await rebuildSubjectItems(supabase, targetSubjectId, term?.week1_start_date ?? null);

  await supabase
    .from("subjects")
    .update({ grouping_status: "user_confirmed", grouping_method: "code_exact" })
    .eq("id", targetSubjectId);
  return { ok: true };
}

export type ManualItemInput = {
  label: string;
  weight: number | null;
  dueDate: string | null; // ISO or null
  deliverable: string | null;
};

/** Manual fallback for a parse_failed document. */
export async function submitManualEntry(
  termId: string,
  documentId: string,
  title: string,
  courseCode: string | null,
  items: ManualItemInput[],
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Supabase not configured." };
  if (!title.trim()) return { ok: false, message: "A subject title is required." };

  const { data: subject } = await supabase
    .from("subjects")
    .insert({
      term_id: termId,
      title: title.trim(),
      course_code: courseCode?.trim() || null,
      grouping_method: "none",
      grouping_confidence: 1,
      grouping_status: "user_confirmed",
    })
    .select("id")
    .single();
  if (!subject) return { ok: false, message: "Could not create subject." };

  await supabase
    .from("subject_documents")
    .insert({ subject_id: subject.id, document_id: documentId });

  for (const it of items) {
    if (!it.label.trim()) continue;
    await supabase.from("assessment_items").insert({
      subject_id: subject.id,
      label: it.label.trim(),
      resolved_weight: it.weight,
      resolved_due_date: it.dueDate,
      due_date_type: it.dueDate ? "calendar_date" : null,
      resolved_deliverable: it.deliverable,
      resolution_status: "user_confirmed",
      status: statusForDate(it.dueDate),
    });
  }

  // The document now has usable (manually entered) data.
  await supabase
    .from("documents")
    .update({ extraction_status: "extracted" })
    .eq("id", documentId);
  return { ok: true };
}

/**
 * Final confirm. Deletes raw files (DPDP: null raw_file_ref + remove the storage
 * object) the moment the plan is confirmed, and marks documents confirmed.
 */
export async function confirmAndFinalize(
  termId: string,
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Supabase not configured." };

  const { data: docs } = await supabase
    .from("documents")
    .select("id, raw_file_ref")
    .eq("term_id", termId);

  const paths = (docs ?? [])
    .map((d) => d.raw_file_ref)
    .filter((p): p is string => Boolean(p));

  if (paths.length) {
    // RLS lets a user remove their own objects (folder = uid).
    await supabase.storage.from("raw-uploads").remove(paths);
  }

  await supabase
    .from("documents")
    .update({
      extraction_status: "confirmed",
      confirmed_at: new Date().toISOString(),
      raw_file_ref: null,
    })
    .eq("term_id", termId);

  return { ok: true };
}
