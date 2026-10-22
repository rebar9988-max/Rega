/**
 * Sign-in session policy (one place, no server-only imports: the browser renewal component and the unit tests use it too).
 *
 * - The session is an Auth.js JWT in a secure, HttpOnly cookie. It lasts SESSION_MAX_AGE_SECONDS from the last renewal.
 * - Auth.js re-issues the cookie (new JWT expiry AND new cookie expiry) only when its session endpoint, a middleware
 *   wrapper or a route handler answers the request. `auth()` in a server component discards the cookie it would set,
 *   so REGA asks the session endpoint once per page load and when a long-open tab becomes visible again (SessionRenewal).
 * - A session also ends when the account is deleted or suspended, or its password changed (src/auth.config.ts).
 */

/** 90 days, renewed while the account keeps being used; a session unused for 90 days asks for a normal sign-in. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

/**
 * A SUPER_ADMIN session ends 7 days after its sign-in, however actively it is used (owner decision, 2026-10-23): the most
 * powerful session must not live for 90 days on a lost or shared device. Every other role keeps the 90-day policy.
 */
export const SUPER_ADMIN_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * True when a SUPER_ADMIN session is older than SUPER_ADMIN_SESSION_MAX_AGE_MS since its sign-in (`authAt`, ms since
 * epoch). A SUPER_ADMIN token without a sign-in time fails closed. `effectiveRole` is the role after the owner-only rule. Pure.
 */
export function superAdminSessionExpired(effectiveRole: string | null | undefined, authAt: unknown, now: number): boolean {
  if (effectiveRole !== "SUPER_ADMIN") return false;
  const at = Number(authAt);
  if (!Number.isFinite(at) || at <= 0 || at > now + 60_000) return true;
  return now - at > SUPER_ADMIN_SESSION_MAX_AGE_MS;
}

/** The Auth.js endpoint that re-issues the session cookie for a still-valid session. */
export const SESSION_RENEW_PATH = "/api/auth/session";

/** A tab that stays open renews again after this long (the next time it becomes visible). */
export const SESSION_RENEW_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** True when the session should be renewed now. `lastRenewedAt` is ms since epoch, or null if not renewed in this page yet. Pure. */
export function renewalDue(lastRenewedAt: number | null, now: number, intervalMs = SESSION_RENEW_INTERVAL_MS): boolean {
  if (lastRenewedAt === null || !Number.isFinite(lastRenewedAt)) return true;
  if (now < lastRenewedAt) return true; // the device clock went backwards
  return now - lastRenewedAt >= intervalMs;
}

/**
 * Short one-way marker of a stored password hash (16 hex characters of its SHA-256). It goes into the encrypted session
 * token so that changing or resetting the password ends every session that was opened with the old one, without a
 * database change. The hash itself is never put into the token.
 */
export async function passwordMarker(passwordHash: string | null | undefined): Promise<string> {
  const bytes = new TextEncoder().encode(`rega-password-marker:${passwordHash ?? ""}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest.slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * True only when the token carries a marker and it differs from the account's current one. Tokens issued before this
 * existed carry no marker: they are kept (and given one at the next re-check), so a deployment never signs anybody out. Pure.
 */
export function passwordChanged(tokenMarker: unknown, currentMarker: string): boolean {
  return typeof tokenMarker === "string" && tokenMarker.length > 0 && tokenMarker !== currentMarker;
}
