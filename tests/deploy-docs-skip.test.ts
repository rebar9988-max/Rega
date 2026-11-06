/**
 * The deploy workflow may skip replacing the Worker only when EVERY change since the release live on Cloudflare is
 * documentation. Regression (2026-11-05): the old HEAD^ comparison skipped a docs commit that followed #127's code,
 * so #127 never reached production. These cases run the real step script from deploy.yml with a fake `curl`.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, chmodSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
const block = workflow.split("- name: Detect documentation-only commit")[1].split("\n      - name:")[0];
const script = block.split("run: |\n")[1].split("\n").map((l) => l.replace(/^ {10}/, "")).join("\n");

function repo() {
  const dir = mkdtempSync(join(tmpdir(), "deploy-skip-"));
  const git = (...a: string[]) => execFileSync("git", a, { cwd: dir, encoding: "utf8" }).trim();
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@example.com"); git("config", "user.name", "t");
  const commit = (file: string, msg: string) => { mkdirSync(join(dir, file, ".."), { recursive: true }); writeFileSync(join(dir, file), msg); git("add", "."); git("commit", "-qm", msg); return git("rev-parse", "HEAD"); };
  // "origin" is the repository itself, so `git fetch origin <sha>` works offline.
  git("remote", "add", "origin", dir);
  return { dir, commit };
}

function run(dir: string, opts: { token?: string; liveTag?: string | null; apiDown?: boolean }) {
  const bin = mkdtempSync(join(tmpdir(), "fake-bin-"));
  const deployments = JSON.stringify({ result: { deployments: [{ versions: [{ version_id: "v-old", percentage: 0 }, { version_id: "v-live", percentage: 100 }] }] } });
  const version = JSON.stringify({ result: { annotations: opts.liveTag ? { "workers/tag": opts.liveTag } : {} } });
  writeFileSync(join(bin, "curl"), opts.apiDown ? "#!/bin/sh\nexit 22\n" : `#!/bin/sh\ncase "$*" in *versions/v-live*) echo '${version}';; *deployments*) echo '${deployments}';; *) exit 22;; esac\n`);
  chmodSync(join(bin, "curl"), 0o755);
  const out = join(bin, "out");
  writeFileSync(out, "");
  const log = execFileSync("bash", ["-c", script], {
    cwd: dir, encoding: "utf8",
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, GITHUB_OUTPUT: out, CLOUDFLARE_ACCOUNT_ID: "acc", CLOUDFLARE_API_TOKEN: opts.token ?? "" },
  });
  return { skip: /skip=true/.test(readFileSync(out, "utf8")), log };
}

test("a code commit followed by a docs commit is still deployed (the #127 regression)", () => {
  const { dir, commit } = repo();
  const live = commit("src/a.ts", "v1");
  commit("src/lib/ai/new.ts", "code: #127");
  commit("CLAUDE.md", "docs: #128");
  const r = run(dir, { token: "t", liveTag: live });
  assert.equal(r.skip, false);
  assert.match(r.log, /deploy required: src\/lib\/ai\/new\.ts/);
});

test("only documentation since the live release: Worker not replaced", () => {
  const { dir, commit } = repo();
  const live = commit("src/a.ts", "v1");
  commit("PROJECT_MEMORY.md", "memory");
  commit("docs/x.md", "doc");
  const r = run(dir, { token: "t", liveTag: live });
  assert.equal(r.skip, true);
});

test("fails open: no token, API down, untagged live version, unknown SHA, nothing changed", () => {
  const { dir, commit } = repo();
  const live = commit("src/a.ts", "v1");
  commit("README.md", "docs");
  for (const [opts, why] of [
    [{ token: "" }, /No Cloudflare token/],
    [{ token: "t", apiDown: true }, /Live version unknown/],
    [{ token: "t", liveTag: null }, /no release SHA tag/],
    [{ token: "t", liveTag: "f".repeat(40) }, /not fetchable/],
  ] as const) {
    const r = run(dir, opts);
    assert.equal(r.skip, false, String(why));
    assert.match(r.log, why);
  }
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).trim();
  assert.equal(run(dir, { token: "t", liveTag: head }).skip, false, "empty diff deploys");
  assert.ok(live);
});

test("the workflow compares with the live release, never with HEAD^", () => {
  assert.doesNotMatch(block, /HEAD\^/);
  assert.match(block, /git diff --name-only "\$live" HEAD/);
  assert.match(workflow, /npx wrangler deploy --tag "\$RELEASE_SHA"/, "deploys keep tagging the exact SHA the skip reads back");
});
