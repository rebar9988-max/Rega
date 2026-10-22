import { expect, test } from "./fixtures";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { EMPLOYEE } from "./global-setup";
import { encode } from "@auth/core/jwt";
import { randomUUID } from "node:crypto";

test("security headers: CSP, frame protection, nosniff, HSTS, referrer and permissions policies", async ({ request }) => {
  const res = await request.get("/de");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("default-src 'self'");
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["content-security-policy"]).toContain("object-src 'none'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["strict-transport-security"]).toContain("max-age=");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["permissions-policy"]).toContain("camera=()");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("CSP does not break the app: pages hydrate without CSP violations", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (m) => /Content Security Policy|Refused to/i.test(m.text()) && violations.push(m.text()));
  await page.goto("/ckb");
  // Header navigation (generated from the section registry): "بازرگانییەکان" leads to the businesses list.
  await page.getByRole("navigation", { name: "ناوبەری سەرەکی" }).getByRole("link", { name: "بازرگانییەکان", exact: true }).click();
  await expect(page).toHaveURL(/\/ckb\/businesses/);
  expect(violations, violations.join("\n")).toEqual([]);
});

test("public business API does not expose internal fields", async ({ request }) => {
  const body = await (await request.get("/api/v1/businesses/kurdistan-rechtsberatung")).json();
  expect(body.ok).toBe(true);
  for (const k of ["createdById", "viewCount", "deletedAt"]) expect(body.data).not.toHaveProperty(k);
});

test("abuse and malformed input are rejected safely (no stack traces, no 500s)", async ({ request }) => {
  const bad = await request.post("/api/v1/businesses", { headers: { "content-type": "application/json" }, data: "{not json" });
  expect(bad.status()).toBe(401); // auth is checked before the body is read
  const xss = await request.get(`/api/v1/search?q=${encodeURIComponent("<script>alert(1)</script>".repeat(50))}`);
  expect(xss.status()).toBe(200);
  expect(xss.headers()["content-type"]).toContain("application/json"); // JSON + nosniff: never rendered as HTML
  expect((await xss.json()).data.query.length).toBeLessThanOrEqual(120); // input is bounded
  const page = await (await request.get(`/de/search?q=${encodeURIComponent('"><script>alert(1)</script>')}`)).text();
  expect(page).not.toContain('"><script>alert(1)</script>'); // the HTML page escapes it
  const deep = await (await request.get("/api/v1/businesses?page=99999999&perPage=100000")).json();
  expect(deep.meta.page).toBe(500);
  expect(deep.meta.perPage).toBeLessThanOrEqual(100);
  const views = await request.post("/api/v1/views", { data: { slug: "x".repeat(500) } });
  expect(views.status()).toBe(422);
  const text = await views.text();
  expect(text).not.toMatch(/at \w+ \(|prisma|node_modules|\/home\//i);
  for (const m of ["PUT", "DELETE"] as const) {
    const r = await request.fetch("/api/v1/categories", { method: m });
    expect([401, 405]).toContain(r.status());
  }
});

test("a suspended account loses access immediately (session revalidation)", async ({ page }) => {
  await page.goto(`/de/login?next=${encodeURIComponent("/dr")}`);
  await page.getByLabel("E-Mail", { exact: true }).fill(EMPLOYEE.email);
  await page.getByLabel("Passwort", { exact: true }).fill(EMPLOYEE.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/dr$/);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    await prisma.user.update({ where: { email: EMPLOYEE.email }, data: { status: "suspended" } });
    await page.goto("/dr");
    // The session is gone: /dr shows its sign-in, not the dashboard.
    await expect(page.getByRole("heading", { name: "چوونەژوورەوەی بەڕێوەبەر" })).toBeVisible();
    const api = await page.request.post("/api/v1/businesses", { data: { name: "x" } });
    expect(api.status()).toBe(401);
  } finally {
    await prisma.user.update({ where: { email: EMPLOYEE.email }, data: { status: "active" } });
    await prisma.$disconnect();
  }
});

test("private reads recheck roles and account status even while the session role is cached", async ({ context, page }) => {
  test.skip(!process.env.AUTH_SECRET, "requires the local test server's signing secret");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const original = await prisma.user.findUniqueOrThrow({ where: { email: EMPLOYEE.email } });
  const marker = `e2eprivate${randomUUID().replaceAll("-", "")}`;
  let businessId: string | undefined;
  try {
    const business = await prisma.business.create({ data: {
      name: `E2E private read ${marker}`, slug: marker, searchText: marker, status: "draft",
      locations: { create: { addressLine1: "Local test address", countryCode: "DE", isPrimary: true } },
    } });
    businessId = business.id;
    const cookie = "authjs.session-token";
    // The suite normally revalidates sessions immediately. Keep this local test's JWT role cached so that
    // a passing test proves the private handlers recheck the account, independently of Auth.js renewal.
    const token = await encode({ secret: process.env.AUTH_SECRET!, salt: cookie, maxAge: 600,
      token: { uid: original.id, sub: original.id, email: original.email, role: "SUPER_ADMIN", locale: "de", checkedAt: Date.now() + 300_000 } });
    await context.addCookies([
      { name: cookie, value: token, url: String(test.info().project.use.baseURL), httpOnly: true, sameSite: "Lax" },
      { name: "REGA_LOCALE", value: "de", url: String(test.info().project.use.baseURL) },
    ]);

    for (const role of ["ADMIN", "MANAGER", "EMPLOYEE", "BUSINESS_OWNER", "USER"] as const) {
      await prisma.user.update({ where: { id: original.id }, data: { role, status: "active", deletedAt: null } });
      const cached = await (await context.request.get("/api/auth/session")).json();
      expect(cached.user.role).toBe("SUPER_ADMIN");
      const staff = ["ADMIN", "MANAGER", "EMPLOYEE"].includes(role);
      const list = await context.request.get(`/api/v1/businesses?q=${marker}`);
      expect((await list.json()).data.map((b: { id: string }) => b.id)).toEqual(staff ? [business.id] : []);
      const detail = await context.request.get(`/api/v1/businesses/${business.id}`);
      expect(detail.status()).toBe(staff ? 200 : 404);
      const locations = await context.request.get(`/api/v1/locations?businessId=${business.id}`);
      expect((await locations.json()).data).toHaveLength(staff ? 1 : 0);
      if (staff) for (const response of [list, detail, locations]) expect(response.headers()["cache-control"]).toContain("no-store");
    }
    for (const state of [{ status: "suspended", deletedAt: null }, { status: "active", deletedAt: new Date() }]) {
      await prisma.user.update({ where: { id: original.id }, data: { role: "ADMIN", ...state } });
      expect((await context.request.get(`/api/v1/businesses/${business.id}`)).status()).toBe(404);
      expect((await (await context.request.get(`/api/v1/businesses?q=${marker}`)).json()).data).toEqual([]);
      expect((await (await context.request.get(`/api/v1/locations?businessId=${business.id}`)).json()).data).toEqual([]);
      await page.goto("/dr");
      await expect(page).toHaveURL(/\/dr$/);
      await expect(page.getByText("Dieses Konto hat keinen Verwaltungszugriff.")).toBeVisible();
      await expect(page.getByRole("navigation")).toHaveCount(0);
    }
  } finally {
    await prisma.user.update({ where: { id: original.id }, data: { role: original.role, status: original.status, deletedAt: original.deletedAt } });
    if (businessId) await prisma.business.delete({ where: { id: businessId } });
    await prisma.$disconnect();
  }
});
