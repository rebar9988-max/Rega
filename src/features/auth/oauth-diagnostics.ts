/**
 * Records WHICH error code a failed social sign-in carried back to the sign-in page (`?error=`), so a failure that the
 * page shows only as "sign-in did not work" can be diagnosed from the audit trail. Only the code is kept (checked against
 * a fixed list in `oauth-core.ts`): no address, name, token, IP address or user agent. At most 5 entries per client per
 * 15 minutes, and a failure to record never affects the page.
 */
import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { allowShared } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";
import { diagnosableAuthError } from "./oauth-core";

export async function recordSocialSignInFailure(code: string | undefined, locale: string): Promise<void> {
  const known = diagnosableAuthError(code);
  if (!known) return;
  try {
    const ip = clientIp(await headers());
    if (!(await allowShared("LOGIN_LIMITER", `oauth-diag:${ip}`, 5, 15 * 60_000))) return;
    await prisma.auditLog.create({
      data: { action: "auth.oauth.failed", entity: "auth", entityId: known, after: { code: known, locale: locale.slice(0, 5) } },
    });
    log.warn("auth.oauth.failed", { code: known });
  } catch (error) {
    log.warn("auth.oauth.diagnostic_failed", { error: error instanceof Error ? error.message : String(error) });
  }
}
