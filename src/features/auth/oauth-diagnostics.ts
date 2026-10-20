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
import { describeAuthError, diagnosableAuthError } from "./oauth-core";

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

/** Entries kept per server instance and 15 minutes (the logger hook has no request to rate limit by). */
const CAUSE_LIMIT = 5;
let causeWindowStart = 0;
let causeWritten = 0;

/**
 * Called from the Auth.js logger when Auth.js logs an error. Keeps the safe summary (`describeAuthError`) as one
 * `AuditLog` row. The write is handed to the Worker (`waitUntil`) so it finishes after the redirect has been sent; any
 * failure only produces a log line.
 */
export async function recordAuthErrorCause(error: unknown): Promise<void> {
  const info = describeAuthError(error);
  if (!info) return;
  const now = Date.now();
  if (now - causeWindowStart > 15 * 60_000) { causeWindowStart = now; causeWritten = 0; }
  if (causeWritten >= CAUSE_LIMIT) return;
  causeWritten += 1;
  const write = Promise.resolve(prisma.auditLog.create({
    data: { action: "auth.oauth.error", entity: "auth", entityId: info.type, after: info as never },
  })).then(
    () => log.warn("auth.oauth.error", { ...info }),
    (failure: unknown) => log.warn("auth.oauth.diagnostic_failed", { error: failure instanceof Error ? failure.message : String(failure) }),
  );
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    getCloudflareContext().ctx.waitUntil(write);
  } catch {
    // Not on Workers (Node, tests): the write simply runs to completion.
  }
}
