# DPDP, cost control & failure handling

Real student data → built to the DPDP Act 2023 from v1.

## Raw-file lifecycle (data minimization)

- On upload, the raw file goes to a **private** Storage bucket (`raw-uploads`),
  RLS-scoped to the user's own folder (`<uid>/<term>/<file>`).
- The extractor reads it once (Layer A).
- **On confirmation (Screen 3 → `confirmAndFinalize`), the raw file is deleted**
  — the storage object is removed and `documents.raw_file_ref` is set null. Only
  the reconciled, user-confirmed data remains. See
  [`app/review/actions.ts`](../app/review/actions.ts).

## Export & delete (visible from v1)

The **/account** page ("Your data") is linked from the funnel top bar and the
landing page. See [`app/account/actions.ts`](../app/account/actions.ts).

- **Export my data** — returns every row we hold (all tables, RLS-scoped) plus
  the account record as a downloadable JSON file.
- **Delete my data** — purges storage objects, then deletes the **auth user**
  via the service role, which cascades every row (`student_id ... on delete
  cascade`), removing the linked email/account too. Without the service-role key
  it falls back to RLS row-deletion + sign-out and says so.

## Cost control

- Every Groq call logs `{ model, in_tokens, out_tokens, est_cost, attempt_no }`
  to `extraction_log` — including failed attempts.
- Upload caps: ≤ 5 files, ≤ 8 MB each, type-checked **client and server**.
- Re-extraction of a document is rate-limited (`APP.reextractCooldownMs`).

## Failure handling

A document that can't be read becomes `parse_failed` and degrades to
"couldn't read this one — fill in manually" on Screen 3. It **never blocks** the
other documents at any stage (each extraction is isolated).

## Motion accessibility

All GSAP timelines run inside `gsap.matchMedia()` gated on
`(prefers-reduced-motion: no-preference)`; the reduced-motion branch renders the
final, fully-visible layout with no animation. `globals.css` also neutralizes
CSS transitions/animations under the reduced-motion query. Status is **never
conveyed by colour alone** — every status pairs its hue with a label + icon.
