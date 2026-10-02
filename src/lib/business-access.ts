/**
 * Per-business access (BusinessMember). Platform staff from MANAGER up manage every business; an EMPLOYEE manages
 * only the businesses they are an active member of (and the ones they create, which makes them a member).
 * Every write path calls these server-side checks; hiding buttons in the UI is only a convenience on top.
 */
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { HttpError, type SessionUser } from "@/lib/auth-helpers";
import { atLeast, type Role } from "@/lib/rbac";

type Actor = Pick<SessionUser, "id" | "role">;

/** Roles that manage all businesses regardless of membership. */
export function hasGlobalBusinessAccess(role: Role | null | undefined): boolean {
  return atLeast(role, "MANAGER");
}

export async function canManageBusiness(user: Actor, businessId: string): Promise<boolean> {
  if (hasGlobalBusinessAccess(user.role)) return true;
  const member = await prisma.businessMember.findFirst({ where: { businessId, userId: user.id, isActive: true }, select: { id: true } });
  return Boolean(member);
}

/** Throws 403 unless the user may manage this business. */
export async function assertBusinessAccess(user: Actor, businessId: string): Promise<void> {
  if (!(await canManageBusiness(user, businessId))) throw new HttpError(403, "forbidden", "You do not manage this business.");
}

/** Filter for lists: which businesses this user may manage. */
export function managedBusinessWhere(user: Actor): Prisma.BusinessWhereInput {
  return hasGlobalBusinessAccess(user.role) ? {} : { members: { some: { userId: user.id, isActive: true } } };
}

/** Ids from `ids` the user may manage (bulk actions). */
export async function manageableIds(user: Actor, ids: string[]): Promise<string[]> {
  if (hasGlobalBusinessAccess(user.role)) return ids;
  const rows = await prisma.businessMember.findMany({ where: { userId: user.id, isActive: true, businessId: { in: ids } }, select: { businessId: true } });
  const allowed = new Set(rows.map((r) => r.businessId));
  return ids.filter((id) => allowed.has(id));
}

/** A non-global creator becomes a member of the business they created, so they can keep editing it. */
export async function addCreatorAsMember(user: Actor, businessId: string): Promise<void> {
  if (hasGlobalBusinessAccess(user.role)) return;
  await prisma.businessMember.upsert({
    where: { businessId_userId: { businessId, userId: user.id } },
    update: { isActive: true },
    create: { businessId, userId: user.id, role: "EMPLOYEE" },
  });
}
