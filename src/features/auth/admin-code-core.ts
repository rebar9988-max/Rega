/**
 * Administrative sign-in codes: the rules, with no database and no network, so each one is
 * tested on its own.
 *
 * A dashboard account signs in at /dr with a six-digit code sent to the address already on
 * the account. Six digits is small, so the code is never stored: only an HMAC of it, keyed
 * with AUTH_SECRET and domain-separated by the address, so one leaked row yields nothing and
 * a code for one address can never be replayed for another.
 */

import { SUPER_ADMIN_EMAILS, isSuperAdminEmail } from "../../lib/rbac";

/**
 * The only addresses /dr ever sends a code to (owner instruction, 2026-10-22): the same single owner address that may
 * hold SUPER_ADMIN power at all (`SUPER_ADMIN_EMAILS` in lib/rbac.ts). The account must also be an active, verified
 * SUPER_ADMIN.
 */
export const DR_CODE_EMAILS: readonly string[] = SUPER_ADMIN_EMAILS;

/** True only for an address on the /dr code allowlist (compared normalised). */
export function mayReceiveDrCode(email: string): boolean {
  return isSuperAdminEmail(email);
}

/** A code is usable for this long. */
export const CODE_TTL_MINUTES = 5;
/** Wait between two sends to the same address. */
export const RESEND_COOLDOWN_SECONDS = 30;
/** Guesses allowed per code before it is locked. */
export const MAX_ATTEMPTS = 5;
/** Codes one address may be sent per hour, and guesses one client may make per hour. */
export const SEND_HOUR_LIMIT = 8;
export const VERIFY_HOUR_LIMIT = 30;

/** Six digits, uniform. Rejection sampling, so no digit is likelier than another. */
export function newAdminCode(): string {
  const limit = 1_000_000;
  const ceiling = Math.floor(0xffffffff / limit) * limit;
  const buffer = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0]!;
  } while (value >= ceiling);
  return String(value % limit).padStart(6, "0");
}

/** Lower-cased, trimmed address, or null when it is not a plausible single mailbox. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length < 6 || email.length > 254) return null;
  if (
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
      email,
    )
  )
    return null;
  if (
    email.startsWith(".") ||
    email.includes("..") ||
    email.split("@")[0]!.endsWith(".")
  )
    return null;
  return email;
}

/** Exactly six digits, with any spacing the person typed removed. */
export function cleanCode(raw: unknown): string | null {
  const code = typeof raw === "string" ? raw.replace(/\s+/g, "") : "";
  return /^\d{6}$/.test(code) ? code : null;
}

/** Domain-separated so a code can only ever be checked against the address it was sent to. */
export async function hashAdminCode(
  secret: string,
  email: string,
  code: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`admin-code\n${email}\n${code}`),
  );
  return [...new Uint8Array(mac)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant time for equal lengths: a wrong guess must not be measurably faster. */
export function codesMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1)
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
