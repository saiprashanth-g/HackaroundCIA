/**
 * Runtime RLS isolation proof — exercises the REAL code path (anon Supabase
 * sessions), not SQL role simulation. Run after wiring Supabase + enabling
 * anonymous sign-ins:
 *
 *   node --env-file=.env.local scripts/verify-rls.mjs
 *
 * It signs in two independent anonymous users (A, B), has A insert a private
 * `terms` row, then proves B cannot read / update / delete it, and that A can.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.error(
    "✗ Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
  process.exit(1);
}

const mk = () =>
  createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });

const A = mk();
const B = mk();
const checks = [];
const record = (name, pass, detail = "") =>
  checks.push({ name, pass, detail });

async function main() {
  const a = await A.auth.signInAnonymously();
  const b = await B.auth.signInAnonymously();
  if (a.error || b.error) {
    console.error(
      "✗ Anonymous sign-in failed. Enable 'Allow anonymous sign-ins' in Supabase Auth settings.",
      a.error?.message || b.error?.message,
    );
    process.exit(1);
  }
  console.log("• Signed in two anonymous users:", a.data.user.id, b.data.user.id);

  // A inserts a private row.
  const marker = `rls-test-${Date.now()}`;
  const ins = await A.from("terms").insert({ name: marker }).select().single();
  if (ins.error) {
    console.error("✗ A could not insert its own row:", ins.error.message);
    process.exit(1);
  }
  const termId = ins.data.id;
  record("A can insert own row", true);

  // B must NOT read it.
  const bRead = await B.from("terms").select("*").eq("id", termId);
  record("B cannot read A's row", (bRead.data?.length ?? 0) === 0,
    `rows=${bRead.data?.length ?? 0}`);

  // B must NOT update it (RLS → 0 rows affected).
  const bUpd = await B.from("terms").update({ name: "hacked" }).eq("id", termId).select();
  record("B cannot update A's row", (bUpd.data?.length ?? 0) === 0,
    `rows=${bUpd.data?.length ?? 0}`);

  // B must NOT delete it.
  const bDel = await B.from("terms").delete().eq("id", termId).select();
  record("B cannot delete A's row", (bDel.data?.length ?? 0) === 0,
    `rows=${bDel.data?.length ?? 0}`);

  // A CAN read its own row, and it's unchanged.
  const aRead = await A.from("terms").select("*").eq("id", termId).single();
  record("A can read own row", !aRead.error && aRead.data?.name === marker,
    aRead.data ? `name=${aRead.data.name}` : aRead.error?.message);

  // cleanup
  await A.from("terms").delete().eq("id", termId);

  console.log("\n── RLS isolation results ──");
  let allPass = true;
  for (const c of checks) {
    allPass &&= c.pass;
    console.log(`${c.pass ? "✓" : "✗"} ${c.name}${c.detail ? `  (${c.detail})` : ""}`);
  }
  console.log(allPass ? "\n✅ PASS — user isolation holds." : "\n❌ FAIL — isolation breach.");
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error("✗ Unexpected error:", e);
  process.exit(1);
});
