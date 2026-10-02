/**
 * One-time tokens for e-mail verification and password reset (pure, no database): a random 256-bit token goes into the
 * e-mail link, only its SHA-256 hash is stored, so a database leak does not leak usable links. Web Crypto only
 * (Node 20+ and Cloudflare Workers).
 */
export type TokenPurpose = "verify" | "reset";

/** 32 random bytes, base64url (43 characters). */
export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashToken(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** VerificationToken.identifier: purpose and (lower-cased) e-mail, so a verify token can never be used to reset a password. */
export const tokenIdentifier = (purpose: TokenPurpose, email: string) => `${purpose}:${email.trim().toLowerCase()}`;
