# Database schema & RLS

Source of truth: [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql).
TypeScript mirror: [`lib/supabase/database.types.ts`](../lib/supabase/database.types.ts).

## Applying the migration

The human provisions Supabase manually. Apply the schema either way:

- **SQL editor:** paste `0001_init.sql` and run. It is idempotent (safe to
  re-run).
- **CLI:** `supabase db push` (with the project linked).

Then, in **Auth → Providers**, enable **Email** (magic link) and **Allow
anonymous sign-ins**. The app needs anonymous sessions from the first visit and
magic-link sign-in at the PDF/save gate.

## Tables

| Table | Purpose | Owner column |
|---|---|---|
| `terms` | per-student semester/term; holds the one `week1_start_date` anchor | `student_id` |
| `documents` | one row per uploaded file; extraction status + raw JSON; `raw_file_ref` nulled on confirm | `student_id` |
| `subjects` | a reconciled subject (Layer B output); grouping method/confidence/status | `student_id` |
| `subject_documents` | join: which documents compose a subject | via `subjects` |
| `assessment_items` | reconciled CIA/assessment rows (resolved weight/date/deliverable/status) | via `subjects` |
| `item_values` | provenance ledger: each candidate value + its `source_document_id` | via `assessment_items → subjects` |
| `user_overrides` | explicit student decisions/overrides | `student_id` |
| `extraction_log` | per-call token usage + cost (cost control) | `student_id` |

`student_id` defaults to `auth.uid()` and references `auth.users(id) on delete
cascade` — so deleting the auth account removes all the user's rows (DPDP
delete-my-data).

## RLS isolation model

Every table has RLS enabled. Two patterns:

1. **Direct owner** (`terms`, `documents`, `subjects`, `user_overrides`,
   `extraction_log`): a single `for all` policy with
   `using / with check (student_id = (select auth.uid()))`.
2. **Derived owner** (`subject_documents`, `assessment_items`, `item_values`):
   ownership is proven via `exists(...)` up the parent chain to a table that
   carries `student_id`. Inserts into `subject_documents` additionally verify
   the linked `document_id` belongs to the user, so you cannot attach someone
   else's file to your subject.

`(select auth.uid())` is wrapped in a subselect so Postgres caches it per
statement (Supabase RLS performance best practice).

### Storage

A private bucket `raw-uploads` holds raw files under the path convention
`<auth.uid()>/<term>/<filename>`. `storage.objects` policies restrict every
operation to objects whose **top folder equals the caller's uid**, so raw files
are owner-only and a user can purge their own objects (delete-my-data).

## Proving isolation

`verify-rls.mjs` exercises the real client path (not SQL role simulation):

```bash
node --env-file=.env.local scripts/verify-rls.mjs
```

It signs in **two** anonymous users, has A insert a private `terms` row, then
asserts B can neither read, update, nor delete it while A can — printing a
PASS/FAIL summary. Requires anonymous sign-ins enabled.
