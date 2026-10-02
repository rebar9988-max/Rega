/**
 * E-mail service behind a small interface, so the provider can change without touching features.
 * Providers: "resend" (HTTPS API, works on Cloudflare Workers) or "none" (default: nothing is sent; in development the
 * message is logged so flows can be tested). Features call `sendEmail` and use `emailEnabled()` to decide what to do
 * when no provider is configured.
 */
import "server-only";
import { serverEnv } from "@/lib/env";
import { log } from "@/lib/logger";
import { maskEmail } from "@/lib/client-ip";

export type EmailMessage = { to: string; subject: string; text: string; replyTo?: string };

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage, from: string): Promise<void>;
}

const resend = (apiKey: string): EmailProvider => ({
  name: "resend",
  async send(message, from) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text, ...(message.replyTo ? { reply_to: message.replyTo } : {}) }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`resend responded ${res.status}`);
  },
});

function provider(): EmailProvider | null {
  const env = serverEnv();
  if (env.EMAIL_PROVIDER === "resend" && env.RESEND_API_KEY) return resend(env.RESEND_API_KEY);
  return null;
}

/** True when messages are really delivered (a provider and its key are configured). */
export function emailEnabled(): boolean {
  return provider() !== null;
}

export const emailFrom = (): string => serverEnv().EMAIL_FROM;
export const teamInbox = (): string => serverEnv().CONTACT_INBOX;

/** Sends one message. Returns false (never throws) when no provider is configured or delivery failed; failures are logged without content. */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const p = provider();
  if (!p) {
    if (process.env.NODE_ENV !== "production") log.info("email.dev_outbox", { to: maskEmail(message.to), subject: message.subject, body: message.text });
    return false;
  }
  try {
    await p.send(message, emailFrom());
    return true;
  } catch (error) {
    log.error("email.send_failed", { provider: p.name, to: maskEmail(message.to), error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}
