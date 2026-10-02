import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost";
const base =
  "inline-flex items-center justify-center gap-2 rounded-xl px-5 min-h-11 text-sm font-semibold transition-all disabled:opacity-50 disabled:pointer-events-none";
const variants: Record<Variant, string> = {
  primary: "bg-brand text-brand-ink shadow-[0_6px_16px_-6px_var(--brand)] hover:bg-brand-hover hover:shadow-[0_10px_22px_-8px_var(--brand)]",
  secondary: "border border-line bg-surface text-ink hover:border-brand hover:text-brand",
  ghost: "text-ink hover:bg-surface-2",
};

export const buttonClass = (variant: Variant = "primary", extra = "") =>
  `${base} ${variants[variant]} ${extra}`;

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button type="button" className={buttonClass(variant, className)} {...props} />;
}

/** Locale-aware link styled as a button (uses next-intl Link from the caller). */
export function ButtonLink({ variant = "primary", className = "", ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}
