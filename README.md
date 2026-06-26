# HackaroundCIA

A premium, scroll-driven planner for Christ University students that turns the
course/CIA plan documents they get each semester into **one reconciled planner
dashboard** and a downloadable **PDF "survival guide."**

Drop in 1–5 course plans → the app extracts and reconciles them → you confirm a
few human-only decisions → a cinematic per-subject planner appears → export it
as a PDF. **v1 is desktop-only by design.**

> 📄 **[`PROJECT.md`](./PROJECT.md) is the canonical project record.** Deep-dives
> live in [`/docs`](./docs).

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v3 · GSAP +
ScrollTrigger · Supabase (Postgres + RLS + Auth) · Groq `qwen/qwen3.6-27b`
(extraction only, multimodal). No paid frontier API in the runtime pipeline.

## Quick start

```bash
npm install
cp .env.example .env.local      # fill in Supabase + Groq (provisioned manually)
npm run dev                     # http://localhost:3000
```

The app **boots without credentials** in a graceful "connect Supabase" mode, so
you can review the design before wiring services. Try the planner visually at
`/planner?demo=1`.

### Set up Supabase

1. Run [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql)
   (SQL editor or `supabase db push`) — schema + RLS + the private `raw-uploads`
   bucket.
2. Auth → enable **Email (magic link)** and **Allow anonymous sign-ins**.
3. Prove isolation: `node --env-file=.env.local scripts/verify-rls.mjs`.

## Scripts

```bash
npm run dev      # dev server
npm run build    # production build (type-check + lint + all routes)
npm start        # serve the production build
npm test         # extraction-contract + assembly logic tests (27 assertions)
```

## The six screens

1. **Landing** — hero + one CTA; silent anonymous session.
2. **Upload** — structured drop, 1–5 files, caps.
3. **Review** — conflicts (with provenance), grouping confirms, week-1 anchor,
   manual fallback. Confirming deletes the raw files (DPDP).
4. **Loading** — animated skeleton dashboard while extraction + assembly run.
5. **Planner** — ScrollTrigger timeline of assessment cards per subject.
6. **PDF export** — magic-link email gate + identity linking, then download.

## Architecture in one line

Two layers, never merged: **Layer A** (one Groq call reads one file →
contract JSON) and **Layer B** (a deterministic step groups documents into
subjects and reconciles field-level conflicts with provenance). See
[`PROJECT.md`](./PROJECT.md) §3.
