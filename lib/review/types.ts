import type { GroupingMethod } from "@/lib/supabase/database.types";

export type ConflictCandidate = {
  value: string;
  documentId: string;
  sourceLabel: string; // e.g. "Course plan", "Handout"
};

export type ReviewConflict = {
  itemId: string;
  subjectTitle: string;
  itemLabel: string;
  field: string; // "due_date" | "weight" | "deliverable"
  fieldLabel: string;
  candidates: ConflictCandidate[];
};

export type ReviewGrouping = {
  subjectId: string;
  title: string;
  courseCode: string | null;
  method: GroupingMethod;
  confidence: number;
  note: string | null;
  mergeTargets: { subjectId: string; label: string }[];
};

export type ReviewParseFailure = {
  documentId: string;
  filename: string;
};

export type ReviewPayload = {
  termId: string;
  week1StartDate: string | null;
  hasWeekNumberItems: boolean;
  conflicts: ReviewConflict[];
  groupings: ReviewGrouping[];
  parseFailures: ReviewParseFailure[];
  weightWarnings: { subjectTitle: string; sum: number }[];
  /** Nothing needs human attention. */
  allClear: boolean;
};

export function docTypeLabel(documentType: string | null): string {
  switch (documentType) {
    case "course_plan":
      return "Course plan";
    case "cia_handout":
      return "Handout";
    case "syllabus":
      return "Syllabus";
    default:
      return "Document";
  }
}

export const FIELD_LABELS: Record<string, string> = {
  due_date: "Deadline",
  weight: "Weightage",
  deliverable: "Deliverable",
};
