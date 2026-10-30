/**
 * Business profile layout of the RTL reference: the optional social profiles sit inside the phone card (below a
 * divider, only the platforms that were saved), the card stays compact without them, the About / Hours / Reviews tabs
 * work with mouse and keyboard, and the back button sits on the cover's reading-start side. Saving and validating the
 * links in the business form is covered by business-form.spec.ts.
 */
import { testDatabaseClient } from "./database-client";
import { expect, test } from "./fixtures";

const db = testDatabaseClient();
const SLUG = "zagros-restaurant"; // seeded with a phone number and no e-mail, website or WhatsApp
const clear = { facebookUrl: null, instagramUrl: null, tiktokUrl: null, snapchatUrl: null };

test.describe.configure({ mode: "serial" });
test.afterAll(async () => { await db.business.update({ where: { slug: SLUG }, data: clear }); });

test("the phone card shows the number and only the saved platforms, below a divider", async ({ page }) => {
  await db.business.update({ where: { slug: SLUG }, data: { ...clear, instagramUrl: "https://www.instagram.com/rega24", snapchatUrl: "https://www.snapchat.com/add/rega24" } });
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(`/ckb/business/${SLUG}`);
  const card = page.getByTestId("business-contact");
  await expect(card.locator('a[href^="tel:"]')).toContainText("+964 750 000 0000");
  const social = card.getByTestId("business-social");
  await expect(social.getByRole("link")).toHaveCount(2);
  await expect(social.getByTestId("social-instagram")).toHaveAttribute("href", "https://www.instagram.com/rega24");
  await expect(social.getByTestId("social-snapchat")).toHaveAttribute("href", "https://www.snapchat.com/add/rega24");
  await expect(social.getByTestId("social-instagram")).toHaveAttribute("rel", /noopener/);
  await expect(social.getByTestId("social-instagram")).toHaveAttribute("target", "_blank");
  await expect(card.getByTestId("social-facebook")).toHaveCount(0);
  await expect(card.getByTestId("social-tiktok")).toHaveCount(0);
  await expect(card.locator(".border-t")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

  // Tabs: About first; Hours and Reviews on click and with the arrow keys (reading direction).
  await expect(page.getByTestId("business-panel-about")).toBeVisible();
  await page.getByTestId("business-tab-hours").click();
  await expect(page.getByTestId("business-panel-hours")).toBeVisible();
  await expect(page.getByTestId("business-panel-about")).toBeHidden();
  await page.keyboard.press("ArrowLeft"); // RTL: the next tab is on the left
  await expect(page.getByTestId("business-tab-reviews")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("business-panel-reviews")).toBeVisible();

  // The back button sits on the cover's reading-start side (right in RTL) and leads to the directory.
  const back = page.getByTestId("business-back");
  const box = await back.boundingBox();
  expect(box && box.x > 375 / 2).toBeTruthy();
  await expect(back).toHaveAttribute("href", "/ckb/businesses");
});

test("without social links the phone card has no divider and no social row", async ({ page }) => {
  await db.business.update({ where: { slug: SLUG }, data: clear });
  await page.goto(`/de/business/${SLUG}`);
  await expect(page.getByTestId("business-contact").locator('a[href^="tel:"]')).toBeVisible();
  await expect(page.getByTestId("business-social")).toHaveCount(0);
  await expect(page.getByTestId("business-contact").locator(".border-t")).toHaveCount(0);
});
