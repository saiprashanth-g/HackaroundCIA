# HackaroundCIA — Documentation

[`PROJECT.md`](../PROJECT.md) at the repo root is the **canonical** record
(architecture, two-layer model, full extraction contract, six-screen flow,
auth/funnel, design/motion, DPDP/cost/failure, decision log).

Deep-dives:

- [`db-schema.md`](./db-schema.md) — tables, the RLS isolation model, storage,
  applying the migration, and proving user isolation.
- [`extraction-contract.md`](./extraction-contract.md) — Layer A contract,
  prompt, input handling (text vs multimodal), resilience, cost & failure.
- [`assembly.md`](./assembly.md) — Layer B grouping, reconciliation with
  provenance, date resolution, soft checks.
- [`design-system.md`](./design-system.md) — palette, type pairing, motion
  policy, status conventions.
- [`dpdp.md`](./dpdp.md) — raw-file lifecycle, export/delete, cost control,
  failure handling, motion accessibility.

> Kept in sync with the code as the build evolved.
