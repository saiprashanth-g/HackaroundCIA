import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isGTokenVariant, normalizeCode, similarity } from "@/lib/assembly/normalize";
import {
  docTypeLabel,
  FIELD_LABELS,
  type ReviewConflict,
  type ReviewGrouping,
  type ReviewPayload,
} from "@/lib/review/types";

const NAME_FUZZY_THRESHOLD = 0.8;
const WEIGHT_TOLERANCE = 2;

function groupingNeedsConfirm(method: string, confidence: number | null): boolean {
  if (method === "code_near" || method === "name_fuzzy" || method === "none") {
    return true;
  }
  return (confidence ?? 1) < 0.9;
}

/**
 * Build the Screen 3 payload: only what needs a human. Conflicts (field-level,
 * with provenance), low-confidence groupings (with merge suggestions), parse
 * failures, the week-1 anchor, and soft weight warnings.
 */
export async function buildReviewPayload(
  termId: string,
): Promise<ReviewPayload | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data: term } = await supabase
    .from("terms")
    .select("id, week1_start_date")
    .eq("id", termId)
    .single();
  if (!term) return null;

  const { data: subjects } = await supabase
    .from("subjects")
    .select(
      "id, title, course_code, grouping_method, grouping_confidence, grouping_status",
    )
    .eq("term_id", termId);
  const subjectList = subjects ?? [];
  const subjectIds = subjectList.map((s) => s.id);
  const subjectTitleById = new Map(subjectList.map((s) => [s.id, s.title]));

  const { data: docs } = await supabase
    .from("documents")
    .select("id, original_filename, document_type, extraction_status")
    .eq("term_id", termId);
  const docLabelById = new Map(
    (docs ?? []).map((d) => [d.id, docTypeLabel(d.document_type)]),
  );

  // ── Items + values ──
  let items: {
    id: string;
    subject_id: string;
    label: string;
    resolution_status: string;
    due_date_type: string | null;
    resolved_weight: number | null;
  }[] = [];
  let values: {
    assessment_item_id: string;
    field_name: string;
    candidate_value: string | null;
    source_document_id: string | null;
  }[] = [];
  if (subjectIds.length) {
    const { data: it } = await supabase
      .from("assessment_items")
      .select("id, subject_id, label, resolution_status, due_date_type, resolved_weight")
      .in("subject_id", subjectIds);
    items = it ?? [];
    const itemIds = items.map((i) => i.id);
    if (itemIds.length) {
      const { data: iv } = await supabase
        .from("item_values")
        .select("assessment_item_id, field_name, candidate_value, source_document_id")
        .in("assessment_item_id", itemIds);
      values = iv ?? [];
    }
  }

  // ── Conflicts: for each unresolved item, fields with >=2 distinct values ──
  const conflicts: ReviewConflict[] = [];
  for (const item of items) {
    if (item.resolution_status !== "unresolved_conflict") continue;
    const itemValues = values.filter((v) => v.assessment_item_id === item.id);
    const byField = new Map<string, typeof itemValues>();
    for (const v of itemValues) {
      const arr = byField.get(v.field_name);
      if (arr) arr.push(v);
      else byField.set(v.field_name, [v]);
    }
    for (const [field, vals] of byField) {
      const distinct = new Set(vals.map((v) => v.candidate_value ?? ""));
      if (distinct.size < 2) continue;
      conflicts.push({
        itemId: item.id,
        subjectTitle: subjectTitleById.get(item.subject_id) ?? "Subject",
        itemLabel: item.label,
        field,
        fieldLabel: FIELD_LABELS[field] ?? field,
        candidates: vals.map((v) => ({
          value: v.candidate_value ?? "—",
          documentId: v.source_document_id ?? "",
          sourceLabel: v.source_document_id
            ? (docLabelById.get(v.source_document_id) ?? "Document")
            : "Document",
        })),
      });
    }
  }

  // ── Groupings needing confirm (+ merge suggestions) ──
  const groupings: ReviewGrouping[] = [];
  for (const s of subjectList) {
    if (s.grouping_status !== "auto") continue;
    if (!groupingNeedsConfirm(s.grouping_method, s.grouping_confidence)) continue;

    const mergeTargets: { subjectId: string; label: string }[] = [];
    for (const o of subjectList) {
      if (o.id === s.id) continue;
      const sCode = normalizeCode(s.course_code);
      const oCode = normalizeCode(o.course_code);
      const codeNear = sCode && oCode && isGTokenVariant(sCode, oCode);
      const titleNear =
        !sCode &&
        s.title &&
        o.title &&
        similarity(s.title, o.title) >= NAME_FUZZY_THRESHOLD;
      if (codeNear || titleNear) {
        mergeTargets.push({ subjectId: o.id, label: o.course_code ?? o.title });
      }
    }

    groupings.push({
      subjectId: s.id,
      title: s.title,
      courseCode: s.course_code,
      method: s.grouping_method,
      confidence: s.grouping_confidence ?? 0,
      note: null,
      mergeTargets,
    });
  }

  // ── Parse failures ──
  const parseFailures = (docs ?? [])
    .filter((d) => d.extraction_status === "parse_failed")
    .map((d) => ({ documentId: d.id, filename: d.original_filename }));

  // ── Soft weight warnings (sum per subject) ──
  const sumBySubject = new Map<string, number>();
  for (const item of items) {
    if (item.resolved_weight == null) continue;
    sumBySubject.set(
      item.subject_id,
      (sumBySubject.get(item.subject_id) ?? 0) + item.resolved_weight,
    );
  }
  const weightWarnings: { subjectTitle: string; sum: number }[] = [];
  for (const [sid, sum] of sumBySubject) {
    if (sum > 0 && Math.abs(sum - 100) > WEIGHT_TOLERANCE) {
      weightWarnings.push({
        subjectTitle: subjectTitleById.get(sid) ?? "Subject",
        sum: Math.round(sum * 10) / 10,
      });
    }
  }

  const hasWeekNumberItems = items.some((i) => i.due_date_type === "week_number");

  const allClear =
    conflicts.length === 0 &&
    groupings.length === 0 &&
    parseFailures.length === 0;

  return {
    termId,
    week1StartDate: term.week1_start_date,
    hasWeekNumberItems,
    conflicts,
    groupings,
    parseFailures,
    weightWarnings,
    allClear,
  };
}
