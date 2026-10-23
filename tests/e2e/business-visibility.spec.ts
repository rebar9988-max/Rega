/**
 * Admin hide / show again of a business listing (non-destructive): confirmation, clear status, gone from every public
 * surface, still editable in /dr, restored with its data and publication rules, and no control for people who do not
 * manage the listing. Uses the same local fakes as admin-business.spec.ts.
 */
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { ADMIN, EMPLOYEE } from "./global-setup";

const stamp = Date.now().toString(36);
const NAME = `E2E Sichtbarkeit ${stamp}`;

async function login(page: Page, who: { email: string; password: string }) {
  await page.goto("/de/login?next=%2Fdr");
  await page.getByLabel("E-Mail", { exact: true }).fill(who.email);
  await page.getByLabel("Passwort", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test.describe.configure({ mode: "serial" });

let id = "";
let slug = "";

test("admin hides a published business after confirming; it disappears publicly but stays editable; showing it again restores it", async ({ page, request }) => {
  await login(page, ADMIN);
  // A complete, published listing.
  await page.goto("/dr/businesses/new");
  await page.getByLabel("Name", { exact: true }).fill(NAME);
  await page.getByRole("combobox", { name: "Kategorie", exact: true }).selectOption({ label: "Recht" });
  await page.getByLabel("Telefon").fill("+49 30 111111");
  await page.getByLabel("Straße und Hausnummer").fill("Oranienstraße 1");
  await page.getByLabel("Land").selectOption("DE");
  await page.getByLabel("Stadt", { exact: true }).fill("Berlin");
  await page.getByLabel("Postleitzahl").fill("10999");
  await page.getByTestId("find-location").click();
  await expect(page.getByTestId("geocode-hits")).toBeVisible();
  await page.getByTestId("confirm-location").check();
  await page.getByRole("button", { name: "Speichern und veröffentlichen" }).click();
  await expect(page.getByTestId("business-status")).toHaveText("Veröffentlicht");
  id = new URL(page.url()).pathname.split("/").pop()!;
  const pub = await (await request.get(`/api/v1/businesses?q=${encodeURIComponent(NAME)}`)).json();
  slug = pub.data.find((b: { name: string }) => b.name === NAME).slug;
  expect((await request.get(`/de/business/${slug}`)).status()).toBe(200);

  // List: public badge; cancelling the confirmation changes nothing.
  await page.goto(`/dr/businesses?q=${encodeURIComponent(NAME)}`);
  const row = page.locator("tr", { hasText: NAME });
  await expect(row.getByTestId("visibility")).toHaveAttribute("data-state", "public");
  page.once("dialog", (d) => d.dismiss());
  await row.getByTestId("hide-business").click();
  await expect(row.getByTestId("visibility")).toHaveAttribute("data-state", "public");
  await expect(page.getByTestId("visibility-notice")).toHaveCount(0);

  // Confirmed hide: notice, hidden state, filters kept.
  page.once("dialog", (d) => { expect(d.message()).toContain("nichts gelöscht"); return d.accept(); });
  await row.getByTestId("hide-business").click();
  await expect(page.getByTestId("visibility-notice")).toHaveAttribute("data-notice", "hidden");
  await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(NAME).replace(/%20/g, "(\\+|%20)")}`));
  await expect(row.getByTestId("visibility")).toHaveAttribute("data-state", "hidden");
  await expect(row.getByTestId("row-status")).toHaveText("Ausgeblendet");
  await expect(row.getByTestId("unhide-business")).toBeVisible();

  // Gone from every public surface.
  expect((await request.get(`/de/business/${slug}`)).status()).toBe(404);
  const list = await (await request.get(`/api/v1/businesses?q=${encodeURIComponent(NAME)}`)).json();
  expect(list.data.some((b: { name: string }) => b.name === NAME)).toBe(false);
  expect((await request.get(`/api/v1/businesses/${slug}`)).status()).toBe(404);
  const near = await (await request.get("/api/v1/nearby?lat=52.5022&lng=13.418&radius=1&mode=map")).json();
  expect(near.data.some((i: { business: { name: string } }) => i.business.name === NAME)).toBe(false);

  // Still available to the admin, editable, and it stays hidden after an edit.
  await page.goto(`/dr/businesses/${id}`);
  await expect(page.getByTestId("hidden-note")).toBeVisible();
  await expect(page.getByTestId("business-status")).toHaveText("Ausgeblendet");
  await expect(page.getByLabel("Telefon")).toHaveValue("+49 30 111111");
  await page.getByLabel("Telefon").fill("+49 30 222222");
  await page.getByTestId("save").click();
  await expect(page.getByTestId("form-notice")).toBeVisible();
  await expect(page.getByTestId("business-status")).toHaveText("Ausgeblendet");
  expect((await request.get(`/de/business/${slug}`)).status()).toBe(404);

  // Show again from the edit page: published again (it was published, verified and complete), data kept.
  await page.getByTestId("unhide-business").click();
  await expect(page.getByTestId("visibility-notice")).toHaveAttribute("data-notice", "shown");
  await expect(page.getByTestId("business-status")).toHaveText("Veröffentlicht");
  await expect(page.getByTestId("visibility")).toHaveAttribute("data-state", "public");
  await expect(page.getByLabel("Telefon")).toHaveValue("+49 30 222222");
  const detail = await request.get(`/de/business/${slug}`);
  expect(detail.status()).toBe(200);
  expect(await detail.text()).toContain(NAME);
});

test("someone who does not manage the listing gets no hide control and cannot change it through the API", async ({ page }) => {
  await login(page, EMPLOYEE);
  await page.goto(`/dr/businesses?q=${encodeURIComponent(NAME)}`);
  const row = page.locator("tr", { hasText: NAME });
  await expect(row).toBeVisible();
  await expect(row.getByTestId("hide-business")).toHaveCount(0);
  await expect(row.getByTestId("unhide-business")).toHaveCount(0);
  expect((await page.request.patch(`/api/v1/businesses/${id}`, { data: { status: "archived" } })).status()).toBe(403);
  expect((await page.request.post("/api/v1/businesses/bulk", { data: { ids: [id], action: "archive" } })).ok()).toBe(true);
  // The bulk call skips businesses the caller does not manage: still public.
  expect((await page.request.get(`/de/business/${slug}`)).status()).toBe(200);
});
