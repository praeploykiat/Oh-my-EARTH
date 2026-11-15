# Background ingestion and cached exploration

**Current release: POWER only.** AppEEARS/NDVI is disabled in `web/src/features/global/sourceSettings.json`; its code and historical evidence remain archived. PostgreSQL stays local. Deploy the checked-in POWER cache using [the Vercel guide](vercel-power-checkpoint.md). Normal deployment does not run these Python commands.

The browser reads a published database snapshot. NASA calls happen only in the Python worker. POWER and NDVI share the monthly observation contract, while retaining their separate products, units, provenance, and quality policies. The four POWER variables cover all 195 capital coordinates for 2001–2024. The historical NDVI pilot is an offline test fixture, and its existing NASA task ID is preserved locally. It is excluded from current publication.

## Local operation

Follow [database setup](../db/README.md) first. The database must be running. From the repository root:

```powershell
./pipeline/.venv/Scripts/python.exe -m pip install -r pipeline/requirements-ingestion.txt
npm --prefix web ci
./pipeline/.venv/Scripts/python.exe pipeline/database.py migrate
./pipeline/.venv/Scripts/python.exe pipeline/worker.py enqueue-power --countries all
./pipeline/.venv/Scripts/python.exe pipeline/worker.py status
./pipeline/start-worker.ps1
```

The Windows helper starts a hidden, persistent process, avoids duplicate instances, and saves its PID and logs under ignored `pipeline/raw/worker/`. It is not installed as a startup service: restart it after a reboot. Stop it with `./pipeline/start-worker.ps1 -Stop`. Abrupt stops preserve database jobs and checkpoints; an abandoned running lease becomes claimable after five minutes. Stop the worker before shutting down PostgreSQL.

For a terminal/container service, use `python pipeline/worker.py run --watch --workers 2 --publish`. For a bounded run, use `run --max-jobs 10 --workers 2 --publish`. Workers require Python dependencies, Node, installed web dependencies, PostgreSQL access, and writable private staging/publication directories. Set `APPEEARS_TOKEN` privately for NDVI; the existing workspace token file is a local fallback. Credentials never enter public files or browser requests. POWER needs no token.

The following describes the deferred AppEEARS implementation; these paths are disabled in the current CLI and excluded from default job claims. When enabled, the worker polls processing AppEEARS tasks at most once per minute per job without consuming its failure budget. Completed bundle files have checksummed download checkpoints. Interruptions may restart the current file; completed files and validated artifacts are reused. A task submission intent is saved before POST. If a response is lost, the worker reconciles its stable task name rather than blindly submitting another extraction. An unresolved intent waits for an operator to inspect NASA and adopt the task with `worker.py adopt --id JOB_ID --task-id TASK_UUID`.

Jobs have unique work identities, atomic `SKIP LOCKED` claims, five-minute fenced leases, bounded exponential retries (five failures), and atomic observation-import/job-completion transactions. Authentication or service failures are visible in database job status and sanitized logs; they never erase published data. After resolving a failed job, use `worker.py retry --id JOB_ID`. To intentionally refresh POWER, enqueue a new `--generation` value, for example `enqueue-power --countries all --generation refresh-2026-11`. Repeating the same enqueue is idempotent. Refresh dates remain fixed at 2001–2024 in this milestone; expanding years requires a contract change.

## Publication and user experience

`python pipeline/publish_cache.py` publishes independently. Watch mode checks for a changed database snapshot at most once per minute between jobs. The first full statistical publication takes compute time; subsequent unchanged publications reuse the release. NASA ingestion can continue while a consistent PostgreSQL snapshot is published.

Each release contains one file per capital (all available variables, 288 monthly positions each), annual maps for every year and variable, and default-period trend maps. Rainfall has monthly-rate and annual-total trend maps. Annual means use day weighting, rainfall totals multiply monthly mean daily rates by calendar days, and annual/extreme maps require all 12 months. Deferred NDVI code retains strict `good-land-clear-v1` QA for offline tests; no NDVI data is published in this release. Default trends use the exact chart engine, `seasonal-sen-cbb-v1`, 999 replicates and seed 271828, including its confidence intervals and evidence safeguards.

The publisher selects a whole latest validated batch per capital/variable, keeps current catalog coordinates, and never assembles a monthly series from unrelated revisions. Source version, retrieval time, artifact checksum, QA policy, and normalization version travel with monthly files. Failed preparation leaves the previous manifest intact. Releases are immutable and retained; `manifest.json` switches atomically last. Readers verify SHA-256 and release IDs, pin a release for the current session, and switch on **Reload published data**. A partially downloaded/corrupt file produces a retryable error. No live NASA fallback is triggered by navigation, missing coverage, or retry.

Default-period maps load one prepared file. A capital selection loads its saved monthly file once and reuses its POWER variables. Custom-range trends use saved monthly records and the existing browser worker; **Calculate map for this range** can still take computation time for 195 capitals. This is local statistical computation, not a NASA queue. The map and detail panels show published coverage and timestamps.

## Hosting

For this checkpoint the POWER release is committed in Git and shipped with the Vercel build, so no hosted database or background server is required. Updating the snapshot is an optional local maintenance task.

Local watch publication updates `web/public/explorer-cache/`; Vite serves it immediately. This does **not** deploy production automatically. For a static deployment, publish first and deploy the complete `web/dist` build (or copy the complete release directory to the same-origin object store/CDN, then switch its manifest last). Keep older release files available for pinned readers. `web/vercel.json` makes the manifest revalidate and content-addressed release files immutable for one year. Other hosts must set equivalent headers. Serve through HTTPS or localhost for Web Crypto checksum verification.

Keep PostgreSQL and NASA credentials on the private worker host. Do not run ingestion inside browser requests or short-lived serverless request handlers. A production service manager should restart the watch worker and retain its private raw checkpoint directory. This milestone does not provision a cloud database, object store, service manager, or automatic deployment.

## Verification

```powershell
$env:RUN_DATABASE_TESTS='1'
./pipeline/.venv/Scripts/python.exe -m pytest pipeline/tests -q
npm --prefix web test
npm --prefix web run validate:data
npm --prefix web run build
```

Database tests use disposable `earth_test_<uuid>` databases. They cover duplicate claims, expired lease fencing, retries, artifact reuse, AppEEARS polling/reconciliation, token stripping on redirects, consistent revisions, and atomic publication failure. Web tests prove cache-only requests, capital reuse, QA preservation, checksum retry, release pinning, and compatible statistics. Dataset validation checks every published file using the actual explorer reader. Workbench keeps its existing live connectors and independently tested API middleware; upstream Giovanni availability is unchanged.
