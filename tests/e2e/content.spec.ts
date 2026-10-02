/** Jobs, events, guides: dashboard create / publish / moderation, public pages with structured data, language fallback, scoping of owners. */
import type { Page } from "@playwright/test";
import pg from "pg";
import { expect, test } from "./fixtures";
import { ADMIN } from "./global-setup";
import { UNCONFIRMED_NOTICE, confirmEmailOf } from "./confirm-email";

const stamp = Date.now().toString(36);
const OWNER = { name: "E2E Inhaber Inhalte", email: `content-${stamp}@example.org`, password: "owner-pass-12345" };
const JOB = `Koch gesucht ${stamp}`;
const EVENT = `Newroz Fest ${stamp}`;
const GUIDE = `Anmeldung in Köln ${stamp}`;
const OWNER_JOB = `Küchenhilfe ${stamp}`;

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

test("a moderator publishes a job: public list, detail page, apply link and JobPosting data", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dr/content/jobs/new");
  await page.locator('select[name="businessId"]').selectOption({ index: 1 });
  await page.getByLabel("Bewerbungs-E-Mail").fill("jobs@example.org");
  await fillGerman(page, JOB, { summary: "Wir suchen Verstärkung in der Küche.", body: "Erste Zeile.\n\nZweite Zeile." });
  await page.getByRole("button", { name: "Speichern und veröffentlichen" }).click();
  await expect(page).toHaveURL(/published=1/);
  await expect(page.getByTestId("form-notice")).toHaveText("Veröffentlicht.");

  await page.goto("/de/jobs");
  const card = page.getByTestId("content-card").filter({ hasText: JOB });
  await expect(card).toHaveCount(1);
  await card.getByRole("link", { name: JOB }).click();
  await expect(page.getByRole("heading", { level: 1, name: JOB })).toBeVisible();
  await expect(page.getByTestId("apply-email")).toHaveAttribute("href", "mailto:jobs@example.org");
  await expect(page.getByRole("main")).toContainText("Zweite Zeile.");
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  const posting = ld.map((s) => JSON.parse(s)).find((j) => j["@type"] === "JobPosting");
  expect(posting.title).toBe(JOB);
  expect(posting.hiringOrganization.name).toBeTruthy();
  expect(page.url()).toContain("/de/jobs/");
  // The description (meta) is built from the summary and fitted to the search-result length.
  const description = await page.locator('meta[name="description"]').getAttribute("content");
  expect(description!.length).toBeGreaterThanOrEqual(120);
  expect(description!.length).toBeLessThanOrEqual(155);
  await expect(page.getByRole("link", { name: "Diesen Inhalt melden" })).toHaveAttribute("href", /\/de\/report\?url=.*%2Fde%2Fjobs%2F/);

  // Search inside the section.
  await page.goto(`/de/jobs?q=${encodeURIComponent(`koch gesucht ${stamp}`)}`);
  await expect(page.getByTestId("content-card")).toHaveCount(1);
  await page.goto("/de/jobs?q=zzzzzz-nichts");
  await expect(page.getByTestId("content-card")).toHaveCount(0);
  await expect(page.getByTestId("be-first-cta")).toBeVisible();
});

test("a job needs an application route; an event needs a start; a guide needs a text", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dr/content/jobs/new");
  await page.locator('select[name="businessId"]').selectOption({ index: 1 });
  await fillGerman(page, `Ohne Bewerbung ${stamp}`);
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.getByTestId("form-error")).toContainText("Angaben unvollständig");

  await page.goto("/dr/content/guides/new");
  await fillGerman(page, `Ohne Text ${stamp}`);
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.getByTestId("form-error")).toContainText("Angaben unvollständig");
});

test("events: upcoming and past are separated; the structured data carries the stored dates", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dr/content/events/new");
  await page.getByLabel("Beginn", { exact: true }).fill("2031-03-21T18:00");
  await page.getByLabel("Veranstaltungsort").fill("Stadthalle");
  await fillGerman(page, EVENT, { summary: "Gemeinsam feiern." });
  await page.getByRole("button", { name: "Speichern und veröffentlichen" }).click();
  await expect(page).toHaveURL(/published=1/);

  await page.goto("/de/events");
  const card = page.getByTestId("content-card").filter({ hasText: EVENT });
  await expect(card).toHaveCount(1);
  await expect(card.locator("time")).toHaveAttribute("datetime", "2031-03-21T18:00");
  await page.goto("/de/events?when=past");
  await expect(page.getByTestId("content-card").filter({ hasText: EVENT })).toHaveCount(0);

  await page.goto("/de/events");
  await card.getByRole("link", { name: EVENT }).click();
  await expect(page.getByRole("main")).toContainText("Stadthalle");
  const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((s) => JSON.parse(s)).find((j) => j["@type"] === "Event");
  expect(ld.startDate).toBe("2031-03-21T18:00");
  expect(ld.name).toBe(EVENT);
});

test("a guide in German is shown in Sorani with the German text marked as such (language fallback)", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dr/content/guides/new");
  await page.getByLabel("Lesezeit (Minuten)").fill("4");
  await fillGerman(page, GUIDE, { summary: "So melden Sie sich an.", body: "Schritt eins.\n\nSchritt zwei." });
  await page.getByRole("button", { name: "Speichern und veröffentlichen" }).click();
  await expect(page).toHaveURL(/published=1/);

  await page.goto("/de/guides");
  await page.getByTestId("content-card").filter({ hasText: GUIDE }).getByRole("link", { name: GUIDE }).click();
  const slug = new URL(page.url()).pathname.split("/").pop()!;
  await expect(page.getByRole("main")).toContainText("4 Min. Lesezeit");

  await page.goto(`/ckb/guides/${slug}`);
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toContainText(GUIDE);
  await expect(heading.locator("bdi")).toHaveAttribute("lang", "de");
  await expect(heading.locator("bdi")).toHaveAttribute("dir", "ltr");
  const article = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((s) => JSON.parse(s)).find((j) => j["@type"] === "Article");
  expect(article.headline).toBe(GUIDE);
  expect(article.inLanguage).toBe("de-DE");
});

test("an owner submits for review, cannot publish, sees only own business; a moderator approves", async ({ page, browser }) => {
  await page.goto("/de/register");
  const reg = page.getByTestId("register-form");
  await reg.getByLabel("Name", { exact: true }).fill(OWNER.name);
  await reg.getByLabel("E-Mail", { exact: true }).fill(OWNER.email);
  await reg.getByLabel("Passwort", { exact: true }).fill(OWNER.password);
  await reg.getByLabel("Passwort wiederholen").fill(OWNER.password);
  await reg.locator('input[value="business"]').check();
  await reg.getByRole("checkbox", { name: /Ich akzeptiere/ }).check();
  await reg.getByRole("button", { name: "Konto erstellen" }).click();
  await expect(page.getByRole("status")).toContainText(UNCONFIRMED_NOTICE);

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const row = (await client.query(`select u.id as uid, b.id as bid from "User" u, "Business" b where u.email = $1 and b.slug = 'sulaymaniyah-clinic'`, [OWNER.email])).rows[0];
    await client.query(`insert into "BusinessMember" (id, "businessId", "userId", role, "isActive") values ($1, $2, $3, 'EMPLOYEE', true)`, [`cm-${stamp}`, row.bid, row.uid]);

    await login(page, OWNER.email, OWNER.password);
    await page.goto("/dr/content/jobs/new");
    // Only the own business can be chosen.
    await expect(page.locator('select[name="businessId"]').locator("option")).toHaveCount(2); // placeholder + 1
    await expect(page.getByRole("button", { name: "Speichern und veröffentlichen" })).toHaveCount(0);
    await page.locator('select[name="businessId"]').selectOption({ index: 1 });
    await page.getByLabel("Bewerbungs-Link (https)").fill("https://example.org/jobs/kuechenhilfe");
    await fillGerman(page, OWNER_JOB);
    // Unconfirmed address: refused, nothing is created.
    await page.getByRole("button", { name: "Zur Prüfung einreichen" }).click();
    await expect(page.getByTestId("form-error")).toContainText("E-Mail-Adresse");
    await confirmEmailOf(OWNER.email);
    await page.getByRole("button", { name: "Zur Prüfung einreichen" }).click();
    await expect(page).toHaveURL(/submitted=1/);
    await expect(page.getByTestId("entry-status")).toHaveText("Ausstehend");
    await expect(page.getByTestId("submit-review")).toBeDisabled();

    // Not public while pending.
    await page.goto("/de/jobs");
    await expect(page.getByTestId("content-card").filter({ hasText: OWNER_JOB })).toHaveCount(0);

    // The owner's list shows only own entries and has no moderation buttons.
    await page.goto("/dr/content/jobs");
    await expect(page.getByTestId("content-row").filter({ hasText: OWNER_JOB })).toHaveCount(1);
    await expect(page.getByTestId("content-row").filter({ hasText: JOB })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Veröffentlichen" })).toHaveCount(0);

    // A moderator publishes it from the list.
    const adminCtx = await browser.newContext();
    const admin = await adminCtx.newPage();
    await login(admin, ADMIN.email, ADMIN.password);
    await admin.goto("/dr/content/jobs?status=pending");
    await admin.getByTestId("content-row").filter({ hasText: OWNER_JOB }).getByRole("button", { name: "Veröffentlichen" }).click();
    await expect(admin.getByTestId("content-row").filter({ hasText: OWNER_JOB })).toHaveCount(0);
    await adminCtx.close();

    await page.goto("/de/jobs");
    const card = page.getByTestId("content-card").filter({ hasText: OWNER_JOB });
    await expect(card).toHaveCount(1);
    await card.getByRole("link", { name: OWNER_JOB }).click();
    await expect(page.getByTestId("apply-link")).toHaveAttribute("href", "https://example.org/jobs/kuechenhilfe");
    await expect(page.getByTestId("apply-link")).toHaveAttribute("rel", /nofollow/);
  } finally {
    await client.query(`delete from "BusinessMember" where id = $1`, [`cm-${stamp}`]);
    await client.end();
  }
});

test("the dashboard of content is closed to guests and plain users; unknown sections and entries are 404", async ({ page, request }) => {
  const guest = await request.get("/dr/content/jobs", { maxRedirects: 0 });
  expect([302, 307]).toContain(guest.status());
  await login(page, ADMIN.email, ADMIN.password);
  expect((await page.goto("/dr/content/unknown"))?.status()).toBe(404);
  expect((await page.goto("/dr/content/jobs/does-not-exist"))?.status()).toBe(404);
  expect((await page.goto("/de/jobs/does-not-exist"))?.status()).toBe(404);
});

test("the sitemap lists published entries of the enabled content sections, and each has a link in the index", async ({ request }) => {
  const index = await (await request.get("/sitemap.xml")).text();
  for (const s of ["jobs", "events", "guides"]) expect(index).toContain(`/sitemaps/${s}-1.xml`);
  const jobs = await (await request.get("/sitemaps/jobs-1.xml")).text();
  expect(jobs).toContain("/de/jobs/");
  expect(jobs).toContain('hreflang="ckb"');
  expect((await request.get("/sitemaps/nonsense-1.xml")).status()).toBe(404);
});
