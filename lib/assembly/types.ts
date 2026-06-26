import type { AssessmentItemExtract } from "@/lib/extraction/schema";
import type {
  Confidence,
  DueDateType,
  GroupingMethod,
  ItemStatus,
  ResolutionStatus,
} from "@/lib/supabase/database.types";

/** One extracted document, reduced to what grouping needs. */
export type DocForGrouping = {
  documentId: string;
  codeField: string | null; // course.code_from_code_field (authoritative)
  codeTitle: string | null; // course.code_from_title
  title: string | null;
  programClass: string | null;
};

/** A candidate subject produced by grouping. */
export type GroupResult = {
  courseCode: string | null;
  title: string | null;
  programClass: string | null;
  documentIds: string[];
  groupingMethod: GroupingMethod;
  groupingConfidence: number; // 0..1
  needsConfirm: boolean;
  note: string | null;
};

/** A document's assessment items, tagged with provenance. */
export type DocItems = {
  documentId: string;
  items: AssessmentItemExtract[];
};

/** One candidate field value with its source document (provenance ledger). */
export type CandidateValue = {
  fieldName: string;
  sourceDocumentId: string;
  value: string;
  confidence: Confidence | null;
};

/** A reconciled assessment item with resolved values + conflict provenance. */
export type ReconciledItem = {
  label: string;
  resolvedWeight: number | null;
  resolvedDueDate: string | null; // ISO date or null
  dueDateType: DueDateType | null;
  resolvedDeliverable: string | null;
  resolutionStatus: ResolutionStatus;
  status: ItemStatus;
  candidates: CandidateValue[];
  conflictFields: string[];
};
