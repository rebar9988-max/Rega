/**
 * Business social profiles: the owner/admin form refuses a URL of another site, and each stored profile is shown on the
 * public page as a direct link to exactly that profile (new tab, no opener), with its brand mark and accessible name.
 */
import { expect, test } from "./fixtures";
import { ADMIN } from "./global-setup";

const stamp = Date.now().toString(36);
const name = `E2E Social ${stamp}`;
const LINKS = {
  instagram: `https://www.instagram.com/rega24_${stamp}`,
  snapchat: `https://www.snapchat.com/add/rega24_${stamp}`,
  facebook: `https://www.facebook.com/rega24.${stamp}`,
  tiktok: `https://www.tiktok.com/@rega24_${stamp}`,
} as const;

test("social links are validated per platform and open the business's own profile directly", async ({ page }) => {
  await page.goto("/de/login?next=%2Fdr");
  await page.getByLabel("E-Mail", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Passwort", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).not.toHaveURL(/\/login/);

  await page.goto("/dr/businesses/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByRole("combobox", { name: "Kategorie", exact: true }).selectOption({ label: "Recht" });
  await page.getByLabel("Straße und Hausnummer").fill("Jungfernstieg 9");
  await page.locator('select[name="countryCode"]').selectOption("DE");
  await page.getByLabel("Stadt", { exact: true }).fill("Hamburg");
  await page.getByTestId("lat").fill("53.5512");
  await page.getByTestId("lng").fill("9.9938");
  await page.getByTestId("confirm-location").check();

  // A link to another site in the Instagram field is refused by the server.
  await page.locator('input[name="instagramUrl"]').fill("https://evil.example/instagram");
  await page.getByRole("button", { name: "Speichern und veröffentlichen" }).click();
  await expect(page.getByTestId("form-error")).toBeVisible();
  await expect(page.locator('input[name="instagramUrl"]')).toHaveAttribute("aria-invalid", "true");

  for (const [platform, url] of Object.entries(LINKS)) await page.locator(`input[name="${platform}Url"]`).fill(url);
  await page.getByRole("button", { name: "Speichern und veröffentlichen" }).click();
  await expect(page.getByTestId("business-status")).toHaveText("Veröffentlicht");

  const slug = (await (await page.request.get(`/api/v1/businesses?q=${encodeURIComponent(name)}`)).json()).data[0].slug;
  for (const locale of ["de", "ckb"]) {
    await page.goto(`/${locale}/businesses/${slug}`);
    const list = page.getByTestId("business-social");
    await expect(list.getByRole("link")).toHaveCount(4);
    for (const [platform, url] of Object.entries(LINKS)) {
      const link = page.getByTestId(`business-social-${platform}`);
      await expect(link).toHaveAttribute("href", url);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /noopener/);
      await expect(link).toHaveAccessibleName(new RegExp(name));
    }
  }
  // A visitor's click goes straight to the profile (the request leaves for the platform's own URL).
  await page.context().route("https://www.instagram.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>ok</title>" }));
  const [popup] = await Promise.all([page.waitForEvent("popup"), page.getByTestId("business-social-instagram").click()]);
  await expect(popup).toHaveURL(LINKS.instagram);
});
