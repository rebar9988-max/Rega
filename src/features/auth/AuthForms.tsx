"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Honeypot } from "@/features/forms/Honeypot";
import { IDLE } from "@/features/forms/state";
import { confirmEmail, forgotPassword, register, resendVerification, resetPassword, type AuthFormState } from "./actions";

const field = "min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-base outline-none focus:border-brand aria-[invalid=true]:border-brand";
const card = "mx-auto max-w-md space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-card";
const primary = "min-h-11 w-full rounded-xl bg-brand text-sm font-semibold text-brand-ink hover:bg-brand-hover disabled:opacity-60";
const link = "font-semibold text-brand underline";

function Notice({ title, body, children }: { title?: string; body: string; children?: React.ReactNode }) {
  return (
    <div role="status" className={`${card} text-center`}>
      {title && <p className="text-lg font-bold">{title}</p>}
      <p className="text-sm">{body}</p>
      {children}
    </div>
  );
}

function ErrorLine({ state, map }: { state: AuthFormState; map: Partial<Record<"invalid" | "rate" | "failed", string>> }) {
  const tf = useTranslations("forms");
  if (state.status !== "error") return null;
  const text = state.error === "rate" ? tf("rateLimited") : (state.error && map[state.error]) || tf("failed");
  return <p role="alert" className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold">{text}</p>;
}

export function RegisterForm() {
  const t = useTranslations("auth");
  const tf = useTranslations("forms");
  const locale = useLocale();
  const [state, action, pending] = useActionState<AuthFormState, FormData>(register, IDLE);
  if (state.status === "ok") {
    return <Notice title={t("registerDoneTitle")} body={state.detail === "unavailable" ? t("registerDoneUnavailable") : t("registerDoneBody")}>
      {state.detail === "unavailable" && <Link href="/login" className={link}>{t("signIn")}</Link>}
    </Notice>;
  }
  const bad = (n: string) => state.fields?.includes(n) || undefined;
  const taken = state.error === "failed" && state.fields?.includes("email");
  return (
    <form action={action} data-testid="register-form" className={`${card} relative`}>
      <input type="hidden" name="locale" value={locale} />
      <Honeypot label={tf("leaveEmpty")} />
      <ErrorLine state={state} map={{ invalid: state.fields?.includes("password") ? t("weakPassword") : state.fields?.includes("password2") ? t("passwordMismatch") : tf("invalid"), failed: taken ? t("emailTaken") : undefined }} />
      {/* Registration is for business owners only (the page says so); the server also fixes the account type. */}
      <input type="hidden" name="accountType" value="owner" />
      <div>
        <label htmlFor="r-name" className="mb-1 block text-sm font-semibold">{t("name")}</label>
        <input id="r-name" name="name" required minLength={2} maxLength={120} autoComplete="name" aria-invalid={bad("name")} className={field} />
      </div>
      <div>
        <label htmlFor="r-email" className="mb-1 block text-sm font-semibold">{t("email")}</label>
        <input id="r-email" name="email" type="email" required maxLength={200} autoComplete="email" dir="ltr" aria-invalid={bad("email")} className={`${field} text-start`} />
      </div>
      <div>
        <label htmlFor="r-pass" className="mb-1 block text-sm font-semibold">{t("password")}</label>
        <input id="r-pass" name="password" type="password" required minLength={10} maxLength={200} autoComplete="new-password" dir="ltr" aria-invalid={bad("password")} aria-describedby="r-pass-hint" className={`${field} text-start`} />
        <p id="r-pass-hint" className="mt-1 text-xs text-muted">{t("passwordHint")}</p>
      </div>
      <div>
        <label htmlFor="r-pass2" className="mb-1 block text-sm font-semibold">{t("confirmPassword")}</label>
        <input id="r-pass2" name="password2" type="password" required minLength={10} maxLength={200} autoComplete="new-password" dir="ltr" aria-invalid={bad("password2")} className={`${field} text-start`} />
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input name="accept" type="checkbox" required className="mt-1 size-5 shrink-0 accent-[var(--brand)]" />
        <span>{t.rich("accept", { terms: (c) => <Link href="/terms" target="_blank" className={link}>{c}</Link>, privacy: (c) => <Link href="/privacy" target="_blank" className={link}>{c}</Link> })}</span>
      </label>
      <button type="submit" disabled={pending} className={primary}>{t("createAccount")}</button>
      <p className="text-center text-sm text-muted">{t("haveAccount")} <Link href="/login" className={link}>{t("signIn")}</Link></p>
    </form>
  );
}

export function ConfirmEmailForm({ email, token }: { email: string; token: string }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, action, pending] = useActionState<AuthFormState, FormData>(confirmEmail, IDLE);
  if (state.status === "ok") return <Notice body={t("verifyOk")}><Link href="/login?verified=1" className={link}>{t("signIn")}</Link></Notice>;
  return (
    <form action={action} className={card}>
      <input type="hidden" name="email" value={email} /><input type="hidden" name="token" value={token} /><input type="hidden" name="locale" value={locale} />
      <ErrorLine state={state} map={{ invalid: t("linkInvalid") }} />
      <p className="text-sm">{email}</p>
      <button type="submit" disabled={pending} className={primary}>{t("verifyButton")}</button>
    </form>
  );
}

export function ForgotForm() {
  const t = useTranslations("auth");
  const tf = useTranslations("forms");
  const locale = useLocale();
  const [state, action, pending] = useActionState<AuthFormState, FormData>(forgotPassword, IDLE);
  if (state.status === "ok") return <Notice body={state.detail === "unavailable" ? t("forgotUnavailable") : t("forgotSent")} />;
  return (
    <form action={action} data-testid="forgot-form" className={`${card} relative`}>
      <input type="hidden" name="locale" value={locale} />
      <Honeypot label={tf("leaveEmpty")} />
      <ErrorLine state={state} map={{ invalid: tf("invalid") }} />
      <p className="text-sm text-muted">{t("forgotLead")}</p>
      <div>
        <label htmlFor="f-email" className="mb-1 block text-sm font-semibold">{t("email")}</label>
        <input id="f-email" name="email" type="email" required maxLength={200} autoComplete="email" dir="ltr" className={`${field} text-start`} />
      </div>
      <button type="submit" disabled={pending} className={primary}>{t("sendLink")}</button>
      <p className="text-center text-sm"><Link href="/login" className={link}>{t("signIn")}</Link></p>
    </form>
  );
}

export function ResetForm({ email, token }: { email: string; token: string }) {
  const t = useTranslations("auth");
  const tf = useTranslations("forms");
  const locale = useLocale();
  const [state, action, pending] = useActionState<AuthFormState, FormData>(resetPassword, IDLE);
  if (state.status === "ok") return <Notice body={t("bannerReset")}><Link href="/login?reset=1" className={link}>{t("signIn")}</Link></Notice>;
  return (
    <form action={action} data-testid="reset-form" className={`${card} relative`}>
      <input type="hidden" name="email" value={email} /><input type="hidden" name="token" value={token} /><input type="hidden" name="locale" value={locale} />
      <Honeypot label={tf("leaveEmpty")} />
      <ErrorLine state={state} map={{ invalid: state.fields?.includes("password2") ? t("passwordMismatch") : t("weakPassword"), failed: t("linkInvalid") }} />
      <div>
        <label htmlFor="n-pass" className="mb-1 block text-sm font-semibold">{t("newPassword")}</label>
        <input id="n-pass" name="password" type="password" required minLength={10} maxLength={200} autoComplete="new-password" dir="ltr" aria-describedby="n-pass-hint" className={`${field} text-start`} />
        <p id="n-pass-hint" className="mt-1 text-xs text-muted">{t("passwordHint")}</p>
      </div>
      <div>
        <label htmlFor="n-pass2" className="mb-1 block text-sm font-semibold">{t("confirmPassword")}</label>
        <input id="n-pass2" name="password2" type="password" required minLength={10} maxLength={200} autoComplete="new-password" dir="ltr" className={`${field} text-start`} />
      </div>
      <button type="submit" disabled={pending} className={primary}>{t("resetButton")}</button>
    </form>
  );
}

/** Small "email not confirmed" notice with a resend button (account page, dashboard). */
export function ResendVerification({ unavailable = false }: { unavailable?: boolean }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, action, pending] = useActionState<AuthFormState, FormData>(resendVerification, IDLE);
  if (unavailable) return <p role="status" className="text-sm"><span className="font-semibold">{t("unverified")}.</span> {t("verifyUnavailable")}</p>;
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="locale" value={locale} />
      <span className="text-sm font-semibold">{t("unverified")}</span>
      {state.status === "ok" ? <span role="status" className="text-sm text-muted">{t("resent")}</span>
        : <button type="submit" disabled={pending} className="min-h-9 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-surface-2">{t("resend")}</button>}
    </form>
  );
}
