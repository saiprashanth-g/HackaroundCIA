"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { gsap, useGSAP, MOTION, EASE } from "@/lib/gsap";
import { setItemDone } from "@/app/planner/actions";
import { EmailGate } from "@/components/auth/EmailGate";
import type { PlannerItem, PlannerPayload, PlannerSubject } from "@/lib/planner/types";
import type { ItemStatus } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { buttonBase, buttonPrimary } from "@/lib/buttonStyles";

const STATUS: Record<
  ItemStatus,
  { label: string; card: string; tag: string; node: string }
> = {
  urgent: {
    label: "Urgent",
    card: "border-status-urgent/50 bg-status-urgent/[0.08]",
    tag: "bg-status-urgent/25 text-ink",
    node: "bg-status-urgent",
  },
  later: {
    label: "Later",
    card: "border-status-later/50 bg-status-later/[0.10]",
    tag: "bg-status-later/30 text-ink",
    node: "bg-status-later",
  },
  done: {
    label: "Done",
    card: "border-status-done/50 bg-status-done/[0.10]",
    tag: "bg-status-done/40 text-ink",
    node: "bg-status-done",
  },
  needs_input: {
    label: "Needs a date",
    card: "border-status-pending/40 bg-status-pending/[0.08]",
    tag: "bg-status-pending/25 text-ink",
    node: "bg-status-pending",
  },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "Date to confirm";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function relDays(iso: string | null): string | null {
  if (!iso) return null;
  const days = Math.ceil(
    (new Date(`${iso}T23:59:59`).getTime() - Date.now()) / 86_400_000,
  );
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `in ${days} days`;
}

function clientStatus(dueDate: string | null): ItemStatus {
  if (!dueDate) return "needs_input";
  const days = (new Date(`${dueDate}T23:59:59`).getTime() - Date.now()) / 86_400_000;
  return days <= 7 ? "urgent" : "later";
}

export default function PlannerClient({
  payload,
  demo = false,
  exportId = null,
  userEmail = null,
}: {
  payload: PlannerPayload;
  demo?: boolean;
  exportId?: string | null;
  userEmail?: string | null;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();
  const [gateOpen, setGateOpen] = useState(false);

  const allItems = useMemo(
    () => payload.subjects.flatMap((s) => s.items),
    [payload],
  );
  const [statusById, setStatusById] = useState<Record<string, ItemStatus>>(() =>
    Object.fromEntries(allItems.map((i) => [i.id, i.status])),
  );

  const stats = useMemo(() => {
    const assessments = allItems.length;
    const upcoming = allItems
      .filter((i) => i.dueDate && statusById[i.id] !== "done")
      .map((i) => i.dueDate as string)
      .sort();
    return {
      subjects: payload.subjects.length,
      assessments,
      next: upcoming[0] ?? null,
    };
  }, [allItems, payload.subjects.length, statusById]);

  function toggleDone(item: PlannerItem) {
    const isDone = statusById[item.id] === "done";
    const next: ItemStatus = isDone ? clientStatus(item.dueDate) : "done";
    setStatusById((prev) => ({ ...prev, [item.id]: next }));
    startTransition(() => {
      void setItemDone(item.id, !isDone);
    });
  }

  function triggerDownload(url: string) {
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function handleDownload() {
    if (demo) return triggerDownload("/api/pdf?demo=1");
    if (!exportId) return;
    if (!userEmail) return setGateOpen(true);
    triggerDownload(`/api/pdf?t=${exportId}`);
  }

  // Auto-download after returning from the email magic link.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("download") === "1" && userEmail && exportId) {
      triggerDownload(`/api/pdf?t=${exportId}`);
      params.delete("download");
      const qs = params.toString();
      window.history.replaceState(
        {},
        "",
        `${location.pathname}${qs ? `?${qs}` : ""}`,
      );
    }
  }, [userEmail, exportId]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION.full, () => {
        gsap.from(".planner-hero > *", {
          opacity: 0,
          y: 24,
          duration: 0.8,
          ease: EASE,
          stagger: 0.1,
        });
        gsap.utils.toArray<HTMLElement>(".subject-section").forEach((sec) => {
          const rail = sec.querySelector(".subject-rail");
          if (rail) {
            gsap.fromTo(
              rail,
              { scaleY: 0 },
              {
                scaleY: 1,
                transformOrigin: "top",
                ease: "none",
                scrollTrigger: {
                  trigger: sec,
                  start: "top 65%",
                  end: "bottom 75%",
                  scrub: true,
                },
              },
            );
          }
          gsap.from(sec.querySelectorAll(".subject-head > *"), {
            opacity: 0,
            y: 20,
            duration: 0.7,
            ease: EASE,
            stagger: 0.08,
            scrollTrigger: { trigger: sec, start: "top 78%" },
          });
          gsap.from(sec.querySelectorAll(".planner-card"), {
            opacity: 0,
            y: 40,
            duration: 0.7,
            ease: EASE,
            stagger: 0.12,
            scrollTrigger: { trigger: sec, start: "top 68%" },
          });
        });
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className="mx-auto max-w-canvas px-8 pb-32">
      {/* Summary hero */}
      <header className="planner-hero border-b border-ink/10 py-16">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-navy-mid">
          Your planner
        </p>
        <h1 className="mt-4 font-serif text-5xl leading-tight tracking-tightish text-ink">
          {payload.termName}
        </h1>
        <p className="mt-5 text-lg text-navy-mid">
          {stats.subjects} subject{stats.subjects === 1 ? "" : "s"} &middot;{" "}
          {stats.assessments} assessment{stats.assessments === 1 ? "" : "s"}
          {stats.next ? (
            <>
              {" "}
              &middot; next up{" "}
              <span className="text-ink">{fmtDate(stats.next)}</span>
            </>
          ) : null}
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          <Legend status="urgent" />
          <Legend status="later" />
          <Legend status="done" />
          <Legend status="needs_input" />
        </div>
        <button
          type="button"
          onClick={handleDownload}
          className={cn(buttonBase, buttonPrimary, "mt-9")}
        >
          Download survival guide (PDF)
        </button>
      </header>

      {payload.subjects.length === 0 ? (
        <p className="py-24 text-center text-navy-mid">
          No subjects yet. Upload your course plans to build your planner.
        </p>
      ) : null}

      {payload.subjects.map((subject) => (
        <SubjectSection
          key={subject.id}
          subject={subject}
          statusById={statusById}
          onToggle={toggleDone}
        />
      ))}

      <EmailGate
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        redirectNext={`/planner?t=${exportId ?? ""}&download=1`}
      />
    </div>
  );
}

function SubjectSection({
  subject,
  statusById,
  onToggle,
}: {
  subject: PlannerSubject;
  statusById: Record<string, ItemStatus>;
  onToggle: (item: PlannerItem) => void;
}) {
  return (
    <section className="subject-section border-b border-ink/5 py-16">
      <div className="grid gap-10 lg:grid-cols-[320px_1fr]">
        <div className="subject-head self-start lg:sticky lg:top-24">
          <h2 className="font-serif text-3xl leading-tight text-ink">
            {subject.title}
          </h2>
          <p className="mt-2 text-sm text-navy-mid">
            {[subject.courseCode, subject.programClass].filter(Boolean).join(" · ")}
          </p>
          {subject.readingLists.length > 0 ? (
            <div className="mt-6 rounded-xl border border-ink/10 bg-card/40 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-navy-mid">
                Reading
              </p>
              <ul className="mt-3 space-y-3">
                {subject.readingLists.map((rl, i) => (
                  <li key={i} className="text-sm text-ink/90">
                    {rl.unit_or_module ? (
                      <p className="text-xs text-navy-mid">{rl.unit_or_module}</p>
                    ) : null}
                    <ul className="mt-1 space-y-1">
                      {rl.references.map((r, j) => (
                        <li key={j} className="leading-snug">
                          {r}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="relative pl-10">
          <span className="subject-rail absolute bottom-2 left-[6px] top-2 w-0.5 origin-top bg-gold/50" />
          {subject.items.map((item) => (
            <AssessmentCard
              key={item.id}
              item={item}
              status={statusById[item.id] ?? item.status}
              onToggle={() => onToggle(item)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function AssessmentCard({
  item,
  status,
  onToggle,
}: {
  item: PlannerItem;
  status: ItemStatus;
  onToggle: () => void;
}) {
  const s = STATUS[status];
  const rel = status === "done" ? null : relDays(item.dueDate);
  const isConflict = item.resolutionStatus === "unresolved_conflict";

  return (
    <div className="planner-card relative mb-6">
      <span
        className={cn(
          "absolute left-0 top-7 h-3.5 w-3.5 rounded-full ring-4 ring-paper",
          s.node,
        )}
      />
      <article className={cn("rounded-2xl border p-6", s.card)}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
                s.tag,
              )}
            >
              <StatusIcon status={status} />
              {s.label}
            </span>
            {isConflict ? (
              <span className="rounded-full bg-status-urgent/15 px-2.5 py-1 text-[11px] font-medium text-ink">
                Needs your input
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
              status === "done"
                ? "border-status-done bg-status-done/30 text-ink"
                : "border-ink/20 text-navy-mid hover:border-ink/40",
            )}
          >
            {status === "done" ? "✓ Done" : "Mark done"}
          </button>
        </div>

        <h3
          className={cn(
            "mt-4 font-serif text-2xl text-ink",
            status === "done" && "line-through decoration-ink/30",
          )}
        >
          {item.label}
        </h3>

        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <span className="text-ink">
            {fmtDate(item.dueDate)}
            {rel ? <span className="text-navy-mid"> · {rel}</span> : null}
          </span>
          {item.weight != null ? (
            <span className="text-navy-mid">
              Weightage <span className="text-ink">{item.weight}%</span>
            </span>
          ) : null}
          {item.mappedCos.length > 0 ? (
            <span className="text-navy-mid">{item.mappedCos.join(" · ")}</span>
          ) : null}
        </div>

        {item.deliverable ? (
          <p className="mt-4 text-[15px] leading-relaxed text-navy-mid">
            {item.deliverable}
          </p>
        ) : null}

        {item.criteria.length > 0 ? (
          <div className="mt-4 border-t border-ink/10 pt-4">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-navy-mid">
              How it&rsquo;s marked
            </p>
            <ul className="mt-2 space-y-1.5">
              {item.criteria.map((c, i) => (
                <li
                  key={i}
                  className="flex items-baseline justify-between gap-4 text-sm"
                >
                  <span className="text-ink/90">{c.text}</span>
                  {c.marks != null ? (
                    <span className="shrink-0 text-navy-mid">{c.marks}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </article>
    </div>
  );
}

function Legend({ status }: { status: ItemStatus }) {
  const s = STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
        s.tag,
      )}
    >
      <StatusIcon status={status} />
      {s.label}
    </span>
  );
}

function StatusIcon({ status }: { status: ItemStatus }) {
  const common = { width: 12, height: 12, viewBox: "0 0 12 12", fill: "none" } as const;
  if (status === "done") {
    return (
      <svg {...common} aria-hidden>
        <path d="M2.5 6.2l2.2 2.3L9.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === "urgent") {
    return (
      <svg {...common} aria-hidden>
        <path d="M6 2.5v4M6 8.6v.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === "needs_input") {
    return (
      <svg {...common} aria-hidden>
        <path d="M4.6 4.4a1.4 1.4 0 112 1.25c-.5.3-.9.6-.9 1.15M6 9.1v.05" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden>
      <circle cx="6" cy="6" r="3.4" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6 4.3V6l1.2.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
