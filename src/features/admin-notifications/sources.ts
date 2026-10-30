/** Server-side counts for the admin notifications (read-only; only the kinds the signed-in role may see). */
import "server-only";
import { prisma } from "@/lib/db";
import type { Role } from "@/lib/rbac";
import { buildNotifications, visibleKinds, type NotificationCounts, type NotificationKind } from "./build";

const COUNT: Record<NotificationKind, () => Promise<number>> = {
  pendingBusinesses: () => prisma.business.count({ where: { status: "pending", deletedAt: null } }),
  pendingReviews: () => prisma.review.count({ where: { status: "pending" } }),
  openReports: () => prisma.report.count({ where: { status: "open" } }),
  newMessages: () => prisma.contactMessage.count({ where: { status: "new" } }),
};

export async function getAdminNotifications(role: Role | null | undefined) {
  const kinds = visibleKinds(role);
  const values = await Promise.all(kinds.map((k) => COUNT[k]()));
  const counts: NotificationCounts = Object.fromEntries(kinds.map((k, i) => [k, values[i]]));
  return buildNotifications(counts, role);
}
