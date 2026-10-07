/** Public content coverage for the approved REGA beta.
 * Jobs stay hidden until launch and Events are removed from public discovery.
 * Guides remain the enabled shared-content section.
 */
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { ADMIN } from "./global-setup";

const stamp = Date.now().toString(36);
const GUIDE = `Anmeldung in Köln ${stamp}`;

async function login(page: Page, email: string, password: string) {
  await page.goto("/de/login");
  await page.getByLabel("E-Mail", { exact: true }).fill(email);
  await page.getByLabel("Passwort", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

async function fillGerman(page: Page, title: string, extra: { summary?: string; body?: string } = {}) {
  await page.locator("summary", { hasText: "Deutsch" }).click();
  await page.getByLabel("Titel auf Deutsch").fill(title);
  if (extra.summary) await page.getByLabel("Kurzfassung auf Deutsch").fill(extra.summary);
  if (extra.body) await page.getByLabel("Text auf Deutsch").fill(extra.body);
}

test.describe.configure({ mode: "serial" });

test("approved beta keeps jobs and events unavailable on public routes", async ({ request }) => {
  for (const section of ["jobs", "events"]) {
    expect((await request.get(`/de/${section}`)).status(), section).toBe(404);
  }
});

test("a guide publishes and falls back from German to Sorani with language metadata", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dr/content/guides/new");
  await page.getByLabel("Lesezeit (Minuten)").fill("4");
  await fillGerman(page, GUIDE, { summary: "So melden Sie sich an.", body: "Schritt eins.\n\nSchritt zwei." });
  await page.getByRole("button", { name: "Speichern und veröffentlichen" }).click();
  await expect(page).toHaveURL(/published=1/);

  await page.goto("/de/guides");
  const card = page.getByTestId("content-card").filter({ hasText: GUIDE });
  await expect(card).toHaveCount(1);
  await card.getByRole("link", { name: GUIDE }).click();
  await page.waitForURL(/\/de\/guides\/[^/]+$/);
  const slug = new URL(page.url()).pathname.split("/").pop()!;
  await expect(page.getByRole("main")).toContainText("4 Min. Lesezeit");

  await page.goto(`/ckb/guides/${slug}`);
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toContainText(GUIDE);
  await expect(heading.locator("bdi")).toHaveAttribute("lang", "de-DE");
  await expect(heading.locator("bdi")).toHaveAttribute("dir", "ltr");
  const article = (await page.locator('script[type="application/ld+json"]').allTextContents())
    .map((s) => JSON.parse(s))
    .find((j) => j["@type"] === "Article");
  expect(article.headline).toBe(GUIDE);
  expect(article.inLanguage).toBe("de-DE");
});

test("content dashboard remains protected and invalid guide routes are 404", async ({ page, request }) => {
  const guest = await request.get("/dr/content/guides", { maxRedirects: 0 });
  expect([302, 307]).toContain(guest.status());
  await login(page, ADMIN.email, ADMIN.password);
  expect((await page.goto("/dr/content/unknown"))?.status()).toBe(404);
  expect((await page.goto("/dr/content/guides/does-not-exist"))?.status()).toBe(404);
  expect((await page.goto("/de/guides/does-not-exist"))?.status()).toBe(404);
});

test("sitemap exposes enabled guides and excludes hidden jobs/events", async ({ request }) => {
  const index = await (await request.get("/sitemap.xml")).text();
  expect(index).toContain("/sitemaps/guides-1.xml");
  expect(index).not.toContain("/sitemaps/jobs-1.xml");
  expect(index).not.toContain("/sitemaps/events-1.xml");

  const guides = await (await request.get("/sitemaps/guides-1.xml")).text();
  expect(guides).toContain("/de/guides/");
  expect(guides).toContain('hreflang="ckb-IQ"');
  expect((await request.get("/sitemaps/nonsense-1.xml")).status()).toBe(404);
});
