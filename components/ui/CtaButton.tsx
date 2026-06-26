import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { buttonBase, buttonOutline, buttonPrimary } from "@/lib/buttonStyles";

type Variant = "primary" | "outline";
const variants: Record<Variant, string> = {
  primary: buttonPrimary,
  outline: buttonOutline,
};

export function CtaButton({
  href,
  variant = "primary",
  className,
  children,
  ...rest
}: { href: string; variant?: Variant } & ComponentProps<typeof Link>) {
  return (
    <Link
      href={href}
      className={cn(buttonBase, variants[variant], className)}
      {...rest}
    >
      {children}
    </Link>
  );
}
