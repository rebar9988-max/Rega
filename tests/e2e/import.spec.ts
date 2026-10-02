import { expect, test } from "./fixtures";
import { ADMIN } from "./global-setup";

const stamp = Date.now().toString(36);

test("admin CSV import: dry run, then pending listings; bad rows reported; a second upload skips duplicates", async ({ page }) => {
  await page.goto("/de/login?next=%2Fdr%2Fimport");
  await page.getByLabel("E-Mail", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Passwort", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await page.goto("/dr/import");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Unternehmen aus CSV importieren");

  const name = `E2E Import ${stamp}`;
  const csv = [
    "name,category,addressLine1,postalCode,city,countryCode,languages",
    `${name},legal,Importstraße 7,10115,Berlin,DE,ckb;de`,
    `E2E Falsche Stadt ${stamp},legal,Weg 1,00000,Atlantis,DE,`,
    `E2E Falsche Kategorie ${stamp},unbekannt,Weg 2,10115,Berlin,DE,`,
  ].join("\n");
  const upload = (_dryRun: boolean) => page.getByTestId("import-form").locator('input[name="file"]').setInputFiles({ name: "import.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });

  // Dry run (default): reports, saves nothing.
  await upload(true);
  await page.getByRole("button", { name: "Starten" }).click();
  const result = page.getByTestId("import-result");
  await expect(result).toContainText("1 würden angelegt, 0 übersprungen, 2 Fehler");
  await expect(result).toContainText("unknown city");
  await expect(result).toContainText("unknown category");
  const none = await (await page.request.get(`/api/v1/businesses?q=${encodeURIComponent(name)}`)).json();
  expect(none.data.some((b: { name: string }) => b.name === name)).toBe(false);

  // Real run.
  await upload(false);
  await page.getByTestId("import-form").getByRole("checkbox").uncheck();
  await page.getByRole("button", { name: "Starten" }).click();
  await expect(page.getByTestId("import-result")).toContainText("1 angelegt, 0 übersprungen, 2 Fehler");
  await page.goto(`/dr/businesses?q=${encodeURIComponent(name)}`);
  await expect(page.locator("tr", { hasText: name }).getByTestId("row-status")).toHaveText("Ausstehend");
  // Never public until a moderator approves it.
  const pub = await (await page.request.get(`/api/v1/businesses?q=${encodeURIComponent(name)}&status=published`)).json();
  expect(pub.data.filter((b: { name: string; status: string }) => b.name === name && b.status === "published")).toHaveLength(0);

  // Second upload of the same file: duplicate skipped.
  await page.goto("/dr/import");
  await upload(false);
  await page.getByTestId("import-form").getByRole("checkbox").uncheck();
  await page.getByRole("button", { name: "Starten" }).click();
  await expect(page.getByTestId("import-result")).toContainText("0 angelegt, 1 übersprungen, 2 Fehler");
});

test("import page needs the right to publish: employees are refused", async ({ page }) => {
  await page.goto("/de/login");
  await page.getByLabel("E-Mail", { exact: true }).fill("employee@example.org");
  await page.getByLabel("Passwort", { exact: true }).fill("employee-pass-123");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).not.toHaveURL(/\/login/);
  const res = await page.goto("/dr/import");
  expect(res?.status()).not.toBe(200);
  await expect(page.getByTestId("import-form")).toHaveCount(0);
});
