/** Server entry of the operations engine: the guarded core + the Prisma store + the ten collectors. */
import "server-only";
import { OPS_LIMITS, newExecutionId, runGuarded, type RunOutcome } from "./core";
import { INSPECTORS } from "./agents";
import { prismaOpsStore } from "./store";
import { AGENT_IDS, type AgentId } from "./types";
import { log } from "@/lib/logger";

export async function runAgent(agent: AgentId, executionId: string, actor: { id: string; email: string }): Promise<RunOutcome> {
  const outcome = await runGuarded({ agent, executionId, actor, store: prismaOpsStore, inspect: INSPECTORS[agent] });
  log.info("ops.run", { agent, executionId, status: outcome.report.status, stored: outcome.stored, reused: outcome.reused, blocked: outcome.blocked ?? null, ms: outcome.report.duration_ms });
  return outcome;
}

/** Owner's "run all": agents one after another, never in parallel; stops starting new ones after the budget. */
export async function runAll(batchId: string, actor: { id: string; email: string }): Promise<{ ran: RunOutcome[]; notStarted: AgentId[] }> {
  const started = Date.now();
  const ran: RunOutcome[] = [];
  const notStarted: AgentId[] = [];
  for (const agent of AGENT_IDS) {
    if (Date.now() - started > OPS_LIMITS.runAllBudgetMs) { notStarted.push(agent); continue; }
    // One execution id per agent, derived from the batch: resubmitting the same batch is idempotent too.
    ran.push(await runAgent(agent, `${batchId.slice(0, 40)}-${agent.split("-")[0]}`.slice(0, 64), actor));
  }
  return { ran, notStarted };
}

export { newExecutionId };
