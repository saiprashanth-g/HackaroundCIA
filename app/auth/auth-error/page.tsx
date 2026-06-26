import Link from "next/link";
import { FunnelTopBar } from "@/components/ui/FunnelTopBar";

export const metadata = { title: "Sign-in link issue · HackaroundCIA" };

export default function AuthErrorPage() {
  return (
    <>
      <FunnelTopBar />
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-8 text-center">
        <h1 className="font-serif text-3xl text-ink">That link didn&rsquo;t work</h1>
        <p className="max-w-md text-navy-mid">
          Your sign-in link may have expired or already been used. Head back to
          your planner and request a fresh one.
        </p>
        <Link
          href="/"
          className="text-sm text-navy-mid underline decoration-gold underline-offset-4"
        >
          Back to start →
        </Link>
      </main>
    </>
  );
}
