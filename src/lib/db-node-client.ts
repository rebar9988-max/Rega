/** Node-only constructor shared by local app, seed, and disposable database verification. */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient as SqliteClient } from "../../.generated/d1-client";
import { usesD1, registerD1Provider } from "./d1-connection";
import { createD1Client } from "./d1-client";
import { localD1 } from "./d1-local";

export function createNodeClient(): PrismaClient {
  if (usesD1()) {
    if (!process.env.D1_SQLITE_PATH) throw new Error("D1_SQLITE_PATH is required for local D1 development");
    const binding = localD1(process.env.D1_SQLITE_PATH);
    registerD1Provider(() => binding);
    return createD1Client(SqliteClient);
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 }), log: ["error"] });
}
