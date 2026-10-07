import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { EmptyState } from "./EmptyState";
import { buttonClass } from "./Button";

export function Grid({ children }: { children: ReactNode }) {
  return <div className="container-page grid grid-cols-1 gap-3">{children}</div>;
}

/**
 * Empty list. Without filters nothing is published yet: invite the first business (free listing). With filters the
 * result is just empty: say so, and still offer the way in.
 */
export async function NoResults({ filtered = false }: { filtered?: boolean }) {
  const t = await getTranslations();
  return (
    <div className="container-page">
      <EmptyState
        title={filtered ? t("common.empty") : t("empty.beFirstTitle")}
        body={filtered ? t("empty.tryOther") : t("empty.beFirstBody")}
        action={<Link href="/for-business" className={buttonClass("primary")} data-testid="be-first-cta">{t("empty.beFirstCta")}</Link>}
      />
    </div>
  );
}

/** Route-level skeleton: same grid as the real page, so nothing jumps when data arrives. */
export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="container-page grid grid-cols-1 gap-3" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => <div key={i} className="h-36 animate-pulse rounded-[var(--radius-card)] border border-line bg-surface-2" />)}
    </div>
  );
}
