/**
 * Prepares a deterministic database: demo data + two known accounts, and resets the demo
 * businesses to their expected state (dashboard tests change status). Never deletes anything.
 */
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { startFakeAi } from "./fake-ai";
import { isMissingBusinessTable } from "./database-safety";

export const ADMIN = { email: "admin@example.org", password: "correct-horse-battery" };
export const EMPLOYEE = { email: "employee@example.org", password: "employee-pass-123" };

/** Demo slugs this setup creates and resets; any other published business means the database holds real data. */
const DEMO_SLUGS = ["kurdistan-rechtsberatung", "zagros-restaurant", "sulaymaniyah-clinic"];
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "postgres", "db"]);

/**
 * Refuses to touch anything that could be production. E2E seeds demo businesses and accounts with known passwords,
 * so it only runs against a local/throw-away database. Fails before any write; never cleans anything up.
 */
export async function assertSafeDatabase(url: string) {
  const envs = [process.env.APP_ENV, process.env.VERCEL_ENV];
  if (envs.some((e) => e === "production")) throw new Error("E2E refused: the environment is marked as production.");
  let host = "";
  try { host = new URL(url).hostname; } catch { throw new Error("E2E refused: DATABASE_URL is not a valid URL."); }
  if (!LOCAL_HOSTS.has(host) && process.env.E2E_ALLOW_REMOTE_DB !== "1") {
    throw new Error(`E2E refused: database host "${host}" is not local. Use a local test database (or set E2E_ALLOW_REMOTE_DB=1 for a dedicated remote TEST database).`);
  }
  // Content check: a database with published businesses other than the demo set is treated as real data.
  const probe = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const real = await probe.business.count({ where: { status: "published", deletedAt: null, slug: { notIn: DEMO_SLUGS }, NOT: { name: { startsWith: "E2E " } } } });
    if (real > 0) throw new Error(`E2E refused: the database contains ${real} published non-test businesses (looks like real data).`);
  } catch (error) {
    // A fresh database without tables is fine (migrations create them); anything else stops the run.
    if (!isMissingBusinessTable(error)) throw error;
  } finally {
    await probe.$disconnect();
  }
}

export default async function globalSetup() {
  if (!process.env.DATABASE_URL) throw new Error("E2E needs DATABASE_URL (use a dev/test database, never production).");
  await assertSafeDatabase(process.env.DATABASE_URL);
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env: { ...process.env, SEED_DEMO: "1", SEED_ADMIN_EMAIL: ADMIN.email, SEED_ADMIN_PASSWORD: ADMIN.password, NODE_ENV: "development" } });

  const fakeAi = await startFakeAi();
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    await prisma.featureFlag.upsert({ where: { key: "public.aiSearch" }, update: { enabled: true, rollout: 100 }, create: { key: "public.aiSearch", enabled: true, rollout: 100 } });
    await prisma.user.upsert({
      where: { email: EMPLOYEE.email }, update: { role: "EMPLOYEE", status: "active", passwordHash: await bcrypt.hash(EMPLOYEE.password, 10) },
      create: { email: EMPLOYEE.email, name: "E2E Employee", role: "EMPLOYEE", locale: "de", passwordHash: await bcrypt.hash(EMPLOYEE.password, 10) },
    });
    await prisma.user.update({ where: { email: ADMIN.email }, data: { role: "SUPER_ADMIN", status: "active", passwordHash: await bcrypt.hash(ADMIN.password, 10) } });
    const demo = { "kurdistan-rechtsberatung": { verified: true, featured: true }, "zagros-restaurant": { verified: true, featured: false }, "sulaymaniyah-clinic": { verified: false, featured: true } };
    for (const [slug, flags] of Object.entries(demo)) {
      await prisma.business.update({ where: { slug }, data: { status: "published", ...flags } });
    }
  } finally {
    await prisma.$disconnect();
  }
  return () => fakeAi.close();
}
