import { expect, test } from "./fixtures";

const BERLIN = { latitude: 52.5201, longitude: 13.4049 };

test("Radar (Smart Request) works end to end for an anonymous visitor, without sign-in", async ({ page, context, browser }) => {
  await context.clearCookies();
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation(BERLIN);

  // The public page carries the form itself; no redirect to login.
  const res = await page.goto("/de/smart-request");
  expect(res?.status()).toBe(200);
  expect(page.url()).not.toContain("/login");
  const form = page.getByTestId("smart-request-form");
  await expect(form).toBeVisible();
  expect((await page.goto("/de/smart-request/new"))?.status()).toBe(200);
  expect(page.url()).not.toContain("/login");
  await page.goto("/de/smart-request");

  const category = await form.locator('select[name="categoryId"] option:not([disabled])').first().getAttribute("value");
  expect(category).toBeTruthy();
  await form.locator('select[name="categoryId"]').selectOption(category!);
  const title = `Radar guest e2e ${Date.now()}`;
  await form.locator('input[name="title"]').fill(title);
  await form.getByRole("button", { name: /standort/i }).click();
  await expect(form.locator('input[name="lat"]')).toHaveValue("52.52");
  await form.locator('input[name="consent"]').check();
  await form.locator('button[type="submit"]').click();

  // The request page of the guest's own request.
  await page.waitForURL(/\/de\/smart-request\/[\w-]+$/);
  const detailUrl = page.url();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);

  // The device remembers it; the cookie is httpOnly.
  const cookie = (await context.cookies()).find((c) => c.name === "rega_radar");
  expect(cookie?.httpOnly).toBe(true);
  await page.goto("/de/smart-request");
  await expect(page.getByTestId("my-requests")).toContainText(title);

  // The guest can close their own request without an account.
  await page.goto(detailUrl);
  await page.locator('form:has(input[name="kind"][value="closed"]) button[type="submit"]').click();
  await expect(page.locator('form:has(input[name="kind"][value="closed"])')).toHaveCount(0);

  // Another visitor cannot open it.
  const other = await browser.newContext();
  try {
    const stranger = await other.newPage();
    expect((await stranger.goto(detailUrl))?.status()).toBe(404);
  } finally {
    await other.close();
  }
});
