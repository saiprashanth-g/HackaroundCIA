/**
 * Runtime test for Layer B pure logic (grouping + reconciliation).
 *   node scripts/test-assembly.ts
 */
import { groupDocuments } from "@/lib/assembly/group";
import { reconcileItems } from "@/lib/assembly/reconcile";

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

const dg = (
  documentId: string,
  codeField: string | null,
  codeTitle: string | null,
  title: string | null,
) => ({ documentId, codeField, codeTitle, title, programClass: null });

// ── Grouping ──────────────────────────────────────────────────────────────
// 1. Exact code → silent merge.
{
  const g = groupDocuments([
    dg("d1", "MPR502-3", null, "Research Methodology"),
    dg("d2", "MPR502-3", null, "Research Methods"),
  ]);
  assert("exact code: single merged group", g.length === 1);
  assert("exact code: both docs in group", g[0]?.documentIds.length === 2);
  assert("exact code: method=code_exact, no confirm", g[0]?.groupingMethod === "code_exact" && g[0]?.needsConfirm === false);
}

// 2. MPR vs MPRG → NEVER auto-merge; both flagged code_near.
{
  const g = groupDocuments([
    dg("d1", "MPR502-3", null, "Research Methodology"),
    dg("d2", "MPRG502-3", null, "Research Methodology"),
  ]);
  assert("G-token: kept separate (2 groups)", g.length === 2);
  assert("G-token: both code_near + needsConfirm", g.every((x) => x.groupingMethod === "code_near" && x.needsConfirm));
}

// 3. Code field is authoritative over title code.
{
  const g = groupDocuments([
    dg("d1", "MPR502-3", "MPRG502-3", "Research Methodology"),
    dg("d2", "MPR502-3", null, "Research Methodology"),
  ]);
  assert("authoritative code: merges on code field", g.length === 1 && g[0]?.courseCode === "MPR502-3");
}

// 4. No code → its own group, flagged for confirm.
{
  const g = groupDocuments([dg("d9", null, null, "Statistics for Psychology")]);
  assert("no code: needsConfirm true", g[0]?.needsConfirm === true);
  assert("no code: method none", g[0]?.groupingMethod === "none");
}

// ── Reconciliation ────────────────────────────────────────────────────────
const item = (
  label: string,
  due: { type: string; value: string | number | null; raw_text: string | null },
  weight: number | null = null,
  deliverable: string | null = null,
) => ({
  label,
  raw_marks: null,
  normalized_weight: weight,
  marks_note: null,
  due_date: due,
  deliverable,
  criteria: [],
  mapped_cos: [],
  field_confidence: "high" as const,
});
const cal = (v: string, raw?: string) => ({ type: "calendar_date" as const, value: v, raw_text: raw ?? v });
const wk = (n: number) => ({ type: "week_number" as const, value: n, raw_text: `Week ${n}` });

// 5. Same item, conflicting dates → unresolved_conflict with provenance.
{
  const r = reconcileItems(
    [
      { documentId: "course", items: [item("CIA I", cal("2026-07-21", "21 Jul"), 30)] },
      { documentId: "handout", items: [item("CIA I", cal("2026-09-07", "7 Sep"), 30)] },
    ],
    null,
  );
  assert("conflict: items merged to one", r.length === 1);
  assert("conflict: due_date flagged", r[0]?.conflictFields.includes("due_date") === true);
  assert("conflict: resolution_status=unresolved_conflict", r[0]?.resolutionStatus === "unresolved_conflict");
  const dueCands = r[0]?.candidates.filter((c) => c.fieldName === "due_date") ?? [];
  assert("conflict: 2 candidates with distinct provenance", dueCands.length === 2 && dueCands[0].sourceDocumentId !== dueCands[1].sourceDocumentId);
  assert("conflict: weight agrees (not flagged)", !r[0]?.conflictFields.includes("weight"));
}

// 6. Agreement → resolved, auto.
{
  const r = reconcileItems(
    [
      { documentId: "a", items: [item("CIA I", cal("2026-07-21"), 30)] },
      { documentId: "b", items: [item("CIA-1", cal("2026-07-21"), 30)] },
    ],
    null,
  );
  assert("agreement: merged via normalized label", r.length === 1);
  assert("agreement: resolved date + auto", r[0]?.resolvedDueDate === "2026-07-21" && r[0]?.resolutionStatus === "auto");
}

// 7. Week number + anchor resolves; without anchor → needs_input.
{
  const withAnchor = reconcileItems([{ documentId: "a", items: [item("CIA II", wk(3))] }], "2026-06-01");
  assert("week+anchor: resolves to ISO date", withAnchor[0]?.resolvedDueDate === "2026-06-15");
  const noAnchor = reconcileItems([{ documentId: "a", items: [item("CIA II", wk(3))] }], null);
  assert("week, no anchor: needs_input + week_number type", noAnchor[0]?.status === "needs_input" && noAnchor[0]?.dueDateType === "week_number");
}

console.log(`\n${fail === 0 ? "✅ PASS" : "❌ FAIL"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
