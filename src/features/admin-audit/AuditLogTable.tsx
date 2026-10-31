import { formatDate, type Locale } from "@/i18n/locales";
import { Ltr } from "@/components/ui/Bidi";

export type AuditRow = { id: string; actorEmail: string | null; action: string; entity: string; entityId: string | null; createdAt: Date };

/**
 * Audit-trail table of the admin dashboard. Presentational only: the page loads the rows (requireDr("audit.read"))
 * and passes the column labels. Identifiers stay left-to-right inside RTL pages.
 */
export function AuditLogTable({ rows, locale, labels, empty }: {
  rows: AuditRow[]; locale: Locale; empty: string;
  labels: { time: string; actor: string; action: string; entity: string };
}) {
  if (rows.length === 0) return <p className="text-muted" data-testid="audit-empty">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface" data-testid="audit-table">
      <table className="w-full min-w-[40rem] text-start text-sm">
        <thead className="bg-surface-2 text-muted">
          <tr>{(["time", "actor", "action", "entity"] as const).map((c) => <th key={c} scope="col" className="px-4 py-3 text-start font-semibold">{labels[c]}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap px-4 py-3">{formatDate(r.createdAt, locale, { dateStyle: "medium", timeStyle: "short" })}</td>
              <td className="px-4 py-3"><Ltr>{r.actorEmail ?? "—"}</Ltr></td>
              <td className="px-4 py-3"><span className="inline-flex rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-text"><Ltr>{r.action}</Ltr></span></td>
              <td className="px-4 py-3"><Ltr>{r.entity}{r.entityId ? `:${r.entityId.slice(0, 8)}` : ""}</Ltr></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
