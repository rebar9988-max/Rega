/** Normalizes free text for the denormalized search columns (accent- and case-insensitive). */
export function normalizeSearch(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
