/**
 * Social sign-in rules (Google, Facebook, Apple): pure, no database and no framework, so every rule is unit-tested.
 *
 * - A provider is offered only when BOTH its client id and secret are configured (never shown as a dead button).
 * - A returning visitor is recognised by the provider's own account id, never by e-mail alone.
 * - A social identity is attached to an existing REGA account by e-mail only when the provider itself vouches that the
 *   address is verified AND the REGA account has a confirmed address (no pre-hijacking of a never-confirmed
 *   registration) AND the account is a public account (never staff).
 * - New accounts are created only from the registration page (intent "register"), never by a plain sign-in.
 *
 * The database is injected (`OAuthStore`); `oauth.ts` provides the Prisma implementation.
 */

export const OAUTH_PROVIDERS = ["google", "facebook", "apple"] as const;
export type OAuthProviderId = (typeof OAUTH_PROVIDERS)[number];

export const isOAuthProvider = (value: unknown): value is OAuthProviderId =>
  typeof value === "string" && (OAUTH_PROVIDERS as readonly string[]).includes(value);

type Env = Record<string, string | undefined>;

const ENV_KEYS: Record<OAuthProviderId, readonly [id: string, secret: string]> = {
  google: ["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"],
  facebook: ["AUTH_FACEBOOK_ID", "AUTH_FACEBOOK_SECRET"],
  apple: ["AUTH_APPLE_ID", "AUTH_APPLE_SECRET"],
};

/** Client credentials of a provider, or null when either half is missing or blank. */
export function oauthCredentials(provider: OAuthProviderId, env: Env): { clientId: string; clientSecret: string } | null {
  const [idKey, secretKey] = ENV_KEYS[provider];
  const clientId = env[idKey]?.trim();
  const clientSecret = env[secretKey]?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** Providers that are fully configured, in the fixed display order of the buttons. */
export function enabledOAuthProviders(env: Env): OAuthProviderId[] {
  return OAUTH_PROVIDERS.filter((provider) => oauthCredentials(provider, env) !== null);
}

/**
 * Does the provider itself state that the e-mail address is verified? Google and Apple send `email_verified` (Apple as
 * the string "true"). Facebook sends no such signal, so its address is never treated as verified.
 */
export function providerVouchesForEmail(provider: OAuthProviderId, profile: Record<string, unknown> | null | undefined): boolean {
  if (provider === "facebook") return false;
  const flag = profile?.email_verified;
  return flag === true || flag === "true";
}

// ---------------------------------------------------------------------------------------------------------------------
// Context of one sign-in attempt, carried from the button to the return from the provider in a short-lived cookie.
// ---------------------------------------------------------------------------------------------------------------------

export type SocialIntent = "login" | "register";
/** The two public roles. A staff role can never be requested through the cookie. */
export type SocialRole = "USER" | "BUSINESS_OWNER";

export type SocialContext = { intent: SocialIntent; locale: string; next?: string; role: SocialRole };

export const SOCIAL_CONTEXT_COOKIE = "rega-social";
export const SOCIAL_CONTEXT_MAX_AGE_S = 15 * 60;

/** Same-site relative paths only (blocks open redirects). */
export function safeRelativePath(value: unknown): string | undefined {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") && !/[\u0000-\u001f\u007f]/.test(value) && value.length <= 300 ? value : undefined;
}

export const serializeSocialContext = (context: SocialContext): string =>
  JSON.stringify({ i: context.intent, l: context.locale, n: context.next, r: context.role });

/**
 * Reads the cookie back. Anything unreadable or unexpected falls back to the SAFE default: a plain sign-in (no account
 * is created), the default language and the least-privileged public role.
 */
export function parseSocialContext(raw: string | undefined | null, locales: readonly string[], defaultLocale: string): SocialContext {
  const fallback: SocialContext = { intent: "login", locale: defaultLocale, role: "USER" };
  if (!raw) return fallback;
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null || Array.isArray(data)) return fallback;
    const { i, l, n, r } = data as Record<string, unknown>;
    const next = safeRelativePath(n);
    return {
      intent: i === "register" ? "register" : "login",
      locale: typeof l === "string" && locales.includes(l) ? l : defaultLocale,
      ...(next ? { next } : {}),
      role: r === "BUSINESS_OWNER" ? "BUSINESS_OWNER" : "USER",
    };
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// The decision
// ---------------------------------------------------------------------------------------------------------------------

export type OAuthUserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  locale: string;
  status: string;
  emailVerified: Date | null;
  deletedAt: Date | null;
};

export type NewOAuthUser = {
  email: string;
  name: string;
  role: SocialRole;
  locale: string;
  emailVerified: Date | null;
  termsAcceptedAt: Date;
  provider: OAuthProviderId;
  providerAccountId: string;
};

export type OAuthStore = {
  /** The user a social identity is already attached to. */
  findLinkedUser(provider: string, providerAccountId: string): Promise<OAuthUserRow | null>;
  /** By e-mail, INCLUDING deleted accounts (their address stays reserved). */
  findUserByEmail(email: string): Promise<OAuthUserRow | null>;
  /** Creates the user and attaches the social identity in one step. */
  createUser(data: NewOAuthUser): Promise<OAuthUserRow>;
  linkAccount(userId: string, provider: OAuthProviderId, providerAccountId: string): Promise<void>;
  recordLogin(userId: string): Promise<void>;
};

export type OAuthDenial =
  | "no_account" //          plain sign-in, nothing to sign in to: go and register
  | "no_email" //            the provider shared no address
  | "exists_other_method" // an account with this address exists and the provider cannot prove the address
  | "exists_unverified" //   an account with this address exists but its owner never confirmed it
  | "unavailable" //         suspended, deleted or staff account
  | "failed"; //             anything unexpected

export type OAuthOutcome =
  | { ok: true; user: OAuthUserRow; created: boolean; linked: boolean }
  | { ok: false; reason: OAuthDenial };

export type OAuthAttempt = {
  provider: OAuthProviderId;
  providerAccountId: string;
  email?: string | null;
  /** From `providerVouchesForEmail`. */
  emailVerified: boolean;
  name?: string | null;
  context: SocialContext;
  now?: Date;
};

/** Public accounts only: staff accounts are never reached through an e-mail match (domain takeover must not mean admin takeover). */
const PUBLIC_ROLES: readonly string[] = ["USER", "BUSINESS_OWNER"];

const isActive = (user: OAuthUserRow) => user.deletedAt === null && user.status === "active";

export function normalizeEmail(value: string | null | undefined): string | null {
  const email = (value ?? "").trim().toLowerCase();
  return email.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/** Display name from the provider; falls back to the part before the @ (the registration form requires 2+ characters). */
export function displayName(name: string | null | undefined, email: string): string {
  const clean = (name ?? "").replace(/[\u0000-\u001f\u007f\s]+/g, " ").trim().slice(0, 120);
  return clean.length >= 2 ? clean : email.split("@")[0].slice(0, 120).padEnd(2, "_");
}

export async function resolveOAuthSignIn(store: OAuthStore, attempt: OAuthAttempt): Promise<OAuthOutcome> {
  const { provider, providerAccountId, context } = attempt;
  if (!providerAccountId) return { ok: false, reason: "failed" };

  // 1. A returning visitor: the provider's own account id decides, no e-mail needed.
  const linked = await store.findLinkedUser(provider, providerAccountId);
  if (linked) {
    if (!isActive(linked)) return { ok: false, reason: "unavailable" };
    await store.recordLogin(linked.id);
    return { ok: true, user: linked, created: false, linked: false };
  }

  // 2. A new social identity needs an address to be matched or registered with.
  const email = normalizeEmail(attempt.email);
  if (!email) return { ok: false, reason: "no_email" };

  const existing = await store.findUserByEmail(email);
  if (existing) {
    if (!isActive(existing)) return { ok: false, reason: "unavailable" };
    // Staff sign in with their password only; a provider that cannot prove the address is never enough either.
    if (!PUBLIC_ROLES.includes(existing.role) || !attempt.emailVerified) return { ok: false, reason: "exists_other_method" };
    if (!existing.emailVerified) return { ok: false, reason: "exists_unverified" };
    await store.linkAccount(existing.id, provider, providerAccountId);
    await store.recordLogin(existing.id);
    return { ok: true, user: existing, created: false, linked: true };
  }

  // 3. Nobody has this address: only the registration page may create an account.
  if (context.intent !== "register") return { ok: false, reason: "no_account" };
  const now = attempt.now ?? new Date();
  const user = await store.createUser({
    email,
    name: displayName(attempt.name, email),
    role: context.role,
    locale: context.locale,
    emailVerified: attempt.emailVerified ? now : null,
    termsAcceptedAt: now,
    provider,
    providerAccountId,
  });
  return { ok: true, user, created: true, linked: false };
}

// ---------------------------------------------------------------------------------------------------------------------
// Messages for a refused or failed social sign-in (the `?error=` of the sign-in and registration pages)
// ---------------------------------------------------------------------------------------------------------------------

const SOCIAL_ERROR_KEYS = {
  social_no_account: "socialNoAccount",
  social_no_email: "socialNoEmail",
  social_exists_other_method: "socialExistsOther",
  social_exists_unverified: "socialExistsUnverified",
  social_unavailable: "socialUnavailable",
  social_failed: "socialFailed",
} as const;
export type SocialErrorKey = (typeof SOCIAL_ERROR_KEYS)[keyof typeof SOCIAL_ERROR_KEYS];

/** The translation key of a social error code, or null when the code is not a social one. */
export function socialErrorKey(code: string | undefined): SocialErrorKey | null {
  return code && Object.hasOwn(SOCIAL_ERROR_KEYS, code) ? SOCIAL_ERROR_KEYS[code as keyof typeof SOCIAL_ERROR_KEYS] : null;
}

/**
 * What a page should say for `?error=`: the sign-in page's own codes ("1" wrong password, "rate") are handled by the
 * page; a social code gets its message; any other code (Auth.js reports a cancelled consent or a provider outage as
 * AccessDenied, OAuthCallbackError, …) gets the generic "sign-in did not work".
 */
export function socialErrorKeyOrGeneric(code: string | undefined): SocialErrorKey | null {
  if (!code || code === "1" || code === "rate") return null;
  return socialErrorKey(code) ?? "socialFailed";
}

/**
 * Error codes that Auth.js puts in `?error=` when the return from a provider fails, plus REGA's own `social_failed`.
 * Used only to record WHICH code a failed return carried (src/features/auth/oauth-diagnostics.ts): anything not in this
 * list (a made-up value in the address bar, the e-mail form's own codes, `CredentialsSignin`) is never recorded.
 */
const DIAGNOSABLE_AUTH_ERRORS: ReadonlySet<string> = new Set([
  "AccessDenied",
  "AccountNotLinked",
  "AdapterError",
  "AuthorizedCallbackError",
  "CallbackRouteError",
  "Configuration",
  "ErrorPageLoop",
  "EventError",
  "InvalidCallbackUrl",
  "InvalidCheck",
  "InvalidEndpoints",
  "InvalidProvider",
  "JWTSessionError",
  "MissingAdapter",
  "MissingAdapterMethods",
  "MissingAuthorize",
  "MissingSecret",
  "OAuthAccountNotLinked",
  "OAuthCallbackError",
  "OAuthProfileParseError",
  "OAuthSignInError",
  "SessionTokenError",
  "SignInError",
  "UnknownAction",
  "UnsupportedStrategy",
  "UntrustedHost",
  "Verification",
  "social_failed",
]);

/** The code itself when it is a known Auth.js (or `social_failed`) error code, otherwise null. */
export function diagnosableAuthError(code: string | null | undefined): string | null {
  return typeof code === "string" && DIAGNOSABLE_AUTH_ERRORS.has(code) ? code : null;
}
