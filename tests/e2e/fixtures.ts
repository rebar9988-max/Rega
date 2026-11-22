import { test as base, expect, type Locator, type Page } from "@playwright/test";

/**
 * After every navigation wait until React has hydrated (the header link carries React props),
 * so clicks never race client-side handlers. Real visitors are never this fast.
 *
 * Before leaving a page, let its in-flight requests finish. A signed-in page starts a second batch of RSC link
 * prefetches right after it renders; navigating away while that batch is running can leave requests that Chromium
 * cancels without Playwright seeing them finish, so "networkidle" on the next page never settles (1 in ~40 logins,
 * far more often on a slow CI runner). The server answers every one of those requests; the race is only in the test.
 * The wait is bounded and the strict "networkidle" check on the destination page is unchanged.
 */
export const test = base.extend({
  page: async ({ page }, run) => {
    const goto = page.goto.bind(page);
    page.goto = (async (url: string, options?: Parameters<typeof goto>[1]) => {
      if (page.url() !== "about:blank") await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
      const res = await goto(url, { waitUntil: "networkidle", ...options });
      await page.waitForFunction(() => {
        const el = document.querySelector("header a, main a, main button");
        return !el || Object.keys(el).some((k) => k.startsWith("__reactProps"));
      });
      return res;
    }) as typeof page.goto;
    await run(page);
  },
});
export { expect };

/**
 * Opens the language menu wherever it lives and returns its list: the header pill from 768 px up, and on phones
 * the menu sheet, where the switcher moved when the phone header was reduced to the menu key (owner, 2026-11-21).
 */
export async function openLanguageMenu(page: Page): Promise<Locator> {
  const pill = page.locator("header .rega-header-pill summary");
  if (await pill.isVisible()) {
    await pill.click();
    return page.locator("header .rega-header-pill details > ul");
  }
  await page.locator("header .rega-header-menu").click();
  // In the sheet the languages are a plain always-visible list, not a disclosure.
  return page.locator("header dialog [data-testid='language-list']");
}
