import Link from "next/link";
import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "font-serif text-lg tracking-tight text-ink transition-opacity hover:opacity-80",
        className,
      )}
    >
      Hackaround<span className="text-gold">CIA</span>
    </Link>
  );
}
