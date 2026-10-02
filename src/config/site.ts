/** Site-wide constants that more than one module (and the legal texts) must agree on. */

/** REGA Assistant conversations are deleted after this many days (stated in the privacy policy; enforced in lib/ai/retention.ts). */
export const AI_RETENTION_DAYS = 30;

/** Unverified accounts' tokens: validity of e-mail verification and password-reset links. */
export const VERIFY_TOKEN_TTL_HOURS = 48;
export const RESET_TOKEN_TTL_MINUTES = 60;
