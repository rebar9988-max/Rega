import type { Owner } from "@/config/owner";

export type LegalKey = "impressum" | "privacy" | "terms";
/** One headed block of a legal page: paragraphs and/or a bullet list. */
export type LegalBlock = { h: string; p?: string[]; ul?: string[] };
export type LegalDoc = { title: string; description: string; blocks: LegalBlock[] };
export type LegalUi = {
  /** Shown on every non-German page. */
  translationNote: string;
  germanLink: string;
  updated: string;
};
export type LegalTexts = Record<LegalKey, LegalDoc> & { ui: LegalUi };

/** Facts the texts depend on beyond the owner's details. */
export type LegalContext = {
  /** How long REGA Assistant conversations are kept. */
  aiRetentionDays: number;
  /** True when LEGAL_ANALYTICS_TOOL names a tool (then the policy says so; a consent banner may be required). */
  analytics: boolean;
};

export type LegalBuilder = (owner: Owner, ctx: LegalContext) => LegalTexts;

/** Date the texts were last reviewed by the maintainers (ISO). Update it with every change to the texts. */
export const LEGAL_UPDATED = "2026-10-08";
