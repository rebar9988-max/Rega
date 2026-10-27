/** Actual workerd + D1 binding smoke, disposable local storage only. */
import { PrismaClient } from "../../.generated/d1-client/wasm";
import { createD1Client } from "../../src/lib/d1-client";
import { registerD1Provider, type D1Connection } from "../../src/lib/d1-connection";
import { d1Transaction } from "../../src/lib/d1-transaction";
function check(value: unknown, name: string) { if (!value) throw new Error(name); }
const worker = {
  async fetch(request: Request, env: { DB: D1Connection }) {
    if (request.method === "GET") return new Response("ready");
    registerD1Provider(() => env.DB);
    const db = createD1Client(PrismaClient);
    const stamp = crypto.randomUUID();
    const user = await db.user.create({ data: { email: `${stamp}@example.invalid`, name: "ÖMER", accounts: { create: { provider: "test", providerAccountId: stamp, type: "oauth" } } } });
    check((await db.user.findFirst({ where: { name: { equals: "ömer", mode: "insensitive" }, id: user.id }, include: { accounts: true } }))?.accounts.length === 1, "nested write and Unicode read");
    check(await db.user.count({ where: { id: user.id, createdAt: { gt: new Date(Date.now() - 60_000) } } }) === 1, "date filters");
    const day = new Date("2026-10-27T00:00:00Z");
    for (let i = 0; i < 2; i++) await db.aiUsageDaily.upsert({ where: { day_provider_model: { day, provider: stamp, model: "test" } }, create: { day, provider: stamp, model: "test", requests: 1 }, update: { requests: { increment: 1 } } });
    check((await db.aiUsageDaily.findUniqueOrThrow({ where: { day_provider_model: { day, provider: stamp, model: "test" } } })).requests === 2, "compound date upsert");
    let rejected = false;
    try {
      await d1Transaction(db, async tx => {
        await tx.user.update({ where: { id: user.id }, data: { name: "Must roll back" } });
        await tx.account.create({ data: { userId: "missing", type: "oauth", provider: "test", providerAccountId: crypto.randomUUID() } });
      });
    } catch { rejected = true; }
    check(rejected && (await db.user.findUniqueOrThrow({ where: { id: user.id } })).name === "ÖMER", "native D1 atomic rollback");
    await db.user.delete({ where: { id: user.id } });
    check(await db.account.count({ where: { userId: user.id } }) === 0, "foreign key cascade");
    return Response.json({ ok: true, checks: 5 });
  },
};
export default worker;
