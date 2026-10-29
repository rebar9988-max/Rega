"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth-helpers";
import { runAgent, runAll } from "@/lib/ops/engine";
import { EXECUTION_ID } from "@/lib/ops/core";
import { AGENT_IDS } from "@/lib/ops/types";

const executionId = z.string().regex(EXECUTION_ID);

/** Owner only (operations.manage = SUPER_ADMIN = the owner's address). Read-only inspection; the report is audited. */
export async function runAgentAction(formData: FormData): Promise<void> {
  const user = await requirePermission("operations.manage");
  const agent = z.enum(AGENT_IDS).parse(formData.get("agent"));
  const outcome = await runAgent(agent, executionId.parse(formData.get("executionId")), { id: user.id, email: user.email });
  revalidatePath("/dr/operations");
  // A refused run stores nothing, so the page is told why (quota, cool-down, lock) instead of silently showing the old report.
  redirect(`/dr/operations?agent=${agent}${outcome.blocked ? `&blocked=${outcome.blocked}` : ""}#${agent}`);
}

export async function runAllAction(formData: FormData): Promise<void> {
  const user = await requirePermission("operations.manage");
  const { ran, notStarted } = await runAll(executionId.parse(formData.get("executionId")), { id: user.id, email: user.email });
  revalidatePath("/dr/operations");
  const blocked = ran.filter((r) => r.blocked).length;
  redirect(`/dr/operations?ran=${ran.length - blocked}&blockedCount=${blocked}&notStarted=${notStarted.length}`);
}
