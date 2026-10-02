/**
 * Auth.js v5 configuration.
 * - Credentials provider (email + password, bcrypt) for staff & users
 * - JWT sessions so the API stays stateless and works for mobile clients too
 * - Role is embedded in the token; permissions are derived, never trusted from the client
 */
import "server-only";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { allowShared } from "@/lib/rate-limit";
import { maskEmail } from "@/lib/client-ip";
import type { Role } from "@/lib/rbac";

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

export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  pages: { signIn: "/login" },
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
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role ?? "USER";
        token.locale = user.locale ?? "ckb";
        token.checkedAt = Date.now();
        return token;
      }
      // JWTs live 14 days: re-read role and status regularly so a demoted, suspended or deleted account loses
      // its privileges within minutes instead of keeping them until the token expires.
      if (token.uid && Date.now() - Number(token.checkedAt ?? 0) > REVALIDATE_MS) {
        try {
          const current = await prisma.user.findFirst({ where: { id: String(token.uid), deletedAt: null }, select: { role: true, status: true } });
          if (!current || current.status !== "active") return null; // ends the session
          token.role = current.role;
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
        session.user.role = (token.role as Role | undefined) ?? "USER";
        session.user.locale = (token.locale as string | undefined) ?? "ckb";
      }
      return session;
    },
  },
};
