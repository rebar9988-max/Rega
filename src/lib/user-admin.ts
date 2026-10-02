/**
 * Staff and role administration. Every rule is enforced here on the server (and the rank rules in rbac.ts);
 * the dashboard only hides what a role cannot do.
 */
import "server-only";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { HttpError, type SessionUser } from "@/lib/auth-helpers";
import { ROLES, assignableRoles, can, canManageUser, type Role } from "@/lib/rbac";

const password = z.string().min(12).max(200).refine((p) => p === p.trim(), "no leading/trailing spaces");

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  name: z.string().trim().min(2).max(200),
  role: z.enum(ROLES),
  password,
});
export const updateUserSchema = z.object({
  id: z.string().min(1).max(64),
  role: z.enum(ROLES).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  password: z.union([z.literal(""), password]).optional().transform((v) => v || undefined),
});

export type UserAdminError = "exists" | "forbidden_role" | "forbidden" | "last_super_admin" | "not_found";

async function activeSuperAdmins(exceptId: string): Promise<number> {
  return prisma.user.count({ where: { role: "SUPER_ADMIN", status: "active", deletedAt: null, NOT: { id: exceptId } } });
}

export async function createStaffUser(actor: SessionUser, input: z.infer<typeof createUserSchema>): Promise<{ ok: true; id: string } | { ok: false; error: UserAdminError }> {
  if (!can(actor.role, "user.write")) throw new HttpError(403, "forbidden", "Your role does not allow this action.");
  if (!assignableRoles(actor.role).includes(input.role)) return { ok: false, error: "forbidden_role" };
  if (await prisma.user.findFirst({ where: { email: { equals: input.email, mode: "insensitive" } }, select: { id: true } })) return { ok: false, error: "exists" };
  const user = await prisma.user.create({
    data: { email: input.email, name: input.name, role: input.role, status: "active", passwordHash: await bcrypt.hash(input.password, 12) },
    select: { id: true },
  });
  return { ok: true, id: user.id };
}

export async function updateStaffUser(actor: SessionUser, input: z.infer<typeof updateUserSchema>): Promise<{ ok: true; changed: string[] } | { ok: false; error: UserAdminError }> {
  const target = await prisma.user.findFirst({ where: { id: input.id, deletedAt: null }, select: { id: true, role: true, status: true } });
  if (!target) return { ok: false, error: "not_found" };
  if (!canManageUser(actor, { id: target.id, role: target.role as Role })) return { ok: false, error: "forbidden" };

  const data: { role?: Role; status?: string; passwordHash?: string } = {};
  if (input.role && input.role !== target.role) {
    // Changing a role needs the dedicated permission (SUPER_ADMIN by default) and a role the actor may give.
    if (!can(actor.role, "user.role") || !assignableRoles(actor.role).includes(input.role)) return { ok: false, error: "forbidden_role" };
    data.role = input.role;
  }
  if (input.status && input.status !== target.status) {
    if (!can(actor.role, "user.write")) return { ok: false, error: "forbidden" };
    data.status = input.status;
  }
  if (input.password) {
    if (!can(actor.role, "user.write")) return { ok: false, error: "forbidden" };
    data.passwordHash = await bcrypt.hash(input.password, 12);
  }
  const losesSuperAdmin = target.role === "SUPER_ADMIN" && ((data.role && data.role !== "SUPER_ADMIN") || data.status === "suspended");
  if (losesSuperAdmin && (await activeSuperAdmins(target.id)) === 0) return { ok: false, error: "last_super_admin" };

  if (Object.keys(data).length) await prisma.user.update({ where: { id: target.id }, data });
  return { ok: true, changed: Object.keys(data).map((k) => (k === "passwordHash" ? "password" : k)) };
}
