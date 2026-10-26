# Rega24 repository cleanup — 2026-10-26

Scope: `rebar9988-max/Rega` only. Baseline `7011eb5482e518aa1b0e2f3974d516cbb8c3f6d2`.
PR: https://github.com/rebar9988-max/Rega/pull/76
Status: safe source cleanup prepared; release blocked, not a 100/100 production certification.

## Recovery and method

Remote checkpoint `checkpoint/rega24-before-cleanup-20261026` preserves the baseline. A local full-history Git bundle was also created before edits. All changes are isolated on `cleanup/rega24-deep-cleanup-20261026`; no history rewrite or force-push.

Inventoried all 533 tracked paths and their bytes; exact-content hashes found no identical files. Parsed imports/exports/require/dynamic imports across the code tree, checked zero-incoming modules against framework entry points, searched asset references including generated srcsets, examined repeated code blocks, package usage, 10 workflows, 17 open PRs, and 109 actual remote branches (110 refs including symbolic HEAD). Automated candidates are evidence for review, never automatic deletion authority.

## Changes

- Removed unreachable `src/components/shell/ThemeToggle.tsx`. The navigation test explicitly requires no public toggle; `ThemeScript` and persisted preferences remain.
- Removed unreachable `src/features/contact/ContactForm.tsx`. The public contact page uses contact channels. Kept the contact action, admin messages, database model and translations because backend/history compatibility is not proven disposable.
- Consolidated `DirectoryBusinessCard.tsx` into `BusinessCard.tsx` with explicit search/directory variants; updated the directory caller. Both variants retain existing image priority/fitting, focus styles, country text and no-review behaviour.
- Reused the tracked-path system-inventory fix and regression test from PR #71. Local build/QA outputs previously made its generated top-level inventory stale. No deployment target changes imported.
- Ignored Python bytecode/test/virtual-environment caches. No existing tracked backup or generated inventory removed.
- Refreshed locked transitive `body-parser` 2.3.0 → 2.4.0 and `source-map-js` 1.2.1 → 1.2.2 within existing ranges. No direct dependency removed or changed; all declared dependencies have runtime/build/test/type roles.

Removed files: **3**. Duplicate card implementations: **2 → 1**, retaining both variants. Dependencies removed: **0**. Workflows changed/removed: **0**; their distinct roles are required or already under active review.

## Preserved and deferred

Responsive AVIF/WebP variants are dynamically referenced, not duplicates. All logos/assets, migrations, backups, schema, routes, authentication, AI/API logic, runtime bindings and infrastructure remain. No data writes or external resource deletion.

| Workflow | Distinct purpose / disposition |
|---|---|
| ci | Disposable DB, unit/browser/build/runtime gates; kept |
| deploy | CI-gated web release; target drift handled in #75 |
| ai-python-deploy | Separate Python engine; kept |
| production-health | Live health/API probes; kept |
| production-browser | Browser checks after health; kept |
| cloudflare-diagnostics | Manual read-only diagnostics; kept |
| database-preflight | Manual read-only schema check; kept |
| db-migrate | Manual guarded migrations; kept |
| worker-secrets-sync | Manual runtime secret sync; kept |
| neon-branch | Unconsumed previews; active cleanup in #72, not duplicated |

17 pre-existing open PRs retained: #75 target safety; #74 three-page design; #73 admin consolidation; #72 Neon workflow; #71 social profiles; #70 address display; #68 no-op files; #60 contact; #59 routing; #53 memory; #47 diagnostics; #43 owner workspace; #39 recovery rules; #38 footer; #35 guidance; #29 release memory; #10 build diagnostics. Age alone does not prove abandonment. #38 appears to overlap the later footer repair, but complete supersession was not certified. #68 already removes the `rega` no-op file and empty legal test; do not repeat that PR's work.

21 non-main branches are exact ancestors of main and are review candidates; none deleted because ancestor status alone does not establish that an owner has stopped using a branch. `preview/admin-shots` and `preview-shots` are explicitly documented disposable screenshot branches, but have unique commits and remain preserved. Active PR branches and release history remain intact. No supported branch-delete connector action was available; no workaround or history rewrite used.

Repeated admin image-selection, form and API scaffolding blocks were retained: their validation, access and state ownership differ, and unifying them without behavioural proof would add risk.

## Verification

- Lint and TypeScript: pass before and after.
- 448 baseline/candidate static HTML comparisons: pass across seven locales, both card variants, all logo/cover combinations, ratings, verification and place/no-place. Child services/components were isolated with deterministic doubles; this is not a full browser screenshot audit.
- Node and OpenNext production builds: pass. Worker dry-run: pass. Existing Next Edge API and codec bundler warnings remain.
- Full local Node runner: 331 pass, 1 fail, 4 database-dependent skips; same pre-existing failure is the subprocess tsx IPC socket (`EPERM`). `npm test` itself cannot start its IPC socket here. Direct `node --import tsx scripts/business-publication-repair.ts` correctly refuses an absent DB. Inventory regression separately passes.
- Python engine: 7 pass. No inference or production provider calls.
- Documentation validator, identity guard and whitespace checks: pass.
- npm audit: **10 → 8** affected-package findings; remaining **6 high, 2 moderate, 0 critical**. Remaining roots: pinned glob in the minifier, undici through Miniflare/Wrangler, and Zod. Audit proposes major Zod migration/toolchain downgrades; these were not forced into cleanup. Further compatible remediation requires dedicated validation.
- Hosted CI pending at initial report publication; check final PR head before release. Local DB integration, authenticated live flows, browser accessibility/performance and runtime smokes require hosted checks; no blanket certification claimed.

## Size and release safety

Baseline tracked payload: **4,568,729 bytes / 533 files**. Code/config changes before this report and memory: **4,562,437 bytes / 531 files** (6,292 bytes less). Final payload including report/memory is recorded in the PR; documentation is deliberately retained even if it offsets byte savings. Baseline Git pack: **7.67 MiB**. Git history was preserved, so Git object storage is not expected to shrink; GitHub metadata size is not a working-tree metric.

Cloudflare read-only verification: canonical `rega24` deployment `cf37b341-5e5c-4703-915b-731aeefa6bfd`, version `f7a118cd-6f64-4206-a19e-ec5b434a5bc9`, 100% traffic. No application published by this task. Main still targets retired `rega-platform`; the existing #75 target reconciliation, deployed-source provenance and credential-release holds must be resolved first. Green cleanup CI alone does not make merging/deploying safe. R&L was not accessed or changed.
