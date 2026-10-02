import "server-only";
import { auth } from "@/auth";
import { canAny, isStaff, type Permission, type Role } from "@/lib/rbac";

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
};

/** Returns the signed-in user, or null. Safe in server components and route handlers. */
export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? null,
    role: session.user.role ?? "USER",
  };
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Throws 401/403 unless the visitor holds one of the permissions. */
export async function requirePermission(...permissions: Permission[]): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "unauthenticated", "Authentication required.");
  if (!canAny(user.role, permissions)) {
    throw new HttpError(403, "forbidden", "Your role does not allow this action.");
  }
  return user;
}

/** Throws 403 unless the visitor may enter the management dashboard. */
export async function requireStaff(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "unauthenticated", "Authentication required.");
  if (!isStaff(user.role)) throw new HttpError(403, "forbidden", "Staff access required.");
  return user;
}
