import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseExtraction } from "@/lib/extraction/schema";
import { normalizeLabel } from "@/lib/assembly/normalize";
import type {
  PlannerItem,
  PlannerPayload,
  PlannerReadingList,
  PlannerSubject,
} from "@/lib/planner/types";
import type { ItemStatus, ResolutionStatus } from "@/lib/supabase/database.types";

type Enrichment = { criteria: { text: string; marks: number | null }[]; cos: string[] };

/** Undated / needs_input items sink to the bottom; the rest sort by date. */
export function sortPlannerItems(items: PlannerItem[]): PlannerItem[] {
  return [...items].sort((a, b) => {
    const an = a.status === "needs_input" ? 1 : 0;
    const bn = b.status === "needs_input" ? 1 : 0;
    if (an !== bn) return an - bn;
    return (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31");
  });
}

/**
 * Build the planner from reconciled data. Resolved fields come from
 * assessment_items; criteria + CO mappings (not reconciled columns) are enriched
 * from the documents' stored extraction, matched by normalized label.
 */
export async function buildPlannerPayload(
  termId: string,
): Promise<PlannerPayload | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data: term } = await supabase
    .from("terms")
    .select("id, name")
    .eq("id", termId)
    .single();
  if (!term) return null;

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, title, course_code, program_class, reading_lists")
    .eq("term_id", termId);
  const subjList = subjects ?? [];
  const subjectIds = subjList.map((s) => s.id);
  if (!subjectIds.length) {
    return { termId, termName: term.name, subjects: [] };
  }

  const { data: items } = await supabase
    .from("assessment_items")
    .select(
      "id, subject_id, label, resolved_weight, resolved_due_date, due_date_type, resolved_deliverable, status, resolution_status",
    )
    .in("subject_id", subjectIds);

  const { data: links } = await supabase
    .from("subject_documents")
    .select("subject_id, document_id")
    .in("subject_id", subjectIds);

  const docsBySubject = new Map<string, string[]>();
  for (const l of links ?? []) {
    const arr = docsBySubject.get(l.subject_id) ?? [];
    arr.push(l.document_id);
    docsBySubject.set(l.subject_id, arr);
  }

  const docIds = [...new Set((links ?? []).map((l) => l.document_id))];
  const extractByDoc = new Map<string, ReturnType<typeof parseExtraction>>();
  if (docIds.length) {
    const { data: docs } = await supabase
      .from("documents")
      .select("id, extracted_json")
      .in("id", docIds);
    for (const d of docs ?? []) {
      extractByDoc.set(d.id, parseExtraction(d.extracted_json));
    }
  }

  function enrichmentFor(subjectId: string): Map<string, Enrichment> {
    const map = new Map<string, Enrichment>();
    for (const docId of docsBySubject.get(subjectId) ?? []) {
      const ex = extractByDoc.get(docId);
      if (!ex) continue;
      for (const it of ex.assessment_items) {
        const key = normalizeLabel(it.label);
        const prev = map.get(key);
        if (!prev || (prev.criteria.length === 0 && it.criteria.length > 0)) {
          map.set(key, { criteria: it.criteria, cos: it.mapped_cos });
        }
      }
    }
    return map;
  }

  const built: PlannerSubject[] = subjList.map((s) => {
    const enr = enrichmentFor(s.id);
    const subjectItems: PlannerItem[] = (items ?? [])
      .filter((i) => i.subject_id === s.id)
      .map((i) => {
        const e = enr.get(normalizeLabel(i.label));
        return {
          id: i.id,
          label: i.label,
          weight: i.resolved_weight,
          dueDate: i.resolved_due_date,
          dueDateType: i.due_date_type,
          deliverable: i.resolved_deliverable,
          status: i.status as ItemStatus,
          resolutionStatus: i.resolution_status as ResolutionStatus,
          criteria: e?.criteria ?? [],
          mappedCos: e?.cos ?? [],
        };
      });
    return {
      id: s.id,
      title: s.title,
      courseCode: s.course_code,
      programClass: s.program_class,
      readingLists: (s.reading_lists as unknown as PlannerReadingList[]) ?? [],
      items: sortPlannerItems(subjectItems),
    };
  });

  return { termId, termName: term.name, subjects: built };
}
