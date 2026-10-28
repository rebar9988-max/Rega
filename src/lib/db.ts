/**
 * Prisma client singleton for Node (Docker, `next start`, CI, local dev). Server-side only.
 * The browser NEVER talks to Postgres — all access goes through server code.
 *
 * On Cloudflare Workers the Workers build swaps this module for `db.workers.ts` (see next.config.ts).
 */
import "server-only";
import type { PrismaClient } from "@prisma/client";
import { createNodeClient } from "./db-node-client";
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? createNodeClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
