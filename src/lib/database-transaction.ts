import { prisma } from "./db";
import { usesD1 } from "./d1-connection";
import { d1Transaction } from "./d1-transaction";
import type { Prisma } from "@prisma/client";

/** Same domain rules, with an actual atomic commit on either database provider. */
export function databaseTransaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return usesD1() ? d1Transaction(prisma, callback) : prisma.$transaction(callback);
}
