# Design & motion system

Premium, editorial, desktop-first. Defined in
[`tailwind.config.ts`](../tailwind.config.ts),
[`app/globals.css`](../app/globals.css), and [`lib/gsap.ts`](../lib/gsap.ts).

## Palette (exact)

| Token (Tailwind) | Hex | Use |
|---|---|---|
| `ink` | `#14213D` | primary text |
| `navy-mid` | `#2D4373` | secondary text |
| `paper` | `#FBF8F2` | page background |
| `card` | `#F1EAD9` | card surface |
| `gold` | `#E3B873` | accent — fills/borders only, **never body text** |
| `status-urgent` | `#E2967C` | status |
| `status-later` | `#A8BEE0` | status |
| `status-done` | `#A8CBAE` | status |
| `status-pending` | `#8C8576` | `needs_input` — **added** (spec palette had no neutral) |

## Type

Editorial pairing via `next/font`: **Fraunces** (display serif, optical sizing)
for headings/numerals, **Inter** for UI/body. Exposed as `--font-serif` /
`--font-sans` and mapped to Tailwind `font-serif` / `font-sans`. Premium =
restraint, generous spacing, and rhythm — not effects.

## Motion (GSAP + ScrollTrigger)

- Animate **`transform` + `opacity` only** — never layout properties.
- ScrollTrigger drives the planner timeline reveals (and the rail "draw"), the
  loading-dashboard skeleton preload, and section entrances.
- Every timeline is wrapped in `gsap.matchMedia()` gated on
  `(prefers-reduced-motion: no-preference)`. The reduced-motion branch is a
  static, fully-visible layout; `globals.css` additionally neutralizes CSS
  motion under that query.
- Signature easing: `power3.out`. Headline reveals use an overflow-clip mask.

## Status convention

Status is **never colour alone** — each hue is always paired with a label and an
icon (the four status hues are close in lightness). Applied consistently on the
planner cards, the upload list, the loading dashboard, and the PDF.
