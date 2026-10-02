import type { Permission } from "@/lib/rbac";
import { enabledSections } from "@/config/sections";
import { CONTENT, isContentSection } from "@/features/content/config";

/** `key` maps to messages `dashboard.*`; an item is shown only if the role holds `permission`. */
export const DR_NAV: { key: string; href: string; permission: Permission }[] = [
  { key: "overview", href: "/dr", permission: "business.read" },
  { key: "businesses", href: "/dr/businesses", permission: "business.read" },
  { key: "services", href: "/dr/services", permission: "service.read" },
  { key: "import", href: "/dr/import", permission: "business.publish" },
  { key: "categories", href: "/dr/categories", permission: "category.write" },
  { key: "geography", href: "/dr/geography", permission: "category.write" },
  { key: "pages", href: "/dr/pages", permission: "content.write" },
  { key: "reviews", href: "/dr/reviews", permission: "review.moderate" },
  { key: "reports", href: "/dr/reports", permission: "review.moderate" },
  { key: "messages", href: "/dr/messages", permission: "review.moderate" },
  { key: "users", href: "/dr/users", permission: "user.read" },
  { key: "aiGateway", href: "/dr/ai", permission: "aiconfig.read" },
  { key: "auditLogs", href: "/dr/audit", permission: "audit.read" },
];

/** Dashboard entries of the enabled content sections (jobs, events, guides), generated from the section registry. `key` is a `nav.*` message. */
export function contentNav(): { key: string; href: string; permission: Permission }[] {
  return enabledSections().filter((s) => s.content && isContentSection(s.key)).map((s) => ({ key: s.labelKey ?? s.key, href: `/dr/content/${s.key}`, permission: CONTENT[s.key as keyof typeof CONTENT].write }));
}
