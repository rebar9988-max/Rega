/**
 * Prepares a deterministic database: demo data + two known accounts, and resets the demo
 * businesses to their expected state (dashboard tests change status). Never deletes anything.
 */
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { startFakeAi } from "./fake-ai";

export const ADMIN = { email: "admin@example.org", password: "correct-horse-battery" };
export const EMPLOYEE = { email: "employee@example.org", password: "employee-pass-123" };

export default async function globalSetup() {
  if (!process.env.DATABASE_URL) throw new Error("E2E needs DATABASE_URL (use a dev/test database, never production).");
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
