"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BUSINESS_SOCIAL_PLATFORMS, BUSINESS_SOCIAL_FIELDS, BUSINESS_SOCIAL_MAX_LENGTH, normalizeBusinessSocialUrl } from "@/lib/business-social";
import { BusinessSocialIcon, BUSINESS_SOCIAL_LABELS } from "@/components/business/BusinessSocialIcon";

type Values = Partial<Record<(typeof BUSINESS_SOCIAL_FIELDS)[keyof typeof BUSINESS_SOCIAL_FIELDS], string | null>>;

export function BusinessSocialFields({ initial, errors }: { initial: Values; errors: string[] }) {
  const t = useTranslations("businessSocial");
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  return (
    <fieldset className="min-w-0 space-y-4 border-t border-line pt-5" data-testid="business-social-fields">
      <legend className="px-1 text-base font-bold">{t("title")}</legend>
      <p id="business-social-hint" className="max-w-2xl text-sm leading-relaxed text-muted">{t("helper")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {BUSINESS_SOCIAL_PLATFORMS.map((platform) => {
          const field = BUSINESS_SOCIAL_FIELDS[platform];
          const value = values[field] ?? "";
          const result = normalizeBusinessSocialUrl(platform, value);
          const invalid = !result.ok && (touched[field] || errors.includes(field));
          const valid = result.ok && Boolean(result.value) && touched[field];
          return <div key={platform} className="min-w-0 space-y-1.5">
            <label htmlFor={field} className="flex items-center gap-2 text-sm font-semibold"><BusinessSocialIcon platform={platform} /><bdi>{BUSINESS_SOCIAL_LABELS[platform]}</bdi><span className="ms-auto text-xs font-normal text-muted">{t("optional")}</span></label>
            <input id={field} name={field} type="url" inputMode="url" dir="ltr" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={BUSINESS_SOCIAL_MAX_LENGTH}
              value={value} placeholder="https://" aria-invalid={invalid || undefined} aria-describedby={`business-social-hint ${field}-feedback`}
              onBlur={() => setTouched((s) => ({ ...s, [field]: true }))}
              onChange={(e) => setValues((s) => ({ ...s, [field]: e.target.value }))}
              className="min-h-12 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-base outline-none focus:border-brand focus-visible:ring-2 focus-visible:ring-brand/20 aria-[invalid=true]:border-brand" />
            <p id={`${field}-feedback`} aria-live="polite" className={`min-h-4 text-xs ${invalid ? "font-semibold text-brand" : "text-muted"}`}>{invalid ? t("invalid", { platform: BUSINESS_SOCIAL_LABELS[platform] }) : valid ? t("valid") : ""}</p>
          </div>;
        })}
      </div>
    </fieldset>
  );
}
