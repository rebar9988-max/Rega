import { databaseTransaction } from "@/lib/database-transaction";
/**
 * Social sign-in glue (server only): the Prisma implementation of the rules in `oauth-core.ts` and the reading of the
 * context cookie. Only the identity (provider + provider account id) is stored; provider access/refresh/id tokens are
 * never kept, because nothing in REGA calls the provider after sign-in.
 */
import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { LOCALES, DEFAULT_LOCALE } from "@/config/locales";
import {
  SOCIAL_CONTEXT_COOKIE,
  parseSocialContext,
  providerVouchesForEmail,
  resolveOAuthSignIn,
  isOAuthProvider,
  type OAuthDenial,
  type OAuthStore,
  type OAuthUserRow,
  type SocialContext,
} from "./oauth-core";

const select = { id: true, email: true, name: true, role: true, locale: true, status: true, emailVerified: true, deletedAt: true } as const;

export const prismaOAuthStore: OAuthStore = {
  async findLinkedUser(provider, providerAccountId) {
    const row = await prisma.account.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      select: { user: { select } },
    });
    return row?.user ?? null;
  },
  findUserByEmail(email) {
    return prisma.user.findUnique({ where: { email }, select });
  },
  createUser(data) {
    return databaseTransaction(async tx => {
    const user = await tx.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash: null,
        role: data.role,
        locale: data.locale,
        emailVerified: data.emailVerified,
        termsAcceptedAt: data.termsAcceptedAt,
        lastLoginAt: new Date(),
      },
      select,
    });
    await tx.account.create({ data: { userId: user.id, type: "oauth", provider: data.provider, providerAccountId: data.providerAccountId } });
    return user;
    });
  },
  async linkAccount(userId, provider, providerAccountId) {
    await prisma.account.create({ data: { userId, type: "oauth", provider, providerAccountId } });
  },
  async recordLogin(userId) {
    await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  },
};

/** The context the sign-in button stored before leaving for the provider (safe defaults when missing or tampered with). */
export async function readSocialContext(): Promise<SocialContext> {
  try {
    const jar = await cookies();
    return parseSocialContext(jar.get(SOCIAL_CONTEXT_COOKIE)?.value, LOCALES, DEFAULT_LOCALE);
  } catch {
    return parseSocialContext(null, LOCALES, DEFAULT_LOCALE);
  }
}

export type SocialSignInResult =
  | { ok: true; user: OAuthUserRow; context: SocialContext }
  | { ok: false; reason: OAuthDenial; context: SocialContext };

/**
 * Called by Auth.js after a successful return from a provider. Never throws: a database problem is reported as
 * "failed" so the visitor lands on the sign-in page with a message instead of an error page.
 */
export async function completeSocialSignIn(input: {
  provider: string;
  providerAccountId?: string | null;
  email?: string | null;
  name?: string | null;
  profile?: Record<string, unknown> | null;
}): Promise<SocialSignInResult> {
  const context = await readSocialContext();
  if (!isOAuthProvider(input.provider) || !input.providerAccountId) return { ok: false, reason: "failed", context };
  try {
    const outcome = await resolveOAuthSignIn(prismaOAuthStore, {
      provider: input.provider,
      providerAccountId: input.providerAccountId,
      email: input.email,
      emailVerified: providerVouchesForEmail(input.provider, input.profile),
      name: input.name,
      context,
    });
    if (!outcome.ok) {
      log.warn("auth.social.denied", { provider: input.provider, reason: outcome.reason, intent: context.intent });
      return { ok: false, reason: outcome.reason, context };
    }
    log.info("auth.social.success", { provider: input.provider, userId: outcome.user.id, created: outcome.created, linked: outcome.linked });
    return { ok: true, user: outcome.user, context };
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code).slice(0, 20) : "UNKNOWN";
    log.error("auth.social.failed", { provider: input.provider, code });
    return { ok: false, reason: "failed", context };
  }
}
