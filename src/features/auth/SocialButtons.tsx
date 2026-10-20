import { getTranslations } from "next-intl/server";
import { siApple, siFacebook } from "simple-icons";
import { Link } from "@/i18n/routing";
import type { OAuthProviderId } from "./oauth-core";
import { startSocialSignIn } from "./social-actions";
import { SocialSubmit } from "./SocialSubmit";

const LABEL = { google: "continueWithGoogle", facebook: "continueWithFacebook", apple: "continueWithApple" } as const;

/** Brand marks: Google's four-colour "G", Facebook's blue circle and Apple's apple (the last two from simple-icons, CC0). */
function ProviderIcon({ provider }: { provider: OAuthProviderId }) {
  if (provider === "google") {
    return (
      <svg viewBox="0 0 48 48" className="size-6 shrink-0" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </svg>
    );
  }
  const icon = provider === "facebook" ? siFacebook : siApple;
  return (
    <svg viewBox="0 0 24 24" className="size-6 shrink-0" fill={provider === "facebook" ? `#${icon.hex}` : "currentColor"} aria-hidden="true">
      <path d={icon.path} />
    </svg>
  );
}

/**
 * The social buttons of the sign-in and registration pages. Only the providers that are configured are passed in. The
 * buttons must sit inside a <form> that carries the hidden fields `intent`, `locale` and (optionally) `next`; on the
 * registration page the form also holds the account-type choice, which is read by the same action.
 */
export async function SocialButtons({ providers, intent }: { providers: OAuthProviderId[]; intent: "login" | "register" }) {
  const t = await getTranslations("auth");
  if (providers.length === 0) return null;
  return (
    <div className="space-y-3" data-testid="social-buttons">
      {providers.map((provider) => (
        <SocialSubmit key={provider} action={startSocialSignIn.bind(null, provider)}>
          <ProviderIcon provider={provider} />
          <span>{t(LABEL[provider])}</span>
        </SocialSubmit>
      ))}
      {intent === "register" && (
        <p className="text-center text-xs leading-6 text-muted">
          {t.rich("socialTerms", {
            terms: (c) => <Link href="/terms" target="_blank" className="font-semibold text-brand underline">{c}</Link>,
            privacy: (c) => <Link href="/privacy" target="_blank" className="font-semibold text-brand underline">{c}</Link>,
          })}
        </p>
      )}
    </div>
  );
}
