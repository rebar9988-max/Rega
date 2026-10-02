/**
 * Completion features end to end: services and categories management, opening hours and "Open now",
 * search normalization and filters, REGA AI retrieval and persistence, staff and per-business access.
 * Everything runs against the local E2E database (never production); created records are prefixed "E2E ".
 */
import type { Browser, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { ADMIN } from "./global-setup";

const stamp = Date.now().toString(36);
const ADMIN_STATE = `test-results/.completion-admin-${stamp}.json`;
/** Contexts made by hand start signed out and need the server address explicitly. */
const FRESH = { baseURL: `http://localhost:${process.env.E2E_PORT ?? 3111}`, storageState: { cookies: [], origins: [] } };

// One admin sign-in for the whole file: logins are rate limited per account (10 per 15 minutes), and the other
// spec files already sign the same admin in several times.
test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext(FRESH);
  const page = await context.newPage();
  await page.goto("/de/login?next=%2Fdr");
  await page.getByLabel("E-Mail", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Passwort", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/dr$/);
  await context.storageState({ path: ADMIN_STATE });
  await context.close();
});
test.use({ storageState: ADMIN_STATE });

/** The dashboard follows the last visited site language; tests that read dashboard labels switch back to German. */
async function german(page: Page) {
  await page.goto("/de");
}

async function stubBasemap(page: Page) {
  await page.route("https://tiles.openfreemap.org/**", (r) => r.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#eceee9" } }] }),
  }));
}

test.describe.configure({ mode: "serial" });

test("services: create, validate, publish, show publicly, find in search, archive", async ({ page }) => {
  await german(page);
  await page.goto("/dr/services/new");
  const name = `E2E Service ${stamp}`;
  // A select inside its label contributes its selected option to the label's name, so these match by substring.
  await page.getByLabel("Unternehmen").selectOption({ label: "Zagros Restaurant" });
  await page.getByLabel("Kategorie").selectOption({ label: "Gastronomie" });
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByTestId("price-from").fill("25");
  await page.getByTestId("price-to").fill("10"); // below "from": refused on the server
  await page.getByRole("button", { name: "Speichern und veröffentlichen" }).click();
  await expect(page.getByTestId("form-error")).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(name); // nothing typed was lost
  await page.getByTestId("price-to").fill("40");
  await page.getByRole("button", { name: "Speichern und veröffentlichen" }).click();
  await expect(page).toHaveURL(/\/dr\/services\/[^/?]+\?published=1$/);
  await expect(page.getByTestId("service-status")).toHaveText("Veröffentlicht");

  // Public: list, detail, the provider's page and unified search.
  await page.goto(`/de/services?q=${encodeURIComponent(name)}`);
  await page.getByRole("link", { name }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  await page.goto("/de/businesses/zagros-restaurant");
  await expect(page.getByRole("main")).toContainText(name);
  await page.goto(`/de/search?q=${stamp}`);
  await expect(page.getByRole("main")).toContainText(name);

  // Archive (the safe "delete"): gone from the public site, still in the dashboard.
  await page.goto(`/dr/services?q=${encodeURIComponent(name)}`);
  await page.getByRole("row", { name: new RegExp(name) }).getByRole("button", { name: "Archivieren" }).click();
  await expect(page.getByRole("row", { name: new RegExp(name) }).getByTestId("service-status")).toHaveText("Archiviert");
  await page.goto(`/de/services?q=${encodeURIComponent(name)}`);
  await expect(page.getByRole("status")).toContainText("Keine Ergebnisse");
});

test("categories: seven names, the right language on public pages, deactivate hides it", async ({ page }) => {
  await german(page);
  await page.goto("/dr/categories/new");
  await page.getByLabel("Name (Sorani)").fill(`پۆلی تاقیکردنەوە ${stamp}`);
  await page.getByLabel("Name (Deutsch)").fill(`E2E Kategorie ${stamp}`);
  await page.getByLabel("Name (Englisch)").fill(`E2E Category ${stamp}`);
  await page.getByLabel("Name (Persisch)").fill(`دسته آزمایشی ${stamp}`);
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByTestId("form-notice")).toHaveText("Gespeichert.");

  await page.goto("/en/businesses");
  await expect(page.locator("select[name=category] option", { hasText: `E2E Category ${stamp}` })).toHaveCount(1);
  await page.goto("/fa/businesses");
  await expect(page.locator("select[name=category] option", { hasText: `دسته آزمایشی ${stamp}` })).toHaveCount(1);
  // Base categories have English names now (no German fallback on English pages).
  await page.goto("/en");
  await expect(page.getByRole("navigation", { name: "Categories" }).getByRole("link", { name: "Legal" })).toBeVisible();

  await german(page);
  await page.goto("/dr/categories");
  await page.getByRole("row", { name: new RegExp(`E2E Kategorie ${stamp}`) }).getByRole("button", { name: "Deaktivieren" }).click();
  await expect(page.getByRole("row", { name: new RegExp(`E2E Kategorie ${stamp}`) })).toContainText("Inaktiv");
  await page.goto("/en/businesses");
  await expect(page.locator("select[name=category] option", { hasText: `E2E Category ${stamp}` })).toHaveCount(0);
});

test("home category tiles lead to the businesses in that category", async ({ page }) => {
  await page.goto("/de");
  await page.getByRole("navigation", { name: "Kategorien" }).getByRole("link", { name: "Recht" }).click();
  await expect(page).toHaveURL(/\/de\/businesses\?category=/);
  await expect(page.getByRole("link", { name: "Kurdistan Rechtsberatung" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Zagros Restaurant" })).toHaveCount(0);
});

test("opening hours: validated input, shown on the detail page; 'Open now' keeps its filter from the home page", async ({ page }) => {
  await stubBasemap(page);
  await german(page);
  const name = `E2E Rund um die Uhr ${stamp}`;
  await page.goto("/dr/businesses/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Kategorie").selectOption({ label: "Recht" });
  // Hamburg, away from the Berlin demo data that other map tests cluster on.
  await page.getByLabel("Straße und Hausnummer").fill("Jungfernstieg 7");
  await page.getByLabel("Land").selectOption("DE");
  await page.getByLabel("Stadt", { exact: true }).fill("Hamburg");
  await page.getByTestId("lat").fill("53.5511");
  await page.getByTestId("lng").fill("9.9937");
  await page.getByTestId("confirm-location").check();
  for (const d of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]) await page.getByTestId(`hours-${d}`).fill("00:00-24:00");
  await page.getByTestId("hours-tue").fill("9 bis 5"); // unreadable: refused
  await page.getByRole("button", { name: "Speichern und veröffentlichen" }).click();
  await expect(page.getByTestId("form-error")).toBeVisible();
  await expect(page.getByTestId("hours-tue")).toHaveAttribute("aria-invalid", "true");
  await page.getByTestId("hours-tue").fill("00:00-24:00");
  await page.getByRole("button", { name: "Speichern und veröffentlichen" }).click();
  await expect(page.getByTestId("business-status")).toHaveText("Veröffentlicht");
  await expect(page.getByTestId("hours-mon")).toHaveValue("00:00–24:00"); // stored in the normalized form

  const slug = (await (await page.request.get(`/api/v1/businesses?q=${encodeURIComponent(name)}`)).json()).data[0].slug;
  await page.goto(`/de/businesses/${slug}`);
  await expect(page.getByTestId("opening-hours")).toContainText("Montag");
  await expect(page.getByTestId("open-state")).toHaveText("Geöffnet");

  // "Open now" link -> Nearby with the filter applied, kept on reload.
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({ latitude: 53.5512, longitude: 9.9938 });
  // (The home page of design frame 204:912 has no "Open now" shortcut; the filter link itself is tested.)
  await page.goto("/de/nearby?open=1");
  await expect(page).toHaveURL(/\/de\/nearby\?open=1$/);
  // The filters appear once a location is chosen; the requested filter is already on.
  await page.getByTestId("nearby-locate").click();
  await expect(page.getByTestId("nearby-open")).toBeChecked();
  await page.getByTestId("nearby-radius").selectOption("1");
  await expect(page.getByTestId("nearby-results")).toContainText(name);
  // Businesses without known hours (the admin spec's Hamburg business, 200 m away) are not offered as "open".
  await expect(page.getByTestId("nearby-results")).not.toContainText("E2E Hamburg");
  await page.reload();
  await expect(page).toHaveURL(/open=1/);
  await expect(page).toHaveURL(/radius=1/);
  await page.getByTestId("nearby-locate").click();
  await expect(page.getByTestId("nearby-open")).toBeChecked();
  await expect(page.getByTestId("nearby-results")).toContainText(name);
});

test("search: Arabic-keyboard spelling finds Kurdish names; words in any order; filters change results and totals", async ({ page, request }) => {
  const kaf = await (await request.get(`/api/v1/search?q=${encodeURIComponent("كوردستان")}&type=businesses`)).json();
  expect(kaf.data.businesses.map((b: { slug: string }) => b.slug)).toContain("kurdistan-rechtsberatung");
  await page.goto(`/ckb/businesses?q=${encodeURIComponent("كوردستان")}`);
  await expect(page.getByRole("link", { name: "ڕاوێژکاری یاسایی کوردستان" }).first()).toBeVisible();

  for (const q of ["rechtsberatung berlin", "berlin rechtsberatung"]) {
    const r = await (await request.get(`/api/v1/search?q=${encodeURIComponent(q)}&type=businesses`)).json();
    expect(r.data.businesses.map((b: { slug: string }) => b.slug), q).toContain("kurdistan-rechtsberatung");
  }

  const cats = (await (await request.get("/api/v1/categories")).json()).data as { id: string; key: string }[];
  const legal = cats.find((c) => c.key === "legal")!;
  const food = cats.find((c) => c.key === "food")!;
  const inLegal = (await (await request.get(`/api/v1/businesses?categoryId=${legal.id}&perPage=100`)).json()).data.map((b: { slug: string }) => b.slug);
  expect(inLegal).toContain("kurdistan-rechtsberatung");
  expect(inLegal).not.toContain("zagros-restaurant");

  const all = (await (await request.get(`/api/v1/search?q=${encodeURIComponent("restaurant")}&type=all`)).json()).data;
  expect(all.totals.businesses).toBeGreaterThan(0);
  const narrowed = (await (await request.get(`/api/v1/search?q=${encodeURIComponent("restaurant")}&type=all&categoryId=${legal.id}`)).json()).data;
  expect(narrowed.totals.businesses).toBe(narrowed.businesses.length); // totals follow the filter
  expect(narrowed.businesses.map((b: { slug: string }) => b.slug)).not.toContain("zagros-restaurant");
  const foodOnly = (await (await request.get(`/api/v1/search?q=${encodeURIComponent("zagros")}&type=services&categoryId=${food.id}`)).json()).data;
  expect(foodOnly.totals.services).toBe(foodOnly.services.length);
});

test("REGA AI: a natural Kurdish question retrieves the real business with a locale link; the exchange is stored", async ({ request }) => {
  const sessionId = `e2e-retrieval-${stamp}`;
  const res = await request.post("/api/v1/ai/chat", { data: { messages: [{ role: "user", content: "ECHO_CONTEXT باشترین چێشتخانە لە هەولێر" }], locale: "ckb", sessionId } });
  expect(res.status(), await res.text()).toBe(200);
  const content = (await res.json()).data.content as string;
  expect(content).toContain("/ckb/businesses/zagros-restaurant");
  expect(content).toContain("چێشتخانەی زاگرۆس");
  expect(content).not.toContain("kurdistan-rechtsberatung");

  const history = (await (await request.get(`/api/v1/ai/chat?sessionId=${sessionId}`)).json()).data.messages as { role: string; content: string }[];
  expect(history.map((m) => m.role)).toEqual(["user", "assistant"]);
  expect(history[0].content).toContain("چێشتخانە");
  expect((await request.get("/api/v1/ai/chat?sessionId=bad id!")).status()).toBe(422);
});

async function asUser(browser: Browser, email: string, password: string) {
  const context = await browser.newContext(FRESH);
  const page = await context.newPage();
  await page.goto("/de/login?next=%2Fdr");
  await page.getByLabel("E-Mail", { exact: true }).fill(email);
  await page.getByLabel("Passwort", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/dr$/);
  return { page, context };
}

test("staff: admin creates an employee; the employee edits only businesses they are a member of", async ({ page, browser }) => {
  await german(page);
  const email = `e2e-staff-${stamp}@example.org`;
  const password = "e2e-staff-password-1";
  await page.goto("/dr/users");
  await page.getByLabel("Name", { exact: true }).fill("E2E Staff");
  await page.getByLabel("E-Mail", { exact: true }).fill(email);
  await page.getByLabel("Startpasswort (mind. 12 Zeichen)").fill(password);
  await page.getByRole("button", { name: "Anlegen" }).click();
  await expect(page.getByTestId("users-done")).toHaveText("Konto angelegt.");
  await expect(page.getByRole("row", { name: new RegExp(email) })).toContainText("Mitarbeiter");
  // Duplicate accounts are refused.
  await page.getByLabel("Name", { exact: true }).fill("E2E Staff 2");
  await page.getByLabel("E-Mail", { exact: true }).fill(email);
  await page.getByLabel("Startpasswort (mind. 12 Zeichen)").fill(password);
  await page.getByRole("button", { name: "Anlegen" }).click();
  await expect(page.getByTestId("users-error")).toBeVisible();

  const zagros = (await (await page.request.get("/api/v1/businesses/zagros-restaurant")).json()).data as { id: string };
  const employee = await asUser(browser, email, password);
  try {
    // Not a member: the server refuses, whatever the UI shows.
    expect((await employee.page.request.patch(`/api/v1/businesses/${zagros.id}`, { data: { tags: ["e2e"] } })).status()).toBe(403);
    expect((await employee.page.request.post("/api/v1/businesses/bulk", { data: { ids: [zagros.id], action: "archive" } })).ok()).toBe(true);
    const still = (await (await page.request.get("/api/v1/businesses/zagros-restaurant")).json()).data as { status: string };
    expect(still.status).toBe("published"); // the bulk call above affected nothing
    // Employees cannot manage staff: no menu entry, and the page itself is refused.
    await expect(employee.page.getByRole("navigation").getByRole("link", { name: "Nutzer" })).toHaveCount(0);
    await employee.page.goto("/dr/users");
    await expect(employee.page.getByRole("button", { name: "Anlegen" })).toHaveCount(0);

    // Admin adds the employee to the business: now allowed.
    await page.goto(`/dr/businesses/${zagros.id}`);
    await page.getByTestId("business-team").getByLabel("E-Mail des Mitarbeiters").fill(email);
    await page.getByTestId("business-team").getByRole("button", { name: "Hinzufügen" }).click();
    await expect(page.getByTestId("team-notice")).toHaveText("Mitglied hinzugefügt.");
    expect((await employee.page.request.patch(`/api/v1/businesses/${zagros.id}`, { data: { tags: ["e2e"] } })).status()).toBe(200);
  } finally {
    await employee.context.close();
  }
});
