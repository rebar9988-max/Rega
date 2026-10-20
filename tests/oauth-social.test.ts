import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  OAUTH_PROVIDERS,
  enabledOAuthProviders,
  oauthCredentials,
  parseSocialContext,
  providerVouchesForEmail,
  resolveOAuthSignIn,
  safeRelativePath,
  serializeSocialContext,
  socialErrorKey,
  socialErrorKeyOrGeneric,
  diagnosableAuthError,
  displayName,
  normalizeEmail,
  type NewOAuthUser,
  type OAuthStore,
  type OAuthUserRow,
  type SocialContext,
} from "../src/features/auth/oauth-core";

const LOCALES = ["ckb", "kmr", "de", "en", "ar", "fa", "tr"];
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const row = (over: Partial<OAuthUserRow> = {}): OAuthUserRow => ({
  id: "u1", email: "ana@example.org", name: "Ana", role: "USER", locale: "ckb", status: "active",
  emailVerified: new Date("2026-01-01"), deletedAt: null, ...over,
});

/** In-memory store that records every write, so a test can prove that nothing was written. */
function fakeStore(seed: { linked?: Record<string, OAuthUserRow>; users?: OAuthUserRow[] } = {}) {
  const calls = { created: [] as NewOAuthUser[], linked: [] as string[], logins: [] as string[] };
  const store: OAuthStore = {
    async findLinkedUser(provider, id) { return seed.linked?.[`${provider}:${id}`] ?? null; },
    async findUserByEmail(email) { return seed.users?.find((u) => u.email === email) ?? null; },
    async createUser(data) { calls.created.push(data); return row({ id: "new", email: data.email, name: data.name, role: data.role, locale: data.locale, emailVerified: data.emailVerified }); },
    async linkAccount(userId, provider, id) { calls.linked.push(`${userId}:${provider}:${id}`); },
    async recordLogin(userId) { calls.logins.push(userId); },
  };
  return { store, calls };
}

const login: SocialContext = { intent: "login", locale: "ckb", role: "USER" };
const register = (over: Partial<SocialContext> = {}): SocialContext => ({ intent: "register", locale: "ckb", role: "USER", ...over });
const attempt = (over: Partial<Parameters<typeof resolveOAuthSignIn>[1]> = {}) => ({
  provider: "google" as const, providerAccountId: "g-1", email: "ana@example.org", emailVerified: true, name: "Ana", context: login, ...over,
});

// ---- configuration --------------------------------------------------------------------------------------------------

test("a provider is offered only when BOTH its id and its secret are configured", () => {
  assert.deepEqual(enabledOAuthProviders({}), []);
  assert.deepEqual(enabledOAuthProviders({ AUTH_GOOGLE_ID: "id" }), []);
  assert.deepEqual(enabledOAuthProviders({ AUTH_GOOGLE_SECRET: "s" }), []);
  assert.deepEqual(enabledOAuthProviders({ AUTH_GOOGLE_ID: "  ", AUTH_GOOGLE_SECRET: "s" }), [], "blank values count as missing");
  assert.deepEqual(enabledOAuthProviders({ AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "s" }), ["google"]);
});

test("providers keep the fixed button order and credentials are trimmed", () => {
  const env = { AUTH_APPLE_ID: "a", AUTH_APPLE_SECRET: "b", AUTH_FACEBOOK_ID: " c ", AUTH_FACEBOOK_SECRET: "d", AUTH_GOOGLE_ID: "e", AUTH_GOOGLE_SECRET: "f" };
  assert.deepEqual(enabledOAuthProviders(env), ["google", "facebook", "apple"]);
  assert.deepEqual(oauthCredentials("facebook", env), { clientId: "c", clientSecret: "d" });
  assert.equal(oauthCredentials("google", {}), null);
});

test("every provider's environment names are declared in env.ts, .env.example and the secrets-sync workflow", () => {
  const names = ["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET", "AUTH_FACEBOOK_ID", "AUTH_FACEBOOK_SECRET", "AUTH_APPLE_ID", "AUTH_APPLE_SECRET"];
  assert.equal(OAUTH_PROVIDERS.length * 2, names.length);
  for (const n of names) {
    assert.ok(read("src/lib/env.ts").includes(`${n}:`), `${n} in env.ts`);
    assert.ok(read(".env.example").includes(`${n}=`), `${n} in .env.example`);
    assert.ok(read(".github/workflows/worker-secrets-sync.yml").includes(`S_${n}`), `S_${n} in the sync workflow`);
  }
});

// ---- what the provider vouches for ------------------------------------------------------------------------------------

test("only Google and Apple can vouch for an e-mail address; Facebook never does", () => {
  assert.equal(providerVouchesForEmail("google", { email_verified: true }), true);
  assert.equal(providerVouchesForEmail("apple", { email_verified: "true" }), true);
  assert.equal(providerVouchesForEmail("google", { email_verified: false }), false);
  assert.equal(providerVouchesForEmail("google", { email_verified: "false" }), false);
  assert.equal(providerVouchesForEmail("google", {}), false);
  assert.equal(providerVouchesForEmail("google", undefined), false);
  assert.equal(providerVouchesForEmail("facebook", { email_verified: true }), false);
});

// ---- the context cookie ---------------------------------------------------------------------------------------------

test("the context cookie round-trips", () => {
  const ctx: SocialContext = { intent: "register", locale: "de", next: "/dr/businesses/new", role: "BUSINESS_OWNER" };
  assert.deepEqual(parseSocialContext(serializeSocialContext(ctx), LOCALES, "ckb"), ctx);
});

test("a missing, broken or tampered cookie falls back to the safe default: plain sign-in, least privilege", () => {
  const safe = { intent: "login", locale: "ckb", role: "USER" };
  for (const raw of [undefined, null, "", "not json", "[]", "null", "42"]) assert.deepEqual(parseSocialContext(raw, LOCALES, "ckb"), safe, String(raw));
  const forged = parseSocialContext(JSON.stringify({ i: "admin", l: "xx", n: "//evil.example", r: "SUPER_ADMIN" }), LOCALES, "ckb");
  assert.deepEqual(forged, safe);
});

test("only the two public roles can ever come out of the cookie", () => {
  for (const r of ["ADMIN", "SUPER_ADMIN", "EMPLOYEE", "MANAGER", "user", 1, null]) {
    assert.equal(parseSocialContext(JSON.stringify({ i: "register", r }), LOCALES, "ckb").role, "USER", String(r));
  }
  assert.equal(parseSocialContext(JSON.stringify({ r: "BUSINESS_OWNER" }), LOCALES, "ckb").role, "BUSINESS_OWNER");
});

test("redirect targets must be same-site relative paths", () => {
  assert.equal(safeRelativePath("/dr/businesses/new"), "/dr/businesses/new");
  for (const bad of ["//evil.example", "https://evil.example", "/\\evil", "evil", "/a\nb", "/" + "a".repeat(300), 5, undefined]) assert.equal(safeRelativePath(bad), undefined, String(bad));
});

// ---- the decision -----------------------------------------------------------------------------------------------------

test("a returning visitor is recognised by the provider id, without needing an e-mail", async () => {
  const { store, calls } = fakeStore({ linked: { "google:g-1": row() } });
  const r = await resolveOAuthSignIn(store, attempt({ email: null }));
  assert.ok(r.ok && r.user.id === "u1" && !r.created && !r.linked);
  assert.deepEqual(calls.logins, ["u1"]);
  assert.equal(calls.created.length + calls.linked.length, 0);
});

test("a returning visitor whose account is suspended or deleted is refused", async () => {
  for (const over of [{ status: "suspended" }, { deletedAt: new Date() }]) {
    const { store, calls } = fakeStore({ linked: { "google:g-1": row(over) } });
    assert.deepEqual(await resolveOAuthSignIn(store, attempt()), { ok: false, reason: "unavailable" });
    assert.equal(calls.logins.length, 0);
  }
});

test("a new identity without any e-mail address cannot be matched or registered", async () => {
  const { store, calls } = fakeStore();
  assert.deepEqual(await resolveOAuthSignIn(store, attempt({ email: null, context: register() })), { ok: false, reason: "no_email" });
  assert.deepEqual(await resolveOAuthSignIn(store, attempt({ email: "not-an-address", context: register() })), { ok: false, reason: "no_email" });
  assert.equal(calls.created.length, 0);
});

test("a verified provider address joins the existing, confirmed public account (case and spaces ignored)", async () => {
  const { store, calls } = fakeStore({ users: [row()] });
  const r = await resolveOAuthSignIn(store, attempt({ email: "  Ana@Example.ORG " }));
  assert.ok(r.ok && r.linked && !r.created && r.user.id === "u1");
  assert.deepEqual(calls.linked, ["u1:google:g-1"]);
  assert.equal(calls.created.length, 0, "no duplicate account");
});

test("an address the provider cannot prove (Facebook) never joins an existing account", async () => {
  const { store, calls } = fakeStore({ users: [row()] });
  assert.deepEqual(await resolveOAuthSignIn(store, attempt({ provider: "facebook", emailVerified: false })), { ok: false, reason: "exists_other_method" });
  assert.equal(calls.linked.length + calls.created.length + calls.logins.length, 0);
});

test("pre-hijacking is blocked: a never-confirmed registration is not taken over by a social sign-in", async () => {
  const { store, calls } = fakeStore({ users: [row({ emailVerified: null })] });
  assert.deepEqual(await resolveOAuthSignIn(store, attempt()), { ok: false, reason: "exists_unverified" });
  assert.equal(calls.linked.length + calls.created.length + calls.logins.length, 0);
});

test("staff accounts are never reached through an e-mail match", async () => {
  for (const role of ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"]) {
    const { store, calls } = fakeStore({ users: [row({ role })] });
    assert.deepEqual(await resolveOAuthSignIn(store, attempt()), { ok: false, reason: "exists_other_method" }, role);
    assert.equal(calls.linked.length + calls.logins.length, 0);
  }
});

test("suspended and deleted accounts keep their address reserved and cannot be revived or joined", async () => {
  for (const over of [{ status: "suspended" }, { deletedAt: new Date() }]) {
    const { store, calls } = fakeStore({ users: [row(over)] });
    assert.deepEqual(await resolveOAuthSignIn(store, attempt({ context: register() })), { ok: false, reason: "unavailable" });
    assert.equal(calls.linked.length + calls.created.length, 0);
  }
});

test("a plain sign-in never creates an account", async () => {
  const { store, calls } = fakeStore();
  assert.deepEqual(await resolveOAuthSignIn(store, attempt()), { ok: false, reason: "no_account" });
  assert.equal(calls.created.length, 0);
});

test("registering with Google creates a confirmed public account with the chosen role and the accepted terms", async () => {
  const { store, calls } = fakeStore();
  const now = new Date("2026-10-20T10:00:00Z");
  const r = await resolveOAuthSignIn(store, attempt({ context: register({ role: "BUSINESS_OWNER", locale: "de" }), now }));
  assert.ok(r.ok && r.created);
  assert.deepEqual(calls.created, [{ email: "ana@example.org", name: "Ana", role: "BUSINESS_OWNER", locale: "de", emailVerified: now, termsAcceptedAt: now, provider: "google", providerAccountId: "g-1" }]);
});

test("registering with Facebook leaves the address unconfirmed (it must still be confirmed by e-mail)", async () => {
  const { store, calls } = fakeStore();
  const r = await resolveOAuthSignIn(store, attempt({ provider: "facebook", providerAccountId: "f-1", emailVerified: false, context: register() }));
  assert.ok(r.ok && r.created);
  assert.equal(calls.created[0].emailVerified, null);
});

test("names: provider name is cleaned; short or missing names fall back to the part before the @", () => {
  assert.equal(displayName("  Ana\u0000 Berg  ", "x@y.org"), "Ana Berg");
  assert.equal(displayName(null, "dara@example.org"), "dara");
  assert.equal(displayName("A", "dara@example.org"), "dara");
  assert.equal(displayName(undefined, "a@example.org"), "a_");
  assert.equal(displayName("x".repeat(500), "a@b.co").length, 120);
  assert.equal(normalizeEmail(" A@B.CO "), "a@b.co");
  assert.equal(normalizeEmail("a b@c.de"), null);
});

test("every refusal the rules can give has a message, and unknown codes never show a raw error", () => {
  for (const reason of ["no_account", "no_email", "exists_other_method", "exists_unverified", "unavailable", "failed"]) {
    assert.ok(socialErrorKey(`social_${reason}`), reason);
  }
  assert.equal(socialErrorKey("constructor"), null, "prototype keys are not error codes");
  assert.equal(socialErrorKey(undefined), null);
  assert.equal(socialErrorKeyOrGeneric("social_exists_unverified"), "socialExistsUnverified");
  assert.equal(socialErrorKeyOrGeneric("AccessDenied"), "socialFailed", "a cancelled consent or provider outage");
  assert.equal(socialErrorKeyOrGeneric("1"), null, "wrong password stays the login page's own message");
  assert.equal(socialErrorKeyOrGeneric("rate"), null);
  assert.equal(socialErrorKeyOrGeneric(undefined), null);
});

// ---- wiring (source-level guards, as the project does for other auth rules) ----------------------------------------------

test("the sign-in callback leaves password sign-in untouched and hands social sign-ins to the rules", () => {
  const source = read("src/auth.config.ts");
  assert.match(source, /account\.provider === "credentials"\) return true/);
  assert.match(source, /completeSocialSignIn\(/);
  assert.match(source, /user\.id = result\.user\.id/, "the token must carry REGA's user id, not the provider's");
  assert.ok(!/allowDangerousEmailAccountLinking/.test(source), "Auth.js must never link accounts by e-mail on its own");
});

test("the start action validates provider, language, redirect and role before leaving for the provider", () => {
  const source = read("src/features/auth/social-actions.ts");
  assert.match(source, /startSocialSignIn\(providerId: string, formData: FormData\)/);
  assert.match(source, /isOAuthProvider\(provider\) \|\| !enabledOAuthProviders\(process\.env\)\.includes\(provider\)/);
  assert.match(source, /safeRelativePath\(formData\.get\("next"\)\)/);
  assert.match(source, /isLocale\(rawLocale\)/);
  assert.match(source, /formData\.get\("accountType"\) === "user" \? "USER" : "BUSINESS_OWNER"/);
  assert.match(source, /httpOnly: true/);
});

test("provider tokens are never stored", () => {
  const source = read("src/features/auth/oauth.ts");
  for (const field of ["access_token", "refresh_token", "id_token"]) assert.ok(!source.includes(field), field);
});

test("diagnosableAuthError: only known Auth.js codes (and social_failed) are recorded", () => {
  for (const code of ["OAuthCallbackError", "InvalidCheck", "Configuration", "CallbackRouteError", "AccessDenied", "social_failed"]) {
    assert.equal(diagnosableAuthError(code), code);
  }
  // The e-mail form's own codes, REGA's rule denials, made-up values and non-strings are never recorded.
  for (const code of ["1", "rate", "CredentialsSignin", "social_no_account", "social_exists_unverified", "<script>", "", "oauthcallbackerror"]) {
    assert.equal(diagnosableAuthError(code), null);
  }
  assert.equal(diagnosableAuthError(undefined), null);
  assert.equal(diagnosableAuthError(null), null);
});
