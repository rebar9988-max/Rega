/**
 * Legacy private-beta switch.
 *
 * REGA is a public beta: visitors can browse the platform. The Beta label
 * lives in the footer, not on the logo, so the official lockup stays clean.
 * Business publishing continues to use the existing admin moderation flow.
 *
 * Keep an emergency opt-in private gate available with REGA_PRIVATE_BETA=1.
 * Do not put personal/legal identity data here.
 */
export const PRIVATE_BETA = process.env.REGA_PRIVATE_BETA === "1";
