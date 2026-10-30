/**
 * Admin notifications, derived from work that is already waiting in existing tables (no notification table yet):
 * businesses submitted for review, reviews to moderate, open content reports and new contact messages.
 * Pure: the role filter and ordering are decided here so they are tested without a database.
 */
import { can, type Permission, type Role } from "@/lib/rbac";

export const NOTIFICATION_KINDS = ["pendingBusinesses", "pendingReviews", "openReports", "newMessages"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];
export type NotificationCounts = Partial<Record<NotificationKind, number>>;
export type AdminNotification = { kind: NotificationKind; count: number; href: string };

/** Where each kind is handled and who may see it (the same permission as that dashboard page). */
export const NOTIFICATION_SOURCE: Record<NotificationKind, { href: string; permission: Permission }> = {
  pendingBusinesses: { href: "/dr/businesses?status=pending", permission: "business.publish" },
  pendingReviews: { href: "/dr/reviews", permission: "review.moderate" },
  openReports: { href: "/dr/reports", permission: "review.moderate" },
  newMessages: { href: "/dr/messages", permission: "review.moderate" },
};

/** Kinds this role may see; the server only counts these. */
export const visibleKinds = (role: Role | null | undefined) => NOTIFICATION_KINDS.filter((k) => can(role, NOTIFICATION_SOURCE[k].permission));

/** Non-empty, permitted notifications in a fixed order (publication first). */
export function buildNotifications(counts: NotificationCounts, role: Role | null | undefined): AdminNotification[] {
  return visibleKinds(role).flatMap((kind) => {
    const count = counts[kind] ?? 0;
    return Number.isSafeInteger(count) && count > 0 ? [{ kind, count, href: NOTIFICATION_SOURCE[kind].href }] : [];
  });
}

/** Badge text: exact up to 99, then "99+" (the list shows exact numbers). */
export const badgeText = (total: number) => (total > 99 ? "99+" : String(Math.max(0, total)));
