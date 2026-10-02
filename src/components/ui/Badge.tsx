import { useTranslations } from "next-intl";

export function VerifiedBadge() {
  const t = useTranslations("businesses");
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">
      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7" /></svg>
      {t("verified")}
    </span>
  );
}

export function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-xs text-muted">{children}</span>;
}
