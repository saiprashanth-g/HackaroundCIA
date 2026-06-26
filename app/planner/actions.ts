"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { statusForDate } from "@/lib/assembly/dates";

/** Toggle an item done (user-set). Un-done re-derives status from its date. */
export async function setItemDone(
  itemId: string,
  done: boolean,
): Promise<{ ok: boolean }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };

  if (done) {
    await supabase
      .from("assessment_items")
      .update({ status: "done" })
      .eq("id", itemId);
  } else {
    const { data } = await supabase
      .from("assessment_items")
      .select("resolved_due_date")
      .eq("id", itemId)
      .single();
    await supabase
      .from("assessment_items")
      .update({ status: statusForDate(data?.resolved_due_date ?? null) })
      .eq("id", itemId);
  }
  return { ok: true };
}
