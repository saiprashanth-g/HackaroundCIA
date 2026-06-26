import Link from "next/link";
import AnonSessionGate from "@/components/AnonSessionGate";
import { FunnelTopBar } from "@/components/ui/FunnelTopBar";
import PlannerClient from "@/components/planner/PlannerClient";
import { buildPlannerPayload } from "@/lib/planner/load";
import { demoPlanner } from "@/lib/planner/demoData";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata = { title: "Your planner · HackaroundCIA" };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AnonSessionGate />
      <FunnelTopBar />
      {children}
    </>
  );
}

function NotReady() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-8 text-center">
      <h1 className="font-serif text-3xl text-ink">Your planner isn&rsquo;t ready</h1>
      <p className="max-w-md text-navy-mid">
        Upload your course plans and confirm them, and your planner will appear
        here.
      </p>
      <Link
        href="/upload"
        className="text-sm text-navy-mid underline decoration-gold underline-offset-4"
      >
        Start with upload →
      </Link>
    </main>
  );
}

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; demo?: string }>;
}) {
  const { t, demo } = await searchParams;

  if (demo === "1") {
    return (
      <Shell>
        <PlannerClient payload={demoPlanner} demo exportId="demo" />
      </Shell>
    );
  }

  if (!isSupabaseConfigured || !t) {
    return (
      <Shell>
        <NotReady />
      </Shell>
    );
  }

  const payload = await buildPlannerPayload(t);
  if (!payload) {
    return (
      <Shell>
        <NotReady />
      </Shell>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null } };
  const userEmail = userData.user?.email ?? null;

  return (
    <Shell>
      <PlannerClient payload={payload} exportId={t} userEmail={userEmail} />
    </Shell>
  );
}
