# Rega24 architecture atlas

Reviewed source: `8edc1ed873ed9c382400a935d77f44966ee64992` (`main`, 2026-10-26).

This is a code-grounded architecture snapshot for `rebar9988-max/Rega`. It adds documentation only. It does not change the application, database, infrastructure or deployed site. It is not automatically synchronized with code or Google Drive.

## Open and edit

Download [rega24-system.drawio](rega24-system.drawio), open [diagrams.net](https://app.diagrams.net/), choose **Device**, then **Open Existing Diagram**. Alternatively use **File → Open From → Device**. Select pages using the tabs at the bottom. All nodes, text and connectors are native editable objects, not embedded screenshots. Save your edited file and include it in a documentation PR.

The original Google Drive file was not found through exact-name, Rega24 keyword and drawio/system-name searches in the connected account. It was not read, overwritten, moved or shared. No Drive synchronization has been installed. This atlas supplements the existing repository system map; it does not replace project memory or the central Google Doc.

## Pages

| Page | Contents |
|---|---|
| A | System overview and boundaries |
| B | Application, locale routing, public, admin and API surfaces |
| C | Business save, moderation, publication and public read flow |
| D1–D5 | All 36 schema models; identity, geography, business, content, operations/AI |
| E | AI retrieval, optional Python reranking, provider routing and persistence |
| E2 | Media, map, geocoding and email integrations |
| F | Declared CI/release paths and scoped Cloudflare live observations |
| G | Implemented security controls and trust boundaries |

The physical tab order groups A/B/C, E/E2/F/G, then D1–D5. Shared tables repeat on database pages to keep local relationships readable. FK arrows point from the referencing model to the referenced model; nullable FK fields are explicitly labelled. Scalar identifiers without a Prisma relation are not invented foreign keys. `Session` exists in the schema although the configured Auth.js session strategy is JWT.

## Evidence and limits

- [evidence.md](evidence.md): each semantic node and connector, with commit-pinned source references.
- [evidence.json](evidence.json): machine-readable cell-to-source mapping, all models and all 33 relation-owning fields.
- [routes.md](routes.md): complete page/API route inventory, including source-disabled routes.
- [live-observations.md](live-observations.md): read-only Cloudflare observations and release-trigger inspection.
- [unknowns.md](unknowns.md): uncertainty and discrepancies; no speculative repairs.
- [validation.md](validation.md): actual verification results and environment limitations.

CODE means verified implementation, CONFIG means declared configuration, LIVE means a dated scoped read-only observation, PLANNED means future intent, UNKNOWN means missing evidence. Implementation is not proof of live enablement. The atlas does not label unobserved Neon/R2/OAuth/provider state as verified.

## Updating safely

1. Read applicable repository instructions and the existing system map/memory. Record the new source commit and review date.
2. Compare against the previous snapshot: `git diff 8edc1ed873ed9c382400a935d77f44966ee64992..HEAD -- src prisma services worker.mjs wrangler.jsonc package.json next.config.ts open-next.config.ts .github/workflows`.
3. Inspect affected implementation, configuration and relevant authorized read-only live metadata. Do not assume a previous live observation is still current.
4. Update affected native cells and connectors. Preserve stable cell IDs and user annotations; do not regenerate the entire file over manual edits.
5. Update evidence, the route/model indexes where affected, and recorded unknowns together. Pin source links to the newly inspected commit.
6. Run `python docs/architecture/validate.py` and `node scripts/validate-system-docs.mjs` from the repository root.
7. Open every changed page in diagrams.net, check text/edges visually, save and reopen it. Record what was actually verified.
8. Reinspect release triggers before push/PR. Use a documentation-only branch and draft PR. No merge, production deployment, migration, secret synchronization or scheduled automation is authorized by this atlas.

No dependency installation is needed to run the architecture validator. It uses Python's standard library. The validator reads repository files only, performs no network calls and writes nothing.
