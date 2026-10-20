/**
 * Public business WhatsApp numbers: normalised to international format and turned into safe https://wa.me links.
 * Pure (no I/O), so the form, the server action, the profile page and the tests all use the same rules.
 *
 * A number is stored (and linked) only after `normalizeWhatsapp` accepted it, and the link is built from the digits
 * alone: nothing a person typed (text, URLs, query strings, markup) can ever reach the generated URL. No WhatsApp
 * Business API and no paid messaging service is involved: wa.me simply opens the visitor's own WhatsApp.
 */

/** International dialling code per country offered in the registration form (ISO 3166-1 alpha-2). */
export const CALLING_CODES: Readonly<Record<string, string>> = {
  DE: "49", AT: "43", CH: "41", NL: "31", BE: "32", LU: "352", FR: "33", GB: "44", IE: "353", DK: "45", SE: "46",
  NO: "47", FI: "358", IT: "39", ES: "34", PL: "48", CZ: "420", IQ: "964", TR: "90", IR: "98", SY: "963", US: "1",
  CA: "1", AU: "61",
};

/**
 * Countries where a national number is written with a trunk "0" that is dropped in international format
 * (0178 … -> +49 178 …). Deliberately a short allow-list: for any other country (Italy keeps its 0, the US has none)
 * the person must type the number with its country code, which is never ambiguous.
 */
const TRUNK_ZERO = new Set(["DE", "AT", "CH", "NL", "BE", "FR", "GB", "IE", "SE", "FI", "IQ", "TR", "IR", "SY", "AU"]);

export type WhatsappResult = { ok: true; value: string } | { ok: false; reason: "empty" | "invalid" };

/** The shape of every stored number: "+" and 8 to 15 digits (ITU-T E.164), the first one not 0. */
const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * Normalises what a person typed to "+<country code><number>".
 * Accepts digits with the usual separators (space, dot, dash, slash, brackets; no line breaks), a leading "+" or "00", and the
 * national form with a trunk 0 when `countryCode` (the business's country) is known. Everything else is rejected,
 * never "cleaned up": letters, "://", "<", "?" or "@" mean the field does not contain a phone number.
 */
export function normalizeWhatsapp(input: string | null | undefined, countryCode?: string | null): WhatsappResult {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: false, reason: "empty" };
  if (raw.length > 50 || !/^\+?[\d \u00a0().\-/]+$/.test(raw)) return { ok: false, reason: "invalid" };

  const international = raw.startsWith("+") || raw.startsWith("00");
  // "+49 (0) 178 …": the bracketed trunk zero is not part of the international number.
  const withoutTrunkNote = international ? raw.replace(/\(\s*0\s*\)/, "") : raw;
  let digits = withoutTrunkNote.replace(/\D/g, "");

  if (international) {
    if (raw.startsWith("00")) digits = digits.slice(2);
  } else {
    const country = (countryCode ?? "").toUpperCase();
    const calling = CALLING_CODES[country];
    // National form: a single leading 0 for a country that uses one. "00…" without "+" was handled above.
    if (!calling || !TRUNK_ZERO.has(country) || !digits.startsWith("0")) return { ok: false, reason: "invalid" };
    digits = calling + digits.slice(1);
  }

  const value = `+${digits}`;
  return E164.test(value) ? { ok: true, value } : { ok: false, reason: "invalid" };
}

/** True for a value that is already a stored, normalised number. */
export function isStoredWhatsapp(value: string | null | undefined): value is string {
  return typeof value === "string" && E164.test(value);
}

/**
 * The wa.me link for a stored number, or null when there is no valid number (then no button is shown at all).
 * Built from digits only, always https, with no query string.
 */
export function whatsappLink(value: string | null | undefined): string | null {
  return isStoredWhatsapp(value) ? `https://wa.me/${value.slice(1)}` : null;
}
