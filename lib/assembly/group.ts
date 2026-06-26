import { codeKeyOf, isGTokenVariant, similarity } from "@/lib/assembly/normalize";
import type { DocForGrouping, GroupResult } from "@/lib/assembly/types";

const NAME_FUZZY_THRESHOLD = 0.8;

function pickTitle(ds: DocForGrouping[]): string | null {
  const titles = ds
    .map((d) => d.title)
    .filter((t): t is string => Boolean(t));
  if (!titles.length) return null;
  return titles.sort((a, b) => b.length - a.length)[0];
}

/**
 * Group documents into candidate subjects. Grouping key is the course code.
 *
 *  - **Exact code match** → silent merge (`code_exact`, confidence 1).
 *  - **G-token near match** (MPR vs MPRG) → kept SEPARATE and flagged
 *    `code_near` for one-tap confirm. Never auto-merged.
 *  - **No code** → its own group, flagged for confirm; if its title closely
 *    matches a coded subject it's hinted as `name_fuzzy`, else `none`.
 */
export function groupDocuments(docs: DocForGrouping[]): GroupResult[] {
  const buckets = new Map<string, DocForGrouping[]>();
  const noCode: DocForGrouping[] = [];

  for (const d of docs) {
    const key = codeKeyOf(d.codeField, d.codeTitle);
    if (key) {
      const arr = buckets.get(key);
      if (arr) arr.push(d);
      else buckets.set(key, [d]);
    } else {
      noCode.push(d);
    }
  }

  const keys = [...buckets.keys()];

  // G-token near pairs (don't merge — just flag).
  const nearOf = new Map<string, string>();
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      if (isGTokenVariant(keys[i], keys[j])) {
        nearOf.set(keys[i], keys[j]);
        nearOf.set(keys[j], keys[i]);
      }
    }
  }

  const groups: GroupResult[] = [];

  for (const key of keys) {
    const ds = buckets.get(key)!;
    const near = nearOf.get(key);
    groups.push({
      courseCode: key,
      title: pickTitle(ds),
      programClass: ds.find((d) => d.programClass)?.programClass ?? null,
      documentIds: ds.map((d) => d.documentId),
      groupingMethod: near ? "code_near" : "code_exact",
      groupingConfidence: near ? 0.6 : 1,
      needsConfirm: Boolean(near),
      note: near
        ? `Possibly the same subject as ${near} — confirm or keep separate.`
        : null,
    });
  }

  for (const d of noCode) {
    let bestSim = 0;
    let bestTitle: string | null = null;
    for (const g of groups) {
      if (!g.title || !d.title) continue;
      const s = similarity(d.title, g.title);
      if (s > bestSim) {
        bestSim = s;
        bestTitle = g.title;
      }
    }
    const fuzzy = bestSim >= NAME_FUZZY_THRESHOLD && bestTitle !== null;
    groups.push({
      courseCode: null,
      title: d.title,
      programClass: d.programClass,
      documentIds: [d.documentId],
      groupingMethod: fuzzy ? "name_fuzzy" : "none",
      groupingConfidence: fuzzy ? Number(bestSim.toFixed(2)) : 0.3,
      needsConfirm: true,
      note: fuzzy
        ? `No course code — looks like "${bestTitle}". Confirm grouping.`
        : "No course code found — confirm this subject.",
    });
  }

  return groups;
}
