import { expect, test } from "./fixtures";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { EMPLOYEE } from "./global-setup";

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
    await expect(page).toHaveURL(/\/login/);
    const api = await page.request.post("/api/v1/businesses", { data: { name: "x" } });
    expect(api.status()).toBe(401);
  } finally {
    await prisma.user.update({ where: { email: EMPLOYEE.email }, data: { status: "active" } });
    await prisma.$disconnect();
  }
});
