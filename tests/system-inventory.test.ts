import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

test("system inventory stays valid when local QA creates untracked root artifacts", () => {
  const directory = mkdtempSync(join(process.cwd(), ".inventory-local-"));
  try {
    writeFileSync(join(directory, "report.txt"), "Disposable local QA artifact");
    execFileSync(process.execPath, ["scripts/generate-system-inventory.mjs", "--check"], { cwd: process.cwd(), stdio: "pipe" });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
