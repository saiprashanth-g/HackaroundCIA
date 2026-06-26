import Link from "next/link";
import { Wordmark } from "@/components/ui/Wordmark";

/** Thin sticky bar for the inner funnel screens (upload → review → planner). */
export function FunnelTopBar() {
  return (
    <div className="sticky top-0 z-20 border-b border-ink/5 bg-paper/80 backdrop-blur">
      <div className="mx-auto flex max-w-canvas items-center justify-between px-8 py-5">
        <Wordmark />
        <Link
          href="/account"
          className="text-[11px] uppercase tracking-[0.28em] text-navy-mid/60 transition-colors hover:text-ink"
        >
          Your data
        </Link>
      </div>
    </div>
  );
}
