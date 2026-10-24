/**
 * One-line postal address: street lines, then postcode and city. The city is left out when a street line already
 * names it (e.g. "Zagros, Erbil, Erbil Governorate, Iraq"), so nothing is shown twice; trailing commas are dropped.
 */
export function addressLine(
  loc: { addressLine1?: string | null; addressLine2?: string | null; postalCode?: string | null },
  city: string | null | undefined,
  otherCityNames: (string | null | undefined)[] = [],
): string {
  const street = [loc.addressLine1, loc.addressLine2].map((part) => (part ?? "").replace(/[\s,]+$/, "").trim()).filter(Boolean);
  const named = [city, ...otherCityNames].some((n) => n && street.some((part) => part.toLocaleLowerCase().includes(n.toLocaleLowerCase())));
  return [...street, [loc.postalCode, named ? null : city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}
