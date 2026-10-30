/**
 * Business gallery and image editor in /dr, and the result on the public profile: one cover + up to two more images,
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

/**
 * Confirms the editor until `done` holds. Uploads are limited to 10 a minute per person (this test makes 5, and the
 * desktop and phone runs share one account); when the limit answers, the editor keeps the crop and shows "retry", as
 * a person would see it, so wait out the window and confirm again.
 */
async function confirmUpload(page: Page, done: () => Promise<boolean>) {
  await page.getByTestId("image-editor").getByRole("button", { name: "Bild bestätigen" }).click();
  try {
    await expect.poll(done, { timeout: 10_000 }).toBe(true);
  } catch {
    await expect(page.getByTestId("image-editor").getByRole("alert")).toBeVisible();
    await page.waitForTimeout(61_000);
    await page.getByTestId("image-editor").getByRole("button", { name: "Bild bestätigen" }).click();
    await expect.poll(done, { timeout: 15_000 }).toBe(true);
  }
}

const photoUrls = (page: Page) => page.locator("input[name=photoUrls]").evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));

test.setTimeout(240_000);

test("staff manage the cover and the two further promotional photos; the profile shows them in that order", async ({ page }, info) => {
  const name = `E2E Galerie ${info.project.name} ${stamp}`;
  await login(page);
  await page.goto("/dr/businesses/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByRole("combobox", { name: "Kategorie", exact: true }).selectOption({ label: "Recht" });
  // Hamburg, away from the Berlin demo listings that other tests count.
  await page.getByLabel("Straße und Hausnummer").fill("Jungfernstieg 7");
  await page.locator('select[name="countryCode"]').selectOption("DE");
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
  await confirmUpload(page, async () => (await editor.count()) === 0);

  // Four image slots: logo, cover (promotional photo 1) and two gallery photos. Both photos in one go; then no free slot is left.
  await page.getByTestId("upload-photos").setInputFiles([png(0, 200, 0), png(0, 0, 200), png(200, 200, 0)]);
  for (let i = 0; i < 2; i++) await confirmUpload(page, async () => (await photoUrls(page)).length === i + 1);
  await expect(page.getByTestId("image-editor")).toHaveCount(0);
  expect(await photoUrls(page)).toHaveLength(2); // the third file did not fit and was not uploaded
  await expect(page.getByTestId("upload-photos")).toHaveCount(0);

  // Reorder: the first moves one place later.
  const [a, b] = await photoUrls(page);
  await page.getByTestId("photo-item").first().getByTestId("photo-later").click();
  expect(await photoUrls(page)).toEqual([b, a]);

  // Replace keeps the slot.
  await page.getByTestId("photo-item").nth(1).getByTestId("photo-replace").click();
  await page.getByTestId("replace-photo-input").setInputFiles(png(120, 0, 120));
  await confirmUpload(page, async () => (await editor.count()) === 0);
  const replaced = await photoUrls(page);
  expect(replaced).toHaveLength(2);
  expect(replaced[0]).toBe(b);
  expect(replaced[1]).not.toBe(a);

  // Remove asks first: dismiss keeps it, accept removes it and frees the slot again.
  page.once("dialog", (d) => void d.dismiss());
  await page.getByTestId("photo-item").first().getByTestId("photo-remove").click();
  expect(await photoUrls(page)).toHaveLength(2);
  page.once("dialog", (d) => void d.accept());
  await page.getByTestId("photo-item").first().getByTestId("photo-remove").click();
  expect(await photoUrls(page)).toEqual([replaced[1]]);
  await expect(page.getByTestId("upload-photos")).toBeEnabled();

  await page.getByRole("button", { name: "Speichern und veröffentlichen" }).click();
  await expect(page.getByTestId("business-status")).toHaveText("Veröffentlicht");
  const cover = await page.locator("input[name=coverUrl]").inputValue();

  // Public profile: cover first, then the remaining gallery photo.
  const slug = (await (await page.request.get(`/api/v1/businesses?q=${encodeURIComponent(name)}`)).json()).data[0].slug;
  await page.goto(`/de/business/${slug}`);
  const gallery = page.getByTestId("business-gallery");
  const shown = await gallery.locator("img").evaluateAll((els) => els.map((e) => (e as HTMLImageElement).getAttribute("src")));
  // Each stored URL announces its smaller copies (features/business-images/variants.ts): the original is the src and
  // the copies are offered in srcset, so a phone loads a copy that fits its screen.
  const plain = (u: string) => u.split("?")[0];
  expect(shown).toEqual([cover, replaced[1]].map(plain));
  for (const u of [cover, replaced[1]]) expect(u).toMatch(/\?v=160,480,720,960&w=1280$/);
  const srcsets = await gallery.locator("img").evaluateAll((els) => els.map((e) => (e as HTMLImageElement).getAttribute("srcset") ?? ""));
  expect(srcsets[0]).toContain(`${plain(cover).replace(/\.jpg$/, "")}-w720.jpg 720w`);
  const copy = await page.request.get(`${plain(cover).replace(/\.jpg$/, "")}-w480.jpg`);
  expect(copy.ok()).toBe(true);
  await expect(gallery).toContainText("2 Bilder");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  // Without a phone number Directions is the first action: its menu still stays on screen.
  await page.getByTestId("directions-button").click();
  const menu = await page.getByTestId("directions-menu").boundingBox();
  expect(menu && menu.x >= 0 && menu.x + menu.width <= page.viewportSize()!.width).toBeTruthy();
});
