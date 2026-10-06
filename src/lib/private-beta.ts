/**
 * Temporary private-beta gate.
 * Keep this enabled until the owner explicitly approves the final public launch.
 * Do not put personal/legal identity data here.
 *
 * Automated E2E may opt out explicitly with REGA_PRIVATE_BETA=0.
 * Production defaults to private even when the variable is missing.
 */
export const PRIVATE_BETA = process.env.REGA_PRIVATE_BETA !== "0";
