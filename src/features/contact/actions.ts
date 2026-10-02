"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { sendEmail, teamInbox } from "@/lib/email";
import { isLocale } from "@/config/locales";
import { guardForm, singleLine } from "@/features/forms/guard";
import type { FormState } from "@/features/forms/state";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.union([z.literal(""), z.string().trim().email().max(200)]).optional(),
  subject: z.string().trim().min(2).max(200),
  message: z.string().trim().min(10).max(4000),
  locale: z.string().refine(isLocale),
});

/** Contact form: validate, stop bots (honeypot + rate limit), store in the database, notify the team by e-mail. */
export async function sendContact(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardForm(formData, "contact", 5);
  if (guard === "spam") return { status: "ok" };
  if (guard === "rate") return { status: "error", error: "rate" };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "invalid", fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))] };
  const { name, email, subject, message, locale } = parsed.data;

  try {
    await prisma.contactMessage.create({ data: { name: singleLine(name), email: email || null, subject: singleLine(subject), message, locale } });
  } catch (error) {
    log.error("contact.store_failed", { error: error instanceof Error ? error.message : String(error) });
    return { status: "error", error: "failed" };
  }
  // The message is safely stored; the notification is best effort (no provider configured = the team reads /dr/messages).
  await sendEmail({
    to: teamInbox(),
    subject: `[REGA contact] ${singleLine(subject)}`.slice(0, 200),
    text: `${message}\n\n— ${singleLine(name)}${email ? ` <${email}>` : ""} (${locale})`,
    ...(email ? { replyTo: email } : {}),
  });
  return { status: "ok" };
}
