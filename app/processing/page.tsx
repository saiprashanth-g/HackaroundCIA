import AnonSessionGate from "@/components/AnonSessionGate";
import { FunnelTopBar } from "@/components/ui/FunnelTopBar";
import ProcessingClient from "@/components/processing/ProcessingClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata = { title: "Building your planner · HackaroundCIA" };

export default async function ProcessingPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;

  let docs: { id: string; filename: string }[] = [];
  if (isSupabaseConfigured && t) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { data } = await supabase
        .from("documents")
        .select("id, original_filename")
        .eq("term_id", t);
      docs = (data ?? []).map((d) => ({
        id: d.id,
        filename: d.original_filename,
      }));
    }
  }

  return (
    <>
      <AnonSessionGate />
      <FunnelTopBar />
      <ProcessingClient termId={t ?? null} initialDocs={docs} />
    </>
  );
}
