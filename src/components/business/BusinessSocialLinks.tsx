import { getTranslations } from "next-intl/server";
import { BUSINESS_SOCIAL_PLATFORMS, BUSINESS_SOCIAL_FIELDS, normalizeBusinessSocialUrl } from "@/lib/business-social";
import { BusinessSocialIcon, BUSINESS_SOCIAL_LABELS } from "./BusinessSocialIcon";

type SocialBusiness = Partial<Record<(typeof BUSINESS_SOCIAL_FIELDS)[keyof typeof BUSINESS_SOCIAL_FIELDS], string | null>>;

export async function BusinessSocialLinks({ business, name }: { business: SocialBusiness; name: string }) {
  const links = BUSINESS_SOCIAL_PLATFORMS.flatMap((platform) => {
    const result = normalizeBusinessSocialUrl(platform, business[BUSINESS_SOCIAL_FIELDS[platform]]);
    return result.ok && result.value ? [{ platform, url: result.value }] : [];
  });
  if (!links.length) return null;
  const t = await getTranslations("businessSocial");
  return <section aria-labelledby="business-social-title" data-testid="business-social-links">
    <h2 id="business-social-title" className="mb-3 text-xl font-bold">{t("title")}</h2>
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {links.map(({ platform, url }) => <li key={platform} className="min-w-0">
        <a href={url} target="_blank" rel="noopener noreferrer" aria-label={t("open", { name, platform: BUSINESS_SOCIAL_LABELS[platform] })}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-2 py-3 text-sm font-semibold hover:border-brand/40 hover:bg-surface-2 active:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          <BusinessSocialIcon platform={platform} /><bdi>{BUSINESS_SOCIAL_LABELS[platform]}</bdi>
        </a>
      </li>)}
    </ul>
  </section>;
}
