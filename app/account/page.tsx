import AnonSessionGate from "@/components/AnonSessionGate";
import { FunnelTopBar } from "@/components/ui/FunnelTopBar";
import AccountClient from "@/components/account/AccountClient";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata = { title: "Your data · HackaroundCIA" };

export default function AccountPage() {
  return (
    <>
      <AnonSessionGate />
      <FunnelTopBar />
      <main className="mx-auto max-w-canvas px-8 pb-28 pt-16">
        <header className="max-w-2xl">
          <p className="mb-5 text-xs font-medium uppercase tracking-[0.3em] text-navy-mid">
            Privacy <span className="text-gold">&middot;</span> DPDP Act 2023
          </p>
          <h1 className="font-serif text-4xl leading-tight tracking-tightish text-ink sm:text-5xl">
            Your data, your call
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-navy-mid">
            We delete your raw uploaded files the moment you confirm a plan. Your
            reconciled planner stays only as long as you want it — take it with
            you, or wipe it entirely, whenever you like.
          </p>
        </header>
        <div className="mt-12">
          <AccountClient configured={isSupabaseConfigured} />
        </div>
      </main>
    </>
  );
}
