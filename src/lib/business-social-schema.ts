import { z } from "zod";
import { normalizeBusinessSocialUrl, type BusinessSocialPlatform } from "./business-social";

const socialUrl = (platform: BusinessSocialPlatform) => z.unknown().transform((value, ctx) => {
  const result = normalizeBusinessSocialUrl(platform, value);
  if (result.ok) return result.value;
  ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter an HTTPS account URL for this platform." });
  return z.NEVER;
}).optional();

/** Omitted fields preserve existing values; empty strings/null explicitly remove a saved account. */
export const businessSocialSchemas = {
  facebookUrl: socialUrl("facebook"), instagramUrl: socialUrl("instagram"),
  tiktokUrl: socialUrl("tiktok"), snapchatUrl: socialUrl("snapchat"),
};
