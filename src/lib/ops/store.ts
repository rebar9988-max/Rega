/**
 * Persistence of the operations engine in EXISTING tables (no schema change, no migration):
 * - reports: one AuditLog row per execution (action "ops.report", entity "ops:<agent>", entityId = execution id,
 *   `after` = the report). Reports therefore also appear in the existing audit trail (/dr/audit).
 * - execution locks: one Setting row per running agent (key "ops.lock.<agent>"); its primary key makes acquiring atomic.
 */
import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { clientIp } from "@/lib/client-ip";
import type { OpsStore } from "./core";
import { isAgentId, type AgentId, type OpsReport } from "./types";

export const REPORT_ACTION = "ops.report";
const entityOf = (agent: AgentId) => `ops:${agent}`;
const lockKey = (agent: AgentId) => `ops.lock.${agent}`;
type LockValue = { executionId?: string };

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "P2002") || (error instanceof Error && /UNIQUE constraint failed/i.test(error.message));
}

export function parseReport(after: unknown): OpsReport | null {
  if (!after || typeof after !== "object") return null;
  const r = after as Partial<OpsReport>;
  return isAgentId(r.agent) && typeof r.execution_id === "string" && typeof r.status === "string" ? (r as OpsReport) : null;
}

export const prismaOpsStore: OpsStore = {
  async findReport(executionId) {
    const row = await prisma.auditLog.findFirst({ where: { action: REPORT_ACTION, entityId: executionId }, select: { after: true } });
    return row ? parseReport(row.after) : null;
  },
  countRunsSince(since) {
    return prisma.auditLog.count({ where: { action: REPORT_ACTION, createdAt: { gte: since } } });
  },
  async lastRunAt(agent) {
    const row = await prisma.auditLog.findFirst({ where: { action: REPORT_ACTION, entity: entityOf(agent) }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    return row?.createdAt ?? null;
  },
  async acquireLock(agent, executionId, ttlMs, now) {
    const key = lockKey(agent);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await prisma.setting.create({ data: { key, value: { executionId, startedAt: now.toISOString() }, isSecret: false } });
        return true;
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        const held = await prisma.setting.findUnique({ where: { key }, select: { updatedAt: true } });
        if (!held) continue; // released in between: try once more
        if (now.getTime() - held.updatedAt.getTime() < ttlMs) return false;
        // Take over an expired lock (a crashed run): compare-and-delete on the exact row we read.
        await prisma.setting.deleteMany({ where: { key, updatedAt: held.updatedAt } });
      }
    }
    return false;
  },
  async releaseLock(agent, executionId) {
    const key = lockKey(agent);
    const held = await prisma.setting.findUnique({ where: { key }, select: { value: true, updatedAt: true } });
    if (held && (held.value as LockValue | null)?.executionId === executionId) await prisma.setting.deleteMany({ where: { key, updatedAt: held.updatedAt } });
  },
  async saveReport(report, actor) {
    const h = await headers();
    const ip = clientIp(h);
    await prisma.auditLog.create({
      data: {
        actorId: actor.id, actorEmail: actor.email, action: REPORT_ACTION, entity: entityOf(report.agent), entityId: report.execution_id,
        after: report as never, ip: ip === "unknown" ? null : ip, userAgent: h.get("user-agent") ?? null,
      },
    });
  },
};

/** Recent stored reports (newest first), bounded. */
export async function recentReports(take = 60): Promise<{ report: OpsReport; actorEmail: string | null }[]> {
  const rows = await prisma.auditLog.findMany({ where: { action: REPORT_ACTION }, orderBy: { createdAt: "desc" }, take: Math.min(take, 200), select: { after: true, actorEmail: true } });
  return rows.flatMap((r) => { const report = parseReport(r.after); return report ? [{ report, actorEmail: r.actorEmail }] : []; });
}

/** Runs per agent (all time) without loading the reports. */
export async function runCounts(): Promise<Map<string, number>> {
  const rows = await prisma.auditLog.groupBy({ by: ["entity"], where: { action: REPORT_ACTION }, _count: { _all: true } });
  return new Map(rows.map((r) => [r.entity.replace(/^ops:/, ""), r._count._all]));
}
