import { expect, test } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";

for (const locale of ["ckb", "ar", "fa", "en"]) {
  test(`Nearby compact preview and results: ${locale}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.addInitScript(() => localStorage.clear());
    await page.route("https://tiles.openfreemap.org/**", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#eee" } }] }) }));
    for (const width of [320, 375, 430, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${locale}/nearby`);
      await expect(page.locator("main h1")).toHaveCount(1);
      await expect(page.locator("main h2")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const map = page.getByTestId("discovery-map");
      if (width < 1024) expect((await map.boundingBox())!.height).toBeGreaterThanOrEqual(240);
      await page.screenshot({ path: info.outputPath(`${locale}-${width}-initial.png`), fullPage: true });
      const city = page.getByTestId("nearby-city");
      const options = await city.locator("option").evaluateAll((rows) => rows.map((row) => ({ value: (row as HTMLOptionElement).value, text: row.textContent })));
      const berlin = options.find((row) => /Berlin|بەرلین|برلين|برلین/.test(row.text ?? ""));
      expect(berlin).toBeTruthy();
      await city.selectOption(berlin!.value);
      await expect(page.getByTestId("nearby-count")).not.toHaveText("");
      await expect(map).toHaveAttribute("data-status", "ready");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`${locale}-${width}-results.png`), fullPage: true });
      expect(errors).toEqual([]);
      if (width === 375) {
        const enter = page.locator(".nearby-map .maplibregl-ctrl-fullscreen");
        await enter.click();
        await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
        await page.locator(".nearby-map .maplibregl-ctrl-shrink").click();
        await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
        const audit = await new AxeBuilder({ page }).include("main").analyze();
        expect(audit.violations.filter((v) => v.impact === "critical" || v.impact === "serious")).toEqual([]);
      }
    }
  });
}

test("Nearby delayed and failed requests keep controls and recovery usable", async ({ page }) => {
  await page.route("https://tiles.openfreemap.org/**", (route) => route.fulfill({ contentType: "application/json", body: '{"version":8,"sources":{},"layers":[]}' }));
  let fail = true;
  await page.route("**/api/v1/nearby?**", async (route) => {
    if (fail) return route.abort();
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  await page.goto("/en/nearby");
  await page.getByTestId("nearby-city").selectOption({ label: "Berlin" });
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  await expect(page.getByTestId("nearby-radius")).toBeEnabled();
  await expect(page.getByTestId("discovery-map")).toHaveAttribute("data-status", "ready");
  const slow = await page.context().newCDPSession(page);
  await slow.send("Network.enable");
  await slow.send("Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: 50000, uploadThroughput: 50000, connectionType: "cellular3g" });
  fail = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator('main ul[aria-hidden="true"]')).toBeVisible();
  await expect(page.getByTestId("nearby-results")).toContainText("Kurdistan Rechtsberatung");
});

test("Nearby city selection supersedes a delayed geolocation callback", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (success) => {
      setTimeout(() => success({ coords: { latitude: 36.191, longitude: 44.009 } } as GeolocationPosition), 1200);
    };
  });
  await page.route("https://tiles.openfreemap.org/**", (route) => route.fulfill({ contentType: "application/json", body: '{"version":8,"sources":{},"layers":[]}' }));
  await page.goto("/en/nearby");
  await page.getByTestId("nearby-locate").click();
  await page.getByTestId("nearby-city").selectOption({ label: "Berlin" });
  await expect(page.getByTestId("nearby-place")).toContainText("Berlin");
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("nearby-place")).toContainText("Berlin");
});

test("Nearby ignores an older radius response after the radius changes", async ({ page }) => {
  await page.route("https://tiles.openfreemap.org/**", (route) => route.fulfill({ contentType: "application/json", body: '{"version":8,"sources":{},"layers":[]}' }));
  await page.goto("/en/nearby");
  await page.getByTestId("nearby-city").selectOption({ label: "Berlin" });
  await expect(page.getByTestId("nearby-results")).toContainText("Kurdistan Rechtsberatung");
  let release: () => void = () => undefined;
  let held = false;
  await page.route("**/api/v1/nearby?**", async (route) => {
    if (new URL(route.request().url()).searchParams.get("radius") !== "1") return route.continue();
    const response = await route.fetch();
    await new Promise<void>((resolve) => { release = resolve; held = true; });
    await route.fulfill({ response });
  });
  try {
    await page.getByTestId("nearby-radius").selectOption("1");
    await expect.poll(() => held).toBe(true);
    await page.getByTestId("nearby-radius").selectOption("25");
    await expect(page.getByTestId("nearby-results")).toContainText("Kurdistan Rechtsberatung");
    const count = await page.getByTestId("nearby-count").textContent();
    release();
    await page.waitForTimeout(400);
    await expect(page.getByTestId("nearby-count")).toHaveText(count!);
    await expect(page.getByTestId("nearby-radius")).toHaveValue("25");
  } finally { release(); }
});
