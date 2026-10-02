/** Only a missing Business table permits setup of a fresh test database. Every other probe failure is fatal. */
export function isMissingBusinessTable(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error) || error.code !== "P2021") return false;
  if (!("meta" in error) || !error.meta || typeof error.meta !== "object" || !("table" in error.meta)) return false;
  return /^(?:public\.)?Business$/.test(String(error.meta.table));
}
