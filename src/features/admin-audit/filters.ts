/**
 * Audit-log filters of the admin dashboard (/dr/audit): parsed from the URL, validated, and turned into a Prisma
 * filter. Pure (no I/O), so the page and the tests share the same rules. Unknown or oversized values are dropped,
 * never passed on: the URL is visitor input even on a signed-in page.
 */
import type { Prisma } from "@prisma/client";

export const AUDIT_PER_PAGE = 30;
/** Deep pages cost a full scan; the trail is browsed newest first, so 500 pages (15,000 rows) is the cap. */
export const AUDIT_MAX_PAGE = 500;

export type AuditFilters = { page: number; action?: string; entity?: string; actor?: string };

type Raw = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
/** Action and entity names are code identifiers ("business.publish", "Business"). */
const IDENT = /^[A-Za-z][\w.:-]{0,63}$/;

export function parseAuditFilters(raw: Raw): AuditFilters {
  const page = Math.min(AUDIT_MAX_PAGE, Math.max(1, Number.parseInt(one(raw.page), 10) || 1));
  const action = one(raw.action), entity = one(raw.entity), actor = one(raw.actor).toLowerCase();
  return {
    page,
    ...(IDENT.test(action) ? { action } : {}),
    ...(IDENT.test(entity) ? { entity } : {}),
    // A part of an e-mail address; no wildcards of its own (Prisma escapes "contains").
    ...(actor && actor.length <= 120 && !/\s/.test(actor) ? { actor } : {}),
  };
}

export function auditWhere(f: AuditFilters): Prisma.AuditLogWhereInput {
  return {
    ...(f.action ? { action: f.action } : {}),
    ...(f.entity ? { entity: f.entity } : {}),
    ...(f.actor ? { actorEmail: { contains: f.actor } } : {}),
  };
}

/** Link to another page of the same filtered list (only the filters that are set). */
export function auditHref(f: AuditFilters, page: number): string {
  const q = new URLSearchParams();
  if (f.action) q.set("action", f.action);
  if (f.entity) q.set("entity", f.entity);
  if (f.actor) q.set("actor", f.actor);
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return s ? `/dr/audit?${s}` : "/dr/audit";
}
