/**
 * Operator ("owner") details for the legal pages, contact page and about page.
 *
 * Nothing here is invented: every value comes from the environment (public, non-secret variables, see .env.example).
 * An empty field renders as a visible placeholder such as `[[LEGAL_NAME]]` so it cannot be missed, and `missingOwnerFields`
 * lists them (shown to admins and in CHANGES_REPORT.md). Pure module; reads `process.env` only when called.
 */

type Env = Record<string, string | undefined>;

const FIELDS = [
  ["operatorType", "LEGAL_OPERATOR_TYPE"],
  ["legalName", "LEGAL_NAME"],
  ["responsiblePerson", "LEGAL_RESPONSIBLE_PERSON"],
  ["streetAddress", "LEGAL_STREET_ADDRESS"],
  ["postalCodeCity", "LEGAL_POSTAL_CODE_CITY"],
  ["country", "LEGAL_COUNTRY"],
  ["publicEmail", "LEGAL_PUBLIC_EMAIL"],
  ["phone", "LEGAL_PHONE"],
  ["vatId", "LEGAL_VAT_ID"],
  ["tradeRegister", "LEGAL_TRADE_REGISTER"],
  ["aiProvider", "LEGAL_AI_PROVIDER"],
  ["hostingProvider", "LEGAL_HOSTING_PROVIDER"],
  ["analyticsTool", "LEGAL_ANALYTICS_TOOL"],
  ["emailProvider", "LEGAL_EMAIL_PROVIDER"],
] as const;

export type OwnerField = (typeof FIELDS)[number][0];

/** Values that are already public on the site (footer / contact page) or fixed by the project owner's brief. */
const DEFAULTS: Partial<Record<OwnerField, string>> = {
  country: "Germany",
  phone: "+49 178 4228269",
  publicEmail: "info@regaplatform.com",
  // Cloudflare is the documented host (README, wrangler.jsonc) and the site sets no analytics cookies of its own.
  hostingProvider: "Cloudflare, Inc. (Cloudflare Workers, R2)",
  analyticsTool: "none",
};

/** Fields that are legally optional: empty means "does not apply", not "missing". */
const OPTIONAL: ReadonlySet<OwnerField> = new Set(["vatId", "tradeRegister", "responsiblePerson", "emailProvider"]);

export const placeholderOf = (field: OwnerField): string => `[[${FIELDS.find((f) => f[0] === field)![1]}]]`;

export type Owner = Record<OwnerField, string> & { missing: OwnerField[] };


/**
 * Public legal disclosure of the AI vendors REGA can actually route to.
 * Derived from configuration names only; API keys are never returned or logged.
 * LEGAL_AI_PROVIDER still wins when an operator wants reviewed custom wording.
 */
function configuredAiProviders(env: Env): string {
  const providers = [
    ["gemini", "GEMINI_API_KEY", "Google Gemini"],
    ["grok", "XAI_API_KEY", "xAI Grok"],
    ["openai", "OPENAI_API_KEY", "OpenAI"],
    ["groq", "GROQ_API_KEY", "Groq"],
    ["deepseek", "DEEPSEEK_API_KEY", "DeepSeek"],
    ["openrouter", "OPENROUTER_API_KEY", "OpenRouter"],
    ["anthropic", "ANTHROPIC_API_KEY", "Anthropic Claude"],
  ] as const;
  const mode = (env.AI_PROVIDER?.trim().toLowerCase() || "auto");
  if (mode === "disabled") return "";
  if (mode === "auto") return providers.filter(([, key]) => Boolean(env[key]?.trim())).map(([, , label]) => label).join(", ");
  const selected = providers.find(([id, key]) => id === mode && Boolean(env[key]?.trim()));
  return selected?.[2] ?? "";
}

export function ownerDetails(env: Env = process.env): Owner {
  const out = {} as Record<OwnerField, string>;
  const missing: OwnerField[] = [];
  for (const [field, name] of FIELDS) {
    const derived =
      field === "emailProvider" && env.EMAIL_PROVIDER === "resend"
        ? "Resend (Resend, Inc.)"
        : field === "aiProvider"
          ? configuredAiProviders(env)
          : "";
    const raw = env[name]?.trim() || DEFAULTS[field] || derived;
    if (raw) out[field] = raw;
    else if (OPTIONAL.has(field)) out[field] = "";
    else {
      out[field] = placeholderOf(field);
      missing.push(field);
    }
  }
  return { ...out, missing };
}

export const OWNER_ENV_NAMES = FIELDS.map((f) => f[1]);
