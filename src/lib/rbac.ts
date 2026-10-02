/**
 * RBAC — central permission matrix.
 * Every API route and server component checks permissions through this module.
 */

export const ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE", "USER"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "business.read",
  "business.write",
  "business.publish",
  "business.delete",
  "service.read",
  "service.write",
  "service.publish",
  "location.read",
  "location.write",
  "category.read",
  "category.write",
  "media.read",
  "media.write",
  "media.delete",
  "user.read",
  "user.write",
  "user.role",
  "role.read",
  "analytics.read",
  "audit.read",
  "settings.read",
  "settings.write",
  "aiconfig.read",
  "aiconfig.write",
  "featureflag.read",
  "featureflag.write",
  "content.read",
  "content.write",
  "review.moderate",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL: Permission[] = [...PERMISSIONS];

const MATRIX: Record<Role, Permission[] | "*"> = {
  SUPER_ADMIN: "*",
  ADMIN: ALL.filter((p) => p !== "settings.write" && p !== "featureflag.write" && p !== "user.role").concat([
    "settings.read",
    "featureflag.read",
    "aiconfig.read",
  ]),
  MANAGER: [
    "business.read",
    "business.write",
    "business.publish",
    "service.read",
    "service.write",
    "service.publish",
    "location.read",
    "location.write",
    "category.read",
    "category.write",
    "media.read",
    "media.write",
    "media.delete",
    "analytics.read",
    "content.read",
    "content.write",
    "review.moderate",
    "user.read",
  ],
  EMPLOYEE: [
    "business.read",
    "business.write",
    "service.read",
    "service.write",
    "location.read",
    "location.write",
    "category.read",
    "media.read",
    "media.write",
    "content.read",
  ],
  USER: [],
};

const ROLE_RANK: Record<Role, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 80,
  MANAGER: 60,
  EMPLOYEE: 40,
  USER: 10,
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  const granted = MATRIX[role];
  if (granted === "*") return true;
  return granted.includes(permission);
}

export function canAny(role: Role | null | undefined, permissions: Permission[]): boolean {
  return permissions.some((p) => can(role, p));
}

/** Staff = anyone allowed into the management dashboard. */
export function isStaff(role: Role | null | undefined): boolean {
  return Boolean(role) && role !== "USER";
}

export function atLeast(role: Role | null | undefined, min: Role): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export function permissionsOf(role: Role): Permission[] {
  const granted = MATRIX[role];
  return granted === "*" ? [...ALL] : [...granted];
}
