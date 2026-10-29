import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// REGA != R&L. The guard must ALLOW only a matching project+repository and BLOCK everything else, before any
// production-changing step. These tests run the guard exactly as the workflows do, from either repository's side.
const REGA_REPO = "rebar9988-max/Rega";
const RL_REPO = "rebar9988-max/rega-cargo";

const load = () => import("../scripts/project-identity-guard.mjs");
const ROOT = fileURLToPath(new URL("..", import.meta.url));

test("1. REGA task in the REGA repository is allowed", async () => {
  const { checkProjectIdentity } = await load();
  const r = checkProjectIdentity({ project: "REGA", localProject: "REGA", repos: [REGA_REPO],
    domains: ["www.rega24.com"], workers: ["rega24"] });
  assert.equal(r.allow, true);
  assert.equal(r.code, "OK");
});

test("2. R&L task in the R&L repository is allowed", async () => {
  const { checkProjectIdentity } = await load();
  const r = checkProjectIdentity({ project: "R&L", localProject: "R&L", repos: [RL_REPO],
    domains: ["www.rlgo.net", "rlgo.net"], workers: ["rega-cargo", "rega-cargo-staging"] });
  assert.equal(r.allow, true);
});

test("3. REGA task in the R&L repository is blocked", async () => {
  const { checkProjectIdentity } = await load();
  const r = checkProjectIdentity({ project: "REGA", localProject: "R&L", repos: [RL_REPO] });
  assert.equal(r.allow, false);
  assert.equal(r.code, "PROJECT_MISMATCH");
});

test("4. R&L task in the REGA repository is blocked", async () => {
  const { checkProjectIdentity } = await load();
  const r = checkProjectIdentity({ project: "R&L", localProject: "REGA", repos: [REGA_REPO] });
  assert.equal(r.allow, false);
  assert.equal(r.code, "PROJECT_MISMATCH");
});

test("5. mixed repository / domain / worker / remote identifiers are blocked", async () => {
  const { checkProjectIdentity } = await load();
  const mixes = [
    { repos: [REGA_REPO, RL_REPO] },
    { repos: [REGA_REPO], domains: ["www.rlgo.net"] },
    { repos: [REGA_REPO], domains: ["cargo.regaplatform.com"] }, // retired R&L host is R&L's, not REGA's
    { repos: [REGA_REPO], workers: ["rega-cargo"] },
    { repos: [REGA_REPO], remotes: ["git@github.com:rebar9988-max/rega-cargo.git"] },
  ];
  for (const mix of mixes) {
    const r = checkProjectIdentity({ project: "REGA", localProject: "REGA", ...mix });
    assert.equal(r.allow, false, JSON.stringify(mix));
    assert.equal(r.code, "MIXED_IDENTIFIERS", JSON.stringify(mix));
    assert.ok(r.conflicts.length > 0);
  }
  // Same from the R&L side: REGA identifiers inside an R&L task.
  const rl = checkProjectIdentity({ project: "R&L", localProject: "R&L", repos: [RL_REPO], domains: ["www.rega24.com"] });
  assert.equal(rl.allow, false);
  assert.equal(rl.code, "MIXED_IDENTIFIERS");
});

test("6. unknown or ambiguous identity is blocked (fail closed)", async () => {
  const { checkProjectIdentity } = await load();
  const cases = [
    { project: undefined, repos: [REGA_REPO] },
    { project: "", repos: [REGA_REPO] },
    { project: "cargo-or-rega", repos: [REGA_REPO] },
    { project: "REGA", repos: [] }, // a project name alone proves nothing
    { project: "REGA", repos: ["someone-else/rega"] },
    { project: "REGA", repos: [REGA_REPO], domains: ["example.com"] },
    { project: "REGA", repos: [REGA_REPO], workers: ["some-other-worker"] },
    { project: "REGA", repos: ["not a repository"] },
  ];
  for (const c of cases) {
    const r = checkProjectIdentity({ localProject: "REGA", ...c });
    assert.equal(r.allow, false, JSON.stringify(c));
  }
});

test("a PR number or CI run id never identifies a project", async () => {
  const { checkProjectIdentity } = await load();
  // No repository evidence: the project name (and any PR/run id the caller has) proves nothing.
  const r = checkProjectIdentity({ project: "REGA", localProject: "REGA" });
  assert.equal(r.allow, false);
  assert.equal(r.code, "NO_REPOSITORY_EVIDENCE");
  // The CLI accepts --pr/--run/--commit but they add no identity; the verified repository still decides.
  const run = spawnSync(process.execPath, ["scripts/project-identity-guard.mjs", "--project", "REGA", "--pr", "10", "--run", "39757908801", "--commit", "abc1234"], {
    env: { ...process.env, GITHUB_REPOSITORY: REGA_REPO }, encoding: "utf8", timeout: 10000, cwd: ROOT,
  });
  assert.equal(run.status, 0, run.stderr);
});

test("CLI: allows the REGA checkout, blocks R&L and mixed input with the Sorani error and exit code 1", async () => {
  const { SORANI_ERROR } = await load();
  const cli = (...args: string[]) => spawnSync(process.execPath, ["scripts/project-identity-guard.mjs", ...args], {
    env: { ...process.env, GITHUB_REPOSITORY: REGA_REPO }, encoding: "utf8", timeout: 10000, cwd: ROOT,
  });
  const ok = cli("--project", "REGA", "--domain", "www.rega24.com", "--worker", "rega24");
  assert.equal(ok.status, 0, ok.stderr);

  for (const args of [
    ["--project", "R&L"],
    ["--project", "REGA", "--domain", "rlgo.net"],
    ["--project", "REGA", "--repo", RL_REPO],
    ["--project", "unknown"],
    [],
    ["--project", "REGA", "--bogus", "x"],
  ]) {
    const blocked = cli(...args);
    assert.equal(blocked.status, 1, args.join(" "));
    assert.ok(blocked.stderr.includes(SORANI_ERROR), args.join(" "));
    assert.match(blocked.stderr, /Expected project/);
    assert.match(blocked.stderr, /Operations already performed: none/);
    assert.equal(blocked.stdout, "", "a blocked run prints nothing on stdout");
  }
});

test("the guard exposes the exact owner-approved Sorani error text", async () => {
  const { SORANI_ERROR } = await load();
  assert.equal(
    SORANI_ERROR,
    "هەڵەی گرنگ: پڕۆژەکان تێکەڵ بوون! REGA و R&L دوو پڕۆژەی جیاوازن. کارەکە بە خۆکار وەستێنرا بۆ پاراستنی کۆد و داتابەیس و Production. تکایە پڕۆژەی دروست دیاری بکە.",
  );
});

test("the guard is read-only: no file writes, no network, no child processes except `git remote -v`", () => {
  const src = readFileSync(new URL("../scripts/project-identity-guard.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(src, /writeFile|appendFile|unlink|rmSync|mkdirSync|renameSync|fetch\(|https?\.request|node:net|node:http/);
  assert.equal([...src.matchAll(/execFileSync\(/g)].length, 1);
  assert.match(src, /execFileSync\("git", \["remote", "-v"\]/);
});

test("every production-changing workflow runs the guard BEFORE its first production step", () => {
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const targets: [string, RegExp][] = [
    [".github/workflows/deploy.yml", /^\s*(?:run:\s*)?npx wrangler deploy\b/m],
    [".github/workflows/db-migrate.yml", /run: npx prisma migrate deploy/],
    [".github/workflows/worker-secrets-sync.yml", /wrangler secret bulk/],
    [".github/workflows/ai-python-deploy.yml", /run: uv run pywrangler deploy/],
    [".github/workflows/media-variants-backfill.yml", /run: npx tsx scripts\/backfill-image-variants\.ts/],
  ];
  for (const [file, production] of targets) {
    const wf = read(file);
    const guard = wf.indexOf("scripts/project-identity-guard.mjs --project REGA");
    const prod = wf.search(production);
    assert.ok(guard > 0, `${file} does not run the project identity guard`);
    assert.ok(prod > guard, `${file}: the guard must run before the production step`);
    assert.ok(wf.indexOf("actions/checkout") < guard, `${file}: the guard needs the checkout first`);
  }
});

test("REGA's own files agree with the guard's REGA identity", () => {
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  assert.match(read("wrangler.jsonc"), /^\s*"name":\s*"rega24"/m);
  for (const file of ["CLAUDE.md", "PROJECT_MEMORY.md"]) {
    const text = read(file);
    assert.match(text, /PERMANENT P0/);
    assert.ok(text.includes("rebar9988-max/Rega") && text.includes("rebar9988-max/rega-cargo"), file);
    assert.ok(text.includes("https://www.rega24.com") && text.includes("https://www.rlgo.net"), file);
  }
});

test("retired web workers cannot be deployed even alongside canonical identity", async () => {
  const { checkProjectIdentity } = await load();
  for (const worker of ["rega-platform", "rega"]) {
    const result = checkProjectIdentity({ project: "REGA", repos: [REGA_REPO], workers: ["rega24", worker] });
    assert.equal(result.allow, false);
  }
});
