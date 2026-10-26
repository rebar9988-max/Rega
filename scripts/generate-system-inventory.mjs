#!/usr/bin/env node
/**
 * Regenerates docs/generated/system-inventory.json from the repository.
 * Names and paths only. Never reads .env, never prints secret values.
 * Usage: node scripts/generate-system-inventory.mjs [--check]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "docs/generated/system-inventory.json");
// Build outputs and local QA artifacts must not make the clean-checkout CI inventory stale.
const trackedPaths = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
  .split("\0").filter(Boolean);

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function walk(dir, acc = []) {
  for (const name of readdirSync(join(root, dir))) {
    if (name === "node_modules" || name === ".git") continue;
    const rel = join(dir, name);
    const st = statSync(join(root, rel));
    if (st.isDirectory()) walk(rel, acc);
    else acc.push(rel.split("\\").join("/"));
  }
  return acc;
}

function uniq(values) {
  return [...new Set(values)].sort();
}

const pkg = JSON.parse(read("package.json"));
const envTs = read("src/lib/env.ts");
const envExample = read(".env.example");
const schema = read("prisma/schema.prisma");
const sections = read("src/config/sections.ts");
const locales = read("src/config/locales.ts");
const workflowFiles = readdirSync(join(root, ".github/workflows")).filter((n) => n.endsWith(".yml")).sort();
const workflowText = workflowFiles.map((n) => read(`.github/workflows/${n}`)).join("\n");

const envSchemaKeys = uniq([...envTs.matchAll(/^\s{2}([A-Z][A-Z0-9_]*):/gm)].map((m) => m[1]));
const envExampleKeys = uniq([...envExample.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]));
const prismaModels = uniq([...schema.matchAll(/^model (\w+)/gm)].map((m) => m[1]));
const prismaEnums = uniq([...schema.matchAll(/^enum (\w+)/gm)].map((m) => m[1]));
const migrations = readdirSync(join(root, "prisma/migrations"))
  .filter((n) => n !== "migration_lock.toml")
  .sort();

const sectionBlocks = [...sections.matchAll(/\{\s*key:\s*"([^"]+)",\s*path:\s*"([^"]*)",[\s\S]*?enabled:\s*(true|false)/g)];
const sectionInventory = sectionBlocks
  .map((m) => ({ key: m[1], path: m[2], enabledInSource: m[3] === "true" }))
  .sort((a, b) => a.key.localeCompare(b.key));

const localeCodes = uniq([...locales.matchAll(/code:\s*"([a-z]{2,3})"/g)].map((m) => m[1]));
const apiRoutes = walk("src/app/api").filter((p) => p.endsWith("/route.ts")).sort();
const githubSecretNames = uniq([...workflowText.matchAll(/secrets\.([A-Z][A-Z0-9_]*)/g)].map((m) => m[1]));
const githubVariableNames = uniq([...workflowText.matchAll(/vars\.([A-Z][A-Z0-9_]*)/g)].map((m) => m[1]));

function stripLineComments(text) {
  return text
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("//");
      if (idx === -1) return line;
      const quotes = (line.slice(0, idx).match(/"/g) || []).length;
      return quotes % 2 === 1 ? line : line.slice(0, idx);
    })
    .join("\n");
}

function wranglerFacts(path) {
  const text = stripLineComments(read(path));
  const name = text.match(/"name":\s*"([^"]+)"/)?.[1] ?? null;
  const main = text.match(/"main":\s*"([^"]+)"/)?.[1] ?? null;
  const bindings = uniq([
    ...[...text.matchAll(/"binding":\s*"([^"]+)"/g)].map((m) => m[1]),
    ...[...text.matchAll(/"name":\s*"(LOGIN_LIMITER|AI_LIMITER|SEARCH_LIMITER|FORM_LIMITER)"/g)].map((m) => m[1]),
  ]);
  return { file: path, name, main, bindings };
}

const inventory = {
  generatedAt: new Date().toISOString(),
  package: {
    name: pkg.name,
    version: pkg.version,
    next: pkg.dependencies?.next ?? null,
    react: pkg.dependencies?.react ?? null,
    prisma: pkg.dependencies?.["@prisma/client"] ?? null,
    openNext: pkg.dependencies?.["@opennextjs/cloudflare"] ?? null,
    nextAuth: pkg.dependencies?.["next-auth"] ?? null,
    nodeEngine: pkg.engines?.node ?? null,
  },
  workers: [wranglerFacts("wrangler.jsonc"), wranglerFacts("services/ai-python/wrangler.jsonc")],
  workflows: workflowFiles,
  prismaModels,
  prismaEnums,
  prismaMigrations: migrations,
  locales: localeCodes,
  sections: sectionInventory,
  apiRoutes,
  topLevel: uniq(trackedPaths.map((path) => path.split("/")[0])),
  envSchemaKeys,
  envExampleKeys,
  envExampleOnly: envExampleKeys.filter((k) => !envSchemaKeys.includes(k)),
  schemaOnly: envSchemaKeys.filter((k) => !envExampleKeys.includes(k)),
  githubSecretNames,
  githubVariableNames,
  schemaKeysNotNamedInWorkflows: envSchemaKeys.filter(
    (k) =>
      !githubSecretNames.includes(k) &&
      !githubVariableNames.includes(k) &&
      k !== "NODE_ENV" &&
      k !== "APP_ENV",
  ),
};

const serialized = `${JSON.stringify(inventory, null, 2)}\n`;
if (process.argv.includes("--check")) {
  const current = readFileSync(outPath, "utf8");
  const strip = (raw) => {
    const data = JSON.parse(raw);
    delete data.generatedAt;
    return JSON.stringify(data);
  };
  if (strip(current) !== strip(serialized)) {
    console.error("system-inventory.json is stale. Run: node scripts/generate-system-inventory.mjs");
    process.exit(1);
  }
  console.log("system-inventory.json matches the repository.");
} else {
  writeFileSync(outPath, serialized);
  console.log(`wrote ${relative(root, outPath)}`);
}
