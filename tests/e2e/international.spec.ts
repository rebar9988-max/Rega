import { expect, test } from "./fixtures";

/**
 * International experience: 11 interface languages × 13 European target countries. Language and country are
 * independent: every combination must render, in the right language and direction, with the country kept.
 */
const LOCALES: [string, string, "rtl" | "ltr"][] = [
  ["ckb", "ckb-IQ", "rtl"], ["kmr", "kmr", "ltr"], ["de", "de-DE", "ltr"], ["en", "en", "ltr"], ["ar", "ar", "rtl"], ["tr", "tr-TR", "ltr"],
  ["fa", "fa-IR", "rtl"], ["fr", "fr-FR", "ltr"], ["sv", "sv-SE", "ltr"], ["nl", "nl-NL", "ltr"], ["it", "it-IT", "ltr"],
];
const COUNTRIES = ["DE", "FR", "SE", "NL", "GB", "BE", "AT", "CH", "GR", "NO", "DK", "FI", "IT"];
const HOST = "https://www.rega24.com";

type GeoCity = { id: string; nameEn: string; countryCode: string };
async function capital(request: import("@playwright/test").APIRequestContext, country: string, nameEn: string): Promise<GeoCity> {
  const body = await (await request.get(`/api/v1/geo?country=${country}&q=${encodeURIComponent(nameEn)}`)).json() as { data: { cities: GeoCity[] } };
  const city = body.data.cities.find((c) => c.nameEn === nameEn);
  expect(city, `${nameEn} in ${country}`).toBeTruthy();
  return city!;
}

test("all 143 language × country combinations render with the right language, direction, canonical and country", async ({ page }) => {
  test.setTimeout(300_000);
  let checked = 0;
  for (const [locale, lang, dir] of LOCALES) {
    for (const country of COUNTRIES) {
      const res = await page.request.get(`/${locale}/businesses?country=${country}`);
      expect(res.status(), `${locale}/${country}`).toBe(200);
      const html = await res.text();
      expect(html, `${locale}/${country} lang`).toContain(`lang="${lang}"`);
      expect(html, `${locale}/${country} dir`).toContain(`dir="${dir}"`);
      // A filtered list keeps the plain list as canonical (no duplicate filter URLs in the index).
      expect(html, `${locale}/${country} canonical`).toContain(`<link rel="canonical" href="${HOST}/${locale}/businesses"`);
      expect(html, `${locale}/${country} country kept`).toMatch(new RegExp(`<option value="${country}" selected=""`));
      checked++;
    }
  }
  expect(checked).toBe(143);
});

test("every target country is offered in the location selector API with at least one city", async ({ request }) => {
  const body = await (await request.get("/api/v1/geo?country=IT")).json() as { data: { countries: { code: string }[] } };
  const offered = body.data.countries.map((c) => c.code);
  for (const c of COUNTRIES) expect(offered, c).toContain(c);
  expect(new Set(offered).size).toBe(offered.length);
  for (const c of COUNTRIES) {
    const list = await (await request.get(`/api/v1/geo?country=${c}`)).json() as { data: { cities: GeoCity[] } };
    expect(list.data.cities.length, `${c} cities`).toBeGreaterThan(0);
    for (const city of list.data.cities) expect(city.countryCode).toBe(c);
  }
});

// Interactive: every locale and every country at least once, in a real browser (language switch keeps country + city).
const PAIRS = COUNTRIES.map((country, i) => [LOCALES[i % LOCALES.length], country] as const);
for (const [[locale, lang, dir], country] of PAIRS) {
  test(`interactive ${locale} + ${country}: page renders, country stays selected, no errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`/${locale}/businesses?country=${country}`);
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    await expect(page.locator("html")).toHaveAttribute("dir", dir);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("#f-country")).toHaveValue(country);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    expect(errors, errors.join("\n")).toEqual([]);
  });
}

// The owner's examples: language, country and city are independent.
const EXAMPLES: [string, string, string, string][] = [["ckb", "DE", "Cologne", "it"], ["it", "DE", "Berlin", "de"], ["de", "IT", "Rome", "ckb"]];
for (const [locale, country, cityEn, next] of EXAMPLES) {
  test(`${locale} + ${country} + ${cityEn}: switching to ${next} keeps country and city`, async ({ page }) => {
    const city = await capital(page.request, country, cityEn);
    await page.goto(`/${locale}/businesses?country=${country}&city=${city.id}`);
    await expect(page.locator("#f-country")).toHaveValue(country);
    await page.locator("header details > summary").click();
    await page.locator(`header details > ul a[hreflang="${LOCALES.find(([l]) => l === next)![1]}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/${next}/businesses\\?country=${country}&city=${city.id}$`));
    await expect(page.locator("#f-country")).toHaveValue(country);
  });
}

test("a business profile keeps its page when the language changes", async ({ page }) => {
  await page.goto("/ckb/business/kurdistan-rechtsberatung");
  await page.locator("header details > summary").click();
  await page.locator(`header details > ul a[hreflang="it-IT"]`).click();
  await expect(page).toHaveURL(/\/it\/business\/kurdistan-rechtsberatung$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "it-IT");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Kurdistan Rechtsberatung");
});
