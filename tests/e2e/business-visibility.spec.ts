/**
 * Admin business actions in /dr: hide / show again (non-destructive), pin / unpin (pinned first, kept after reload),
 * delete (soft, confirmed with the exact name, undo and restore), and that people without the right get neither the
 * controls nor the server-side permission. Runs on desktop and on a phone (Pixel 5). Uses the local fakes of
 * admin-business.spec.ts; every record is created by this file.
 */
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { ADMIN, EMPLOYEE } from "./global-setup";

const stamp = Date.now().toString(36);
const NAME = `E2E Sichtbarkeit ${stamp}`;
const OTHER = `E2E Zweiter ${stamp}`;

async function login(page: Page, who: { email: string; password: string }) {
  await page.goto("/de/login?next=%2Fdr");
  await page.getByLabel("E-Mail", { exact: true }).fill(who.email);
  await page.getByLabel("Passwort", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** A complete, published listing created through the admin form; returns its id. */
async function createPublished(page: Page, name: string): Promise<string> {
  await page.goto("/dr/businesses/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByRole("combobox", { name: "Kategorie", exact: true }).selectOption({ label: "Recht" });
  await page.getByLabel("Telefon").fill("+49 30 111111");
  await page.getByLabel("Straße und Hausnummer").fill("Oranienstraße 1");
  await page.locator('select[name="countryCode"]').selectOption("DE");
  await page.getByLabel("Stadt", { exact: true }).fill("Berlin");
  await page.getByLabel("Postleitzahl").fill("10999");
  await page.getByTestId("find-location").click();
  await expect(page.getByTestId("geocode-hits")).toBeVisible();
  await page.getByTestId("confirm-location").check();
  await page.getByRole("button", { name: "Speichern und veröffentlichen" }).click();
  await expect(page.getByTestId("business-status")).toHaveText("Veröffentlicht");
  return new URL(page.url()).pathname.split("/").pop()!;
}

const rowOf = (page: Page, name: string) => page.locator("tbody tr", { hasText: name });
async function openMenu(page: Page, name: string) {
  const row = rowOf(page, name);
  await row.getByTestId("row-actions").click();
  return row;
}
const openDialog = (page: Page) => page.locator("dialog[open]");

test.describe.configure({ mode: "serial" });

let id = "";
let otherId = "";
let slug = "";

test("hide asks first, removes the listing from every public surface, keeps it editable; show again restores it", async ({ page, request }) => {
  await login(page, ADMIN);
  id = await createPublished(page, NAME);
  const pub = await (await request.get(`/api/v1/businesses?q=${encodeURIComponent(NAME)}`)).json();
  slug = pub.data.find((b: { name: string }) => b.name === NAME).slug;
  expect((await request.get(`/de/business/${slug}`)).status()).toBe(200);

  // Cancelling the confirmation changes nothing.
  await page.goto(`/dr/businesses?q=${encodeURIComponent(NAME)}`);
  await expect(rowOf(page, NAME).getByTestId("row-status")).toHaveText("Veröffentlicht");
  const row = await openMenu(page, NAME);
  await row.getByTestId("hide-business").click();
  await expect(openDialog(page)).toContainText(NAME);
  await openDialog(page).getByTestId("confirm-cancel").click();
  await expect(openDialog(page)).toHaveCount(0);
  await expect(rowOf(page, NAME).getByTestId("row-status")).toHaveText("Veröffentlicht");
  await expect(page.getByTestId("visibility-notice")).toHaveCount(0);

  // Confirmed: notice, hidden state, filters kept.
  await (await openMenu(page, NAME)).getByTestId("hide-business").click();
  await expect(openDialog(page)).toContainText("nichts gelöscht");
  await openDialog(page).getByTestId("confirm-submit").click();
  await expect(page.getByTestId("visibility-notice")).toHaveAttribute("data-notice", "hidden");
  await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(NAME).replace(/%20/g, "(\\+|%20)")}`));
  await expect(rowOf(page, NAME).getByTestId("row-status")).toHaveText("Ausgeblendet");

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
  await page.getByLabel("Telefon").fill("+49 30 222222");
  await page.getByTestId("save").click();
  await expect(page.getByTestId("form-notice")).toBeVisible();
  await expect(page.getByTestId("business-status")).toHaveText("Ausgeblendet");
  expect((await request.get(`/de/business/${slug}`)).status()).toBe(404);

  // Show again from the edit page's menu: published again (it was published, verified and complete), data kept.
  await page.getByTestId("row-actions").click();
  await page.getByTestId("unhide-business").click();
  await expect(page.getByTestId("visibility-notice")).toHaveAttribute("data-notice", "shown");
  await expect(page.getByTestId("business-status")).toHaveText("Veröffentlicht");
  await expect(page.getByTestId("visibility")).toHaveAttribute("data-state", "public");
  await expect(page.getByLabel("Telefon")).toHaveValue("+49 30 222222");
  const detail = await request.get(`/de/business/${slug}`);
  expect(detail.status()).toBe(200);
  expect(await detail.text()).toContain(NAME);
});

test("pin puts a business first and survives a reload; unpin returns it to the normal order", async ({ page }) => {
  await login(page, ADMIN);
  otherId = await createPublished(page, OTHER); // updated last, so it leads the unpinned order
  const search = `/dr/businesses?q=${encodeURIComponent(`E2E`)}+${encodeURIComponent(stamp)}`;
  await page.goto(search);
  await expect(page.locator("tbody tr").first()).toContainText(OTHER);

  await (await openMenu(page, NAME)).getByTestId("pin-business").click();
  await expect(page.getByTestId("visibility-notice")).toHaveAttribute("data-notice", "pinned");
  await expect(page.locator("tbody tr").first()).toContainText(NAME);
  await expect(rowOf(page, NAME).getByTestId("pinned-mark")).toBeVisible();
  await page.reload();
  await expect(page.locator("tbody tr").first()).toContainText(NAME);
  await page.goto("/dr/businesses?pin=1");
  await expect(rowOf(page, NAME)).toHaveCount(1);
  await expect(rowOf(page, OTHER)).toHaveCount(0);

  await page.goto(search);
  await (await openMenu(page, NAME)).getByTestId("unpin-business").click();
  await expect(page.getByTestId("visibility-notice")).toHaveAttribute("data-notice", "unpinned");
  await expect(rowOf(page, NAME).getByTestId("pinned-mark")).toHaveCount(0);
  // The audit trail names who did it.
  await page.goto("/dr/audit");
  await expect(page.getByRole("cell", { name: "business.unfeature" }).first()).toBeVisible();
});

test("delete names the business, can be cancelled, removes it everywhere, and can be undone or restored", async ({ page, request }) => {
  await login(page, ADMIN);
  await page.goto(`/dr/businesses?q=${encodeURIComponent(OTHER)}`);
  await (await openMenu(page, OTHER)).getByTestId("delete-business").click();
  await expect(openDialog(page)).toHaveAttribute("data-tone", "danger");
  await expect(openDialog(page)).toContainText(OTHER);
  await openDialog(page).getByTestId("confirm-cancel").click();
  await expect(rowOf(page, OTHER)).toHaveCount(1);

  await (await openMenu(page, OTHER)).getByTestId("delete-business").click();
  await openDialog(page).getByTestId("confirm-submit").click();
  await expect(page.getByTestId("visibility-notice")).toHaveAttribute("data-notice", "deleted");
  await expect(rowOf(page, OTHER)).toHaveCount(0);
  expect((await request.get(`/api/v1/businesses/${otherId}`)).status()).toBe(404);
  // Undo straight from the notice: back, hidden.
  await page.getByTestId("undo-delete").click();
  await expect(page.getByTestId("visibility-notice")).toHaveAttribute("data-notice", "recovered");
  await expect(rowOf(page, OTHER).getByTestId("row-status")).toHaveText("Ausgeblendet");

  // Delete again and restore from "Deleted".
  await (await openMenu(page, OTHER)).getByTestId("delete-business").click();
  await openDialog(page).getByTestId("confirm-submit").click();
  await expect(page.getByTestId("visibility-notice")).toHaveAttribute("data-notice", "deleted");
  await page.goto(`/dr/businesses?status=deleted&q=${encodeURIComponent(OTHER)}`);
  await expect(rowOf(page, OTHER).getByTestId("row-status")).toHaveText("Gelöscht");
  await rowOf(page, OTHER).getByTestId("recover-business").click();
  await expect(page.getByTestId("visibility-notice")).toHaveAttribute("data-notice", "recovered");
  await page.goto(`/dr/businesses?q=${encodeURIComponent(OTHER)}`);
  await expect(rowOf(page, OTHER).getByTestId("row-status")).toHaveText("Ausgeblendet");
  // Its data survived: the edit page still has it.
  await page.goto(`/dr/businesses/${otherId}`);
  await expect(page.getByLabel("Telefon")).toHaveValue("+49 30 111111");
});

test("without the right there are no pin, delete or hide controls, and the server refuses the calls", async ({ page }) => {
  await login(page, EMPLOYEE);
  await page.goto(`/dr/businesses?q=${encodeURIComponent(NAME)}`);
  const row = rowOf(page, NAME);
  await expect(row).toBeVisible();
  if (await row.getByTestId("row-actions").count()) await row.getByTestId("row-actions").click();
  for (const control of ["pin-business", "unpin-business", "delete-business", "hide-business", "unhide-business"]) await expect(row.getByTestId(control)).toHaveCount(0);
  await expect(page.getByTestId("tile-deleted")).toHaveCount(0);
  expect((await page.request.patch(`/api/v1/businesses/${id}`, { data: { featured: true } })).status()).toBe(403);
  expect((await page.request.patch(`/api/v1/businesses/${id}`, { data: { status: "archived" } })).status()).toBe(403);
  expect((await page.request.delete(`/api/v1/businesses/${id}`)).status()).toBe(403);
  expect((await page.request.post("/api/v1/businesses/bulk", { data: { ids: [id], action: "delete" } })).status()).toBe(403);
  // The bulk call skips businesses the caller does not manage: still public.
  expect((await page.request.post("/api/v1/businesses/bulk", { data: { ids: [id], action: "archive" } })).ok()).toBe(true);
  expect((await page.request.get(`/de/business/${slug}`)).status()).toBe(200);
});

test("the dashboard has no horizontal scroll and the menu stays on screen", async ({ page }) => {
  await login(page, ADMIN);
  for (const path of ["/dr", "/dr/businesses", `/dr/businesses/${id}`]) {
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), path).toBeLessThanOrEqual(0);
  }
  await page.goto(`/dr/businesses?q=${encodeURIComponent(NAME)}`);
  const row = await openMenu(page, NAME);
  const box = await row.locator("[id]").filter({ has: page.getByTestId("hide-business") }).boundingBox();
  const width = page.viewportSize()!.width;
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width);
});
