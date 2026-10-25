// Public, read-only production baseline. This never proves that an unmerged feature is deployed.
import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const out = "browser-check/lighthouse";
mkdirSync(out, { recursive: true });
const reports = [];
for (const locale of ["en", "ckb"]) {
  for (const device of ["mobile", "desktop"]) {
    const url = `https://www.rega24.com/${locale}/business/karwans-hairtuning`;
    const path = join(out, `${locale}-${device}.json`);
    const args = ["--yes", "lighthouse@13.5.0", url, "--quiet", "--chrome-flags=--headless --no-sandbox", "--output=json", `--output-path=${path}`];
    if (device === "desktop") args.push("--preset=desktop");
    const run = spawnSync("npx", args, { stdio: "inherit", env: { ...process.env, CHROME_PATH: chromium.executablePath() }, timeout: 180_000 });
    if (run.error || run.status !== 0) throw new Error(`Lighthouse failed for ${locale}/${device}; inspect this job's diagnostics.`);
    const report = JSON.parse(readFileSync(path, "utf8"));
    const finalUrl = new URL(report.finalDisplayedUrl || report.finalUrl);
    if (report.runtimeError || finalUrl.origin !== "https://www.rega24.com" || finalUrl.pathname !== new URL(url).pathname)
      throw new Error(`Lighthouse did not audit the intended public profile: ${locale}/${device}`);
    const scores = Object.fromEntries(["performance", "accessibility", "best-practices", "seo"].map((key) => {
      const score = report.categories[key]?.score;
      if (typeof score !== "number") throw new Error(`Missing ${key} score: ${locale}/${device}`);
      return [key, Math.round(score * 100)];
    }));
    const result = { url, locale, device, lighthouseVersion: report.lighthouseVersion, fetchTime: report.fetchTime, scores };
    reports.push(result);
    console.log(`Production baseline (current deployment): ${JSON.stringify(result)}`);
  }
}
writeFileSync(join(out, "summary.json"), `${JSON.stringify(reports, null, 2)}\n`);
