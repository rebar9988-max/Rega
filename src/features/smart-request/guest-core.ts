/**
 * Smart Request (Radar) guest access — pure, testable core (no I/O, no server-only).
 *
 * Visitors without an account own their requests through a signed, httpOnly cookie that lists the request ids they
 * created on this device. The list is HMAC-SHA256 signed with AUTH_SECRET, so it cannot be forged or extended by the
 * client; request ids are random cuids, so they cannot be guessed either. Nothing personal is stored in the cookie.
 */

export const GUEST_COOKIE = "rega_radar";
/** Requests remembered per device (newest first); older ones simply drop out of the list. */
export const GUEST_MAX_IDS = 20;
/** Cookie lifetime: longer than a request's 14-day lifetime so a guest can still see the outcome. */
export const GUEST_COOKIE_MAX_AGE = 30 * 86_400;
/** The single system owner row of guest requests (the column is a required foreign key). It can never sign in. */
export const GUEST_OWNER_EMAIL = "radar-guest@system.rega24.invalid";

const ID = /^[\w-]{1,64}$/;
const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(value: string): string {
  const s = value.replace(/-/g, "+").replace(/_/g, "/");
  return atob(s + "=".repeat((4 - (s.length % 4)) % 4));
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(`smart-request-guest:${secret}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data))));
}

/** Constant-time string comparison (same length required). */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Keeps only well-formed, unique ids, newest first, at most GUEST_MAX_IDS. */
export function normalizeIds(ids: readonly unknown[]): string[] {
  const out: string[] = [];
  for (const id of ids) if (typeof id === "string" && ID.test(id) && !out.includes(id)) out.push(id);
  return out.slice(0, GUEST_MAX_IDS);
}

export async function signGuestIds(secret: string, ids: readonly string[]): Promise<string> {
  const payload = b64url(enc.encode(normalizeIds(ids).join(",")));
  return `${payload}.${await hmac(secret, payload)}`;
}

/** The request ids of a valid cookie; [] for a missing, malformed or tampered cookie. */
export async function verifyGuestIds(secret: string, value: string | undefined | null): Promise<string[]> {
  if (!value || value.length > 4096) return [];
  const dot = value.indexOf(".");
  if (dot <= 0) return [];
  const payload = value.slice(0, dot);
  const signature = value.slice(dot + 1);
  if (!same(signature, await hmac(secret, payload))) return [];
  try {
    const text = fromB64url(payload);
    return text ? normalizeIds(text.split(",")) : [];
  } catch {
    return [];
  }
}

/** A new request goes to the front of the device's list. */
export function withRequest(ids: readonly string[], id: string): string[] {
  return normalizeIds([id, ...ids]);
}
