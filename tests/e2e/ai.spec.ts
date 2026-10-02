import { expect, test } from "./fixtures";
import { FAKE_ANTHROPIC_ANSWER, FAKE_DEEPSEEK_ANSWER, FAKE_GROK_ANSWER, FAKE_GROQ_ANSWER, FAKE_OPENAI_ANSWER, FAKE_OPENROUTER_ANSWER } from "./fake-ai";
import { ADMIN } from "./global-setup";

const body = (content: string) => ({ messages: [{ role: "user", content }], locale: "de", sessionId: `e2e-${Math.random().toString(36).slice(2)}-session` });

async function ask(request: import("@playwright/test").APIRequestContext, content: string) {
  const res = await request.post("/api/v1/ai/chat", { data: body(content) });
  const text = await res.text();
  expect(res.status(), text).toBe(200);
  expect(text).not.toMatch(/e2e-fake-/); // no key ever appears in a response
  return JSON.parse(text).data as { content: string; provider: string };
}

test("chain step 1: Gemini down -> OpenAI answers", async ({ request }) => {
  expect(await ask(request, "Restaurant in Erbil")).toMatchObject({ provider: "openai", content: FAKE_OPENAI_ANSWER });
});

test("chain step 2: Gemini + OpenAI down -> Grok answers", async ({ request }) => {
  expect(await ask(request, "FORCE_OPENAI_FAIL Restaurant")).toMatchObject({ provider: "grok", content: FAKE_GROK_ANSWER });
});

test("chain step 3: Gemini + OpenAI + Grok down -> Groq still answers", async ({ request }) => {
  expect(await ask(request, "FORCE_OPENAI_FAIL FORCE_GROK_FAIL Restaurant")).toMatchObject({ provider: "groq", content: FAKE_GROQ_ANSWER });
});

test("chain step 4: every direct vendor fails -> DeepSeek answers", async ({ request }) => {
  expect(await ask(request, "FORCE_DIRECT_REJECT Restaurant")).toMatchObject({ provider: "deepseek", content: FAKE_DEEPSEEK_ANSWER });
});

test("chain step 5: DeepSeek out of credit (402) too -> OpenRouter answers", async ({ request }) => {
  expect(await ask(request, "FORCE_DIRECT_REJECT FORCE_DEEPSEEK_FAIL Restaurant")).toMatchObject({ provider: "openrouter", content: FAKE_OPENROUTER_ANSWER });
});

test("chain step 6: every other provider fails -> Anthropic Claude answers last", async ({ request }) => {
  // OpenAI fails with an empty answer here rather than a 5xx: steps 2 and 3 already gave it two 5xx in a row, and a
  // third would open its circuit in the shared server for 30 s and reroute the tests that follow (they expect OpenAI).
  // DeepSeek answers 402 (its 2nd consecutive failure after step 5, below the breaker threshold of 3) and OpenRouter
  // rejects with a breaker-neutral 400, so no circuit opens for later tests either.
  expect(await ask(request, "FORCE_OPENAI_EMPTY FORCE_GROK_FAIL FORCE_GROQ_FAIL FORCE_DEEPSEEK_FAIL FORCE_OPENROUTER_REJECT Restaurant")).toMatchObject({ provider: "anthropic", content: FAKE_ANTHROPIC_ANSWER });
});

test("invalid AI requests are rejected with validation errors, not 500s", async ({ request }) => {
  expect((await request.post("/api/v1/ai/chat", { data: { messages: [], locale: "de", sessionId: "short" } })).status()).toBe(422);
  expect((await request.post("/api/v1/ai/chat", { data: Buffer.from("not json"), headers: { "content-type": "application/json" } })).status()).toBe(400);
  expect((await request.post("/api/v1/ai/chat", { data: body("x".repeat(70_000)) })).status()).toBeGreaterThanOrEqual(400);
});

test("AI page: suggestion → answer rendered", async ({ page }) => {
  await page.goto("/de/ai");
  // Example prompts target Germany/Europe (not Erbil restaurants); "verified" finds the verified demo businesses.
  await expect(page.getByRole("button", { name: "Kurdischer Anwalt in Köln" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Kurdischsprachiger Arzt in Berlin" })).toBeVisible();
  await page.getByRole("button", { name: "Welche Unternehmen sind verifiziert?" }).click();
  await expect(page.getByRole("log")).toContainText(FAKE_OPENAI_ANSWER);
  // The listings the answer is based on come back as structured cards that link to the listing.
  const cards = page.getByTestId("ai-cards");
  await expect(cards).toBeVisible();
  await expect(cards.getByRole("link").first()).toHaveAttribute("href", /\/de\/business\//);
});

test("AI is rate limited per session", async ({ request }) => {
  const sessionId = "e2e-rate-limit-session";
  const statuses: number[] = [];
  for (let i = 0; i < 14; i++) statuses.push((await request.post("/api/v1/ai/chat", { data: { ...body("hi"), sessionId } })).status());
  expect(statuses.slice(0, 12).every((s) => s === 200)).toBe(true);
  expect(statuses.slice(12)).toContain(429);
});

test("dashboard lists all seven providers and every connection test succeeds", async ({ page }) => {
  await page.goto("/de/login?next=%2Fdr%2Fai");
  await page.getByLabel("E-Mail", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Passwort", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/dr\/ai$/);
  for (const id of ["gemini", "grok", "openai", "groq", "deepseek", "openrouter", "anthropic"]) {
    const row = page.getByRole("row").filter({ has: page.getByText(id, { exact: true }) });
    await expect(row.getByText("Konfiguriert")).toBeVisible();
    await row.getByRole("button", { name: "Verbindung testen" }).click();
    await expect(page.getByTestId(`probe-${id}`)).toContainText("Verbindung erfolgreich");
  }
});

test("nothing matches: the assistant says so instead of inventing businesses, and points to categories and /for-business", async ({ request, page }) => {
  const res = await request.post("/api/v1/ai/chat", { data: body("Kurdischer Zahnarzt in Atlantisstadt") });
  const out = (await res.json()).data as { content: string; provider: string; grounded: boolean; cards: unknown[]; suggestions: { url: string }[] };
  expect(res.status()).toBe(200);
  expect(out.provider).toBe("rega"); // no model was called
  expect(out.grounded).toBe(false);
  expect(out.cards).toEqual([]);
  expect(out.content).toContain("kein passender Eintrag");
  expect(out.suggestions.length).toBeGreaterThan(0);
  for (const s of out.suggestions) expect(s.url).toMatch(/^\/de\/businesses\?category=/);

  await page.goto("/de/ai");
  await page.getByLabel("Zum Beispiel: Kurdischer Anwalt in Köln").fill("Kurdischer Zahnarzt in Atlantisstadt");
  await page.getByRole("button", { name: "Senden" }).click();
  const noMatch = page.getByTestId("ai-no-match");
  await expect(noMatch).toBeVisible();
  await expect(noMatch.getByRole("link", { name: "Unternehmen kostenlos eintragen" })).toHaveAttribute("href", "/de/for-business");
});

test("question length is limited", async ({ request }) => {
  expect((await request.post("/api/v1/ai/chat", { data: body("x".repeat(601)) })).status()).toBe(422);
  expect((await request.post("/api/v1/ai/chat", { data: body("Restaurant ".repeat(40)) })).status()).toBe(200);
});
