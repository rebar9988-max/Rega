import "server-only";
import { prisma } from "@/lib/db";
import { hashToken, newToken, tokenIdentifier, type TokenPurpose } from "./tokens-core";

/** Creates a token for (purpose, email), replacing any earlier one, and returns the RAW token to put in the e-mail link. */
export async function issueToken(purpose: TokenPurpose, email: string, ttlMs: number): Promise<string> {
  const identifier = tokenIdentifier(purpose, email);
  const raw = newToken();
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    prisma.verificationToken.create({ data: { identifier, token: await hashToken(raw), expires: new Date(Date.now() + ttlMs) } }),
  ]);
  return raw;
}

/** True exactly once per valid, unexpired token: the delete is the check, so concurrent uses cannot both succeed. */
export async function consumeToken(purpose: TokenPurpose, email: string, raw: string): Promise<boolean> {
  if (!raw || raw.length > 200) return false;
  const { count } = await prisma.verificationToken.deleteMany({
    where: { identifier: tokenIdentifier(purpose, email), token: await hashToken(raw), expires: { gt: new Date() } },
  });
  return count === 1;
}

/** Drops every outstanding token of a purpose for an address (after a successful password reset). */
export async function revokeTokens(purpose: TokenPurpose, email: string): Promise<void> {
  await prisma.verificationToken.deleteMany({ where: { identifier: tokenIdentifier(purpose, email) } });
}
