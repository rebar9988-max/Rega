"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { DEFAULT_LOCALE, isLocale } from "@/config/locales";
import { allowShared } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";
import {
  SOCIAL_CONTEXT_COOKIE,
  SOCIAL_CONTEXT_MAX_AGE_S,
  enabledOAuthProviders,
  isOAuthProvider,
  safeRelativePath,
  serializeSocialContext,
  type SocialContext,
} from "./oauth-core";

/**
 * The social sign-in buttons (Google, Facebook, Apple). Everything the browser sends is validated again here: the
 * provider must be one that is really configured, the language and the redirect target are checked, and the role is
 * only ever one of the two public roles. The context is kept in a short-lived httpOnly cookie that the return from the
 * provider reads (src/features/auth/oauth.ts); without it the return falls back to a plain sign-in that creates nothing.
 */
export async function startSocialSignIn(providerId: string, formData: FormData): Promise<void> {
  const rawLocale = String(formData.get("locale") ?? "");
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const intent = formData.get("intent") === "register" ? "register" : "login";
  const back = `/${locale}/${intent === "register" ? "register" : "login"}`;
  const next = safeRelativePath(formData.get("next"));
  const withNext = (error: string) => `${back}?error=${error}${next ? `&next=${encodeURIComponent(next)}` : ""}`;

  // The provider is bound to each button on the server (startSocialSignIn.bind(null, provider)); it is re-checked here anyway.
  const provider = providerId;
  if (!isOAuthProvider(provider) || !enabledOAuthProviders(process.env).includes(provider)) redirect(withNext("social_failed"));

  const ip = clientIp(await headers());
  if (!(await allowShared("LOGIN_LIMITER", `social-ip:${ip}`, 30, 15 * 60_000))) redirect(withNext("rate"));

  const context: SocialContext = {
    intent,
    locale,
    next,
    role: formData.get("accountType") === "user" ? "USER" : "BUSINESS_OWNER",
  };
  const production = process.env.NODE_ENV === "production";
  (await cookies()).set(SOCIAL_CONTEXT_COOKIE, serializeSocialContext(context), {
    httpOnly: true,
    secure: production,
    // Apple returns by a cross-site POST, which a "lax" cookie would not travel with.
    sameSite: provider === "apple" && production ? "none" : "lax",
    path: "/",
    maxAge: SOCIAL_CONTEXT_MAX_AGE_S,
  });

  // Throws the redirect to the provider's consent screen; must not be caught here.
  await signIn(provider, { redirectTo: next ?? `/${locale}/account` });
}
