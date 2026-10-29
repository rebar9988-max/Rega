import { testSqlClient } from "./database-client";
import type { BrowserContext, Page } from "@playwright/test";
import { encode } from "@auth/core/jwt";
import type pg from "pg";
import { expect, test } from "./fixtures";
import { EMPLOYEE } from "./global-setup";

/**
 * Persistent sign-in: the session survives refreshes, navigation across languages and a browser restart (only persistent
 * cookies survive), is renewed while the site is used, ends only through explicit logout or a security reason (password
 * change), never deletes the account, and logging in again gives the same account.
 */

const DAY = 24 * 60 * 60;
const COOKIE = "authjs.session-token"; // the e2e server runs on http://localhost, so no __Secure- prefix

async function login(page: Page, who: { email: string; password: string }, next: string) {
  await page.goto(`/de/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("E-Mail", { exact: true }).fill(who.email);
  await page.getByLabel("Passwort", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(new RegExp(`${next.replace(/\//g, "\\/")}$`));
}

async function sessionCookie(context: BrowserContext) {
  return (await context.cookies()).find((c) => c.name === COOKIE);
}

async function sql<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values: unknown[] = []) {
  const client = testSqlClient();
  await client.connect();
  try {
    return (await client.query<T>(text, values)).rows;
  } finally {
    await client.end();
  }
}

const accountRows = (email: string) => sql<{ id: string; deletedAt: Date | null }>(`select id, "deletedAt" from "User" where email = $1`, [email]);

test("sign-in cookie: HttpOnly, SameSite=Lax, persistent for 90 days", async ({ page, context }) => {
  await login(page, EMPLOYEE, "/de/account");
  const cookie = await sessionCookie(context);
  expect(cookie, "session cookie after sign-in").toBeTruthy();
  expect(cookie!.httpOnly).toBe(true);
  expect(cookie!.sameSite).toBe("Lax");
  expect(cookie!.path).toBe("/");
  const now = Date.now() / 1000;
  expect(cookie!.expires, "a persistent cookie, not a browser-session cookie").toBeGreaterThan(now + 89 * DAY);
  expect(cookie!.expires).toBeLessThan(now + 91 * DAY);
});

test("refresh and navigation across pages and languages keep the visitor signed in, without a false redirect", async ({ page }) => {
  await login(page, EMPLOYEE, "/de/account");
  await page.reload();
  await expect(page).toHaveURL(/\/de\/account$/);
  await expect(page.getByText(EMPLOYEE.email)).toBeVisible();
  for (const path of ["/de/businesses", "/en", "/ckb/search", "/en/account", "/ckb/account", "/de/account"]) {
    await page.goto(path);
    expect((await (await page.request.get("/api/auth/session")).json())?.user?.email, `signed in on ${path}`).toBe(EMPLOYEE.email);
  }
  await expect(page).toHaveURL(/\/de\/account$/);
  await expect(page.getByText(EMPLOYEE.email)).toBeVisible();
});

test("closing and reopening the browser: only persistent cookies survive, and the session is among them", async ({ page, context, browser }) => {
  await login(page, EMPLOYEE, "/de/account");
  const saved = await context.storageState();
  const persistent = saved.cookies.filter((c) => c.expires > 0);
  expect(persistent.some((c) => c.name === COOKIE)).toBe(true);
  const reopened = await browser.newContext({ storageState: { cookies: persistent, origins: [] } });
  try {
    const again = await reopened.newPage();
    await again.goto(`${test.info().project.use.baseURL}/de/account`);
    await expect(again).toHaveURL(/\/de\/account$/);
    await expect(again.getByText(EMPLOYEE.email)).toBeVisible();
  } finally {
    await reopened.close();
  }
});

test("rolling renewal: the session endpoint re-issues the cookie with a later expiry, and so does a page load", async ({ page, context }) => {
  await login(page, EMPLOYEE, "/de/account");
  await page.waitForLoadState("networkidle");
  const first = await sessionCookie(context);
  expect(first).toBeTruthy();

  // Server side: a still-valid session answers with a fresh Set-Cookie (new JWT, new expiry).
  await page.waitForTimeout(1500);
  const res = await page.request.get("/api/auth/session");
  const setCookies = res.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie").map((h) => h.value);
  expect(setCookies.some((v) => v.startsWith(`${COOKIE}=`) && /expires=/i.test(v))).toBe(true);
  expect((await res.json()).user.email).toBe(EMPLOYEE.email);
  const second = await sessionCookie(context);
  expect(second!.expires).toBeGreaterThan(first!.expires);
  expect(second!.value, "a new token was issued").not.toBe(first!.value);

  // Browser side: opening a page renews it without the visitor doing anything.
  await page.waitForTimeout(1500);
  await page.reload();
  await expect.poll(async () => (await sessionCookie(context))!.expires, { timeout: 10_000 }).toBeGreaterThan(second!.expires);
});

test("a session issued under the old 14-day policy (no password marker) stays valid through the deployment and is upgraded to 90 days", async ({ page, context }) => {
  test.skip(!process.env.AUTH_SECRET, "needs the server's AUTH_SECRET to issue a token");
  const [row] = await accountRows(EMPLOYEE.email);
  const legacy = await encode({
    token: { sub: row.id, uid: row.id, name: "E2E Employee", email: EMPLOYEE.email, role: "EMPLOYEE", locale: "de", checkedAt: 0 },
    secret: process.env.AUTH_SECRET!,
    salt: COOKIE,
    maxAge: 14 * DAY,
  });
  const now = Date.now() / 1000;
  await context.addCookies([{ name: COOKIE, value: legacy, url: String(test.info().project.use.baseURL), httpOnly: true, sameSite: "Lax", expires: now + 14 * DAY }]);

  await page.goto("/de/account");
  await expect(page).toHaveURL(/\/de\/account$/);
  await expect(page.getByText(EMPLOYEE.email)).toBeVisible();

  // The next renewal replaces the 14-day cookie with a 90-day one.
  await expect.poll(async () => (await sessionCookie(context))?.expires ?? 0, { timeout: 10_000 }).toBeGreaterThan(now + 89 * DAY);
});

test("anonymous visitors cannot use protected pages or the session", async ({ page }) => {
  await page.goto("/de/account");
  await expect(page).toHaveURL(/\/de\/login/);
  await page.goto("/dr");
  await expect(page.getByRole("heading", { name: "چوونەژوورەوەی بەڕێوەبەر" })).toBeVisible();
  await expect(page.locator("aside")).toHaveCount(0);
  expect(await (await page.request.get("/api/auth/session")).json()).toBeNull();
});

test("logout ends the session but keeps the account; signing in again gives the same account (no duplicates)", async ({ page, context }) => {
  const [before] = await accountRows(EMPLOYEE.email);
  const linksBefore = await sql(`select 1 from "Account" where "userId" = $1`, [before.id]);

  await login(page, EMPLOYEE, "/de/account");
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(/\/de$/);
  expect(await sessionCookie(context), "session cookie removed by logout").toBeUndefined();
  expect(await (await page.request.get("/api/auth/session")).json()).toBeNull();
  await page.goto("/de/account");
  await expect(page).toHaveURL(/\/de\/login/);

  const [afterLogout] = await accountRows(EMPLOYEE.email);
  expect(afterLogout.id).toBe(before.id);
  expect(afterLogout.deletedAt).toBeNull();

  await login(page, EMPLOYEE, "/de/account");
  await expect(page.getByText(EMPLOYEE.email)).toBeVisible();
  const rows = await accountRows(EMPLOYEE.email);
  expect(rows).toHaveLength(1);
  expect(rows[0].id).toBe(before.id);
  expect(await sql(`select 1 from "Account" where "userId" = $1`, [before.id])).toHaveLength(linksBefore.length);
});

test("changing the password ends sessions opened with the old one; signing in with the current password works", async ({ page, context }) => {
  const [{ passwordHash }] = await sql<{ passwordHash: string }>(`select "passwordHash" from "User" where email = $1`, [EMPLOYEE.email]);
  try {
    await login(page, EMPLOYEE, "/de/account");
    // A reset elsewhere replaces the stored hash (any other well-formed hash stands in for the new password).
    await sql(`update "User" set "passwordHash" = $2 where email = $1`, [EMPLOYEE.email, "$2a$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"]);
    await page.goto("/de/account");
    await expect(page).toHaveURL(/\/de\/login/);
  } finally {
    await sql(`update "User" set "passwordHash" = $2 where email = $1`, [EMPLOYEE.email, passwordHash]);
  }
  await context.clearCookies();
  await login(page, EMPLOYEE, "/de/account");
  await expect(page.getByText(EMPLOYEE.email)).toBeVisible();
});
