import type { PlannerPayload } from "@/lib/planner/types";

/**
 * Sample reconciled data used ONLY for visual QA at `/planner?demo=1`. The real
 * planner is populated entirely from the student's uploads — this never feeds
 * the real data path. Dates are set relative to mid-2026 to exercise every
 * status (urgent / later / done / needs_input).
 */
export const demoPlanner: PlannerPayload = {
  termId: "demo",
  termName: "Demo · Trimester II",
  subjects: [
    {
      id: "s1",
      title: "Research Methodology",
      courseCode: "MPR502-3",
      programClass: "MSc Psychology",
      readingLists: [
        {
          unit_or_module: "Unit 1 — Foundations",
          references: [
            "Kerlinger & Lee (2000), Foundations of Behavioral Research",
            "Creswell (2014), Research Design",
          ],
        },
      ],
      items: [
        {
          id: "i1",
          label: "CIA I — Research proposal",
          weight: 20,
          dueDate: "2026-06-30",
          dueDateType: "calendar_date",
          deliverable: "A 1500-word proposal with a clear research question.",
          status: "urgent",
          resolutionStatus: "user_confirmed",
          criteria: [
            { text: "Clarity of research question", marks: 8 },
            { text: "Literature grounding", marks: 7 },
            { text: "Feasibility", marks: 5 },
          ],
          mappedCos: ["CO1", "CO2"],
        },
        {
          id: "i2",
          label: "CIA II — Methods critique",
          weight: 30,
          dueDate: "2026-07-20",
          dueDateType: "calendar_date",
          deliverable: "Critique two published studies' methodology.",
          status: "later",
          resolutionStatus: "auto",
          criteria: [{ text: "Depth of critique", marks: 18 }],
          mappedCos: ["CO3"],
        },
        {
          id: "i3",
          label: "End-Semester Exam",
          weight: 50,
          dueDate: null,
          dueDateType: "unknown",
          deliverable: null,
          status: "needs_input",
          resolutionStatus: "auto",
          criteria: [],
          mappedCos: [],
        },
      ],
    },
    {
      id: "s2",
      title: "Cognitive Psychology",
      courseCode: "PSY531-2",
      programClass: "MSc Psychology",
      readingLists: [
        {
          unit_or_module: null,
          references: ["Goldstein (2018), Cognitive Psychology, 5th ed."],
        },
      ],
      items: [
        {
          id: "i4",
          label: "CIA I A — Reflective journal",
          weight: 10,
          dueDate: "2026-06-18",
          dueDateType: "calendar_date",
          deliverable: "Weekly reflections on attention & memory readings.",
          status: "done",
          resolutionStatus: "user_confirmed",
          criteria: [{ text: "Consistency & insight", marks: 10 }],
          mappedCos: ["CO1"],
        },
        {
          id: "i5",
          label: "CIA I B — Experiment report",
          weight: 15,
          dueDate: "2026-07-01",
          dueDateType: "calendar_date",
          deliverable: "Report a Stroop-task replication (APA format).",
          status: "urgent",
          resolutionStatus: "user_confirmed",
          criteria: [
            { text: "Method & analysis", marks: 9 },
            { text: "APA formatting", marks: 6 },
          ],
          mappedCos: ["CO2", "CO4"],
        },
        {
          id: "i6",
          label: "Term Paper",
          weight: 25,
          dueDate: "2026-08-14",
          dueDateType: "calendar_date",
          deliverable: "3000-word review on a cognitive phenomenon.",
          status: "later",
          resolutionStatus: "auto",
          criteria: [],
          mappedCos: ["CO5"],
        },
      ],
    },
    {
      id: "s3",
      title: "Statistics for Psychology",
      courseCode: null,
      programClass: "MSc Psychology",
      readingLists: [],
      items: [
        {
          id: "i7",
          label: "Lab Record",
          weight: 20,
          dueDate: "2026-07-09",
          dueDateType: "week_number",
          deliverable: "JASP outputs for weeks 1–6, annotated.",
          status: "later",
          resolutionStatus: "auto",
          criteria: [{ text: "Correct analyses", marks: 12 }],
          mappedCos: [],
        },
        {
          id: "i8",
          label: "Viva Voce",
          weight: 10,
          dueDate: null,
          dueDateType: "unknown",
          deliverable: "Oral defense of your lab record.",
          status: "needs_input",
          resolutionStatus: "auto",
          criteria: [],
          mappedCos: [],
        },
      ],
    },
  ],
};
