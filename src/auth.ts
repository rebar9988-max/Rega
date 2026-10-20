import NextAuth from "next-auth";
import { buildAuthConfig } from "@/auth.config";

// Lazy configuration: built for each request so social providers follow the runtime secrets (src/auth.config.ts).
export const { handlers, auth, signIn, signOut } = NextAuth(() => buildAuthConfig());
