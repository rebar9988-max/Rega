/**
 * Security Inspector — repository part (runs in the existing CI on every push, `npm test`): no tracked file may contain
 * a live-looking credential. Only the file path and the pattern name are reported, never the matched value.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const PATTERNS: [string, RegExp][] = [
  ["private key block", /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/],
  ["AWS access key id", /\bAKIA[0-9A-Z]{16}\b/],
  ["GitHub token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{60,}\b/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["OpenAI/Anthropic key", /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{32,}\b/],
  ["Resend key", /\bre_[A-Za-z0-9]{8}_[A-Za-z0-9]{20,}\b/],
  ["Slack token", /\bxox[abpr]-[A-Za-z0-9-]{20,}\b/],
  ["Stripe secret", /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b/],
  ["database URL with password", /\b(?:postgres(?:ql)?|mysql):\/\/[^\s:@/"'`]+:[^\s@/"'`]{6,}@(?!localhost|127\.0\.0\.1|postgres[:/]|db[:/])[^\s"'`]+/],
];
/** Obvious fixtures in tests and docs ("sk-0123456789abcdef…", "user:password@", "DUMMY…") are not credentials. */
const PLACEHOLDER = /dummy|example|0123456789|abcdef|password|private-|fake|placeholder|xxxx|your[-_]|<[^>]+>/i;
const SKIP = /(^|\/)(package-lock\.json|.*\.(png|jpe?g|webp|gif|ico|woff2?|ttf|otf|pdf|zip|gz|wasm|dump))$/i;

function trackedFiles(): string[] | null {
  try {
    return execFileSync("git", ["ls-files", "-z"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\0").filter(Boolean);
  } catch {
    return null;
  }
}

test("no tracked file contains a credential (repository secret scan)", (t) => {
  const files = trackedFiles();
  if (!files) { t.skip("git is not available in this environment"); return; }
  assert.ok(files.length > 100, "the repository file list was read");
  const hits: string[] = [];
  for (const file of files) {
    if (SKIP.test(file)) continue;
    let text: string;
    try {
      if (statSync(file).size > 5 * 1024 * 1024) continue;
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const [name, re] of PATTERNS) {
      for (const m of text.matchAll(new RegExp(re.source, "g"))) if (!PLACEHOLDER.test(m[0])) { hits.push(`${file}: ${name}`); break; }
    }
  }
  assert.deepEqual(hits, [], `credential-like values found:\n${hits.join("\n")}`);
});

test("the scanner recognises the patterns it guards against", () => {
  const sample = (name: string) => PATTERNS.find(([n]) => n === name)![1];
  assert.match("AKIA" + "ABCDEFGHIJKLMNOP", sample("AWS access key id"));
  assert.match("-----BEGIN " + "PRIVATE KEY-----", sample("private key block"));
  assert.match("postgres://user:" + "s3cretpass@db.example.com/x", sample("database URL with password"));
  assert.doesNotMatch("postgres://rega:rega@localhost:5432/rega", sample("database URL with password"));
  assert.match("sk-0123456789abcdef0123456789abcdef", PLACEHOLDER, "fixtures are recognised as placeholders");
  assert.doesNotMatch("sk-" + "Zq8Lr2Vt9Nw4Hy6Ks1Mb3Pc5Df7Gj0Tu", PLACEHOLDER, "a real-looking key is not");
});
