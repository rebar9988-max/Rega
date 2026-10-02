import { defineConfig, devices } from "@playwright/test";
import { existsSync, statSync } from "node:fs";

const PORT = Number(process.env.E2E_PORT ?? 3111);
// In sandboxes the browser is pre-installed; on a normal machine `npx playwright install chromium` is enough.
const SANDBOX_CHROMIUM = "/opt/pw-browsers/chromium";
const executablePath = existsSync(SANDBOX_CHROMIUM) && statSync(SANDBOX_CHROMIUM).isFile() ? SANDBOX_CHROMIUM : undefined;

// The map needs WebGL: headless Chromium provides it in software (SwiftShader).
const launchOptions = { ...(executablePath ? { executablePath } : {}), args: ["--enable-unsafe-swiftshader"] };

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false, // tests share one database; dashboard tests mutate rows
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    // AI providers point at a local fake (tests/e2e/fake-ai.ts): no real keys or network are ever used in tests.
    env: { AUTH_SESSION_REVALIDATE_MS: "0", AUTH_LOGIN_ATTEMPTS: "500", AI_PROVIDER: "auto", GEMINI_API_KEY: "e2e-fake-gemini-key", GEMINI_BASE_URL: "http://127.0.0.1:3999/gemini", XAI_API_KEY: "e2e-fake-xai-key", GROK_BASE_URL: "http://127.0.0.1:3999/grok", OPENAI_API_KEY: "e2e-fake-openai-key", OPENAI_BASE_URL: "http://127.0.0.1:3999/openai", GROQ_API_KEY: "e2e-fake-groq-key", GROQ_BASE_URL: "http://127.0.0.1:3999/groq", DEEPSEEK_API_KEY: "e2e-fake-deepseek-key", DEEPSEEK_BASE_URL: "http://127.0.0.1:3999/deepseek", OPENROUTER_API_KEY: "e2e-fake-openrouter-key", OPENROUTER_BASE_URL: "http://127.0.0.1:3999/openrouter", ANTHROPIC_API_KEY: "e2e-fake-anthropic-key", ANTHROPIC_BASE_URL: "http://127.0.0.1:3999/anthropic", AI_TIMEOUT_MS: "5000", GEOCODING_URL: "http://127.0.0.1:3999/geocode",
      // Test-only profile URLs (the TikTok one is deliberately not on tiktok.com and must be rejected, never shown).
      SOCIAL_FACEBOOK_URL: "https://www.facebook.com/rega-e2e-test", SOCIAL_INSTAGRAM_URL: "https://www.instagram.com/rega_e2e_test/", SOCIAL_TIKTOK_URL: "https://tiktok.example.org/@rega" },
    url: `http://localhost:${PORT}/api/v1/health`, reuseExistingServer: true, timeout: 60_000 },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions } },
    { name: "mobile", use: { ...devices["Pixel 5"], launchOptions }, testMatch: /(navigation|catalog|language-switcher|nearby)\.spec\.ts/ },
  ],
});
