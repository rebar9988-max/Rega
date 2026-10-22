/**
 * Auth.js v5 configuration.
 * - Credentials provider (email + password, bcrypt) for staff & users
 * - Optional social sign-in (Google, Facebook, Apple) for public accounts: a provider exists here only when its client id
 *   AND secret are configured; the rules for matching/creating accounts live in src/features/auth/oauth-core.ts
 * - JWT sessions so the API stays stateless and works for mobile clients too
 * - Role is embedded in the token; permissions are derived, never trusted from the client
 */
import "server-only";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import Apple from "next-auth/providers/apple";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { allowShared } from "@/lib/rate-limit";
import { maskEmail } from "@/lib/client-ip";
import { completeSocialSignIn } from "@/features/auth/oauth";
import { oauthCredentials } from "@/features/auth/oauth-core";
import { recordAuthErrorCause } from "@/features/auth/oauth-diagnostics";
import { SESSION_MAX_AGE_SECONDS, passwordChanged, passwordMarker } from "@/features/auth/session-policy";
import { effectiveRole, type Role } from "@/lib/rbac";

/** How often a signed-in session re-checks role/status against the database. */
const REVALIDATE_MS = Number(process.env.AUTH_SESSION_REVALIDATE_MS ?? 5 * 60_000);

/**
 * Well-formed cost-12 bcrypt hash (same cost as real accounts) compared for unknown e-mails. Its hash part was made
 * at another cost, so no password can match it; and `!user` rejects the login regardless.
 */
const DUMMY_HASH = "$2a$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

/** Sign-in attempts per account per 15 minutes (default 10). Raised only by the end-to-end tests, which sign in many times. */
const LOGIN_ATTEMPTS = Number(process.env.AUTH_LOGIN_ATTEMPTS ?? 10);

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

/** Absolute site origin for redirects that Auth.js sends from its own callback (AUTH_URL wins, else the canonical host). */
const siteBase = () => (process.env.AUTH_URL ? new URL(process.env.AUTH_URL).origin : `https://${process.env.CANONICAL_HOST || "www.regaplatform.com"}`);

/** Google / Facebook / Apple: only those with BOTH client id and secret in the environment. */
function socialProviders(): NextAuthConfig["providers"] {
  const providers: NextAuthConfig["providers"] = [];
  const google = oauthCredentials("google", process.env);
  if (google) providers.push(Google(google));
  const facebook = oauthCredentials("facebook", process.env);
  if (facebook) providers.push(Facebook(facebook));
  const apple = oauthCredentials("apple", process.env);
  if (apple) providers.push(Apple(apple));
  return providers;
}

/**
 * Apple returns to /api/auth/callback/apple with a cross-site POST (response_mode=form_post). Cookies that are SameSite=lax are
 * not sent with such a request, so while Apple is configured the short-lived state/PKCE/nonce cookies (httpOnly, secure,
 * single-use, bound to the `state` parameter) are SameSite=none in production.
 */
function appleCookies(): NextAuthConfig["cookies"] | undefined {
  if (!oauthCredentials("apple", process.env)) return undefined;
  const secure = process.env.NODE_ENV === "production";
  const prefix = secure ? "__Secure-" : "";
  const options = { httpOnly: true, sameSite: secure ? ("none" as const) : ("lax" as const), path: "/", secure };
  return {
    pkceCodeVerifier: { name: `${prefix}authjs.pkce.code_verifier`, options },
    state: { name: `${prefix}authjs.state`, options },
    nonce: { name: `${prefix}authjs.nonce`, options },
  };
}

/**
 * Built per request (see src/auth.ts) so the provider list follows the Worker's runtime secrets: Workers hand their
 * secrets to the code when a request arrives, not when the bundle is built.
 */
export function buildAuthConfig(): NextAuthConfig {
  return {
    trustHost: true,
    // 90 days, renewed while the account is used (SessionRenewal asks the session endpoint, which re-issues the cookie). Policy: session-policy.ts.
    session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
    // Failed provider returns (cancelled consent, provider error) land on the sign-in page with a message, not on an Auth.js error page.
    pages: { signIn: "/login", error: "/login" },
    cookies: appleCookies(),
    logger: {
      // Same server log lines as Auth.js's own logger, plus a safe summary (error type and error CODES, never messages) kept in
      // the audit trail so a failed Google return can be diagnosed (src/features/auth/oauth-diagnostics.ts). Wrong e-mail passwords are not kept.
      error(error) {
        const detail = error as unknown as { type?: unknown; cause?: { err?: unknown } };
        console.error(`[auth][error] ${typeof detail.type === "string" ? detail.type : error.name}: ${error.message}`);
        const inner = detail.cause?.err;
        if (inner instanceof Error && inner.stack) console.error("[auth][cause]:", inner.stack);
        void recordAuthErrorCause(error);
      },
    },
    providers: [
      Credentials({
        name: "credentials",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(raw) {
          const parsed = credentialsSchema.safeParse(raw);
          if (!parsed.success) return null;
          const { email, password } = parsed.data;

          // 10 attempts per account per 15 minutes, regardless of source.
          if (!(await allowShared("LOGIN_LIMITER", `login:${email.toLowerCase()}`, LOGIN_ATTEMPTS, 15 * 60_000))) {
            log.warn("auth.login.rate_limited", { email: maskEmail(email) });
            return null;
          }

          const user = await prisma.user.findFirst({
            where: { email: email.toLowerCase(), deletedAt: null },
          });
          // Constant-ish response: always run a full cost-12 hash comparison. The stand-in must be a well-formed
          // 60-character bcrypt hash: bcryptjs answers `false` at once for any other length (no hashing at all),
          // which made unknown e-mail addresses answer measurably faster than real accounts (user enumeration).
          const hash = user?.passwordHash ?? DUMMY_HASH;
          const ok = await bcrypt.compare(password, hash);

          if (!user || !ok || user.status !== "active") {
            log.warn("auth.login.failed", { email: maskEmail(email), reason: !user ? "unknown_user" : "bad_credentials" });
            return null;
          }

          await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
          log.info("auth.login.success", { userId: user.id, role: user.role });

          return {
            id: user.id,
            email: user.email,
            name: user.name ?? undefined,
            image: user.avatarUrl ?? undefined,
            role: user.role as Role,
            locale: user.locale,
            pv: await passwordMarker(user.passwordHash),
          };
        },
      }),
      // Administrative sign-in at /dr: a six-digit code to the address already on the account.
      // It opens a session only for an account that already has dashboard access, never
      // creates a user and never grants a role; the code itself is checked in admin-code.ts.
      Credentials({
        id: "admin-code",
        name: "admin-code",
        credentials: {
          email: { label: "Email", type: "email" },
          code: { label: "Code", type: "text" },
        },
        async authorize(raw, request) {
          const input = raw as { email?: unknown; code?: unknown };
          const { adminCodeAccount, recordAdminSignIn, verifyAdminCode } = await import("@/features/auth/admin-code");
          // The address the request came from, as the edge reports it; never a value the caller sends.
          const { clientIp } = await import("@/lib/client-ip");
          const ip = clientIp(request.headers);
          const checked = await verifyAdminCode(input.email, input.code, ip);
          if ("error" in checked) return null;
          // Read the role again, after the code was spent: access removed in between opens nothing.
          const user = await adminCodeAccount(checked.email);
          if (!user) return null;
          await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
          log.info("auth.dr_code.success", { userId: user.id, role: user.role });
          await recordAdminSignIn(user, ip);
          return {
            id: user.id,
            email: user.email,
            name: user.name ?? undefined,
            image: user.avatarUrl ?? undefined,
            role: user.role as Role,
            locale: user.locale,
            pv: await passwordMarker(user.passwordHash),
          };
        },
      }),
      ...socialProviders(),
    ],
    callbacks: {
      async signIn({ user, account, profile }) {
        if (!account || account.provider === "credentials") return true;
        // The /dr code provider decided everything in its own authorize (SUPER_ADMIN only).
        if (account.provider === "admin-code") return true;
        const result = await completeSocialSignIn({
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          email: profile?.email ?? user.email,
          name: profile?.name ?? user.name,
          profile: profile as Record<string, unknown> | undefined,
        });
        if (!result.ok) {
          // Back to the page the visitor came from; "no account" sends a plain sign-in to the registration page.
          const page = result.reason === "no_account" || result.context.intent === "register" ? "register" : "login";
          const query = new URLSearchParams({ error: `social_${result.reason}` });
          if (result.context.next) query.set("next", result.context.next);
          return `${siteBase()}/${result.context.locale}/${page}?${query}`;
        }
        // The token is built from this object: it must carry REGA's own user id, role and language, not the provider's.
        user.id = result.user.id;
        user.email = result.user.email;
        user.name = result.user.name ?? undefined;
        user.role = result.user.role as Role;
        user.locale = result.user.locale;
        return true;
      },
      async jwt({ token, user }) {
        if (user) {
          token.uid = user.id;
          // SUPER_ADMIN only for the owner's address, whichever provider signed in (rbac.effectiveRole).
          token.role = effectiveRole(user.role, user.email);
          token.locale = user.locale ?? "ckb";
          token.checkedAt = Date.now();
          if (user.pv) token.pv = user.pv; // password marker of this sign-in (social sign-ins get theirs at the first re-check)
          return token;
        }
        // JWTs live 90 days (renewed while used): re-read role, status and password marker regularly so a demoted, suspended
        // or deleted account, or one whose password was changed or reset, loses its sessions within minutes
        // instead of keeping them until the token expires.
        if (token.uid && Date.now() - Number(token.checkedAt ?? 0) > REVALIDATE_MS) {
          try {
            const current = await prisma.user.findFirst({ where: { id: String(token.uid), deletedAt: null }, select: { role: true, email: true, status: true, passwordHash: true } });
            if (!current || current.status !== "active") return null; // ends the session
            const marker = await passwordMarker(current.passwordHash);
            if (passwordChanged(token.pv, marker)) return null; // password changed or reset: sign in again with the new one
            token.pv = marker;
            token.role = effectiveRole(current.role, current.email);
            token.checkedAt = Date.now();
          } catch (error) {
            // Database briefly unreachable: keep the session, but never upgrade it; retry on the next request.
            log.warn("auth.session.revalidate_failed", { error: error instanceof Error ? error.message : String(error) });
          }
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          session.user.id = (token.uid as string | undefined) ?? "";
          // Re-applied on every read, so a token issued before the owner-only rule never carries SUPER_ADMIN for another address.
          session.user.role = effectiveRole(token.role as Role | undefined, (token.email as string | undefined) ?? session.user.email);
          session.user.locale = (token.locale as string | undefined) ?? "ckb";
        }
        return session;
      },
    },
  };
}
