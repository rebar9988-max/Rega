import "server-only";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { currentUser, requirePermission, type SessionUser } from "@/lib/auth-helpers";
import type { Permission } from "@/lib/rbac";

/**
 * Permission guard for dashboard pages. Pages render in parallel with the layout, so an anonymous visitor
 * must be *redirected* here (not thrown at) or every visit would log a spurious 401 error.
 * Missing permission still throws 403 and is shown by the dashboard error boundary.
 */
export async function requireDr(permission: Permission): Promise<SessionUser> {
  const user = await currentUser().catch(() => null);
  if (!user) redirect(`/${await getLocale()}/login?next=${encodeURIComponent("/dr")}`);
  return requirePermission(permission);
}
