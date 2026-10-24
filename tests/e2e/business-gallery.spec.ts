/**
 * Business gallery and image editor in /dr, and the result on the public profile: one cover + up to three images,
 * move / zoom buttons in the editor, reorder, replace, remove with confirmation, and the gallery on the profile.
 * Runs on desktop and on a phone (Pixel 5); every record is created by this file (local storage fake).
 */
import type { Page } from "@playwright/test";
import { encode } from "fast-png";
import { expect, test } from "./fixtures";
import { ADMIN } from "./global-setup";

// Uploads need the HTTPS origin of the local proxy, as in business-publication.spec.ts.
test.use({ baseURL: `https://127.0.0.1:${Number(process.env.E2E_PORT ?? 3111) + 1}`, ignoreHTTPSErrors: true });

const stamp = Date.now().toString(36);
const png = (r: number, g: number, b: number) =>
  ({ name: `p${r}${g}${b}.png`, mimeType: "image/png", buffer: Buffer.from(encode({ width: 4, height: 3, data: new Uint8Array(Array.from({ length: 12 }, () => [r, g, b, 255]).flat()) })) });

async function login(page: Page) {
  await page.goto("/de/login?next=%2Fdr");
  await page.getByLabel("E-Mail", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Passwort", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

const photoUrls = (page: Page) => page.locator("input[name=photoUrls]").evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));

test("owner manages one cover and three gallery images; the profile shows them in that order", async ({ page }, info) => {
  const name = `E2E Galerie ${info.project.name} ${stamp}`;
  await login(page);
  await page.goto("/dr/businesses/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByRole("combobox", { name: "Kategorie", exact: true }).selectOption({ label: "Recht" });
  // Hamburg, away from the Berlin demo listings that other tests count.
  await page.getByLabel("Straße und Hausnummer").fill("Jungfernstieg 7");
  await page.getByLabel("Land").selectOption("DE");
  await page.getByLabel("Stadt", { exact: true }).fill("Hamburg");
  await page.getByLabel("Postleitzahl").fill("20354");
  await page.getByTestId("lat").fill("53.5511");
  await page.getByTestId("lng").fill("9.9937");
  await page.getByTestId("confirm-location").check();

  // Cover through the editor, using the explicit move and zoom buttons.
  await page.getByTestId("upload-coverUrl").setInputFiles(png(200, 0, 0));
  const editor = page.getByTestId("image-editor");
  await editor.getByTestId("crop-zoom-in").click();
  await editor.getByRole("button", { name: "Nach links" }).click();
  await editor.getByRole("button", { name: "Nach oben" }).click();
  await editor.getByRole("button", { name: "Bild bestätigen" }).click();
  await expect(editor).toHaveCount(0);

  // Three gallery images in one go; then adding is closed.
  await page.getByTestId("upload-photos").setInputFiles([png(0, 200, 0), png(0, 0, 200), png(200, 200, 0)]);
  for (let i = 0; i < 3; i++) {
    await editor.getByRole("button", { name: "Bild bestätigen" }).click();
    await expect.poll(async () => (await photoUrls(page)).length).toBe(i + 1);
  }
  await expect(page.getByTestId("image-editor")).toHaveCount(0);
  await expect(page.getByTestId("upload-photos")).toBeDisabled();

  // Reorder: the first moves one place later.
  const [a, b, c] = await photoUrls(page);
  await page.getByTestId("photo-item").first().getByTestId("photo-later").click();
  expect(await photoUrls(page)).toEqual([b, a, c]);

  // Replace keeps the slot.
  await page.getByTestId("photo-item").nth(1).getByTestId("photo-replace").click();
  await page.getByTestId("replace-photo-input").setInputFiles(png(120, 0, 120));
  await editor.getByRole("button", { name: "Bild bestätigen" }).click();
  await expect(page.getByTestId("image-editor")).toHaveCount(0);
  const replaced = await photoUrls(page);
  expect(replaced).toHaveLength(3);
  expect(replaced[0]).toBe(b);
  expect(replaced[1]).not.toBe(a);
  expect(replaced[2]).toBe(c);

  // Remove asks first: dismiss keeps it, accept removes it.
  page.once("dialog", (d) => void d.dismiss());
  await page.getByTestId("photo-item").last().getByTestId("photo-remove").click();
  expect(await photoUrls(page)).toHaveLength(3);
  page.once("dialog", (d) => void d.accept());
  await page.getByTestId("photo-item").last().getByTestId("photo-remove").click();
  expect(await photoUrls(page)).toEqual([b, replaced[1]]);
  await expect(page.getByTestId("upload-photos")).toBeEnabled();

  await page.getByRole("button", { name: "Speichern und veröffentlichen" }).click();
  await expect(page.getByTestId("business-status")).toHaveText("Veröffentlicht");
  const cover = await page.locator("input[name=coverUrl]").inputValue();

  // Public profile: cover first, then the two images in the saved order.
  const slug = (await (await page.request.get(`/api/v1/businesses?q=${encodeURIComponent(name)}`)).json()).data[0].slug;
  await page.goto(`/de/business/${slug}`);
  const gallery = page.getByTestId("business-gallery");
  const shown = await gallery.locator("img").evaluateAll((els) => els.map((e) => (e as HTMLImageElement).getAttribute("src")));
  expect(shown).toEqual([cover, b, replaced[1]]);
  await expect(gallery).toContainText("3 Bilder");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});
