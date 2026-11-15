# Earth Trend Detective

NASA Space Apps Challenge 2026, challenge: **Be An Earth System Trend Detective!**

An interactive story driven by NASA Earth observation data, paired with a workbench that tests whether an Earth system variable is changing, where, by how much, and whether the change is statistically significant.

> Status: workbench working with live NASA connections (not yet verified in production). Featured datasets are still synthetic. See [Next steps](#next-steps).

## Structure

```
contracts/     JSON schemas shared by the pipeline and the web app
fixtures/      Reference trend cases both implementations must match
pipeline/      Python: fetch NASA data, compute trends, export datasets
web/           Vite + React + TypeScript app
  api/               Vercel functions that call Earthdata services with our token
  public/datasets/   Exported datasets read by the app
  public/geo/        Thailand provinces and neighbouring countries
  src/core/          Stats, data loading, geo, i18n
  src/features/      experience (story), workbench (analysis tool), methods
  src/shared/        Chart, map, summary and share components
```

Data flows one way: `pipeline/export.py` writes `web/public/datasets/`, the web app reads it. Every dataset must match `contracts/dataset.schema.json`.

## Getting started

### Web

```bash
cd web
npm install
npm run dev
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm test` | Stats tests against shared fixtures |
| `npm run typecheck` | TypeScript check |
| `npm run validate:data` | Check datasets against the contract |
| `npm run build` | Production build into `web/dist` |

### Languages

The UI shows one language at a time, English by default, with a switcher in the nav. The choice is remembered per browser.

- Strings live in `web/src/core/i18n/en.ts` and `th.ts`.
- Add a key to `en.ts` first. TypeScript and `npm test` fail until `th.ts` has the same key and placeholders.
- Use `const { t } = useI18n()` and `t('key', { name: value })` in components.

### Pipeline

```bash
cd pipeline
python -m venv .venv
.venv\Scripts\activate        # Windows
source .venv/bin/activate     # macOS / Linux
pip install -r requirements.txt

python export.py --sample     # synthetic data, works offline
python export.py              # real data from NASA POWER
pytest
```

Add or change datasets in `SPECS` inside `pipeline/export.py`.

## Local database foundation

Validated POWER and NDVI observations can now be stored in local PostgreSQL, with checksummed migrations, a shared observation contract and repeatable imports. Start with [db/README.md](db/README.md). This is a separate pipeline capability; existing web pages do not require PostgreSQL to run. Resumable POWER ingestion and database-generated caches are implemented. PostgreSQL is a local preparation tool; the deployed explorer reads the checked-in cache and requires no database connection.

## Global explorer

Open `#/global` from **Global explorer** in the navigation. This separate page provides a clickable world map and searchable catalog of 195 representative capital-city locations. The four initial variables are air temperature (`T2M`), corrected precipitation (`PRECTOTCORR`), relative humidity (`RH2M`), and solar radiation (`ALLSKY_SFC_SW_DWN`).

The page reads a checked-in POWER-only cache published from the local PostgreSQL database. All four variables have monthly records for 195 capitals, 2001–2024. Default-period trend maps and annual maps are prepared in advance; selecting a capital loads one reusable monthly file. Changing years reuses those observations. Custom-range maps run the existing browser statistical worker on saved data. Normal exploration, retries, and **Reload published data** do not start NASA requests. Country, variable, view, and years remain shareable in the URL. No database or AppEEARS credentials are needed by the deployed explorer. See [Vercel checkpoint deployment](docs/vercel-power-checkpoint.md).

Observations represent NASA grid data at the listed capital coordinate, not national averages or local station measurements. The global explorer uses day-weighted annual means for temperature, humidity, and daily solar energy, and derives annual rainfall totals by summing each monthly daily rate multiplied by its calendar days (including leap days). Annual values require all 12 valid months; incomplete years remain gaps and are never scaled or filled. Derived rainfall totals inherit the precision of the rounded monthly rates. The Thailand workbench retains its existing aggregation.

Within the selected period, monthly/anomaly views and annual means use seasonal Kendall comparisons and Sen slopes within matching calendar months. Annual rainfall uses complete annual totals, so its chart and trend both use `mm/year`. Anomaly baselines follow the selected period. Inference is withheld unless the selection covers at least 10 years, observations occur in at least 10 distinct years, and at least 80% of monthly observations are valid; annual rainfall additionally requires 10 complete years. These are explicit MVP display safeguards, not statistical guarantees.

The global explorer now uses **seasonal-sen-cbb-v1**, a whole-year residual block bootstrap for approximate 95% slope intervals and Kendall score p-values. A background worker keeps the page responsive. Results include plain-English explanations, residual autocorrelation diagnostics, and sensitivity to block length. Gaps, strong persistence, or records shorter than 15 years are marked provisional. The method is numerically verified against an independent NumPy/SciPy reference, but simulations still show under-coverage in some dependent and incomplete records; it remains an exploratory method. See the [full statistical method and validation](docs/global-trend-method.md), [parity report](docs/global-trend-validation.json), and [simulation report](docs/global-trend-simulation.json). Run `npm run validate:trend` in `web/` to reproduce the numerical comparison.

The **Data quality and provenance** panel reports all four variables for the selected years, including source units, valid/missing/rejected month counts, requested and API response coordinates, source products, and retrieval time. Runtime validation rejects malformed response structure, missing variable metadata, incompatible units, unexpected months/years, and location mismatches. Missing/fill values remain missing; nonnumeric, nonfinite, or implausible values are excluded and counted separately. See [validation rules and live pilot](docs/global-data-validation.md).

AppEEARS/NDVI is currently **disabled** in the UI, ingestion CLI, and published cache. Old NDVI URLs fall back to temperature. The pilot remains an offline test fixture under `pipeline/fixtures/ndvi-pilot.json`; the connector, QA evidence and local database observations are preserved for future review. The local AppEEARS polling worker is stopped. See [the partial NDVI QA review](docs/ndvi-capital-review.md).

Run the opt-in live pilot from `web/`:

```bash
npm run validate:global:live
# Optional subset:
npm run validate:global:live -- --countries=TH,NO
```

The script uses the same validator and aggregator as the page, writes a summary to `docs/global-data-validation.json`, and retains original responses with request metadata in ignored `pipeline/raw/global-validation/`. A rerun replaces those pilot outputs; no live request is required by the ordinary unit tests.

Bundled geography and source attribution:

- `web/public/geo/capitals.json`: derived from [REST Countries countriesV3.1.json](https://github.com/restcountries/restcountries/blob/master/src/main/resources/countriesV3.1.json), retrieved November 15, 2026. Includes the 195 entries marked `independent: true` with capital coordinates; uses the first listed capital (Pretoria for South Africa). Names and coordinates reflect this source snapshot, not a continuously updated political gazetteer. The derived JSON is distributed as source under MPL-2.0; a copy of the upstream license is included at `web/public/licenses/rest-countries-MPL-2.0.txt`.
- `web/public/geo/world-countries.json`: derived from [Natural Earth 1:110m country boundaries](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson), retrieved November 15, 2026; public domain. Properties are reduced to display name and country code. Small islands may have a marker without a boundary polygon.

Country/capital names retain the English source labels in both UI languages; controls and explanations are translated. No extra mapping or chart dependency, database, or backend service is required for this page.

## Workbench method

1. Monthly series per location from the sources listed under [Data](#data).
2. Seasonal cycle removed by subtracting each calendar month's mean.
3. Mann-Kendall test for a monotonic trend (two-sided, tie-corrected, Î± = 0.05).
4. Sen's slope for the rate of change, reported per decade.

Both the Python and TypeScript implementations are checked against `fixtures/trend-cases.json`, which is cross-checked with `pymannkendall` (`python make_fixtures.py`).

Known limitation of the Thailand workbench/legacy pipeline: the test does not yet correct for serial autocorrelation, which can overstate significance. The global explorer uses the separate method described above.

## Deployment

The site is hosted on [Vercel](https://vercel.com/) with **Root Directory** set to `web` and the Vite preset.

| Variable | Needed by | Notes |
| --- | --- | --- |
| `EARTHDATA_TOKEN` | `web/api/giovanni.ts` | NASA Earthdata user token, stored as a Secret. Expires after about 60 days. |
| `SPHERE_KEY` | `web/api/flood.ts` | GISTDA sphere API key (free sign up at sphere.gistda.or.th), stored as a Secret. |

`npm run dev` now runs the existing `web/api/` handlers through a development-only Vite adapter (`web/scripts/local-api.ts`). Requests to `/api/giovanni`, `/api/flood`, and `/api/questions` are handled before Vite's source transforms. Local server credentials are read from `web/.env`/`.env.local` (or the shell environment) and are not exposed as client variables. Restart the dev process after changing credentials. `npx vercel dev` remains an option for checking Vercel-specific routing; production continues to use the existing Vercel functions.

An `Invalid loader value: "2000"` error for `api/giovanni.ts` was caused by sending API query URLs through Vite's TypeScript transform instead of executing the server handler. The adapter keeps query strings on the HTTP request and loads only an explicit, query-free server module ID. Regression tests cover decimal coordinates, JSON request bodies, response errors, and the three API routes. See the [dependency and page regression audit](docs/dependency-regression-audit.md).

- Every push to `main` deploys to production.
- Every pull request gets its own preview URL.

CI (`.github/workflows/ci.yml`) runs on every pull request and push to `main`: typecheck, tests in both languages, dataset validation, and build.

## Data

The workbench offers 12 variables in three Earth system layers. All series are monthly, 2001 to 2024.

| How it is reached | Source | Variables | Code |
| --- | --- | --- | --- |
| Browser calls NASA directly | [NASA POWER](https://power.larc.nasa.gov/) monthly point API (MERRA-2; sunlight from CERES) | Air temperature, daily high, daily low, rainfall, humidity, wind speed, sunlight | `web/src/core/data/power.ts` |
| Our function `/api/giovanni` | [NASA Giovanni](https://giovanni.gsfc.nasa.gov/) time series API | Haze (AOD 550 nm, hourly MERRA-2 averaged monthly), satellite rainfall (GPM IMERG V07), soil moisture, runoff and evaporation (GLDAS Noah 2.1) | `web/api/giovanni.ts`, `web/api/_proxy.ts`, `web/src/core/data/remote.ts` |
| Our function `/api/flood` | [GISTDA sphere](https://sphere.gistda.or.th/docs/web-service/disaster-information) flood recurrence API | Years each subdistrict flooded, 2011 to 2023. Shown under rainfall, satellite rainfall and runoff for context, not trend tested | `web/api/flood.ts`, `web/src/core/data/flood.ts`, `web/src/features/workbench/FloodHistory.tsx` |
| Static file | `web/public/datasets/` | Featured cases and offline fallback | `web/src/core/data/resolve.ts` |
| Static file | [geoBoundaries](https://www.geoboundaries.org/) (CC BY 4.0) | Thailand province boundaries | `web/public/geo/thailand-provinces.json` |
| Static file | [Natural Earth](https://www.naturalearthdata.com/) via `world-atlas` (public domain) | Neighbouring countries on the map | `web/public/geo/region-neighbors.json` |

If a live request fails, the app falls back to a saved dataset for the same place and shows a "Saved copy" badge.

Giovanni investigation: the generated-token request still returns HTTP 500 when
called directly outside the application, including NASA's published example.
Unsupported haze product IDs were corrected using the live catalog; further
credential/upstream work is deferred at the user's request. See the
[investigation and evidence](docs/giovanni-investigation.md). The generated token
was preserved, and this integration is not yet marked live-verified.

Sample datasets in `web/public/datasets/` are synthetic until replaced by `python export.py`. Each file marks this with `source.synthetic`.

Not connected yet: FIRMS fire hotspots, AppEEARS, NOAA Climate Data Online, SWOT. Reference articles from the challenge resources are linked on the Methods page.

## Next steps

Verify live data (blocking)
- [ ] Open the deployed site, pick a province that is not a featured case, and confirm the "Live" badge (NASA POWER works from the browser).
- [ ] Open `/api/giovanni?variable=AOD&lat=18.79&lon=98.98` and `/api/giovanni?variable=RUNOFF&lat=18.79&lon=98.98` on the deployed site and note which `product` each one used. The Hydrology Data Rods service was retired, so runoff and evaporation now come through Giovanni.
- [ ] Add `SPHERE_KEY` in Vercel, then open `/api/flood?lat=14.3615&lon=100.5816` and check it lists flood years for Hua Ro, Ayutthaya.

Real data
- [ ] Replace the three synthetic files in `web/public/datasets/` with real exports (`python export.py`).
- [ ] Pick featured cases from real results, then write the pitch story around what the data shows.
- [ ] Add FIRMS fire hotspot counts per province (MODIS only, 2001 to 2024, precomputed in the pipeline).

Statistics
- [ ] Agree on the trend method with the analytic team. Candidate: seasonal Mann-Kendall with 3PW prewhitening and Sen's slope with 95% confidence limits (Collaud Coen et al. 2020, used by WMO GAW), reference implementation [`mannkendall`](https://pypi.org/project/mannkendall).
- [ ] Decide where it runs: Python function on Vercel using `mannkendall` directly (about 260 MB, about 3 s cold start), or a TypeScript port tested against it.
- [ ] Note: `mannkendall` reports no yearly slope when monthly trends are not homogeneous. The UI needs a message and a per-month breakdown for that case.
- [ ] Report certainty in graded levels (TOAR-II guidance) instead of a yes or no on p < 0.05.

Product
- [ ] Redesign the Experience page in the same theme as the workbench.
- [ ] Check the Thai translation of every new string.
- [ ] Update the `og:image` URL in `web/index.html` if the production domain changes.
- [ ] Before submission: make the repository public, record the demo, fill in the Use of AI table.

## Use of AI

AI tools were used in this project as follows. Update this section as the project changes.

| Tool | Where | How |
| --- | --- | --- |
| Claude (Anthropic) | Project scaffold, stats implementations, CI, this README | Generated initial code, reviewed and tested by the team |
| Claude (Anthropic) | Workbench UI, data connectors (`web/api/`), map, share and image export | Generated code and design mockups, reviewed by the team |
| Claude (Anthropic) | Ideation | Brainstorming challenge interpretation and story concepts |

## License

[MIT](LICENSE)

## Cached global exploration

Global Explorer now reads database-published map summaries and per-capital monthly files. Normal exploration does not call NASA. The checked-in cache covers 195 capital coordinates for four POWER variables, 2001–2024. AppEEARS/NDVI is disabled and excluded from the deployment. Workbench connectors retain their existing behavior.

See [Vercel checkpoint deployment](docs/vercel-power-checkpoint.md) for the database-free deployment and [background ingestion and publication](docs/background-ingestion.md) for optional local data refreshes.
