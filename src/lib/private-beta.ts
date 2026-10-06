/**
 * Legacy private-beta switch.
 *
 * REGA is now intentionally a PUBLIC BETA: visitors can browse the platform,
 * while the existing BETA badge in the public header communicates its status.
 * Business publishing continues to use the existing admin moderation flow.
 *
 * Keep an emergency opt-in private gate available with REGA_PRIVATE_BETA=1.
 * Do not put personal/legal identity data here.
 */
export const PRIVATE_BETA = process.env.REGA_PRIVATE_BETA === "1";
