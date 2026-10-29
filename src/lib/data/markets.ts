/**
 * The European markets REGA covers (ISO 3166-1 alpha-2). The location selector always offers them, even before they
 * have listings; other active countries (e.g. IQ) still appear as soon as they have public listings.
 */
export const MARKET_COUNTRY_CODES = ["DE", "FR", "SE", "NL", "GB", "BE", "AT", "CH", "GR", "NO", "DK", "FI", "IT"] as const;
