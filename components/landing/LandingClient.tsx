"use client";

import { useRef } from "react";
import Link from "next/link";
import { gsap, useGSAP, MOTION, EASE } from "@/lib/gsap";
import { CtaButton } from "@/components/ui/CtaButton";

const steps = [
  {
    n: "01",
    title: "Upload",
    body: "Drop in up to five course & CIA plans. Clean PDFs or quick phone photos — both read fine.",
  },
  {
    n: "02",
    title: "Confirm",
    body: "We surface only the genuine clashes — “course plan says 21 Jul, handout says 7 Sep.” One tap each, you decide.",
  },
  {
    n: "03",
    title: "Plan",
    body: "Scroll your whole semester: every CIA with its weight, deadline, deliverable, and how to prepare.",
  },
];

export default function LandingClient() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      // Full motion only; reduced-motion users get the static, visible layout.
      mm.add(MOTION.full, () => {
        const tl = gsap.timeline({ defaults: { ease: EASE } });
        tl.from(".hero-eyebrow", { opacity: 0, y: 14, duration: 0.7 })
          .from(
            ".hero-line",
            { yPercent: 120, duration: 1, stagger: 0.1 },
            "-=0.35",
          )
          .from(
            ".hero-rule",
            { scaleX: 0, transformOrigin: "left center", duration: 0.85 },
            "-=0.5",
          )
          .from(".hero-sub", { opacity: 0, y: 18, duration: 0.8 }, "-=0.6")
          .from(".hero-cta", { opacity: 0, y: 14, duration: 0.7 }, "-=0.55")
          .from(".scroll-cue", { opacity: 0, duration: 0.6 }, "-=0.25");

        gsap.from(".step-card", {
          opacity: 0,
          y: 48,
          duration: 0.85,
          ease: EASE,
          stagger: 0.16,
          scrollTrigger: { trigger: ".steps", start: "top 78%" },
        });

        gsap.from(".closing-inner", {
          opacity: 0,
          y: 32,
          duration: 0.9,
          ease: EASE,
          scrollTrigger: { trigger: ".closing", start: "top 82%" },
        });
      });
    },
    { scope: root },
  );

  return (
    <div ref={root}>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative flex min-h-screen flex-col justify-center overflow-hidden">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 top-1/2 hidden -translate-y-1/2 select-none font-serif text-[34rem] leading-none text-ink/[0.035] lg:block"
        >
          &sect;
        </span>

        <div className="mx-auto w-full max-w-canvas px-8">
          <p className="hero-eyebrow mb-8 text-xs font-medium uppercase tracking-[0.34em] text-navy-mid">
            For Christ University &middot; CIA season
          </p>

          <h1 className="font-serif text-5xl font-light leading-[1.05] tracking-tightish text-ink sm:text-6xl lg:text-[5.2rem]">
            <span className="block overflow-hidden pb-1">
              <span className="hero-line block">We know what time</span>
            </span>
            <span className="block overflow-hidden pb-1">
              <span className="hero-line block">of the month it is &mdash;</span>
            </span>
            <span className="block overflow-hidden pb-1">
              <span className="hero-line block">CIA week.</span>
            </span>
          </h1>
          <span className="hero-rule mt-6 block h-[3px] w-44 rounded-full bg-gold" />

          <p className="hero-sub mt-9 max-w-xl text-lg leading-relaxed text-navy-mid">
            Drop in your course plans. HackaroundCIA reads them, untangles the
            conflicts, and lays out one calm planner &mdash; what&rsquo;s due,
            when, and how to prepare. Then take the survival guide with you as a
            PDF.
          </p>

          <div className="hero-cta mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
            <CtaButton href="/upload">
              Upload your course plans
              <Arrow />
            </CtaButton>
            <span className="text-sm text-navy-mid/70">
              No account needed to start.
            </span>
          </div>
        </div>

        <div className="scroll-cue absolute inset-x-0 bottom-8 mx-auto flex w-full max-w-canvas items-center gap-3 px-8 text-[11px] uppercase tracking-[0.3em] text-navy-mid/55">
          <span className="h-px w-10 bg-navy-mid/30" /> Scroll
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="steps border-t border-ink/5 bg-card/40">
        <div className="mx-auto max-w-canvas px-8 py-28">
          <p className="mb-14 max-w-md font-serif text-2xl leading-snug text-ink">
            Three steps between you and a calm CIA week.
          </p>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-ink/10 bg-ink/10 md:grid-cols-3">
            {steps.map((s) => (
              <div
                key={s.n}
                className="step-card flex flex-col gap-4 bg-paper p-9"
              >
                <span className="font-serif text-sm text-gold">{s.n}</span>
                <h3 className="font-serif text-2xl text-ink">{s.title}</h3>
                <p className="text-[15px] leading-relaxed text-navy-mid">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing ──────────────────────────────────────────────────────── */}
      <section className="closing">
        <div className="closing-inner mx-auto max-w-canvas px-8 py-28 text-center">
          <h2 className="mx-auto max-w-2xl font-serif text-4xl leading-tight text-ink">
            Your semester, finally legible.
          </h2>
          <div className="mt-9 flex justify-center">
            <CtaButton href="/upload">
              Upload your course plans
              <Arrow />
            </CtaButton>
          </div>
          <p className="mx-auto mt-10 max-w-md text-sm leading-relaxed text-navy-mid/70">
            Your raw files are deleted the moment you confirm your plan.{" "}
            <Link
              href="/account"
              className="underline decoration-gold underline-offset-4 transition-colors hover:text-ink"
            >
              Export or delete
            </Link>{" "}
            everything we hold, anytime.
          </p>
        </div>
      </section>
    </div>
  );
}

function Arrow() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className="transition-transform duration-300 group-hover:translate-x-0.5"
    >
      <path
        d="M2 8h12M9 3l5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
