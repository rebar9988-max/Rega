import type { Permission } from "@/lib/rbac";
import type { DrIconName } from "./icons";
import { enabledSections } from "@/config/sections";
import { CONTENT, isContentSection } from "@/features/content/config";

/** Sidebar groups in display order; headings are messages `drAdmin.group_*`. */
export const DR_NAV_GROUPS = ["work", "content", "moderation", "system"] as const;
type Group = (typeof DR_NAV_GROUPS)[number];

/** `key` maps to messages `dashboard.*`; an item is shown only if the role holds `permission`. */
export const DR_NAV: { key: string; href: string; permission: Permission; icon: DrIconName; group: Group }[] = [
  { key: "overview", href: "/admin", permission: "business.read", icon: "overview", group: "work" },
  { key: "businesses", href: "/admin/businesses", permission: "business.read", icon: "businesses", group: "work" },
  { key: "services", href: "/admin/services", permission: "service.read", icon: "services", group: "work" },
  { key: "categories", href: "/admin/categories", permission: "category.write", icon: "categories", group: "work" },
  { key: "geography", href: "/admin/geography", permission: "category.write", icon: "geography", group: "work" },
  { key: "pages", href: "/admin/pages", permission: "content.write", icon: "pages", group: "content" },
  { key: "reviews", href: "/admin/reviews", permission: "review.moderate", icon: "reviews", group: "moderation" },
  { key: "reports", href: "/admin/reports", permission: "review.moderate", icon: "reports", group: "moderation" },
  { key: "messages", href: "/admin/messages", permission: "review.moderate", icon: "messages", group: "moderation" },
  { key: "users", href: "/admin/users", permission: "user.read", icon: "users", group: "system" },
  { key: "aiGateway", href: "/admin/ai", permission: "aiconfig.read", icon: "aiGateway", group: "system" },
  { key: "media", href: "/admin/media", permission: "media.read", icon: "businesses", group: "work" },
  { key: "settings", href: "/admin/system", permission: "settings.write", icon: "aiGateway", group: "system" },
  { key: "auditLogs", href: "/admin/audit", permission: "audit.read", icon: "auditLogs", group: "system" },
];

/** Dashboard entries of the enabled content sections (jobs, events, guides), generated from the section registry. `key` is a `nav.*` message. */
export function contentNav(): { key: string; href: string; permission: Permission }[] {
  return enabledSections().filter((s) => s.content && isContentSection(s.key)).map((s) => ({ key: s.labelKey ?? s.key, href: `/admin/content/${s.key}`, permission: CONTENT[s.key as keyof typeof CONTENT].write }));
}
