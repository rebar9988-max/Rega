import type { Permission } from "@/lib/rbac";
import type { DrIconName } from "./icons";
import { enabledSections } from "@/config/sections";
import { CONTENT, isContentSection } from "@/features/content/config";

/** Sidebar groups in display order; headings are messages `drAdmin.group_*`. */
export const DR_NAV_GROUPS = ["work", "content", "moderation", "system"] as const;
type Group = (typeof DR_NAV_GROUPS)[number];

/** `key` maps to messages `dashboard.*`; an item is shown only if the role holds `permission`. */
export const DR_NAV: { key: string; href: string; permission: Permission; icon: DrIconName; group: Group }[] = [
  { key: "overview", href: "/dr", permission: "business.read", icon: "overview", group: "work" },
  { key: "businesses", href: "/dr/businesses", permission: "business.read", icon: "businesses", group: "work" },
  { key: "services", href: "/dr/services", permission: "service.read", icon: "services", group: "work" },
  { key: "categories", href: "/dr/categories", permission: "category.write", icon: "categories", group: "work" },
  { key: "geography", href: "/dr/geography", permission: "category.write", icon: "geography", group: "work" },
  { key: "pages", href: "/dr/pages", permission: "content.write", icon: "pages", group: "content" },
  { key: "reviews", href: "/dr/reviews", permission: "review.moderate", icon: "reviews", group: "moderation" },
  { key: "reports", href: "/dr/reports", permission: "review.moderate", icon: "reports", group: "moderation" },
  { key: "messages", href: "/dr/messages", permission: "review.moderate", icon: "messages", group: "moderation" },
  { key: "users", href: "/dr/users", permission: "user.read", icon: "users", group: "system" },
  { key: "aiGateway", href: "/dr/ai", permission: "aiconfig.read", icon: "aiGateway", group: "system" },
  { key: "auditLogs", href: "/dr/audit", permission: "audit.read", icon: "auditLogs", group: "system" },
];

/** Dashboard entries of the enabled content sections (jobs, events, guides), generated from the section registry. `key` is a `nav.*` message. */
export function contentNav(): { key: string; href: string; permission: Permission }[] {
  return enabledSections().filter((s) => s.content && isContentSection(s.key)).map((s) => ({ key: s.labelKey ?? s.key, href: `/dr/content/${s.key}`, permission: CONTENT[s.key as keyof typeof CONTENT].write }));
}
