import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { PlannerItem, PlannerPayload } from "@/lib/planner/types";
import type { ItemStatus } from "@/lib/supabase/database.types";

const C = {
  ink: "#14213D",
  navy: "#2D4373",
  paper: "#FBF8F2",
  gold: "#E3B873",
  hair: "#E7DFCB",
  white: "#FFFFFF",
};

const STATUS_LABEL: Record<ItemStatus, string> = {
  urgent: "URGENT",
  later: "LATER",
  done: "DONE",
  needs_input: "NEEDS A DATE",
};

const STATUS_BG: Record<ItemStatus, string> = {
  urgent: "rgba(226,150,124,0.33)",
  later: "rgba(168,190,224,0.40)",
  done: "rgba(168,203,174,0.50)",
  needs_input: "rgba(140,133,118,0.28)",
};

function fmt(iso: string | null): string {
  if (!iso) return "Date to confirm";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const s = StyleSheet.create({
  page: {
    backgroundColor: C.paper,
    paddingVertical: 48,
    paddingHorizontal: 54,
    fontFamily: "Helvetica",
    color: C.ink,
  },
  kicker: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    letterSpacing: 2,
    color: C.navy,
  },
  title: { fontFamily: "Times-Bold", fontSize: 26, marginTop: 8 },
  rule: { height: 2, backgroundColor: C.gold, width: 84, marginTop: 14 },
  sub: { fontSize: 11, color: C.navy, marginTop: 10 },
  subject: {
    marginTop: 22,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: C.hair,
  },
  subjectTitle: { fontFamily: "Times-Bold", fontSize: 16 },
  subjectMeta: { fontSize: 9, color: C.navy, marginTop: 2 },
  item: {
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: C.hair,
    borderRadius: 6,
    backgroundColor: C.white,
  },
  pill: {
    alignSelf: "flex-start",
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    letterSpacing: 1,
    color: C.ink,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  itemLabel: { fontFamily: "Times-Bold", fontSize: 13, marginTop: 6 },
  meta: { fontSize: 9, color: C.navy, marginTop: 4 },
  deliverable: { fontSize: 10, color: C.navy, marginTop: 6, lineHeight: 1.4 },
  critHead: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    letterSpacing: 1,
    color: C.navy,
    marginTop: 8,
  },
  crit: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 9,
    marginTop: 3,
  },
  reading: { fontSize: 9, color: C.navy, marginTop: 8, lineHeight: 1.4 },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 54,
    right: 54,
    fontSize: 8,
    color: C.navy,
    textAlign: "center",
  },
});

function ItemBlock({ item }: { item: PlannerItem }) {
  const meta = [
    fmt(item.dueDate),
    item.weight != null ? `Weightage ${item.weight}%` : null,
    item.mappedCos.length ? item.mappedCos.join(" · ") : null,
  ]
    .filter(Boolean)
    .join("      ");

  return (
    <View style={s.item} wrap={false}>
      <Text style={[s.pill, { backgroundColor: STATUS_BG[item.status] }]}>
        {STATUS_LABEL[item.status]}
      </Text>
      <Text style={s.itemLabel}>{item.label}</Text>
      <Text style={s.meta}>{meta}</Text>
      {item.deliverable ? (
        <Text style={s.deliverable}>{item.deliverable}</Text>
      ) : null}
      {item.criteria.length > 0 ? (
        <View>
          <Text style={s.critHead}>HOW IT&apos;S MARKED</Text>
          {item.criteria.map((c, i) => (
            <View key={i} style={s.crit}>
              <Text>{c.text}</Text>
              <Text>{c.marks != null ? String(c.marks) : ""}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function PlannerPdf({ payload }: { payload: PlannerPayload }) {
  return (
    <Document title={`HackaroundCIA — ${payload.termName}`} author="HackaroundCIA">
      <Page size="A4" style={s.page}>
        <Text style={s.kicker}>HACKAROUNDCIA · CIA SURVIVAL GUIDE</Text>
        <Text style={s.title}>{payload.termName}</Text>
        <View style={s.rule} />
        <Text style={s.sub}>What&apos;s due, when, and how to prepare.</Text>

        {payload.subjects.map((subj) => (
          <View key={subj.id} style={s.subject} wrap={false}>
            <Text style={s.subjectTitle}>{subj.title}</Text>
            <Text style={s.subjectMeta}>
              {[subj.courseCode, subj.programClass].filter(Boolean).join("   ·   ")}
            </Text>
            {subj.items.map((it) => (
              <ItemBlock key={it.id} item={it} />
            ))}
            {subj.readingLists.length > 0 ? (
              <Text style={s.reading}>
                Reading:{" "}
                {subj.readingLists.flatMap((r) => r.references).join("; ")}
              </Text>
            ) : null}
          </View>
        ))}

        <Text
          style={s.footer}
          render={({ pageNumber, totalPages }) =>
            `HackaroundCIA · generated ${new Date().toLocaleDateString("en-IN")} · page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
