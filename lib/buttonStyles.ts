/** Shared button styling so links (CtaButton) and <button>s look identical. */
export const buttonBase =
  "group inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-medium tracking-wide transition-[transform,box-shadow,opacity,border-color] duration-300 will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

export const buttonPrimary =
  "bg-ink text-paper shadow-[0_10px_30px_-12px_rgba(20,33,61,0.6)] hover:-translate-y-0.5 hover:shadow-[0_18px_42px_-14px_rgba(20,33,61,0.7)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:translate-y-0";

export const buttonOutline =
  "border border-ink/25 text-ink hover:-translate-y-0.5 hover:border-ink/45 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0";
