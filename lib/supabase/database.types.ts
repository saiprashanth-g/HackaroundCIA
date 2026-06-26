/**
 * Hand-maintained to match supabase/migrations/0001_init.sql. If you change the
 * schema, update this file (or regenerate with `supabase gen types typescript`).
 *
 * Per-table Row/Insert/Update are standalone types (no self-referential
 * `Database[...]` lookups) so the supabase-js generic resolves them correctly.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ── Enums ────────────────────────────────────────────────────────────────────
export type DocumentType = "course_plan" | "cia_handout" | "syllabus" | "other";
export type Confidence = "low" | "medium" | "high";
export type ExtractionStatus =
  | "pending"
  | "extracted"
  | "parse_failed"
  | "confirmed";
export type GroupingMethod = "code_exact" | "code_near" | "name_fuzzy" | "none";
export type GroupingStatus = "auto" | "user_confirmed";
export type DueDateType = "calendar_date" | "week_number" | "unknown";
export type ResolutionStatus = "auto" | "user_confirmed" | "unresolved_conflict";
export type ItemStatus = "urgent" | "later" | "done" | "needs_input";

// ── terms ────────────────────────────────────────────────────────────────────
export type TermRow = {
  id: string;
  student_id: string;
  name: string;
  week1_start_date: string | null;
  created_at: string;
};
export type TermInsert = {
  id?: string;
  student_id?: string;
  name: string;
  week1_start_date?: string | null;
  created_at?: string;
};

// ── documents ────────────────────────────────────────────────────────────────
export type DocumentRow = {
  id: string;
  student_id: string;
  term_id: string | null;
  original_filename: string;
  document_type: DocumentType | null;
  document_type_confidence: Confidence | null;
  extraction_status: ExtractionStatus;
  raw_file_ref: string | null;
  extracted_json: Json | null;
  uploaded_at: string;
  confirmed_at: string | null;
};
export type DocumentInsert = {
  id?: string;
  student_id?: string;
  term_id?: string | null;
  original_filename: string;
  document_type?: DocumentType | null;
  document_type_confidence?: Confidence | null;
  extraction_status?: ExtractionStatus;
  raw_file_ref?: string | null;
  extracted_json?: Json | null;
  uploaded_at?: string;
  confirmed_at?: string | null;
};

// ── subjects ─────────────────────────────────────────────────────────────────
export type SubjectRow = {
  id: string;
  student_id: string;
  term_id: string | null;
  course_code: string | null;
  title: string;
  program_class: string | null;
  grouping_method: GroupingMethod;
  grouping_confidence: number | null;
  grouping_status: GroupingStatus;
  reading_lists: Json;
  created_at: string;
};
export type SubjectInsert = {
  id?: string;
  student_id?: string;
  term_id?: string | null;
  course_code?: string | null;
  title: string;
  program_class?: string | null;
  grouping_method?: GroupingMethod;
  grouping_confidence?: number | null;
  grouping_status?: GroupingStatus;
  reading_lists?: Json;
  created_at?: string;
};

// ── subject_documents ────────────────────────────────────────────────────────
export type SubjectDocumentRow = { subject_id: string; document_id: string };

// ── assessment_items ─────────────────────────────────────────────────────────
export type AssessmentItemRow = {
  id: string;
  subject_id: string;
  label: string;
  resolved_weight: number | null;
  resolved_due_date: string | null;
  due_date_type: DueDateType | null;
  resolved_deliverable: string | null;
  resolution_status: ResolutionStatus;
  status: ItemStatus;
  created_at: string;
};
export type AssessmentItemInsert = {
  id?: string;
  subject_id: string;
  label: string;
  resolved_weight?: number | null;
  resolved_due_date?: string | null;
  due_date_type?: DueDateType | null;
  resolved_deliverable?: string | null;
  resolution_status?: ResolutionStatus;
  status?: ItemStatus;
  created_at?: string;
};

// ── item_values ──────────────────────────────────────────────────────────────
export type ItemValueRow = {
  id: string;
  assessment_item_id: string;
  source_document_id: string | null;
  field_name: string;
  candidate_value: string | null;
  extraction_confidence: Confidence | null;
  created_at: string;
};
export type ItemValueInsert = {
  id?: string;
  assessment_item_id: string;
  source_document_id?: string | null;
  field_name: string;
  candidate_value?: string | null;
  extraction_confidence?: Confidence | null;
  created_at?: string;
};

// ── user_overrides ───────────────────────────────────────────────────────────
export type UserOverrideRow = {
  id: string;
  student_id: string;
  assessment_item_id: string | null;
  field: string;
  value: string;
  set_at: string;
};
export type UserOverrideInsert = {
  id?: string;
  student_id?: string;
  assessment_item_id?: string | null;
  field: string;
  value: string;
  set_at?: string;
};

// ── extraction_log ───────────────────────────────────────────────────────────
export type ExtractionLogRow = {
  id: string;
  student_id: string;
  document_id: string | null;
  model: string;
  in_tokens: number | null;
  out_tokens: number | null;
  est_cost: number | null;
  attempt_no: number;
  created_at: string;
};
export type ExtractionLogInsert = {
  id?: string;
  student_id?: string;
  document_id?: string | null;
  model: string;
  in_tokens?: number | null;
  out_tokens?: number | null;
  est_cost?: number | null;
  attempt_no?: number;
  created_at?: string;
};

export type Database = {
  public: {
    Tables: {
      terms: {
        Row: TermRow;
        Insert: TermInsert;
        Update: Partial<TermInsert>;
        Relationships: [];
      };
      documents: {
        Row: DocumentRow;
        Insert: DocumentInsert;
        Update: Partial<DocumentInsert>;
        Relationships: [];
      };
      subjects: {
        Row: SubjectRow;
        Insert: SubjectInsert;
        Update: Partial<SubjectInsert>;
        Relationships: [];
      };
      subject_documents: {
        Row: SubjectDocumentRow;
        Insert: SubjectDocumentRow;
        Update: Partial<SubjectDocumentRow>;
        Relationships: [];
      };
      assessment_items: {
        Row: AssessmentItemRow;
        Insert: AssessmentItemInsert;
        Update: Partial<AssessmentItemInsert>;
        Relationships: [];
      };
      item_values: {
        Row: ItemValueRow;
        Insert: ItemValueInsert;
        Update: Partial<ItemValueInsert>;
        Relationships: [];
      };
      user_overrides: {
        Row: UserOverrideRow;
        Insert: UserOverrideInsert;
        Update: Partial<UserOverrideInsert>;
        Relationships: [];
      };
      extraction_log: {
        Row: ExtractionLogRow;
        Insert: ExtractionLogInsert;
        Update: Partial<ExtractionLogInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      document_type: DocumentType;
      confidence: Confidence;
      extraction_status: ExtractionStatus;
      grouping_method: GroupingMethod;
      grouping_status: GroupingStatus;
      due_date_type: DueDateType;
      resolution_status: ResolutionStatus;
      item_status: ItemStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
