import type { Permission } from "@/lib/rbac";

/** `key` maps to messages `dashboard.*`; an item is shown only if the role holds `permission`. */
export const DR_NAV: { key: string; href: string; permission: Permission }[] = [
  { key: "overview", href: "/dr", permission: "business.read" },
  { key: "businesses", href: "/dr/businesses", permission: "business.read" },
  { key: "services", href: "/dr/services", permission: "service.read" },
  { key: "categories", href: "/dr/categories", permission: "category.write" },
  { key: "users", href: "/dr/users", permission: "user.read" },
  { key: "aiGateway", href: "/dr/ai", permission: "aiconfig.read" },
  { key: "auditLogs", href: "/dr/audit", permission: "audit.read" },
];
