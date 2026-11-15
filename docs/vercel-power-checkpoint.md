# Cached Vercel deployment

The original POWER-only checkpoint is now extended with [GLDAS soil moisture](global-gldas-soil.md). Its deployment still requires no database connection.

Global Explorer deploys from the checked-in `web/public/explorer-cache/` snapshot. Vite copies it into `web/dist/explorer-cache/`. Browsers read those same-origin JSON files; no PostgreSQL connection, Python ingestion process, or AppEEARS login is involved in this route.

## Deploy

Use the existing Vercel project and its existing API settings. For the Vite app, the project root is `web`, build command `npm run build`, and output directory `dist`. Commit the source code and the entire current published release, including its manifest. No database migration or data fetch belongs in the Vercel build command.

Do not add `DATABASE_URL`, `PGPASSWORD`, or `APPEEARS_TOKEN` for Global Explorer. Preserve credentials/settings already required by other existing Workbench APIs; this change does not migrate or reconfigure those routes. Deployment does not depend on your laptop or Docker being running. Workbench's external NASA/API availability remains a separate concern.

The snapshot includes 195 capital coordinates, four POWER variables, and monthly records for January 2001–December 2024. Default-period trend maps and annual average/total, lowest-month and highest-month maps are prepared in advance. Custom-range trends still require browser computation on saved records.

GLDAS soil moisture is enabled through the cached local-ingestion path. AppEEARS/NDVI is disabled. The public cache has no NDVI variables or summaries, and the pilot was moved to a non-public offline fixture. Shared URLs requesting NDVI fall back to temperature. Deferred source code and QA tests remain available for later review; they do not make requests in the website or the default ingestion worker. The local polling worker was stopped for this checkpoint; its durable database state is preserved.

## Before deploying

From `web/`:

```text
npm ci
npm test
npm run validate:data
npm run build
```

These web commands do not require PostgreSQL or NASA credentials. `validate:data` verifies every published file's checksum, release identity, coordinates, QA metadata, and data contract using the actual explorer reader. The checked-in cache must not be replaced with synthetic data or omitted from the deployment.

The existing `vercel.json` sets revalidation for the manifest and immutable caching for release files. Readers pin one release until **Reload published data** or a new page session. Failed reads produce a retryable error instead of triggering NASA extraction.

## Optional local refresh

Only data preparation needs local PostgreSQL. With Docker and local credentials available, use the commands in [background ingestion](background-ingestion.md), then run `python pipeline/publish_cache.py`. Validate the result, commit the intended release, and redeploy through your normal Vercel workflow. Unchanged data reuses its release. No automatic cloud refresh or database hosting is configured.

Keep `.env`, database volumes, `pipeline/raw/`, download checkpoints, and logs out of Git. The previous experimental mixed-source cache was moved to ignored local `pipeline/raw/cache-archives/`; it is not shipped. Future snapshot releases should retain previous published assets long enough for pinned clients, with an explicit retention policy rather than accumulating every release in Git.
