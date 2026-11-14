import { getTranslations } from "next-intl/server";
import { effectiveStatus } from "./rules";

const STATUS_KEY = { open: "statusOpen", closed: "statusClosed", cancelled: "statusCancelled", expired: "statusExpired" } as const;

/** Request status as text + shape, never colour alone. */
export async function StatusBadge({ row }: { row: { status: string; expiresAt: Date } }) {
  const t = await getTranslations("smartRequest");
  const status = effectiveStatus(row);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${status === "open" ? "border-brand bg-brand-soft text-brand-text" : "border-line bg-surface text-muted"}`}>
      <span aria-hidden="true">{status === "open" ? "●" : "○"}</span>{t(STATUS_KEY[status])}
    </span>
  );
}
