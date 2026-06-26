# HackaroundCIA — Project Record

> Canonical project document. This file is the source of truth for architecture
> and decisions; keep it updated as the build evolves. Deep-dives live in
> [`/docs`](./docs).

HackaroundCIA turns the course-plan / CIA-plan documents Christ University
students receive each semester into **one premium, scroll-driven planner
dashboard** plus a downloadable **PDF "survival guide."** A student drops in
1–5 course plans, the app extracts and reconciles them, the student confirms a
handful of human-only decisions, and a cinematic per-subject planner appears.

**v1 is desktop-only by deliberate choice.** Components stay clean enough to
adapt to mobile later, but no mobile layouts are built now.

---

## 1. Status

| Build step | Status |
|---|---|
| 1. Scaffold + base design system | ✅ done (dev server boots, palette + fonts verified) |
| 2. DB schema + RLS, prove isolation | ✅ done (migration + RLS + types; `tsc` clean; run `verify-rls.mjs` to confirm on live project) |
| 3. Screen 1 — Landing | ✅ done (hero + GSAP entrance + scroll reveals; anon session gate; verified rendering) |
| 4. Screen 2 — Upload | ✅ done (drag-drop + caps + documents rows + RLS direct-to-storage; verified) |
| 5. Layer A — Groq extraction | ✅ done (contract + prompt + Groq JSON/multimodal client + orchestration; 10/10 contract tests pass) |
| 6. Layer B — assembly + conflicts | ✅ done (grouping + reconciliation + provenance + DB orchestrator; 17/17 tests pass) |
| 7. Screen 3 — Review & confirm | ✅ done (conflicts w/ provenance, grouping confirm/merge, week-1 anchor, manual entry, confirm→raw deletion) |
| 8. Screen 4 — Loading dashboard | ✅ done (GSAP skeleton reveal + live per-doc progress; runs extract+assemble; redirects to review) |
| 9. Screen 5 — Planner dashboard | ✅ done (ScrollTrigger timeline, exact status palette + labels, criteria/reading, mark-done; verified via DOM) |
| 10. Screen 6 — PDF export + email gate | ✅ done (valid PDF via @react-pdf; magic-link gate + identity linking + auto-download) |
| 11. DPDP + cost caps + QA | ✅ done (export/delete actions + UI, caps, rate-limit, reduced-motion; prod build passes) |
| 12. PROJECT.md + /docs | ✅ done (kept current through the build) |

**Verification:** `npm test` → 27/27 (10 contract + 17 assembly). `npx tsc
--noEmit` clean. `npm run build` compiles all 12 routes. `scripts/verify-rls.mjs`
proves user isolation once Supabase is wired.

---

## 2. Stack

- **Frontend:** Next.js 15 (App Router) + React 19 + TypeScript.
- **Styling:** Tailwind CSS v3 with a fixed, spec-defined design system (no
  default-template look).
- **Animation:** GSAP + ScrollTrigger (`@gsap/react` `useGSAP` for scoped,
  auto-cleaned contexts). The signature of the product.
- **Backend / DB / Auth:** Supabase (Postgres + RLS + Supabase Auth). All
  credentials read from env; **provisioning is done manually by the human** —
  this app never scaffolds provisioning.
- **LLM (extraction only):** Groq, model **`qwen/qwen3.6-27b`** (multimodal).
  No Anthropic or other paid frontier API anywhere in the runtime pipeline.

### Verified decision — Groq model (2026-06-26)

The prompt specified `qwen/qwen3.6-27b` and asked to confirm it is current. We
verified against Groq's live docs:

- It is **listed as a current Preview model** on Groq's Supported Models page.
- Groq's **Vision docs describe it as "a 27B multimodal model that processes
  both text and image inputs"** — satisfies our requirement to read scanned /
  photographed documents.
- It is in fact **Groq's recommended migration target** now that
  `qwen/qwen3-32b` was flagged for deprecation (announced 2026-06-17).

**Conclusion: no substitution needed.** Model string kept as-is, read from
`GROQ_MODEL` (default `qwen/qwen3.6-27b`). Calls go to Groq's OpenAI-compatible
endpoint (`/openai/v1/chat/completions`) via `fetch` — no SDK dependency, full
control over the multimodal message shape (base64 `image_url` for photos).

---

## 3. Architecture — two layers, never merged

The core discipline of the product: **"did we read the file right?" must never
blur into "did we group and reconcile right?"**

### Layer A — per-document extraction
One Groq call reads **one** file and returns **that file's fields** against a
fixed JSON contract (§4). It never decides what a "subject" is. Output is
schema-validated (zod). A file that can't be parsed becomes `parse_failed` and
degrades to manual entry — it never blocks the other files.

### Layer B — per-subject assembly
A separate, deterministic (non-LLM) step groups documents into subjects,
detects field-level conflicts with provenance, and produces the reconciled view
the planner renders. See §5.

---

## 4. Extraction contract (Layer A — exact JSON)

Absent fields are `null` / `[]`. **Absence is expected, not a failure** (a CIA
handout has no COs/faculty/schedule).

```json
{
  "document_type": "course_plan | cia_handout | syllabus | other",
  "document_type_confidence": "low | medium | high",
  "course": {
    "code_from_code_field": "string | null",
    "code_from_title": "string | null",
    "title": "string | null",
    "program_class": "string | null",
    "semester": "string | null"
  },
  "faculty": [{ "name": "string", "contact": "string | null" }],
  "course_outcomes": [{ "id": "CO1", "text": "string" }],
  "assessment_items": [{
    "label": "string (free text: 'CIA I A', 'CIA II', 'ESE', 'Class Participation'...)",
    "raw_marks": "number | null",
    "normalized_weight": "number | null",
    "marks_note": "string | null",
    "due_date": { "type": "calendar_date | week_number | unknown",
                  "value": "ISO date | integer | null", "raw_text": "string | null" },
    "deliverable": "string | null",
    "criteria": [{ "text": "string", "marks": "number | null" }],
    "mapped_cos": ["CO1"],
    "field_confidence": "low | medium | high"
  }],
  "reading_lists": [{ "unit_or_module": "string | null", "references": ["string"] }],
  "policy_extract": { "late_penalty": "string | null",
                      "plagiarism_threshold": "string | null",
                      "submission_mode": "string | null" },
  "unparseable_sections": ["string"],
  "extraction_notes": "string | null"
}
```

**Rules**
- Capture `code_from_code_field` and `code_from_title` **separately** — source
  docs disagree internally (a title may read `MPRG502-3` while the code field
  reads `MPR502-3`); **the code field is authoritative.**
- `assessment_items` is a **free-label list**, never a fixed CIA1/CIA2/ESE enum.
- `due_date.type` covers absolute dates, bare week numbers, and unknown.
- `marks_note` preserves rescalings like "50 converted to 30".
- Do **NOT** extract PO–CO mapping, weekly schedule, or policy boilerplate.

---

## 5. Grouping, conflict, reconciliation (Layer B)

- **Grouping key:** `(course_code, term)`. The same code recurs across years;
  only ever silent-merge **within a term**.
- **Confidence gate:**
  - Silent-merge **only** on exact code match.
  - Route to one-tap confirm when a doc has no code, only a fuzzy name match, or
    a code differing only by the **"G" token** (`MPR` vs `MPRG` — ambiguous,
    **never auto-resolve**).
- **Conflicts are field-level with provenance:** every candidate value is stored
  with its `source_document_id`. A genuine disagreement is `unresolved_conflict`
  until the student picks in Screen 3.
- **Review priority** is computed from conflict / absence / low grouping
  confidence — **not** from the model's self-rated confidence.
- **"Sums to 100" is a soft warning, not a reject** (dissertation labs carry
  marks forward and won't sum the same).

### Dates & status
- Resolve `week_number` deadlines using the per-term `week1_start_date` the
  student enters once. Until set, those items stay **undated**.
- Status per item: `done` (user-set), `urgent` / `later` (derived from resolved
  date vs now), `needs_input` (no resolvable date — rendered distinctly, **never
  as a false `later`**).

---

## 6. Six-screen flow

1. **Landing** — premium hero, warm knowing line ("We know what time of the
   month it is — CIA week"), one CTA (Upload your course plans). Anonymous
   Supabase session created silently.
2. **Upload** — structured file drop (not chat). 1–5 course plans; per-student
   size + count caps. Each file → a `documents` row (`pending`).
3. **Review & confirm** *(mandatory trust mechanism)* — surfaces only
   human-needed decisions: cross-doc conflicts with provenance, low-confidence
   groupings, parse failures (manual entry), and the single per-term week-1
   start date. Confirmation triggers raw-file deletion.
4. **Loading dashboard** — designed animated state (GSAP skeleton reveal,
   per-subject progress) while extraction + assembly run. Not a spinner.
5. **Planner dashboard** — the payoff. A prebuilt template populated entirely
   from reconciled per-subject data; ScrollTrigger reveals a per-subject
   timeline of assessment cards (deadline, weightage, deliverable, criteria,
   reading list), color + label coded by status.
6. **PDF export** — generates + downloads a per-student/per-semester planner
   PDF. **This is the email gate:** magic-link sign-in + identity linking here.

---

## 7. Auth & the funnel

- **Anonymous-first:** an anonymous Supabase session is created on first visit
  so a student can land and upload with zero friction. All their data is scoped
  to that anon user via RLS from the first action.
- **Email only at the payoff:** require Supabase **magic-link** sign-in only
  when saving the planner / downloading the PDF. At that moment, **link the
  email identity to the existing anonymous session** (Supabase identity linking)
  so in-progress work carries over.
- This yields a verified email + real registered-user count without gating the
  entrance. **No Google OAuth in v1.**
- Requires "Allow anonymous sign-ins" + email (magic link) enabled in Supabase
  Auth settings (human-provisioned).

---

## 8. Design & motion direction (desktop)

**Palette (exact):**

| Token | Hex | Use |
|---|---|---|
| Ink navy | `#14213D` | primary text |
| Navy mid | `#2D4373` | secondary text |
| Paper | `#FBF8F2` | page |
| Card | `#F1EAD9` | card surface |
| Gold | `#E3B873` | accent — fills/borders only, **never body text** |
| Urgent | `#E2967C` | status |
| Later | `#A8BEE0` | status |
| Done | `#A8CBAE` | status |
| Pending | `#8C8576` | status `needs_input` — **added** (spec palette had none) |

- **Type:** editorial serif/sans pairing — **Fraunces** (display, optical
  sizing) + **Inter** (UI/body). Generous spacing, clear hierarchy. Premium =
  restraint and rhythm.
- **Motion:** GSAP + ScrollTrigger; animate **`transform` + `opacity` only** (no
  layout props). ScrollTrigger drives planner timeline reveals + loading-dash
  preload. Respect `prefers-reduced-motion` via `gsap.matchMedia()` with a
  static, fully-visible fallback.
- **Status never by color alone** — always paired with a label/icon (status hues
  are close in lightness).

---

## 9. Cross-cutting requirements

- **DPDP Act 2023 (India), real student data:** delete the raw uploaded file
  (null `raw_file_ref` + delete the storage object) the **moment** a document is
  confirmed. Visible **export-my-data** and **delete-my-data** actions from v1;
  delete removes **all** rows for the user including the linked email/account.
- **Cost control:** log token usage per extraction call to `extraction_log`;
  enforce upload size/count caps; rate-limit re-extraction per document.
- **Failure handling:** a document that fails to parse becomes `parse_failed`
  and degrades to "couldn't read this one — fill in manually." It never blocks
  the other documents at any stage.

---

## 10. Local development

```bash
npm install
cp .env.example .env.local   # fill in Supabase + Groq creds
npm run dev                  # http://localhost:3000
```

The app **boots and renders without credentials** (degraded mode): Supabase
clients and middleware become no-ops, and screens show a "connect Supabase"
state where data is required. This is intentional so design/QA can proceed
before services are wired.

### Notes / known items
- `sharp` postinstall is skipped by an allow-scripts policy in this environment.
  That only affects production `next/image` optimization; dev + our SVG/static
  UI are unaffected. Re-enable with `npm approve-scripts sharp` if prod image
  optimization is needed.
- Build prints one **non-fatal warning**: `@supabase/supabase-js` references
  `process.version` (a Node API) from the Edge middleware runtime. This is the
  standard `@supabase/ssr` middleware pattern and runs correctly in production —
  it's a known, accepted warning, not an error.
- Deleting the account (not just rows) requires `SUPABASE_SERVICE_ROLE_KEY`. The
  delete action degrades gracefully (RLS row-deletion + sign-out) without it.

---

## 11. Build decision log

- **2026-06-26** — Verified Groq `qwen/qwen3.6-27b` is current + multimodal; no
  substitution. Decided to call Groq's OpenAI-compatible REST endpoint via
  `fetch` (no SDK) for full control of multimodal payloads.
- **2026-06-26** — Manual scaffold (not `create-next-app`) because the project
  dir name (`project 1`) violates npm package-name rules and we want full
  control of the premium design system. Tailwind v3 (not v4) for predictable,
  config-driven theming.
- **2026-06-26** — Added `status.pending` `#8C8576` for `needs_input` (spec
  palette had no neutral).
- **2026-06-26** — Graceful-degradation env layer (`lib/env.ts`) so the app
  renders without Supabase/Groq creds during design QA.
- **2026-06-26** — Aligned `@supabase/ssr` to 0.12.0 (was 0.5.2) to match the
  resolved `@supabase/supabase-js` 2.108. The version skew made the typed
  client's `.from()` resolve to `never`; alignment restored end-to-end DB types.
