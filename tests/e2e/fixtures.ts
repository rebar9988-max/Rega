import { test as base, expect } from "@playwright/test";

/**
 * After every navigation wait until React has hydrated (the header link carries React props),
 * so clicks never race client-side handlers. Real visitors are never this fast.
 */
export const test = base.extend({
  page: async ({ page }, run) => {
    const goto = page.goto.bind(page);
    page.goto = (async (url: string, options?: Parameters<typeof goto>[1]) => {
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
