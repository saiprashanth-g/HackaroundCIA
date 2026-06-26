import { createElement } from "react";
import { type NextRequest } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { PlannerPdf } from "@/lib/pdf/PlannerPdf";
import { buildPlannerPayload } from "@/lib/planner/load";
import { demoPlanner } from "@/lib/planner/demoData";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const demo = searchParams.get("demo") === "1";
  const t = searchParams.get("t");

  const payload = demo
    ? demoPlanner
    : t
      ? await buildPlannerPayload(t)
      : null;
  if (!payload) {
    return new Response("Planner not found.", { status: 404 });
  }

  const element = createElement(PlannerPdf, { payload }) as ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);

  const safeName = payload.termName.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="HackaroundCIA-${safeName}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
