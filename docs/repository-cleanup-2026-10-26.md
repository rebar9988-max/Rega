# Rega24 repository cleanup — 2026-10-26

Scope: `rebar9988-max/Rega` only. Baseline `7011eb5482e518aa1b0e2f3974d516cbb8c3f6d2`.
PRs: https://github.com/rebar9988-max/Rega/pull/76 and https://github.com/rebar9988-max/Rega/pull/77
Status: cleanup and hardening merged; current release evidence is maintained in PR #77 and the central project-memory Doc. Earlier results below are historical checkpoints. No universal 100/100 certification is claimed.

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

## Initial verification checkpoint (superseded by hosted results below)

- Lint and TypeScript: pass before and after.
- 448 baseline/candidate static HTML comparisons: pass across seven locales, both card variants, all logo/cover combinations, ratings, verification and place/no-place. Child services/components were isolated with deterministic doubles; this is not a full browser screenshot audit.
- Node and OpenNext production builds: pass. Worker dry-run: pass. Existing Next Edge API and codec bundler warnings remain.
- Full local Node runner: 331 pass, 1 fail, 4 database-dependent skips; same pre-existing failure is the subprocess tsx IPC socket (`EPERM`). `npm test` itself cannot start its IPC socket here. Direct `node --import tsx scripts/business-publication-repair.ts` correctly refuses an absent DB. Inventory regression separately passes.
- Python engine: 7 pass. No inference or production provider calls.
- Documentation validator, identity guard and whitespace checks: pass.
- npm audit: **10 → 8** affected-package findings; remaining **6 high, 2 moderate, 0 critical**. Remaining roots: pinned glob in the minifier, undici through Miniflare/Wrangler, and Zod. Audit proposes major Zod migration/toolchain downgrades; these were not forced into cleanup. Further compatible remediation requires dedicated validation.
- Hosted CI pending at initial report publication; check final PR head before release. Local DB integration, authenticated live flows, browser accessibility/performance and runtime smokes require hosted checks; no blanket certification claimed.

## Initial size and release-safety checkpoint

Baseline tracked payload: **4,568,729 bytes / 533 files**. Code/config changes before this report and memory: **4,562,437 bytes / 531 files** (6,292 bytes less). Final payload including report/memory is recorded in the PR; documentation is deliberately retained even if it offsets byte savings. Baseline Git pack: **7.67 MiB**. Git history was preserved, so Git object storage is not expected to shrink; GitHub metadata size is not a working-tree metric.

Cloudflare read-only verification: canonical `rega24` deployment `cf37b341-5e5c-4703-915b-731aeefa6bfd`, version `f7a118cd-6f64-4206-a19e-ec5b434a5bc9`, 100% traffic. No application published by this task. Main still targets retired `rega-platform`; the existing #75 target reconciliation, deployed-source provenance and credential-release holds must be resolved first. Green cleanup CI alone does not make merging/deploying safe. R&L was not accessed or changed.

## Owner-authorized blocker repair and deployment continuation

The owner subsequently required resolving the blockers and explicitly requested deployment. Original PR head d4e5bbf completed hosted CI successfully (40285442047). Recovery checkpoint: `checkpoint/rega24-pr76-before-hardening-20261026`.

- npm audit is now zero at every severity: Zod 4.6.7+, minifier-scoped glob 10.x and Miniflare-scoped undici 7.x overrides. Four regression tests first demonstrated Zod 4 resetting omitted PATCH fields; six validation tests now preserve update semantics/create defaults and bound oversized collection failures. CI adds `npm audit --audit-level=low`.
- The focused #75 target repair is reused, with live account/stable-Worker/domain verification before release and secret writes. New web deployments attach the GitHub SHA tag for provenance. No other feature PR is imported.
- The unconsumed external Neon provisioner is replaced with #72's manual policy. Main has no required status checks/rulesets; no protected gate is bypassed. Actual migration/preflight/integration/browser validation remains on CI PostgreSQL. No Neon data/resource deleted; genuine future preview testing requires audited capacity and a consumer.
- Both Worker configs contain preview definitions and enforce non-ready isolation before app/provider handlers. Only `/__preview-health` returns isolated health; application requests return explicit 503. A successful upload is not functional application certification. This prevents inherited base credentials reaching production data or billed AI while real application QA runs in CI.
- Previews Base's two plaintext provider values were converted internally, unchanged, to secret_text with HTTP 200/readback. Binding names, production deployment time and references were unchanged. No key was output/deleted/rotated. Provider-side historical revocation remains unverified.
- Local focused release tests 25/25, Python 8/8, lint/typecheck and Worker build pass. Final-head hosted verification and live release evidence must be recorded in the PR before certification.
- Pre-release public health and a real browser showed the current site working; DB/migrations/content/auth/storage/AI/email ready, four configured providers. Immutable rollback version: f7a118cd-6f64-4206-a19e-ec5b434a5bc9. It lacks a Git annotation, so exact old-source identity is unknown; the new SHA tag resolves future traceability. No production code had been changed at this checkpoint.

Primary references: https://zod.dev/v4/changelog and https://developers.cloudflare.com/workers/previews/configuration/ . The isolation guard is intentional safety, not a claim that an unconfigured preview has passed application QA.


## Hosted validation and deployment-command repair — 2026-10-26

PR #77 merged as `7e16349e2314255a25987b1497c66d0dd927cdea`; its tree exactly matches the verified candidate. Main CI `40387716820` passed: 351 unit/integration tests, 331 E2E tests, 8 Python tests, zero Node skips/failures, lint/typecheck, disposable PostgreSQL migration/preflight, both production builds and workerd codec/route smokes. npm 10 clean install and audit pass with zero findings at every severity. Overrides are version-specific (`glob@10.3.3`, `undici@7.29.1`) and retain their major versions. Focused release tests: 26/26.

The #77 source checkpoint is 4,592,343 tracked bytes / 538 files versus baseline 4,568,729 / 533. Exactly 3 removed, 8 added, 26 modified; added safety code, tests and documentation explain the net increase. Dependencies removed: 0. Workflows modified: 7; deleted: 0. No schema/migration or brand-asset changes. Git history is preserved; no Git-storage reduction is claimed.

Python production workflow `40387716870` passed live health, anonymous rejection and authenticated process/embed/rerank smokes before enabling web integration. Cloudflare's Python build trigger incorrectly used the web root/commands. Its production trigger is now validation-only in `/services/ai-python`; the existing branch Preview settings were repaired separately. Correct preview build `cf311921-fc31-4eed-9e48-942728b73464` passed; readback shows `main.py` and only `REGA_ISOLATED_PREVIEW=1`, without production/provider bindings. Public preview probes returned Cloudflare 403/1010; live preview application QA is unverified.

Web release `40390749927` failed before upload: OpenNext forwards CLI arguments through a shell without preserving spaces in the deployment message (`Unknown arguments: CI, release`). The message now uses one shell-safe token. CI's dry-run invokes the actual OpenNext forwarding path with the same message and a synthetic tag; this passed locally alongside 19 release/identity/ownership tests and documentation validation. No application or dependency version change is needed. Final hosted/deployment/readback evidence belongs in PR #77 and the central Doc; never treat a dry-run as a production deployment.


## Python dependency security completion — 2026-10-26

The first pip-audit scan found pytest8.4.2 affected by PYSEC-2026-1845 / CVE-2025-71176 (insecure Unix temporary-directory handling). This is a development/test dependency, not an application provider or production-data migration. Official pytest changelog confirms the temporary-directory fix: https://docs.pytest.org/en/stable/changelog.html . Raise the supported range to >=9.0.3,<10; actual resolved9.1.1 passed all8 Python tests. Strict pip-audit then scanned50 environment entries with0 vulnerabilities and0 skipped packages. CI now runs the same strict Python audit after Python tests, alongside the existing all-severity npm audit. No runtime application dependency, schema, branding, credential or external-resource change. Historical npm-only audit results did not cover Python; this closes that coverage gap. Final hosted release evidence remains in the linked release PRs and central Doc.
