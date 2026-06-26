import type { ItemStatus, ResolutionStatus } from "@/lib/supabase/database.types";

export type PlannerItem = {
  id: string;
  label: string;
  weight: number | null;
  dueDate: string | null;
  dueDateType: string | null;
  deliverable: string | null;
  status: ItemStatus;
  resolutionStatus: ResolutionStatus;
  criteria: { text: string; marks: number | null }[];
  mappedCos: string[];
};

export type PlannerReadingList = {
  unit_or_module: string | null;
  references: string[];
};

export type PlannerSubject = {
  id: string;
  title: string;
  courseCode: string | null;
  programClass: string | null;
  readingLists: PlannerReadingList[];
  items: PlannerItem[];
};

export type PlannerPayload = {
  termId: string;
  termName: string;
  subjects: PlannerSubject[];
};
