"use client";

/**
 * Contact form without a mail backend: it composes the message in the visitor's own email app, addressed to the
 * official address. Nothing is sent to or stored by REGA's servers.
 */
import { useTranslations } from "next-intl";
import { CONTACT } from "@/lib/seo";

const field = "min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-brand";

export function ContactForm() {
  const t = useTranslations("contact");
  return (
    <form
      data-testid="contact-form"
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const text = (k: string) => String(f.get(k) ?? "").trim();
        const body = `${text("message")}\n\n— ${text("name")}${text("email") ? ` <${text("email")}>` : ""}`;
        const a = document.createElement("a");
        a.href = `${CONTACT.email.href}?subject=${encodeURIComponent(text("subject"))}&body=${encodeURIComponent(body)}`;
        document.body.append(a);
        a.click(); // opens the visitor's email app
        a.remove();
      }}
    >
      <label className="flex flex-col gap-1 text-sm font-semibold">{t("name")}
        <input name="name" required maxLength={120} autoComplete="name" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">{t("yourEmail")}
        <input name="email" type="email" maxLength={200} autoComplete="email" dir="ltr" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">{t("subject")}
        <input name="subject" required maxLength={200} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">{t("message")}
        <textarea name="message" required rows={5} maxLength={4000} className={`${field} py-2`} />
      </label>
      <div className="sm:col-span-2">
        <button type="submit" className="min-h-11 rounded-xl bg-brand px-6 text-sm font-bold text-brand-ink hover:bg-brand-hover">{t("send")}</button>
      </div>
    </form>
  );
}
