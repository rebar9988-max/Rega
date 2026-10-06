import { expect, test } from "./fixtures";

type CityOption = { value: string; text: string };

async function cityOptions(page: import("@playwright/test").Page, locale: "de" | "ckb"): Promise<CityOption[]> {
  await page.goto(`/${locale}/businesses/legal`);
  return page.locator("#f-city option").evaluateAll((options) =>
    options
      .map((option) => {
        const el = option as HTMLOptionElement;
        return { value: el.value, text: (el.textContent ?? "").trim() };
      })
      .filter((option) => option.value !== ""),
  );
}

test("business city filter stays inside Germany and does not follow the UI language", async ({ page }) => {
  const de = await cityOptions(page, "de");
  expect(de.length).toBeGreaterThan(0);

  const germanLabels = de.map((option) => option.text);
  for (const city of ["Berlin", "Hamburg", "Köln", "München", "Frankfurt"]) {
    expect(germanLabels.some((label) => label.startsWith(city))).toBe(true);
  }
  for (const foreignCity of ["Wien", "Stockholm", "London", "Amsterdam", "Paris", "Erbil", "Sulaimaniyya"]) {
    expect(germanLabels.some((label) => label.startsWith(foreignCity))).toBe(false);
  }

  // The legal demo business is in Berlin, so the category-scoped count must be positive.
  const berlin = de.find((option) => option.text.startsWith("Berlin"));
  expect(berlin?.text).toMatch(/\([1-9][0-9]*\)$/);

  const ckb = await cityOptions(page, "ckb");
  expect(ckb.map((option) => option.value).sort()).toEqual(de.map((option) => option.value).sort());
});
