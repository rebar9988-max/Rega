import Link from "next/link";
import type { AuditFilters as Filters } from "./filters";

/**
 * Filter bar for /dr/audit: a plain GET form (works without JavaScript; the URL is shareable). Values are validated
 * again on the server by parseAuditFilters. REGA red only for the primary button.
 */
export function AuditFilters({ value, labels }: { value: Filters; labels: { action: string; entity: string; actor: string; apply: string; reset: string } }) {
  const field = "min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10";
  return (
    <form method="get" action="/dr/audit" className="mb-4 grid gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:grid-cols-[1fr_1fr_1fr_auto]" data-testid="audit-filters">
      <label className="flex flex-col gap-1 text-xs font-semibold text-muted">{labels.action}
        <input name="action" dir="ltr" maxLength={64} defaultValue={value.action} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-muted">{labels.entity}
        <input name="entity" dir="ltr" maxLength={64} defaultValue={value.entity} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-muted">{labels.actor}
        <input name="actor" type="search" dir="ltr" maxLength={120} defaultValue={value.actor} className={field} />
      </label>
      <div className="flex items-end gap-2">
        <button type="submit" className="min-h-11 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-ink hover:bg-brand-hover">{labels.apply}</button>
        <Link href="/dr/audit" className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-semibold hover:border-brand hover:text-brand-text">{labels.reset}</Link>
      </div>
    </form>
  );
}
