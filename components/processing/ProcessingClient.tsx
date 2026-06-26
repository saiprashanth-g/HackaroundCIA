"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { gsap, useGSAP, MOTION, EASE } from "@/lib/gsap";
import { getProcessingStatus, runProcessing } from "@/app/processing/actions";
import { cn } from "@/lib/utils";

type DocLite = { id: string; filename: string };

const PHASES = [
  "Reading your documents",
  "Untangling subjects",
  "Spotting conflicts",
  "Laying out your planner",
];

export default function ProcessingClient({
  termId,
  initialDocs,
}: {
  termId: string | null;
  initialDocs: DocLite[];
}) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const [statuses, setStatuses] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialDocs.map((d) => [d.id, "pending"])),
  );
  const [phase, setPhase] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Visual fallback when we have no docs (e.g. unconfigured) — 3 ghost cards.
  const cards: DocLite[] =
    initialDocs.length > 0
      ? initialDocs
      : [
          { id: "g1", filename: "" },
          { id: "g2", filename: "" },
          { id: "g3", filename: "" },
        ];

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION.full, () => {
        gsap.from(".load-card", {
          opacity: 0,
          y: 24,
          duration: 0.7,
          ease: EASE,
          stagger: 0.12,
        });
        gsap.to(".shimmer", {
          opacity: 0.35,
          duration: 0.9,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          stagger: { each: 0.12 },
        });
      });
    },
    { scope: root },
  );

  useEffect(() => {
    const id = setInterval(
      () => setPhase((p) => Math.min(p + 1, PHASES.length - 1)),
      1600,
    );
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!termId) return;
    let active = true;
    const start = Date.now();

    async function poll() {
      const { docs } = await getProcessingStatus(termId!);
      if (active && docs.length) {
        setStatuses(Object.fromEntries(docs.map((d) => [d.id, d.status])));
      }
    }
    const pollId = setInterval(poll, 1500);

    (async () => {
      const r = await runProcessing(termId);
      if (!active) return;
      await poll();
      if (!r.ok) {
        setError("Something went wrong while building your planner.");
        return;
      }
      const wait = Math.max(0, 1200 - (Date.now() - start));
      setTimeout(() => {
        if (active) router.push(`/review?t=${termId}`);
      }, wait);
    })().catch(() => {
      if (active) setError("Something went wrong while building your planner.");
    });

    return () => {
      active = false;
      clearInterval(pollId);
    };
  }, [termId, router]);

  if (!termId) {
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-8 text-center">
        <h1 className="font-serif text-3xl text-ink">No planner in progress</h1>
        <Link
          href="/upload"
          className="text-sm text-navy-mid underline decoration-gold underline-offset-4"
        >
          Upload your course plans →
        </Link>
      </main>
    );
  }

  const done = Object.values(statuses).filter((s) => s !== "pending").length;
  const total = initialDocs.length;

  return (
    <main ref={root} className="mx-auto max-w-canvas px-8 pb-28 pt-20">
      <div className="mb-12 max-w-xl">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-navy-mid">
          Building your planner
        </p>
        <h1 className="mt-4 font-serif text-4xl leading-tight text-ink sm:text-5xl">
          {error ?? `${PHASES[phase]}…`}
        </h1>
        {!error && total > 0 ? (
          <p className="mt-4 text-navy-mid">
            {done} of {total} document{total === 1 ? "" : "s"} read
          </p>
        ) : null}
        {error ? (
          <Link
            href={`/review?t=${termId}`}
            className="mt-4 inline-block text-sm text-navy-mid underline decoration-gold underline-offset-4"
          >
            Continue anyway →
          </Link>
        ) : null}
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((d) => (
          <SkeletonCard key={d.id} filename={d.filename} status={statuses[d.id]} />
        ))}
      </div>
    </main>
  );
}

function SkeletonCard({
  filename,
  status,
}: {
  filename: string;
  status?: string;
}) {
  const done = status === "extracted";
  const failed = status === "parse_failed";

  return (
    <div className="load-card rounded-2xl border border-ink/10 bg-card/50 p-6">
      <div className="flex items-center justify-between">
        <div
          className={cn(
            "shimmer h-9 w-9 rounded-lg",
            done
              ? "bg-status-done/60"
              : failed
                ? "bg-status-pending/40"
                : "bg-ink/10",
          )}
        />
        <StatusTag status={status} />
      </div>

      {done || failed ? (
        <p className="mt-5 truncate font-serif text-lg text-ink">
          {filename || "Document"}
        </p>
      ) : (
        <div className="mt-5 space-y-2.5">
          <div className="shimmer h-3 w-3/4 rounded-full bg-ink/10" />
          <div className="shimmer h-3 w-1/2 rounded-full bg-ink/10" />
        </div>
      )}

      <div className="mt-6 space-y-2.5">
        <div
          className={cn(
            "shimmer h-2.5 rounded-full bg-ink/[0.07]",
            done ? "w-2/3" : "w-full",
          )}
        />
        <div className="shimmer h-2.5 w-5/6 rounded-full bg-ink/[0.07]" />
        {!done && !failed ? (
          <div className="shimmer h-2.5 w-2/3 rounded-full bg-ink/[0.07]" />
        ) : null}
      </div>
    </div>
  );
}

function StatusTag({ status }: { status?: string }) {
  if (status === "extracted") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-status-done/45 px-2.5 py-1 text-[11px] font-medium text-ink">
        <Check /> Read
      </span>
    );
  }
  if (status === "parse_failed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-status-pending/30 px-2.5 py-1 text-[11px] font-medium text-ink">
        ! Fix next
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-2.5 py-1 text-[11px] font-medium text-navy-mid">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      Reading
    </span>
  );
}

function Check() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2.5 6.2l2.2 2.3L9.5 3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
