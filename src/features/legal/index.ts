import { ownerDetails } from "@/config/owner";
import { AI_RETENTION_DAYS } from "@/config/site";
import type { Locale } from "@/config/locales";
import { ar } from "./texts/ar";
import { ckb } from "./texts/ckb";
import { de } from "./texts/de";
import { en } from "./texts/en";
import { fa } from "./texts/fa";
import { kmr } from "./texts/kmr";
import { tr } from "./texts/tr";
import type { LegalBuilder, LegalTexts } from "./types";

export { LEGAL_UPDATED, type LegalKey } from "./types";

const BUILDERS: Record<string, LegalBuilder> = { ckb, kmr, de, en, ar, fa, tr };

/**
 * Legal texts of a locale with the operator's details filled in. German is the binding original; a locale without a
 * translation (a newly added language) shows the English text. Texts are built per request: the owner details come from
 * the environment at runtime.
 */
export function legalTexts(locale: Locale, env: Record<string, string | undefined> = process.env): LegalTexts {
  const owner = ownerDetails(env);
  const analytics = owner.analyticsTool.trim().toLowerCase() !== "none" && owner.analyticsTool.trim() !== "" && !owner.missing.includes("analyticsTool");
  return (BUILDERS[locale] ?? en)(owner, { aiRetentionDays: AI_RETENTION_DAYS, analytics });
}

export const hasTranslation = (locale: string) => locale in BUILDERS;
