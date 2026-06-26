"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

// Register once, client-only. ScrollTrigger drives every scroll reveal in the
// app; useGSAP gives us scoped contexts with automatic cleanup (React 19 / strict
// mode safe).
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

/**
 * Motion policy: we animate ONLY transform + opacity (never layout props), and
 * we respect prefers-reduced-motion. Components should wrap their timelines in
 * `gsap.matchMedia()` using these queries so the reduced-motion branch renders a
 * static, fully-visible fallback.
 */
export const MOTION = {
  full: "(prefers-reduced-motion: no-preference)",
  reduced: "(prefers-reduced-motion: reduce)",
} as const;

/** Imperative check for non-GSAP code paths. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(MOTION.reduced).matches;
}

// Signature easing for the editorial feel — calm, confident, slight overshoot.
export const EASE = "power3.out";

export { gsap, ScrollTrigger, useGSAP };
