"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { sendEmail, emailEnabled } from "@/lib/email";
import { isLocale } from "@/config/locales";
import { RESET_TOKEN_TTL_MINUTES, VERIFY_TOKEN_TTL_HOURS } from "@/config/site";
import { guardForm } from "@/features/forms/guard";
import type { FormState } from "@/features/forms/state";
import { currentUser } from "@/lib/auth-helpers";
import { allowShared } from "@/lib/rate-limit";
import { maskEmail } from "@/lib/client-ip";
import { consumeToken, issueToken, revokeTokens } from "./tokens";

/** Result of an auth form: FormState plus which success message to show. */
export type AuthFormState = FormState & { detail?: "verify" | "ready" | "sent" | "unavailable" | "done" };

const email = z.string().trim().toLowerCase().email().max(200);
const password = z.string().min(10).max(200);
const localeField = z.string().refine(isLocale);
const origin = () => (process.env.AUTH_URL ? new URL(process.env.AUTH_URL).origin : `https://${process.env.CANONICAL_HOST || "www.regaplatform.com"}`);

async function sendVerification(user: { email: string; name: string | null }, locale: string) {
  const raw = await issueToken("verify", user.email, VERIFY_TOKEN_TTL_HOURS * 3_600_000);
  const t = await getTranslations({ locale, namespace: "emails" });
  const link = `${origin()}/${locale}/verify-email?${new URLSearchParams({ email: user.email, token: raw })}`;
  return sendEmail({ to: user.email, subject: t("verifySubject"), text: t("verifyBody", { name: user.name ?? "", link, hours: VERIFY_TOKEN_TTL_HOURS }) });
}

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email,
  password,
  accountType: z.enum(["user", "owner"]),
  accept: z.literal("on"),
  locale: localeField,
});

/**
 * Registration: name, e-mail, password (bcrypt cost 12), account type, accepted Terms + Privacy (timestamp stored).
 * The account must confirm its address (link valid 48 h). Without an e-mail provider the confirmation cannot be sent:
 * the account is still created, stays unconfirmed (never marked verified by assumption) and the visitor is told so
 * (docs/adr/0005).
 * In e-mail mode an already registered address gets the same answer as a new one (no account enumeration).
 */
export async function register(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const guard = await guardForm(formData, "register", 5);
  if (guard === "spam") return { status: "ok", detail: "verify" };
  if (guard === "rate") return { status: "error", error: "rate" };

  const raw = Object.fromEntries(formData);
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
    return { status: "error", error: "invalid", fields };
  }
  if (raw.password !== raw.password2) return { status: "error", error: "invalid", fields: ["password2"] };
  const { name, email: address, password: plain, accountType, locale } = parsed.data;
  const mailing = emailEnabled();

  const existing = await prisma.user.findFirst({ where: { email: address, deletedAt: null }, select: { id: true, name: true, email: true, emailVerified: true } });
  if (existing) {
    if (!mailing) return { status: "error", error: "failed", fields: ["email"] }; // shown as "already exists" (no mail channel to hide it in)
    if (!existing.emailVerified && !(await sendVerification(existing, locale))) return { status: "ok", detail: "unavailable" };
    return { status: "ok", detail: "verify" };
  }

  let user: { id: string; email: string; name: string | null };
  try {
    user = await prisma.user.create({
      data: {
        email: address, name, locale,
        passwordHash: await bcrypt.hash(plain, 12),
        role: accountType === "owner" ? "BUSINESS_OWNER" : "USER",
        termsAcceptedAt: new Date(),
        emailVerified: null,
      },
      select: { id: true, email: true, name: true },
    });
  } catch (error) {
    // Two registrations of the same address at the same moment: the unique index decided; answer like "already registered".
    if (typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "P2002") return mailing ? { status: "ok", detail: "verify" } : { status: "error", error: "failed", fields: ["email"] };
    throw error;
  }
  log.info("auth.registered", { userId: user.id, type: accountType, email: maskEmail(address) });
  if (mailing) {
    const delivered = await sendVerification(user, locale);
    return { status: "ok", detail: delivered ? "verify" : "unavailable" };
  }
  return { status: "ok", detail: "unavailable" };
}

const confirmSchema = z.object({ email, token: z.string().min(10).max(200), locale: localeField });

/** The confirm button of /verify-email (a click, not a GET, so mail scanners that prefetch links cannot use the token up). */
export async function confirmEmail(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = confirmSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "invalid" };
  const guard = await guardForm(formData, "verify", 20);
  if (guard !== "ok") return { status: "error", error: "rate" };
  if (!(await consumeToken("verify", parsed.data.email, parsed.data.token))) return { status: "error", error: "invalid" };
  await prisma.user.updateMany({ where: { email: parsed.data.email, deletedAt: null, emailVerified: null }, data: { emailVerified: new Date() } });
  return { status: "ok", detail: "done" };
}

/** Signed-in user asks for a new confirmation link (at most 3 per hour). */
export async function resendVerification(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const user = await currentUser().catch(() => null);
  const locale = String(formData.get("locale") ?? "");
  if (!user || !isLocale(locale) || !emailEnabled()) return { status: "error", error: "failed" };
  if (!(await allowShared("FORM_LIMITER", `resend:${user.id}`, 3, 3_600_000))) return { status: "error", error: "rate" };
  const row = await prisma.user.findFirst({ where: { id: user.id, deletedAt: null }, select: { email: true, name: true, emailVerified: true } });
  if (!row || row.emailVerified) return { status: "ok", detail: "done" };
  const delivered = await sendVerification(row, locale);
  return delivered ? { status: "ok", detail: "sent" } : { status: "error", error: "failed" };
}

const forgotSchema = z.object({ email, locale: localeField });

/** "Forgot password": always answers the same (no enumeration); sends a 60-minute link when the account exists. */
export async function forgotPassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const guard = await guardForm(formData, "forgot", 5);
  if (guard === "spam") return { status: "ok", detail: "sent" };
  if (guard === "rate") return { status: "error", error: "rate" };
  const parsed = forgotSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "invalid", fields: ["email"] };
  if (!emailEnabled()) return { status: "ok", detail: "unavailable" };
  const { email: address, locale } = parsed.data;
  if (!(await allowShared("FORM_LIMITER", `forgot-mail:${address}`, 3, 3_600_000))) return { status: "ok", detail: "sent" };

  const user = await prisma.user.findFirst({ where: { email: address, deletedAt: null, status: "active", passwordHash: { not: null } }, select: { email: true, name: true } });
  if (user) {
    const raw = await issueToken("reset", user.email, RESET_TOKEN_TTL_MINUTES * 60_000);
    const t = await getTranslations({ locale, namespace: "emails" });
    const link = `${origin()}/${locale}/reset-password?${new URLSearchParams({ email: user.email, token: raw })}`;
    // Keep the same response for existing and unknown addresses: a provider outage must not expose account existence.
    await sendEmail({ to: user.email, subject: t("resetSubject"), text: t("resetBody", { name: user.name ?? "", link, minutes: RESET_TOKEN_TTL_MINUTES }) });
  }
  return { status: "ok", detail: "sent" };
}

const resetSchema = z.object({ email, token: z.string().min(10).max(200), password, locale: localeField });

/** Sets a new password with a valid reset token (single use). Also confirms the address: the user proved they read the mail. */
export async function resetPassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const guard = await guardForm(formData, "reset", 10);
  if (guard !== "ok") return { status: "error", error: "rate" };
  const raw = Object.fromEntries(formData);
  const parsed = resetSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", error: "invalid", fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))] };
  if (raw.password2 !== raw.password) return { status: "error", error: "invalid", fields: ["password2"] };
  const { email: address, token, password: plain } = parsed.data;
  if (!(await consumeToken("reset", address, token))) return { status: "error", error: "failed" };
  const hash = await bcrypt.hash(plain, 12);
  const { count } = await prisma.user.updateMany({ where: { email: address, deletedAt: null, status: "active" }, data: { passwordHash: hash } });
  if (count === 1) await prisma.user.updateMany({ where: { email: address, emailVerified: null }, data: { emailVerified: new Date() } });
  await revokeTokens("reset", address);
  return count === 1 ? { status: "ok", detail: "done" } : { status: "error", error: "failed" };
}
