import Link from "next/link";
import AnonSessionGate from "@/components/AnonSessionGate";
import { FunnelTopBar } from "@/components/ui/FunnelTopBar";
import { StepHeader } from "@/components/ui/StepHeader";
import ReviewClient from "@/components/review/ReviewClient";
import { buildReviewPayload } from "@/lib/review/load";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata = { title: "Review · HackaroundCIA" };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AnonSessionGate />
      <FunnelTopBar />
      <main className="mx-auto max-w-canvas px-8 pb-28 pt-16">{children}</main>
    </>
  );
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;

  if (!isSupabaseConfigured) {
    return (
      <Shell>
        <StepHeader
          step={2}
          total={3}
          label="Confirm"
          title="Review needs Supabase"
          sub="Connect Supabase in .env.local to load your extracted documents and reconcile them here."
        />
      </Shell>
    );
  }

  if (!t) {
    return (
      <Shell>
        <StepHeader
          step={2}
          total={3}
          label="Confirm"
          title="No planner in progress"
          sub="Start by uploading your course plans."
        />
        <Link
          href="/upload"
          className="mt-6 inline-block text-sm text-navy-mid underline decoration-gold underline-offset-4"
        >
          Go to upload →
        </Link>
      </Shell>
    );
  }

  const payload = await buildReviewPayload(t);
  if (!payload) {
    return (
      <Shell>
        <StepHeader
          step={2}
          total={3}
          label="Confirm"
          title="We couldn't find that planner"
          sub="It may have been deleted, or belongs to another session."
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <StepHeader
        step={2}
        total={3}
        label="Confirm"
        title="A few things only you can decide"
        sub="We've reconciled what we could. These are the calls that need a human — fast, one tap each."
      />
      <div className="mt-12">
        <ReviewClient payload={payload} />
      </div>
    </Shell>
  );
}
