import { normalizeLabel } from "@/lib/assembly/normalize";
import { resolveWeekDate, statusForDate } from "@/lib/assembly/dates";
import type { AssessmentItemExtract, DueDateExtract } from "@/lib/extraction/schema";
import type { DueDateType } from "@/lib/supabase/database.types";
import type { CandidateValue, DocItems, ReconciledItem } from "@/lib/assembly/types";

type Entry = { documentId: string; item: AssessmentItemExtract };

/** Canonical key for conflict detection (independent of wording). */
function dueComparable(due: DueDateExtract): string | null {
  if (due.type === "calendar_date" && due.value != null) {
    return `date:${String(due.value)}`;
  }
  if (due.type === "week_number" && due.value != null) {
    return `week:${String(due.value)}`;
  }
  return null;
}

function parseDueComparable(s: string): {
  type: DueDateType;
  iso: string | null;
  week: number | null;
} {
  if (s.startsWith("date:")) return { type: "calendar_date", iso: s.slice(5), week: null };
  if (s.startsWith("week:")) return { type: "week_number", iso: null, week: Number(s.slice(5)) };
  return { type: "unknown", iso: null, week: null };
}

/**
 * Collect candidate values for one field across the contributing documents.
 * Pushes every candidate (with provenance) into `candidates`; if two or more
 * DISTINCT values appear, records a conflict.
 */
function reconcileField(
  entries: Entry[],
  fieldName: string,
  getComparable: (e: Entry) => string | null,
  getDisplay: (e: Entry) => string | null,
  candidates: CandidateValue[],
  conflictFields: string[],
): { resolved: string | null; conflict: boolean } {
  const distinct = new Set<string>();
  for (const e of entries) {
    const cmp = getComparable(e);
    if (cmp == null) continue;
    candidates.push({
      fieldName,
      sourceDocumentId: e.documentId,
      value: getDisplay(e) ?? cmp,
      confidence: e.item.field_confidence,
    });
    distinct.add(cmp);
  }
  if (distinct.size === 0) return { resolved: null, conflict: false };
  if (distinct.size === 1) return { resolved: [...distinct][0], conflict: false };
  conflictFields.push(fieldName);
  return { resolved: null, conflict: true };
}

/**
 * Reconcile assessment items across a subject's documents. Items are matched by
 * normalized label; each field is reconciled with provenance; any genuine
 * disagreement is left `unresolved_conflict` for Screen 3.
 */
export function reconcileItems(
  docItems: DocItems[],
  week1Start: string | null,
): ReconciledItem[] {
  const groups = new Map<string, Entry[]>();
  for (const { documentId, items } of docItems) {
    for (const item of items) {
      const key = normalizeLabel(item.label);
      if (!key) continue;
      const entry: Entry = { documentId, item };
      const arr = groups.get(key);
      if (arr) arr.push(entry);
      else groups.set(key, [entry]);
    }
  }

  const result: ReconciledItem[] = [];
  for (const entries of groups.values()) {
    const candidates: CandidateValue[] = [];
    const conflictFields: string[] = [];

    const label = entries
      .map((e) => e.item.label)
      .sort((a, b) => b.length - a.length)[0];

    const weight = reconcileField(
      entries,
      "weight",
      (e) =>
        e.item.normalized_weight != null
          ? String(e.item.normalized_weight)
          : null,
      (e) =>
        e.item.normalized_weight != null
          ? `${e.item.normalized_weight}%`
          : null,
      candidates,
      conflictFields,
    );

    const due = reconcileField(
      entries,
      "due_date",
      (e) => dueComparable(e.item.due_date),
      (e) => e.item.due_date.raw_text ?? dueComparable(e.item.due_date),
      candidates,
      conflictFields,
    );

    const deliverable = reconcileField(
      entries,
      "deliverable",
      (e) =>
        e.item.deliverable && e.item.deliverable.trim()
          ? e.item.deliverable.trim().toLowerCase().replace(/\s+/g, " ")
          : null,
      (e) => (e.item.deliverable ? e.item.deliverable.trim() : null),
      candidates,
      conflictFields,
    );

    // Resolve typed values from the agreed comparables.
    const resolvedWeight =
      weight.resolved != null ? Number(weight.resolved) : null;

    let resolvedDueDate: string | null = null;
    let dueDateType: DueDateType | null = null;
    if (due.resolved != null) {
      const parsed = parseDueComparable(due.resolved);
      dueDateType = parsed.type;
      if (parsed.type === "calendar_date") resolvedDueDate = parsed.iso;
      else if (parsed.type === "week_number")
        resolvedDueDate = resolveWeekDate(parsed.week!, week1Start);
    } else if (due.conflict) {
      dueDateType = "unknown";
    }

    // Resolved deliverable = the original-cased text of the single agreed value.
    let resolvedDeliverable: string | null = null;
    if (!deliverable.conflict && deliverable.resolved != null) {
      const match = candidates.find(
        (c) =>
          c.fieldName === "deliverable" &&
          c.value.trim().toLowerCase().replace(/\s+/g, " ") ===
            deliverable.resolved,
      );
      resolvedDeliverable = match ? match.value : null;
    }

    const hasConflict = conflictFields.length > 0;

    result.push({
      label,
      resolvedWeight,
      resolvedDueDate,
      dueDateType,
      resolvedDeliverable,
      resolutionStatus: hasConflict ? "unresolved_conflict" : "auto",
      status: statusForDate(resolvedDueDate),
      candidates,
      conflictFields,
    });
  }

  return result;
}

/**
 * Soft "sums to 100" check — a warning, never a reject (dissertation labs carry
 * marks forward and won't sum the same). Returns the sum of known weights.
 */
export function weightSum(items: ReconciledItem[]): number {
  return items.reduce((acc, it) => acc + (it.resolvedWeight ?? 0), 0);
}
