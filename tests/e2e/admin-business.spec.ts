/**
 * Admin -> business -> address -> coordinates -> publish -> list / map / Nearby, end to end.
 * Geocoding uses the local fake Nominatim (tests/e2e/fake-ai.ts); the basemap is a local stub style.
 */
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { ADMIN } from "./global-setup";

const stamp = Date.now().toString(36);

async function login(page: Page) {
  await page.goto("/de/login?next=%2Fdr");
  await page.getByLabel("E-Mail", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Passwort", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/dr$/);
}

async function stubBasemap(page: Page) {
  await page.route("https://tiles.openfreemap.org/**", (r) => r.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#eceee9" } }] }),
  }));
}

async function fillBasics(page: Page, name: string, address: string, city: string) {
  await page.goto("/dr/businesses/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Kategorie").selectOption({ label: "Recht" });
  await page.getByLabel("Telefon").fill("+49 30 000000");
  await page.getByLabel("Straße und Hausnummer").fill(address);
  await page.getByLabel("Land").selectOption("DE");
  await page.getByLabel("Stadt", { exact: true }).fill(city);
}

test.describe.configure({ mode: "serial" });

test("admin adds a business: address lookup, confirmed map location, publish; it appears in list, map and Nearby", async ({ page }) => {
  await stubBasemap(page);
  await login(page);
  const name = `E2E Standort ${stamp}`;
  await fillBasics(page, name, "Oranienstraße 1", "Berlin");
  await page.getByLabel("Postleitzahl").fill("10999");
  await page.getByTestId("find-location").click();
  await expect(page.getByTestId("geocode-hits")).toContainText("genaue Adresse");
  await expect(page.getByTestId("lat")).toHaveValue("52.502238");
  await expect(page.getByTestId("lng")).toHaveValue("13.418012");
  await expect(page.getByTestId("location-picker")).toHaveAttribute("data-status", "ready", { timeout: 20_000 });
  await expect(page.getByTestId("picker-marker")).toBeVisible();
  // Not confirmed yet: publishing must be refused.
  await page.getByRole("button", { name: "Speichern und veröffentlichen" }).click();
  await expect(page.getByTestId("form-notice")).toContainText("Standort bestätigt");
  await expect(page.getByTestId("business-status")).toHaveText("Entwurf");
  // Confirm the marker, then publish.
  await page.getByTestId("confirm-location").check();
  await page.getByRole("button", { name: "Speichern und veröffentlichen" }).click();
  await expect(page.getByTestId("form-notice")).toContainText("Veröffentlicht");
  await expect(page.getByTestId("business-status")).toHaveText("Veröffentlicht");
  await expect(page.getByTestId("publish-checklist")).toContainText("Bereit zum Veröffentlichen");

  // Public list and search.
  await page.goto(`/de/businesses?q=${encodeURIComponent(name)}`);
  await expect(page.getByRole("main")).toContainText(name);
  // Nearby API (distance-sorted, with the business's own category) and category filter.
  const cats = await (await page.request.get("/api/v1/categories")).json();
  const legal = cats.data.find((c: { key: string }) => c.key === "legal");
  const near = await (await page.request.get(`/api/v1/nearby?lat=52.5022&lng=13.418&radius=1&mode=map&category=${legal.id}`)).json();
  const hit = near.data.find((i: { business: { name: string } }) => i.business.name === name);
  expect(hit.category.nameDe).toBe("Recht");
  expect(hit.distanceKm).toBeLessThan(0.1);
  const food = cats.data.find((c: { key: string }) => c.key === "food");
  const other = await (await page.request.get(`/api/v1/nearby?lat=52.5022&lng=13.418&radius=1&mode=map&category=${food.id}`)).json();
  expect(other.data.some((i: { business: { name: string } }) => i.business.name === name)).toBe(false);
  // Detail page shows it on the map.
  await page.goto(`/de/businesses/${hit.business.slug}`);
  const detailShell = page.getByTestId("places-map-shell");
  await detailShell.scrollIntoViewIfNeeded();
  const detailMap = page.getByTestId("discovery-map");
  await expect(detailMap).toHaveAttribute("data-status", "ready", { timeout: 20_000 });
  await expect(detailMap.locator("button.rega-pin")).toHaveCount(1);
  // Nearby map: marker -> preview -> detail.
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({ latitude: 52.5025, longitude: 13.4182 });
  await page.goto("/de/nearby");
  await page.getByTestId("nearby-locate").click();
  await page.getByTestId("nearby-radius").selectOption("1");
  await expect(page.getByTestId("nearby-results")).toContainText(name);
  await page.getByTestId("nearby-view-map").click();
  await expect(page.getByTestId("discovery-map")).toHaveAttribute("data-status", "ready", { timeout: 20_000 });
  // Selecting the result beside the map opens its marker preview (markers at one position may be stacked).
  await page.getByTestId("nearby-map-list").getByRole("button", { name: new RegExp(name) }).click();
  await expect(page.getByTestId("map-preview")).toContainText("Recht");
  await page.getByTestId("map-preview").getByRole("link", { name: "Details ansehen" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
});

test("failed address lookup: clear message, no publish without a location; invalid coordinates rejected; manual placement works", async ({ page }) => {
  await stubBasemap(page);
  await login(page);
  const name = `E2E Ohne Standort ${stamp}`;
  await fillBasics(page, name, "Nowhere 999", "Berlin");
  await page.getByTestId("find-location").click();
  await expect(page.getByTestId("geocode-message")).toHaveText("Der Standort dieses Unternehmens konnte nicht bestätigt werden. Bitte den Standort auf der Karte festlegen.");
  await expect(page.getByTestId("lat")).toHaveValue("");
  await expect(page.getByTestId("confirm-location")).toBeDisabled();
  await page.getByRole("button", { name: "Speichern und veröffentlichen" }).click();
  await expect(page.getByTestId("form-notice")).toContainText("Standort auf der Karte");
  await expect(page.getByTestId("business-status")).toHaveText("Entwurf");
  const editUrl = page.url().split("?")[0];

  // Not public.
  const list = await (await page.request.get(`/api/v1/businesses?q=${encodeURIComponent(name)}`)).json();
  expect(list.data.some((b: { name: string; status: string }) => b.name === name && b.status === "published")).toBe(false);

  // Invalid coordinates are refused in the form.
  await page.getByTestId("lat").fill("95");
  await page.getByTestId("lng").fill("13.4");
  await expect(page.getByTestId("coords-invalid")).toBeVisible();
  await expect(page.getByTestId("confirm-location")).toBeDisabled();

  // Manual placement (clicking the map sets the marker), then confirm and publish.
  await page.getByTestId("lat").fill("");
  await page.getByTestId("lng").fill("");
  const picker = page.getByTestId("location-picker");
  await expect(picker).toHaveAttribute("data-status", "ready", { timeout: 20_000 });
  // The click uses viewport coordinates, so the map must be on screen whatever the page length below it is.
  await picker.scrollIntoViewIfNeeded();
  const box = (await picker.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2 + 90, box.y + box.height / 2 - 60);
  await expect(page.getByTestId("lat")).not.toHaveValue("");
  await expect(page.getByTestId("picker-marker")).toBeVisible();
  await page.getByTestId("confirm-location").check();
  await page.getByRole("button", { name: "Speichern und veröffentlichen" }).click();
  await expect(page.getByTestId("business-status")).toHaveText("Veröffentlicht");
  expect(page.url().split("?")[0]).toBe(editUrl);

  // A published business keeps a confirmed location: moving the marker without confirming is refused.
  await page.getByTestId("lat").fill("52.51");
  await page.getByTestId("lng").fill("13.39");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.getByTestId("form-error")).toContainText("bestätigten Standort");
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(name); // nothing typed was lost
});

test("location audit, filter and list publish guard for existing businesses; APIs enforce the same rule", async ({ page }) => {
  await login(page);
  const name = `E2E Entwurf ${stamp}`;
  await fillBasics(page, name, "Irgendwo 5", "Berlin");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.getByTestId("form-notice")).toHaveText("Gespeichert.");
  const id = page.url().split("?")[0].split("/").pop()!;

  await page.goto(`/dr/businesses?loc=missing&q=${encodeURIComponent(name)}`);
  await expect(page.getByTestId("location-audit")).toBeVisible();
  expect(Number((await page.getByTestId("audit-auditMissing").textContent())?.replace(/\D/g, ""))).toBeGreaterThan(0);
  const row = page.getByRole("row", { name: new RegExp(name) });
  await expect(row.getByTestId("loc-state")).toHaveText("Fehlt");
  await row.getByRole("button", { name: "Veröffentlichen" }).click();
  await expect(page.getByTestId("publish-blocked")).toBeVisible();

  // Same rule through the API.
  const patch = await page.request.patch(`/api/v1/businesses/${id}`, { data: { status: "published" } });
  expect(patch.status()).toBe(422);
  const post = await page.request.post("/api/v1/businesses", { data: { name: `E2E API ${stamp}`, status: "published" } });
  expect(post.status()).toBe(422);
  const bulk = await (await page.request.post("/api/v1/businesses/bulk", { data: { ids: [id], action: "publish" } })).json();
  expect(bulk.data.affected).toBe(0);
  expect(bulk.data.skippedIncomplete).toEqual([id]);
});

test("a new city is created from the form, gets its centre, and becomes selectable in Nearby", async ({ page }) => {
  await stubBasemap(page);
  await login(page);
  const name = `E2E Hamburg ${stamp}`;
  await fillBasics(page, name, "Jungfernstieg 1", "Hamburg");
  await page.getByTestId("find-location").click();
  await expect(page.getByTestId("lat")).toHaveValue("53.553013");
  await page.getByTestId("confirm-location").check();
  await page.getByRole("button", { name: "Speichern und veröffentlichen" }).click();
  await expect(page.getByTestId("business-status")).toHaveText("Veröffentlicht");
  await page.goto("/de/nearby");
  await page.getByTestId("nearby-city").selectOption({ label: "Hamburg" });
  await expect(page.getByTestId("nearby-results")).toContainText(name);
});

test("businesses at the very same position: the map offers them as a list", async ({ page }) => {
  await stubBasemap(page);
  await login(page);
  const name = `E2E Gleiches Haus ${stamp}`;
  await fillBasics(page, name, "Oranienstraße 1", "Berlin");
  await page.getByTestId("lat").fill("52.502238");
  await page.getByTestId("lng").fill("13.418012");
  await page.getByTestId("confirm-location").check();
  await page.getByRole("button", { name: "Speichern und veröffentlichen" }).click();
  await expect(page.getByTestId("business-status")).toHaveText("Veröffentlicht");

  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({ latitude: 52.5025, longitude: 13.4182 });
  await page.goto("/de/nearby");
  await page.getByTestId("nearby-locate").click();
  await page.getByTestId("nearby-radius").selectOption("1");
  await page.getByTestId("nearby-view-map").click();
  const map = page.getByTestId("discovery-map");
  await expect(map).toHaveAttribute("data-status", "ready", { timeout: 20_000 });
  const stack = page.getByTestId("map-stack");
  for (let i = 0; i < 6 && !(await stack.isVisible()); i++) {
    await map.getByRole("button", { name: /Orte – zum Vergrößern klicken/ }).first().click();
    await page.waitForTimeout(700);
  }
  await expect(stack).toContainText(name);
  await expect(stack).toContainText(`E2E Standort ${stamp}`);
  await stack.getByRole("button", { name: new RegExp(name) }).click();
  await expect(page.getByTestId("map-preview")).toContainText(name);
});
