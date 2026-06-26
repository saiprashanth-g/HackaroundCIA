"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  confirmAndFinalize,
  confirmGrouping,
  mergeSubjects,
  resolveConflict,
  setWeek1Date,
  submitManualEntry,
  type ManualItemInput,
} from "@/app/review/actions";
import type {
  ReviewConflict,
  ReviewGrouping,
  ReviewParseFailure,
  ReviewPayload,
} from "@/lib/review/types";
import { cn } from "@/lib/utils";
import { buttonBase, buttonOutline, buttonPrimary } from "@/lib/buttonStyles";

type ActionResult = { ok: boolean; message?: string };

export default function ReviewClient({ payload }: { payload: ReviewPayload }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [finalizing, setFinalizing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const decisionsLeft =
    payload.conflicts.length +
    payload.groupings.length +
    payload.parseFailures.length;

  function run(fn: () => Promise<ActionResult>) {
    startTransition(async () => {
      const r = await fn();
      setNotice(!r.ok && r.message ? r.message : null);
      router.refresh();
    });
  }

  async function finalize() {
    setFinalizing(true);
    setNotice(null);
    const r = await confirmAndFinalize(payload.termId);
    if (!r.ok) {
      setNotice(r.message ?? "Could not finalize.");
      setFinalizing(false);
      return;
    }
    router.push(`/planner?t=${payload.termId}`);
  }

  return (
    <div className="max-w-3xl">
      {notice ? (
        <div className="mb-6 rounded-xl border border-status-urgent/40 bg-status-urgent/10 px-4 py-3 text-sm text-ink">
          {notice}
        </div>
      ) : null}

      {/* Week-1 anchor */}
      {payload.hasWeekNumberItems ? (
        <Week1Anchor
          termId={payload.termId}
          current={payload.week1StartDate}
          busy={isPending}
          onSet={(date) => run(() => setWeek1Date(payload.termId, date))}
        />
      ) : null}

      {/* Conflicts */}
      {payload.conflicts.length > 0 ? (
        <Section
          title="Conflicts to resolve"
          caption="Your documents disagree. Pick the right value — one tap each."
        >
          {payload.conflicts.map((c) => (
            <ConflictCard
              key={`${c.itemId}-${c.field}`}
              conflict={c}
              busy={isPending}
              onPick={(documentId) =>
                run(() => resolveConflict(c.itemId, c.field, documentId))
              }
            />
          ))}
        </Section>
      ) : null}

      {/* Groupings */}
      {payload.groupings.length > 0 ? (
        <Section
          title="Confirm subjects"
          caption="We weren't fully sure how to group these. You decide."
        >
          {payload.groupings.map((g) => (
            <GroupingCard
              key={g.subjectId}
              grouping={g}
              busy={isPending}
              onConfirm={() => run(() => confirmGrouping(g.subjectId))}
              onMerge={(targetId) =>
                run(() => mergeSubjects(payload.termId, g.subjectId, targetId))
              }
            />
          ))}
        </Section>
      ) : null}

      {/* Parse failures */}
      {payload.parseFailures.length > 0 ? (
        <Section
          title="Couldn't read these"
          caption="No problem — add the details by hand and they'll join your planner."
        >
          {payload.parseFailures.map((f) => (
            <ManualEntryCard
              key={f.documentId}
              failure={f}
              busy={isPending}
              onSubmit={(title, code, items) =>
                run(() =>
                  submitManualEntry(payload.termId, f.documentId, title, code, items),
                )
              }
            />
          ))}
        </Section>
      ) : null}

      {/* Weight warnings (soft, non-blocking) */}
      {payload.weightWarnings.length > 0 ? (
        <div className="mt-8 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-ink">
          <p className="font-medium">Just so you know</p>
          <ul className="mt-1 list-disc pl-5 text-navy-mid">
            {payload.weightWarnings.map((w) => (
              <li key={w.subjectTitle}>
                {w.subjectTitle}: weights add up to {w.sum}%, not 100. That can be
                normal — carry-forward marks, etc.
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* All-clear */}
      {decisionsLeft === 0 ? (
        <div className="mt-2 rounded-2xl border border-status-done/50 bg-status-done/15 px-6 py-8 text-center">
          <p className="font-serif text-2xl text-ink">Everything checks out.</p>
          <p className="mt-2 text-sm text-navy-mid">
            No conflicts, nothing ambiguous. You're ready.
          </p>
        </div>
      ) : null}

      {/* Finalize */}
      <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
        <button
          type="button"
          onClick={finalize}
          disabled={finalizing || isPending}
          className={cn(buttonBase, buttonPrimary)}
        >
          {finalizing ? "Finalizing…" : "Confirm & build my planner"}
        </button>
        <p className="text-sm text-navy-mid/70">
          Confirming deletes your raw uploaded files for good.
        </p>
      </div>
    </div>
  );
}

function Section({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="font-serif text-2xl text-ink">{title}</h2>
      <p className="mt-1 mb-5 text-sm text-navy-mid">{caption}</p>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Week1Anchor({
  current,
  busy,
  onSet,
}: {
  termId: string;
  current: string | null;
  busy: boolean;
  onSet: (date: string) => void;
}) {
  const [date, setDate] = useState(current ?? "");
  return (
    <section className="mb-10 rounded-2xl border border-ink/10 bg-card/50 p-6">
      <h2 className="font-serif text-2xl text-ink">When does week 1 start?</h2>
      <p className="mt-1 text-sm text-navy-mid">
        Some deadlines are written as week numbers. Set your term&rsquo;s week-1
        Monday once and we&rsquo;ll turn those into real dates.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-ink/20 bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-gold"
        />
        <button
          type="button"
          disabled={busy || !date}
          onClick={() => onSet(date)}
          className={cn(buttonBase, buttonOutline, "px-5 py-2")}
        >
          {current ? "Update" : "Set date"}
        </button>
        {current ? (
          <span className="text-sm text-status-done">
            ✓ Set to {current}
          </span>
        ) : null}
      </div>
    </section>
  );
}

function ConflictCard({
  conflict,
  busy,
  onPick,
}: {
  conflict: ReviewConflict;
  busy: boolean;
  onPick: (documentId: string) => void;
}) {
  return (
    <div className="rounded-xl border border-ink/10 bg-paper p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-navy-mid/70">
        {conflict.subjectTitle} &middot; {conflict.fieldLabel}
      </p>
      <p className="mt-1 font-serif text-lg text-ink">{conflict.itemLabel}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {conflict.candidates.map((c, i) => (
          <button
            key={`${c.documentId}-${i}`}
            type="button"
            disabled={busy || !c.documentId}
            onClick={() => onPick(c.documentId)}
            className="group flex flex-col items-start rounded-lg border border-ink/15 bg-card/40 px-4 py-2.5 text-left transition-colors hover:border-gold hover:bg-card disabled:opacity-50"
          >
            <span className="text-[11px] uppercase tracking-wider text-navy-mid/70">
              {c.sourceLabel} says
            </span>
            <span className="font-medium text-ink">{c.value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function GroupingCard({
  grouping,
  busy,
  onConfirm,
  onMerge,
}: {
  grouping: ReviewGrouping;
  busy: boolean;
  onConfirm: () => void;
  onMerge: (targetId: string) => void;
}) {
  return (
    <div className="rounded-xl border border-ink/10 bg-paper p-5">
      <p className="font-serif text-lg text-ink">
        {grouping.title}
        {grouping.courseCode ? (
          <span className="ml-2 text-sm text-navy-mid">{grouping.courseCode}</span>
        ) : null}
      </p>
      <p className="mt-1 text-sm text-navy-mid">
        {grouping.method === "code_near"
          ? "Its code is one letter away from another subject."
          : grouping.method === "name_fuzzy"
            ? "No course code — matched by name."
            : "No course code found."}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className={cn(buttonBase, buttonOutline, "px-5 py-2")}
        >
          Keep as its own subject
        </button>
        {grouping.mergeTargets.map((t) => (
          <button
            key={t.subjectId}
            type="button"
            disabled={busy}
            onClick={() => onMerge(t.subjectId)}
            className={cn(buttonBase, buttonOutline, "px-5 py-2")}
          >
            Merge with {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ManualEntryCard({
  failure,
  busy,
  onSubmit,
}: {
  failure: ReviewParseFailure;
  busy: boolean;
  onSubmit: (title: string, code: string | null, items: ManualItemInput[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [rows, setRows] = useState<ManualItemInput[]>([
    { label: "", weight: null, dueDate: null, deliverable: null },
  ]);

  function update(i: number, patch: Partial<ManualItemInput>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  return (
    <div className="rounded-xl border border-ink/10 bg-paper p-5">
      <div className="flex items-center justify-between gap-4">
        <p className="min-w-0 truncate text-sm text-ink">{failure.filename}</p>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(buttonBase, buttonOutline, "shrink-0 px-5 py-2")}
        >
          {open ? "Close" : "Fill in manually"}
        </button>
      </div>

      {open ? (
        <div className="mt-5 flex flex-col gap-3 border-t border-ink/10 pt-5">
          <div className="flex flex-wrap gap-3">
            <input
              placeholder="Subject title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 rounded-lg border border-ink/20 bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
            />
            <input
              placeholder="Course code (optional)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-48 rounded-lg border border-ink/20 bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
            />
          </div>
          {rows.map((r, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <input
                placeholder="Assessment (e.g. CIA I)"
                value={r.label}
                onChange={(e) => update(i, { label: e.target.value })}
                className="min-w-[10rem] flex-1 rounded-lg border border-ink/20 bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
              />
              <input
                type="number"
                placeholder="%"
                value={r.weight ?? ""}
                onChange={(e) =>
                  update(i, {
                    weight: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-20 rounded-lg border border-ink/20 bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
              />
              <input
                type="date"
                value={r.dueDate ?? ""}
                onChange={(e) => update(i, { dueDate: e.target.value || null })}
                className="rounded-lg border border-ink/20 bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
              />
              <input
                placeholder="Deliverable"
                value={r.deliverable ?? ""}
                onChange={(e) =>
                  update(i, { deliverable: e.target.value || null })
                }
                className="min-w-[8rem] flex-1 rounded-lg border border-ink/20 bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
              />
            </div>
          ))}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setRows((p) => [
                  ...p,
                  { label: "", weight: null, dueDate: null, deliverable: null },
                ])
              }
              className="text-sm text-navy-mid underline decoration-gold underline-offset-4"
            >
              + Add another
            </button>
            <button
              type="button"
              disabled={busy || !title.trim()}
              onClick={() => onSubmit(title, code || null, rows)}
              className={cn(buttonBase, buttonPrimary, "px-5 py-2")}
            >
              Save subject
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
