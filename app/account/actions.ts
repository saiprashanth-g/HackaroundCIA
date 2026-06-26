"use server";

import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";

type ServerClient = NonNullable<
  Awaited<ReturnType<typeof createSupabaseServerClient>>
>;

// Order matters for the RLS fallback: children before parents.
const DELETE_ORDER = [
  "subjects", // cascades assessment_items, item_values, subject_documents
  "documents",
  "user_overrides",
  "extraction_log",
  "terms",
] as const;

const EXPORT_TABLES = [
  "terms",
  "documents",
  "subjects",
  "subject_documents",
  "assessment_items",
  "item_values",
  "user_overrides",
  "extraction_log",
] as const;

async function purgeUserStorage(supabase: ServerClient, uid: string) {
  const bucket = supabase.storage.from("raw-uploads");
  const { data: folders } = await bucket.list(uid, { limit: 1000 });
  const paths: string[] = [];
  for (const folder of folders ?? []) {
    const { data: files } = await bucket.list(`${uid}/${folder.name}`, {
      limit: 1000,
    });
    for (const f of files ?? []) paths.push(`${uid}/${folder.name}/${f.name}`);
  }
  if (paths.length) await bucket.remove(paths);
}

/** DPDP: export everything we hold about the user as a JSON object. */
export async function exportMyData(): Promise<{
  ok: boolean;
  data?: Record<string, unknown>;
  message?: string;
}> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Not configured." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "No session found." };

  const out: Record<string, unknown> = {
    account: {
      id: user.id,
      email: user.email ?? null,
      is_anonymous: user.is_anonymous ?? !user.email,
      created_at: user.created_at,
    },
    exported_at: new Date().toISOString(),
  };
  for (const t of EXPORT_TABLES) {
    const { data } = await supabase.from(t).select("*");
    out[t] = data ?? [];
  }
  return { ok: true, data: out };
}

/**
 * DPDP: delete everything for the user, including the linked email/account.
 * Removes storage objects, then deletes the auth user (service role) which
 * cascades all rows. Without the service-role key, falls back to deleting rows
 * via RLS and signing out.
 */
export async function deleteMyData(): Promise<{
  ok: boolean;
  accountDeleted?: boolean;
  message?: string;
}> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Not configured." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "No session found." };

  await purgeUserStorage(supabase, user.id);

  const admin = createSupabaseAdminClient();
  if (admin) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) return { ok: false, message: error.message };
    await supabase.auth.signOut();
    return { ok: true, accountDeleted: true };
  }

  // Fallback: RLS-scoped row deletion (can't remove the auth account itself).
  for (const t of DELETE_ORDER) {
    await supabase.from(t).delete().not("id", "is", null);
  }
  await supabase.auth.signOut();
  return {
    ok: true,
    accountDeleted: false,
    message:
      "Your data was deleted. Removing the account record itself needs the service-role key.",
  };
}
