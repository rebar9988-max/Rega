/** The existing management routes remain the single form and business-list implementation. */
export const BUSINESS_HOME = "/dr/business-owner";
export const BUSINESS_LIST = "/dr/businesses";
export const BUSINESS_NEW = "/dr/businesses/new";

/** Only these existing business destinations enable the business auth presentation. */
export function isBusinessDestination(value: unknown): value is string {
  return typeof value === "string" && [BUSINESS_HOME, BUSINESS_LIST, BUSINESS_NEW].includes(value);
}
