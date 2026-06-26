import type { ItemStatus } from "@/lib/supabase/database.types";

/** Resolve a 1-based week number to an ISO date using the term's week-1 start. */
export function resolveWeekDate(
  week: number,
  week1Start: string | null,
): string | null {
  if (!week1Start) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(week1Start);
  if (!m) return null;
  // UTC arithmetic so the result is timezone-stable (no off-by-one across IST).
  const base = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(base + (week - 1) * 7 * 86_400_000);
  return d.toISOString().slice(0, 10);
}

const URGENT_WINDOW_DAYS = 7;

/**
 * Status from a resolved date. `done` is user-set only (never derived here).
 * No resolvable date → `needs_input` (rendered distinctly — never a false
 * `later`). Overdue or within a week → `urgent`; otherwise `later`.
 */
export function statusForDate(resolvedDate: string | null): ItemStatus {
  if (!resolvedDate) return "needs_input";
  const due = new Date(`${resolvedDate}T23:59:59`);
  if (Number.isNaN(due.getTime())) return "needs_input";
  const days = (due.getTime() - Date.now()) / 86_400_000;
  return days <= URGENT_WINDOW_DAYS ? "urgent" : "later";
}
