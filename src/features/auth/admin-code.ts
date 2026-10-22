/**
 * Administrative sign-in at /dr: issue a code to a dashboard account, and check one.
 *
 * The rules live in admin-code-core.ts; this file is the part that touches the database, the
 * mailer and the rate limiter. Two things it deliberately never does: create an account, and
 * grant a role. It only recognises an account that already has dashboard access.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { allowShared } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import { maskEmail } from "@/lib/client-ip";
import { writeAudit } from "@/lib/audit";
import {
  CODE_TTL_MINUTES,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_SECONDS,
  SEND_HOUR_LIMIT,
  VERIFY_HOUR_LIMIT,
  cleanCode,
  codesMatch,
  mayReceiveDrCode,
  hashAdminCode,
  newAdminCode,
  normalizeEmail,
} from "./admin-code-core";

export type SendResult = { sent: true } | { error: "email" | "rate" | "unavailable" };
export type VerifyResult =
  | { ok: true; email: string }
  | { error: "code" | "expired" | "rate" };

/**
 * The account a verified code may open: the owner's address on DR_CODE_EMAILS, held by an
 * active SUPER_ADMIN with a verified address, nothing else. Every other account keeps signing in exactly as before (password, Google, Apple).
 */
async function dashboardAccount(email: string) {
  // Owner-only: any other address, SUPER_ADMIN or not, is never sent a code and never opened.
  if (!mayReceiveDrCode(email)) return null;
  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null, status: "active" },
    select: { id: true, email: true, name: true, avatarUrl: true, role: true, locale: true, passwordHash: true, emailVerified: true },
  });
  if (!user || user.role !== "SUPER_ADMIN" || !user.emailVerified) return null;
  return user;
}

/**
 * Send a code, if the address is one we serve. Every address gets the same answer, so this
 * cannot be used to find out who holds dashboard access.
 */
export async function requestAdminCode(rawEmail: unknown, ip: string): Promise<SendResult> {
  const email = normalizeEmail(rawEmail);
  if (!email) return { error: "email" };

  const now = new Date();
  // Cooldown first, so a too-early resend does not spend the hourly budget.
  const live = await prisma.adminSignInCode.findUnique({ where: { email } });
  if (
    live &&
    live.expiresAt > now &&
    (live.sentAt > new Date(now.getTime() - RESEND_COOLDOWN_SECONDS * 1000) ||
      live.attempts >= MAX_ATTEMPTS)
  ) {
    return { error: "rate" };
  }
  if (
    !(await allowShared("LOGIN_LIMITER", `dr-code-send:${email}`, SEND_HOUR_LIMIT, 60 * 60_000)) ||
    !(await allowShared("LOGIN_LIMITER", `dr-code-ip:${ip}`, SEND_HOUR_LIMIT * 3, 60 * 60_000))
  ) {
    return { error: "rate" };
  }

  const code = newAdminCode();
  const codeHash = await hashAdminCode(serverEnv().AUTH_SECRET, email, code);
  const expiresAt = new Date(now.getTime() + CODE_TTL_MINUTES * 60_000);
  // Reserve before delivery, so two concurrent requests cannot both pass the cooldown.
  await prisma.adminSignInCode.upsert({
    where: { email },
    create: { email, codeHash, state: "pending", expiresAt, attempts: 0, sentAt: now },
    update: { codeHash, state: "pending", expiresAt, attempts: 0, sentAt: now },
  });

  const account = await dashboardAccount(email);
  if (!account) {
    // The same answer as a served address, but no mail and no usable code.
    log.info("auth.dr_code.not_served", { email: maskEmail(email) });
    return { sent: true };
  }

  const delivered = await sendEmail({
    to: email,
    subject: "کۆدی چوونەژوورەوەی بەڕێوەبەری REGA",
    text: [
      "کۆدی چوونەژوورەوەت بۆ بەشی بەڕێوەبردنی REGA:",
      "",
      code,
      "",
      `ئەم کۆدە بۆ ${CODE_TTL_MINUTES} خولەک کار دەکات و تەنها یەک جار بەکاردێت.`,
      "ئەگەر تۆ داوات نەکردووە، ئەم ئیمەیڵە پشتگوێ بخە. کۆدەکە بە کەس مەدە.",
      "",
      "REGA · https://www.regaplatform.com",
    ].join("\n"),
  });
  if (!delivered) {
    // A code nobody received must not sit there usable.
    await prisma.adminSignInCode.deleteMany({ where: { email, codeHash, state: "pending" } });
    return { error: "unavailable" };
  }
  await prisma.adminSignInCode.updateMany({
    where: { email, codeHash, state: "pending", expiresAt: { gt: new Date() } },
    data: { state: "active" },
  });
  log.info("auth.dr_code.sent", { email: maskEmail(email) });
  return { sent: true };
}

/** Check a code and, when it is right, say which address it opened. Single use. */
export async function verifyAdminCode(
  rawEmail: unknown,
  rawCode: unknown,
  ip: string,
): Promise<VerifyResult> {
  const email = normalizeEmail(rawEmail);
  const code = cleanCode(rawCode);
  if (!email || !code) return { error: "code" };
  if (!(await allowShared("LOGIN_LIMITER", `dr-code-verify:${ip}`, VERIFY_HOUR_LIMIT, 60 * 60_000))) {
    return { error: "rate" };
  }

  // Spend one guess before comparing, so guesses count even when the comparison fails.
  const spent = await prisma.adminSignInCode.updateMany({
    where: { email, state: "active", expiresAt: { gt: new Date() }, attempts: { lt: MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  const row = await prisma.adminSignInCode.findUnique({ where: { email } });
  if (spent.count !== 1) {
    if (row && row.expiresAt <= new Date()) return { error: "expired" };
    if (row && row.attempts >= MAX_ATTEMPTS) return { error: "rate" };
    return { error: "code" };
  }
  if (!row) return { error: "code" };

  const expected = await hashAdminCode(serverEnv().AUTH_SECRET, email, code);
  if (!codesMatch(expected, row.codeHash)) {
    log.warn("auth.dr_code.wrong", { email: maskEmail(email) });
    return { error: "code" };
  }
  // One winner: a second verification of the same code finds nothing left to consume.
  const consumed = await prisma.adminSignInCode.deleteMany({
    where: { email, codeHash: row.codeHash, state: "active" },
  });
  if (consumed.count !== 1) return { error: "code" };
  return { ok: true, email };
}

/** The account to open a session for, re-read after the code was spent. */
export async function adminCodeAccount(email: string) {
  return dashboardAccount(email);
}

/**
 * After a successful sign-in: an audit row, and a short notice to the account's own address so
 * a sign-in the owner did not make is noticed. The notice carries no code, token or link.
 * Neither step can fail the sign-in.
 */
export async function recordAdminSignIn(user: { id: string; email: string }, ip: string): Promise<void> {
  await writeAudit({ actorId: user.id, actorEmail: user.email, action: "auth.dr_code.sign_in", entity: "User", entityId: user.id });
  const when = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
  try {
    await sendEmail({
      to: user.email,
      subject: "چوونەژوورەوەیەکی بەڕێوەبەر بۆ REGA",
      text: [
        "کەسێک بە کۆدی ئیمەیڵ چووە ژوورەوەی بەشی بەڕێوەبردنی REGA.",
        `کات: ${when}`,
        `IP: ${ip}`,
        "",
        "ئەگەر تۆ بوویت، هیچ کارێک پێویست نییە.",
        "ئەگەر تۆ نەبوویت، ڕاستەوخۆ وشەی نهێنی هەژمارەکەت بگۆڕە و ئیمەیڵەکەت بپارێزە.",
        "",
        "REGA",
      ].join("\n"),
    });
  } catch (error) {
    log.warn("auth.dr_code.notice_failed", { reason: error instanceof Error ? error.name : "unknown" });
  }
}
