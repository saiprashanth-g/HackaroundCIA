/** Pure helpers for grouping + reconciliation. No I/O. */

export function normalizeCode(s: string | null): string | null {
  if (!s) return null;
  const c = s.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  return c.length ? c : null;
}

/** Authoritative key: the explicit code field wins over a code in the title. */
export function codeKeyOf(
  codeField: string | null,
  codeTitle: string | null,
): string | null {
  return normalizeCode(codeField) ?? normalizeCode(codeTitle);
}

/** True iff `long` is `short` with exactly one extra 'G' inserted. */
function isSingleGInsertion(short: string, long: string): boolean {
  if (long.length !== short.length + 1) return false;
  let i = 0;
  let j = 0;
  let skipped = false;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i++;
      j++;
    } else {
      if (skipped || long[j] !== "G") return false;
      skipped = true;
      j++;
    }
  }
  if (j < long.length) {
    if (long[j] !== "G") return false;
    j++;
  }
  return true;
}

/**
 * MPR502-3 vs MPRG502-3 — codes that differ only by the "G" token. Ambiguous;
 * NEVER auto-resolve — always route to Screen 3.
 */
export function isGTokenVariant(a: string, b: string): boolean {
  if (a === b) return false;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  return isSingleGInsertion(s, l);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** 0..1 similarity by normalized Levenshtein. */
export function similarity(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (!s1 && !s2) return 1;
  if (!s1 || !s2) return 0;
  return 1 - levenshtein(s1, s2) / Math.max(s1.length, s2.length);
}

const ROMAN: Record<string, string> = {
  i: "1",
  ii: "2",
  iii: "3",
  iv: "4",
  v: "5",
  vi: "6",
};

/** Normalize an assessment label for cross-document matching. */
export function normalizeLabel(s: string): string {
  const base = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return base
    .split(" ")
    .map((t) => ROMAN[t] ?? t)
    .join(" ");
}
