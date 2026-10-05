import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Execute the actual server actions with isolated provider/database doubles. No messages or database writes escape.
const requireActual = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync(new URL("../src/features/auth/actions.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;

function actions({ delivered, existing = false, mailing = true, dbFails = false }: { delivered: boolean; existing?: boolean; mailing?: boolean; dbFails?: boolean }) {
  const user = { id: "owner", name: "Owner", email: "owner@example.org", emailVerified: null };
  let sent = 0;
  let created = 0;
  const doubles: Record<string, unknown> = {
    bcryptjs: { hash: async () => "test-hash" },
    "next-intl/server": { getTranslations: async () => (key: string) => key },
    "@/lib/db": { prisma: { user: {
      findFirst: async () => {
        if (dbFails) throw Object.assign(new Error("database unavailable"), { code: "P2022" });
        return existing ? user : null;
      },
      create: async () => { created++; return user; },
    } } },
    "@/lib/logger": { log: { info() {}, error() {} } },
    "@/lib/email": { emailEnabled: () => mailing, sendEmail: async () => { sent++; return delivered; } },
    "@/config/locales": { isLocale: (value: string) => value === "de" },
    "@/config/site": { RESET_TOKEN_TTL_MINUTES: 60, VERIFY_TOKEN_TTL_HOURS: 48 },
    "@/features/forms/guard": { guardForm: async () => "ok" },
    "@/lib/auth-helpers": { currentUser: async () => user },
    "@/lib/rate-limit": { allowShared: async () => true },
    "@/lib/client-ip": { maskEmail: () => "masked" },
    "./tokens": { issueToken: async () => "test-token", consumeToken: async () => true, revokeTokens: async () => {} },
  };
  const exports: Record<string, (prev: unknown, form: FormData) => Promise<{ status: string; detail?: string; error?: string }>> = {};
  runInNewContext(compiled, {
    exports, require: (name: string) => name in doubles ? doubles[name] : requireActual(name),
    process: { env: {} }, URL, URLSearchParams, Date,
  });
  return { api: exports, counts: () => ({ sent, created }) };
}

function registration() {
  const form = new FormData();
  for (const [key, value] of Object.entries({ name: "Owner", email: "owner@example.org", password: "secure-pass-123", password2: "secure-pass-123", accountType: "owner", accept: "on", locale: "de" })) form.set(key, value);
  return form;
}

test("new registration reports unavailable delivery without undoing or duplicating the unverified account", async () => {
  const { api, counts } = actions({ delivered: false });
  const result = await api.register(undefined, registration());
  assert.equal(result.status, "ok");
  assert.equal(result.detail, "unavailable");
  assert.deepEqual(counts(), { sent: 1, created: 1 });
});

test("registration reports verification mail only when delivery succeeds", async () => {
  const { api } = actions({ delivered: true });
  assert.equal((await api.register(undefined, registration())).detail, "verify");
});

test("retrying registration for an unverified account does not create another account", async () => {
  const { api, counts } = actions({ delivered: false, existing: true });
  assert.equal((await api.register(undefined, registration())).detail, "unavailable");
  assert.deepEqual(counts(), { sent: 1, created: 0 });
});

test("registration without a provider does not pretend to send a message", async () => {
  const { api, counts } = actions({ delivered: false, mailing: false });
  assert.equal((await api.register(undefined, registration())).detail, "unavailable");
  assert.equal(counts().sent, 0);
});

test("verification resend exposes delivery failure and permits a later retry", async () => {
  const form = new FormData();
  form.set("locale", "de");
  const failure = await actions({ delivered: false, existing: true }).api.resendVerification(undefined, form);
  assert.equal(failure.status, "error");
  assert.equal(failure.error, "failed");
  const success = await actions({ delivered: true, existing: true }).api.resendVerification(undefined, form);
  assert.equal(success.detail, "sent");
});


test("registration returns an inline form error instead of a Server Error page when the production schema is unavailable", async () => {
  const { api, counts } = actions({ delivered: true, dbFails: true });
  const result = await api.register(undefined, registration());
  assert.equal(result.status, "error");
  assert.equal(result.error, "failed");
  assert.deepEqual(counts(), { sent: 0, created: 0 });
});
