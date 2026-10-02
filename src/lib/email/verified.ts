import "server-only";
import { prisma } from "@/lib/db";
import { atLeast, type Role } from "@/lib/rbac";

/**
 * Members of the public (USER, BUSINESS_OWNER) must have a confirmed e-mail address before they submit listings or write
 * reviews. This holds whether or not an e-mail provider is configured: without one nobody can confirm, and the
 * address stays unconfirmed (never marked verified by assumption). Staff accounts (EMPLOYEE and up) are created and
 * vetted by administrators and are exempt.
 */
export async function hasConfirmedEmail(user: { id: string; role: Role }): Promise<boolean> {
  if (atLeast(user.role, "EMPLOYEE")) return true;
  const row = await prisma.user.findFirst({ where: { id: user.id, deletedAt: null }, select: { emailVerified: true } });
  return Boolean(row?.emailVerified);
}
