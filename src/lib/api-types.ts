export type ApiMeta = { page: number; perPage: number; total: number; pages: number; truncated?: boolean };

/**
 * Known Prisma request errors that are the caller's fault, as API errors (pure; unit-tested). Duck-typed on Prisma's
 * documented error codes so this file imports no Prisma runtime (it is shared by the Node and Workers builds).
 *  - P2002 unique constraint (e.g. a category key or slug that already exists) -> 409 instead of a 500;
 *  - P2025 record to update/delete does not exist (e.g. DELETE of an unknown business id) -> 404 instead of a 500.
 * Anything else returns null and stays a logged 500.
 */
export function knownDbError(error: unknown): { status: number; code: string; message: string } | null {
  if (!error || typeof error !== "object") return null;
  const { name, code } = error as { name?: unknown; code?: unknown };
  if (name !== "PrismaClientKnownRequestError") return null;
  if (code === "P2002") return { status: 409, code: "conflict", message: "A record with this value already exists." };
  if (code === "P2025") return { status: 404, code: "not_found", message: "The record was not found." };
  return null;
}
