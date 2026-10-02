/**
 * Section registry — the ONE list of top-level sections of the site.
 *
 * Header, mobile menu, footer, sitemap, site search and robots are GENERATED from it; none of them lists a route by
 * hand. Adding a section = a feature folder + one entry here + its `nav.<labelKey>` translations (see
 * docs/HOW-TO-EXTEND.md). A section with `enabled: false` is built but invisible everywhere (no nav, no sitemap,
 * 404 on its route via `sectionEnabled`) until it is switched on, here or through SECTIONS_ENABLED / SECTIONS_DISABLED
 * (comma-separated keys in the environment; no code change, no redeploy of code, no deleted code).
 *
 * Pure module: no I/O, safe to import from server and client components.
 */

export type FooterGroup = "explore" | "more" | "contact" | "legal";

export type SectionDef = {
  /** Stable key. Also the `nav.<key>` translation key unless `labelKey` is set. */
  key: string;
  /** Route segment below /[locale]; "" is the home page. */
  path: string;
  /** Name of the `nav.*` message used as the label everywhere (one term per section). */
  labelKey?: string;
  /** Icon name (rendered by the components that show icons; unknown names render no icon). */
  icon?: string;
  /** Sort order within every list (nav, footer, sitemap). */
  order: number;
  enabled: boolean;
  /** Primary navigation of the desktop header. */
  header?: boolean;
  /** Menu sheet (mobile). */
  mobile?: boolean;
  /** Footer column the link belongs to. */
  footer?: FooterGroup;
  sitemap?: boolean;
  /** Included in the site-wide search page (its tabs). */
  search?: boolean;
  /** A content section built on the shared Listing core (features/content): it gets dashboard pages automatically. */
  content?: boolean;
  /** Retrievable by REGA Assistant: needs a retriever in lib/search/postgres.ts (tests/config.test.ts enforces it). */
  assistant?: boolean;
  /** Needs an administrative or legal review before it is switched on; informational only. */
  note?: string;
};

export const SECTIONS: readonly SectionDef[] = [
  { key: "home", path: "", icon: "home", order: 0, enabled: true, header: true, mobile: true, sitemap: true },
  { key: "businesses", path: "/businesses", icon: "store", order: 10, enabled: true, header: true, mobile: true, footer: "explore", sitemap: true, search: true, assistant: true },
  { key: "services", path: "/services", icon: "wrench", order: 20, enabled: true, header: true, mobile: true, footer: "explore", sitemap: true, search: true, assistant: true },
  { key: "locations", path: "/locations", icon: "pin", order: 30, enabled: true, mobile: true, footer: "explore", sitemap: true, search: true },
  { key: "nearby", path: "/nearby", icon: "compass", order: 40, enabled: true, mobile: true, footer: "explore", sitemap: true },
  { key: "ai", path: "/ai", icon: "spark", order: 50, enabled: true, mobile: true, footer: "more", sitemap: true },
  // Content sections built on the shared Listing core (features/content). Switch one off with SECTIONS_DISABLED=jobs (or enabled: false): it disappears from nav, footer, sitemap and returns 404.
  { key: "jobs", path: "/jobs", icon: "briefcase", order: 60, enabled: true, content: true, header: true, mobile: true, footer: "explore", sitemap: true, assistant: true },
  { key: "events", path: "/events", icon: "calendar", order: 70, enabled: true, content: true, mobile: true, footer: "explore", sitemap: true, assistant: true },
  { key: "guides", path: "/guides", icon: "book", order: 80, enabled: true, content: true, mobile: true, footer: "explore", sitemap: true, assistant: true },
  { key: "about", path: "/about", icon: "info", order: 90, enabled: true, header: true, mobile: true, footer: "more", sitemap: true },
  { key: "forBusiness", path: "/for-business", icon: "store", order: 95, enabled: true, mobile: true, footer: "more", sitemap: true },
  { key: "register", path: "/register", order: 97, enabled: true, sitemap: true },
  { key: "contact", path: "/contact", icon: "mail", order: 100, enabled: true, mobile: true, footer: "more", sitemap: true },
  // Legal pages (Phase 1): linked from the footer of every page.
  { key: "impressum", path: "/impressum", order: 200, enabled: true, footer: "legal", sitemap: true },
  { key: "privacy", path: "/privacy", order: 210, enabled: true, footer: "legal", sitemap: true },
  { key: "terms", path: "/terms", order: 220, enabled: true, footer: "legal", sitemap: true },
  { key: "report", path: "/report", order: 230, enabled: true, footer: "legal", sitemap: true },
];

type Env = Record<string, string | undefined>;

const csv = (v: string | undefined) => new Set((v ?? "").split(",").map((s) => s.trim()).filter(Boolean));

/** Registry with the environment overrides applied (DISABLED wins over ENABLED). Sorted by `order`. */
export function resolveSections(env: Env = process.env, defs: readonly SectionDef[] = SECTIONS): SectionDef[] {
  const on = csv(env.SECTIONS_ENABLED);
  const off = csv(env.SECTIONS_DISABLED);
  return defs
    .map((s) => ({ ...s, enabled: off.has(s.key) ? false : on.has(s.key) ? true : s.enabled }))
    .sort((a, b) => a.order - b.order);
}

export function enabledSections(env: Env = process.env, defs: readonly SectionDef[] = SECTIONS): SectionDef[] {
  return resolveSections(env, defs).filter((s) => s.enabled);
}

export const labelKeyOf = (s: SectionDef) => s.labelKey ?? s.key;

/** Enabled sections of one surface, in order. */
export function sectionsFor(surface: "header" | "mobile" | "sitemap" | "search" | "assistant", env?: Env, defs?: readonly SectionDef[]): SectionDef[] {
  return enabledSections(env, defs).filter((s) => s[surface]);
}

export function footerSections(group: FooterGroup, env?: Env, defs?: readonly SectionDef[]): SectionDef[] {
  return enabledSections(env, defs).filter((s) => s.footer === group);
}

/** Pages that exist only while their section is enabled call this and `notFound()` on false. */
export function sectionEnabled(key: string, env?: Env, defs?: readonly SectionDef[]): boolean {
  return enabledSections(env, defs).some((s) => s.key === key);
}

export function sectionByKey(key: string, env?: Env, defs?: readonly SectionDef[]): SectionDef | undefined {
  return enabledSections(env, defs).find((s) => s.key === key);
}
