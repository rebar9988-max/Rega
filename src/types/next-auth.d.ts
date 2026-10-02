import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/rbac";

declare module "next-auth" {
  interface User { role?: Role; locale?: string }
  interface Session { user: { id: string; role: Role; locale: string } & DefaultSession["user"] }
}

declare module "@auth/core/jwt" {
  interface JWT { uid?: string; role?: Role; locale?: string }
}
