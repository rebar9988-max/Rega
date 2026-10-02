/**
 * Shared abuse protection of every public form (contact, report, register, password reset):
 * a honeypot field that humans never fill, plus a per-client rate limit. Server-only.
 */
import "server-only";
import { headers } from "next/headers";
import { allowShared } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";

import { HONEYPOT_FIELD } from "./constants";

export type GuardResult = "ok" | "spam" | "rate";

/** "spam": the honeypot was filled (callers answer as if it worked, so bots learn nothing). "rate": too many requests from this client. */
export async function guardForm(formData: FormData, bucket: string, limit = 5, windowMs = 10 * 60_000): Promise<GuardResult> {
  if (String(formData.get(HONEYPOT_FIELD) ?? "").trim() !== "") return "spam";
  const ip = clientIp(await headers());
  return (await allowShared("FORM_LIMITER", `form:${bucket}:${ip}`, limit, windowMs)) ? "ok" : "rate";
}

/** Plain-text field with length cap; control characters (incl. line breaks in single-line fields) cannot reach e-mail headers or logs. */
export const singleLine = (value: string) => value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
