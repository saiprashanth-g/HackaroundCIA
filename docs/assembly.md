# Layer B — assembly, grouping & reconciliation

Deterministic (no LLM). Turns a term's extracted documents into the reconciled
subjects + assessment items the planner renders. Pure logic is unit-tested;
the DB write is orchestrated separately.

- Normalization / G-token / similarity: [`normalize.ts`](../lib/assembly/normalize.ts)
- Grouping: [`group.ts`](../lib/assembly/group.ts)
- Reconciliation + provenance: [`reconcile.ts`](../lib/assembly/reconcile.ts)
- Date resolution + status: [`dates.ts`](../lib/assembly/dates.ts)
- DB orchestration: [`assemble.ts`](../lib/assembly/assemble.ts)
- Tests: [`scripts/test-assembly.ts`](../scripts/test-assembly.ts) (`npm test`)

## Grouping (key = course code, within a term)

| Situation | Behaviour | method / confidence |
|---|---|---|
| Exact code match | **silent merge** | `code_exact` / 1.0 |
| MPR vs MPRG (one "G" apart) | **kept separate, flagged** — never auto-merged | `code_near` / 0.6, needs confirm |
| No code, title ~matches a coded subject | own group, hinted | `name_fuzzy` / similarity, needs confirm |
| No code, no match | own group | `none` / 0.3, needs confirm |

The code field (`code_from_code_field`) is authoritative over a code embedded in
the title. Review priority comes from **conflict / absence / low grouping
confidence** — never the model's self-rated confidence.

## Reconciliation (field-level, with provenance)

Items are matched across a subject's documents by normalized label (Roman
numerals folded, so "CIA I" == "CIA-1"). For each field (`weight`, `due_date`,
`deliverable`) every candidate value is written to `item_values` with its
`source_document_id`. If two or more **distinct** values appear, the field is a
conflict and the item is `unresolved_conflict` until the student picks on
Screen 3. Agreement (or a single source) resolves automatically.

## Dates & status

- `week_number` due dates resolve against the term's single `week1_start_date`
  (entered once on Screen 3). UTC arithmetic — timezone-stable.
- Status: `done` is user-set only; no resolvable date → `needs_input` (rendered
  distinctly, never a false `later`); overdue/≤7 days → `urgent`; else `later`.

## Soft checks

"Sums to 100" is a **warning, not a reject** (dissertation labs carry marks
forward). `assembleTerm` returns any subject whose known weights fall outside
100 ± 2.
