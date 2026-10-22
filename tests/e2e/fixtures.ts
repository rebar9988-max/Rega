import { test as base, expect } from "@playwright/test";

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
