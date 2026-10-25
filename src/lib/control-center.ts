import { can, type Role } from "./rbac";

// Only settings that the application actually consumes; infrastructure secrets never enter a settings form.
export const MANAGED_FLAGS = ["public.reviews"] as const;
export function isManagedFlag(value: unknown): value is (typeof MANAGED_FLAGS)[number] {
  return typeof value === "string" && (MANAGED_FLAGS as readonly string[]).includes(value);
}
export function canManageSystem(role: Role): boolean {
  return can(role, "settings.write");
}
