# Layer A — extraction contract & pipeline

One Groq call reads **one** file and returns **that file's** fields. It never
decides what a "subject" is (that's [Layer B](./assembly.md)).

- Model: `qwen/qwen3.6-27b` (multimodal), via Groq's OpenAI-compatible endpoint
  (`fetch`, JSON mode). No SDK. See [`lib/groq.ts`](../lib/groq.ts).
- Prompt: [`lib/extraction/prompt.ts`](../lib/extraction/prompt.ts).
- Contract (zod): [`lib/extraction/schema.ts`](../lib/extraction/schema.ts).
- Orchestration: [`lib/extraction/extract.ts`](../lib/extraction/extract.ts).

## Input handling

| Uploaded as | How it's read |
|---|---|
| Photo / scan (`png/jpg/webp`) | sent **multimodally** as a base64 `image_url` — the model OCRs it |
| Digital PDF | text extracted with `unpdf`, sent as text |
| DOCX | text extracted with `mammoth`, sent as text |
| PDF/DOCX with no text layer | degrades to `parse_failed` ("try re-uploading as a photo") |

Text is truncated to ~60k chars to bound tokens/cost.

## The contract

See the full JSON in [`PROJECT.md` §4](../PROJECT.md). Enforced rules:

- `code_from_code_field` and `code_from_title` captured **separately** (the code
  field is authoritative; reconciliation is Layer B's job, not the model's).
- `assessment_items` is a **free-label** list — the document's own labels,
  never a fixed CIA1/CIA2/ESE enum.
- `due_date.type` ∈ `calendar_date | week_number | unknown`, always with
  `raw_text` preserved.
- `marks_note` preserves rescalings ("50 converted to 30").
- PO–CO matrices, weekly schedules, and policy boilerplate are **not** extracted.
- Absent fields are `null` / `[]` — absence is expected, not a failure.

## Resilience

The schema is **lenient** (`.catch` fallbacks, array defaults) because the
extractor is open-weight: imperfect-but-usable output is normalized rather than
rejected, while genuinely unreadable output (non-JSON, API error, empty text)
becomes `parse_failed`. Verified by
[`scripts/test-extraction-schema.ts`](../scripts/test-extraction-schema.ts)
(`node scripts/test-extraction-schema.ts`).

## Cost control & failure

- Every call logs `{ model, in_tokens, out_tokens, est_cost, attempt_no }` to
  `extraction_log` (even failed attempts), per [`cost.ts`](../lib/extraction/cost.ts).
  Set `GROQ_IN_RATE_PER_M` / `GROQ_OUT_RATE_PER_M` to Groq's published price.
- Re-extraction of a document is rate-limited (`APP.reextractCooldownMs`).
- A `parse_failed` document **never blocks** its siblings — each is isolated.
