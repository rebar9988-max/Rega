import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "./EmptyState";

export function Grid({ children }: { children: ReactNode }) {
  return <div className="container-page grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

export async function NoResults() {
  const t = await getTranslations();
  return <div className="container-page"><EmptyState title={t("common.empty")} body={t("list.emptyHint")} /></div>;
}

/** Route-level skeleton: same grid as the real page, so nothing jumps when data arrives. */
export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="container-page grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => <div key={i} className="h-36 animate-pulse rounded-[var(--radius-card)] border border-line bg-surface-2" />)}
    </div>
  );
}
