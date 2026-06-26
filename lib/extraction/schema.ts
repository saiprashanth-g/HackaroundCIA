import { z } from "zod";

/**
 * Layer A extraction contract — the EXACT JSON one Groq call returns for ONE
 * document. Lenient by design: an open-weight model won't be perfect, so every
 * field has a graceful fallback (`.catch`) and missing arrays default to []. A
 * genuinely unreadable document is caught earlier (non-JSON / API error →
 * parse_failed); this schema's job is to normalize imperfect-but-usable output.
 *
 * Absence is expected, not a failure (a CIA handout has no COs/faculty/schedule).
 */
export const confidenceEnum = z.enum(["low", "medium", "high"]);
export const documentTypeEnum = z.enum([
  "course_plan",
  "cia_handout",
  "syllabus",
  "other",
]);
export const dueDateTypeEnum = z.enum([
  "calendar_date",
  "week_number",
  "unknown",
]);

export const dueDateSchema = z
  .object({
    type: dueDateTypeEnum.catch("unknown"),
    value: z.union([z.string(), z.number(), z.null()]).catch(null),
    raw_text: z.string().nullable().catch(null),
  })
  .catch({ type: "unknown", value: null, raw_text: null });

export const criterionSchema = z.object({
  text: z.string().catch(""),
  marks: z.number().nullable().catch(null),
});

export const assessmentItemSchema = z.object({
  label: z.string().catch(""),
  raw_marks: z.number().nullable().catch(null),
  normalized_weight: z.number().nullable().catch(null),
  marks_note: z.string().nullable().catch(null),
  due_date: dueDateSchema,
  deliverable: z.string().nullable().catch(null),
  criteria: z.array(criterionSchema).catch([]),
  mapped_cos: z.array(z.string()).catch([]),
  field_confidence: confidenceEnum.catch("low"),
});

export const courseSchema = z
  .object({
    code_from_code_field: z.string().nullable().catch(null),
    code_from_title: z.string().nullable().catch(null),
    title: z.string().nullable().catch(null),
    program_class: z.string().nullable().catch(null),
    semester: z.string().nullable().catch(null),
  })
  .catch({
    code_from_code_field: null,
    code_from_title: null,
    title: null,
    program_class: null,
    semester: null,
  });

export const facultySchema = z.object({
  name: z.string().catch(""),
  contact: z.string().nullable().catch(null),
});

export const courseOutcomeSchema = z.object({
  id: z.string().catch(""),
  text: z.string().catch(""),
});

export const readingListSchema = z.object({
  unit_or_module: z.string().nullable().catch(null),
  references: z.array(z.string()).catch([]),
});

export const policyExtractSchema = z
  .object({
    late_penalty: z.string().nullable().catch(null),
    plagiarism_threshold: z.string().nullable().catch(null),
    submission_mode: z.string().nullable().catch(null),
  })
  .catch({
    late_penalty: null,
    plagiarism_threshold: null,
    submission_mode: null,
  });

export const extractionSchema = z.object({
  document_type: documentTypeEnum.catch("other"),
  document_type_confidence: confidenceEnum.catch("low"),
  course: courseSchema,
  faculty: z.array(facultySchema).catch([]),
  course_outcomes: z.array(courseOutcomeSchema).catch([]),
  assessment_items: z.array(assessmentItemSchema).catch([]),
  reading_lists: z.array(readingListSchema).catch([]),
  policy_extract: policyExtractSchema,
  unparseable_sections: z.array(z.string()).catch([]),
  extraction_notes: z.string().nullable().catch(null),
});

export type ExtractionResult = z.infer<typeof extractionSchema>;
export type AssessmentItemExtract = z.infer<typeof assessmentItemSchema>;
export type DueDateExtract = z.infer<typeof dueDateSchema>;

/**
 * Parse model output into the contract. Returns null when the value is so far
 * from the shape that even the lenient schema can't recover (→ parse_failed).
 */
export function parseExtraction(value: unknown): ExtractionResult | null {
  const result = extractionSchema.safeParse(value);
  return result.success ? result.data : null;
}
