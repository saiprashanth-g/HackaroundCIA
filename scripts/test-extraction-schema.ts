/**
 * Runtime test for the Layer A contract. No live model needed.
 *   node scripts/test-extraction-schema.ts
 * Validates: (1) the canonical contract example parses, (2) messy-but-usable
 * model output is normalized rather than rejected, (3) total garbage is rejected
 * (→ parse_failed).
 */
import { parseExtraction } from "@/lib/extraction/schema";

const good = {
  document_type: "course_plan",
  document_type_confidence: "high",
  course: {
    code_from_code_field: "MPR502-3",
    code_from_title: "MPRG502-3",
    title: "Research Methodology",
    program_class: "MSc Psychology",
    semester: "II",
  },
  faculty: [{ name: "Dr. A. Sharma", contact: "a.sharma@christuniversity.in" }],
  course_outcomes: [{ id: "CO1", text: "Design a study." }],
  assessment_items: [
    {
      label: "CIA I A",
      raw_marks: 50,
      normalized_weight: 30,
      marks_note: "50 converted to 30",
      due_date: { type: "calendar_date", value: "2026-07-21", raw_text: "21 Jul 2026" },
      deliverable: "Research proposal",
      criteria: [{ text: "Clarity of argument", marks: 10 }],
      mapped_cos: ["CO1"],
      field_confidence: "high",
    },
  ],
  reading_lists: [{ unit_or_module: "Unit 1", references: ["Kerlinger (2000)"] }],
  policy_extract: {
    late_penalty: "-10% per day",
    plagiarism_threshold: "10%",
    submission_mode: "Moodle",
  },
  unparseable_sections: [],
  extraction_notes: null,
};

// Missing most fields; bad enum values; off-type due_date — must normalize.
const messy = {
  assessment_items: [
    {
      label: "CIA II",
      due_date: { type: "bogus", value: 7 },
      field_confidence: "ultra",
    },
  ],
};

const garbage = 42;

let pass = 0;
let fail = 0;
function assert(name: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log(`✓ ${name}`);
  } else {
    fail++;
    console.log(`✗ ${name}`);
  }
}

const g = parseExtraction(good);
assert("canonical example parses", g !== null);
assert("keeps both course codes separate", g?.course.code_from_code_field === "MPR502-3" && g?.course.code_from_title === "MPRG502-3");
assert("preserves marks_note rescaling", g?.assessment_items[0].marks_note === "50 converted to 30");
assert("calendar due date intact", g?.assessment_items[0].due_date.type === "calendar_date" && g?.assessment_items[0].due_date.value === "2026-07-21");

const m = parseExtraction(messy);
assert("messy output normalized (not rejected)", m !== null);
assert("messy: 1 assessment item kept", (m?.assessment_items.length ?? 0) === 1);
assert("messy: bad enum -> safe default (field_confidence=low)", m?.assessment_items[0].field_confidence === "low");
assert("messy: bad due_date.type -> unknown", m?.assessment_items[0].due_date.type === "unknown");
assert("messy: missing arrays default to []", Array.isArray(m?.faculty) && m?.faculty.length === 0);

const bad = parseExtraction(garbage);
assert("garbage rejected (-> parse_failed)", bad === null);

console.log(`\n${fail === 0 ? "✅ PASS" : "❌ FAIL"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
