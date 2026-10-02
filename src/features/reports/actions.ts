"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { sendEmail, teamInbox } from "@/lib/email";
import { isLocale } from "@/config/locales";
import { siteHost } from "@/lib/seo";
import { guardForm, singleLine } from "@/features/forms/guard";
import type { FormState } from "@/features/forms/state";
import { REPORT_REASONS, reportKind } from "./reasons";

const schema = z.object({
  url: z.string().trim().url().max(500),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().min(10).max(4000),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  goodFaith: z.literal("on"),
  locale: z.string().refine(isLocale),
});

/** Notice-and-action (DSA Art. 16): stored with reason, exact URL, explanation and the notifier's name and e-mail. */
export async function submitReport(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardForm(formData, "report", 5);
  if (guard === "spam") return { status: "ok" };
  if (guard === "rate") return { status: "error", error: "rate" };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "invalid", fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))] };
  const { url, reason, details, name, email, locale } = parsed.data;
  const target = new URL(url);
  if (!["http:", "https:"].includes(target.protocol)) return { status: "error", error: "invalid", fields: ["url"] };

  try {
    await prisma.report.create({ data: { ...reportKind(url), targetUrl: url, reason, details, reporterName: singleLine(name), reporterEmail: email, locale } });
  } catch (error) {
    log.error("report.store_failed", { error: error instanceof Error ? error.message : String(error) });
    return { status: "error", error: "failed" };
  }
  await sendEmail({
    to: teamInbox(),
    subject: `[REGA report] ${reason}: ${target.host === siteHost() ? target.pathname : target.host}`.slice(0, 200),
    text: `URL: ${url}\nReason: ${reason}\n\n${details}\n\n— ${singleLine(name)} <${email}> (${locale})\nReview in the dashboard: https://${siteHost()}/dr/reports`,
    replyTo: email,
  });
  return { status: "ok" };
}
