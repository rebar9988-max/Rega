# Unknowns and discrepancies

Source commit: `8edc1ed873ed9c382400a935d77f44966ee64992`. Review: 2026-10-26.

| Topic | What is established | What is not established / implication |
|---|---|---|
| Drive diagram | Exact-name and broader connected-account searches returned no matching drawio file | Original file, contents, location and revision remain unknown. Original untouched. |
| Deployed source | Live Worker version and 100% allocation observed | No exact mapping from active version to inspected Git commit was established. Do not equate main with deployed source. |
| Old domain retirement | Four enabled custom domains remain attached to rega24, including old hostnames | Owner intent is canonical www.rega24.com. Old-domain routing/redirects were not tested or changed. |
| Worker names in older memory | Current Wrangler config and live Worker identify rega24 | Historical memory still mentions rega-platform. Read historical claims by date; no out-of-scope memory files changed. |
| Database host | Prisma PostgreSQL and Workers/Node adapters verified in code | Live Neon project, branches, quota, migrations, backup readiness and runtime connection binding were not queried. |
| Hyperdrive | Optional binding consumption implemented; example only is commented in Wrangler | Binding not declared active by checked-in config. No live binding values queried. |
| Media | S3-compatible implementation and normalized business-image path verified | Live R2/S3 bucket/provider, public URL, CORS and actual stored images not inspected. |
| AI | Seven provider adapter factories; configurable routing; public endpoint and flags implemented | Enabled providers, credentials, health, billing and inference not tested. Provider support does not mean active service. |
| Python AI | Separate Worker configuration and optional token-protected client verified | Live deployment, Workers AI binding and runtime enablement not queried. Code has candidate-preserving fallback. |
| Private inspector / MCP | No matching inspector/MCP implementation found in `src`, `services` or workflows | Do not draw a private inspector or ChatGPT connector as deployed. Absence from these paths is not proof about external systems. |
| Sections | Jobs/events source defaults disabled; guides enabled | Runtime environment can override registry defaults. Existing tables/routes do not imply launched features. |
| Sessions | JWT strategy configured; Session model remains in schema | Schema presence alone does not establish that Session rows serve current authentication. |
| Security fallback | Shared rate limiter catches exceptions and falls back to local allow result; JWT revalidation catches DB errors | Those implementations are documented, not certified fail-closed. No security fixes were authorized or attempted. |
| Opening status | Location JSON, overnight ranges and open/closed/unknown logic verified | Timezone selected by country; multi-zone countries use a representative zone. No per-place timezone or closing-soon implementation is asserted. |
| Edge cache | Business-bearing views, APIs/admin/auth bypass cache in code | Other anonymous cacheable pages use 300s TTL and stale behavior; runtime performance was not measured. |
| Email and OAuth | Resend/none email adapter and credential-gated social providers implemented | Live provider selection, delivery and enabled OAuth apps not verified; no email sent. |
| Cron | No scheduled handler in worker.mjs and no cron triggers declared in the two Wrangler files | Hourly GitHub health workflow exists; external dashboard-only cron configuration not inspected. |
| Diagram GUI | Native XML structural checks can run without diagrams.net | See validation.md for the actual rendering/reopen outcome; never treat XML parsing as GUI verification. |

These are documentation findings only. Nothing here authorizes infrastructure consolidation, domain removal, credential changes or application fixes.
