/** Read-only unless --apply is supplied. Never infers staff verification from a map/location badge. */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  approvalData,
  lockBusiness,
  publicationSelect,
} from "../src/lib/business-publication";
import { reindexBusinessTree } from "../src/lib/search-index";
async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL must be configured.");
    process.exitCode = 1;
    return;
  }
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  const apply = process.argv.includes("--apply");
  try {
    const candidates = await db.business.findMany({
      where: { verified: true, status: { not: "published" } },
      select: { id: true },
      take: 500,
    });
    const report = [];
    for (const { id } of candidates) {
      report.push(
        await db.$transaction(async (tx) => {
          await lockBusiness(tx, id);
          const before = await tx.business.findUniqueOrThrow({
            where: { id },
            select: publicationSelect,
          });
          const verification = await tx.auditLog.findFirst({
            where: {
              entity: "Business",
              entityId: id,
              action: "business.verify",
              actorId: { not: null },
            },
            orderBy: { createdAt: "desc" },
          });
          const restriction = verification
            ? await tx.auditLog.findFirst({
                where: {
                  entity: "Business",
                  entityId: id,
                  createdAt: { gte: verification.createdAt },
                  // Any subsequent edit requires fresh staff review; never infer that a later
                  // business.update was harmless or undo a status transition hidden in it.
                  id: { not: verification.id },
                },
                select: { id: true },
              })
            : null;
          const data =
            before.verified &&
            before.status !== "published" &&
            verification &&
            !restriction
              ? approvalData(before)
              : null;
          if (!data)
            return {
              id,
              name: before.name,
              result: "skipped: needs staff review or is explicitly restricted",
            };
          if (!apply)
            return { id, name: before.name, result: "eligible (read-only)" };
          await tx.business.update({ where: { id }, data });
          await reindexBusinessTree(tx, id);
          await tx.auditLog.create({
            data: {
              actorId: verification!.actorId,
              action: "business.publication_repair",
              entity: "Business",
              entityId: id,
              before: {
                status: before.status,
                verified: before.verified,
                categoryId: before.categoryId,
              },
              after: {
                status: data.status,
                verified: true,
                sourceVerification: verification!.id,
              },
            },
          });
          return { id, name: before.name, result: "repaired" };
        }),
      );
    }
    console.log(
      JSON.stringify({ apply, candidates: candidates.length, report }, null, 2),
    );
  } finally {
    await db.$disconnect();
  }
}
void main().catch(() => {
  console.error(
    "Publication repair failed; check database connectivity and schema.",
  );
  process.exitCode = 1;
});
