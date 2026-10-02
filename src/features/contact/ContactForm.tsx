"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Honeypot } from "@/features/forms/Honeypot";
import { IDLE, type FormState } from "@/features/forms/state";
import { sendContact } from "./actions";

const field = "min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-brand";

export function ContactForm() {
  const t = useTranslations("contact");
  const tf = useTranslations("forms");
  const tn = useTranslations("nav");
  const locale = useLocale();
  const [state, action, pending] = useActionState<FormState, FormData>(sendContact, IDLE);

  if (state.status === "ok") {
    return (
      <div role="status" data-testid="contact-sent" className="rounded-xl bg-brand-soft px-4 py-5">
        <p className="font-bold">{t("sentTitle")}</p>
        <p className="mt-1 text-sm">{t("sentBody")}</p>
      </div>
    );
  }
  const bad = (name: string) => state.fields?.includes(name) || undefined;
  return (
    <form action={action} data-testid="contact-form" className="relative grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="locale" value={locale} />
      <Honeypot label={tf("leaveEmpty")} />
      {state.status === "error" && (
        <p role="alert" className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold sm:col-span-2">
          {state.error === "rate" ? tf("rateLimited") : state.error === "invalid" ? tf("invalid") : tf("failed")}
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm font-semibold">{t("name")}
        <input name="name" required minLength={2} maxLength={120} autoComplete="name" aria-invalid={bad("name")} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">{t("yourEmail")}
        <input name="email" type="email" maxLength={200} autoComplete="email" dir="ltr" aria-invalid={bad("email")} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">{t("subject")}
        <input name="subject" required minLength={2} maxLength={200} aria-invalid={bad("subject")} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">{t("message")}
        <textarea name="message" required minLength={10} rows={5} maxLength={4000} aria-invalid={bad("message")} className={`${field} py-2`} />
      </label>
      <p className="text-xs text-muted sm:col-span-2">
        {tf("privacyNote")} <Link href="/privacy" className="font-semibold text-brand underline">{tn("privacy")}</Link>
      </p>
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className="min-h-11 rounded-xl bg-brand px-6 text-sm font-bold text-brand-ink hover:bg-brand-hover disabled:opacity-60">{t("send")}</button>
      </div>
    </form>
  );
}
