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

## Method

1. Monthly series per location from the sources listed under [Data](#data).
2. Seasonal cycle removed by subtracting each calendar month's mean.
3. Mann-Kendall test for a monotonic trend (two-sided, tie-corrected, α = 0.05).
4. Sen's slope for the rate of change, reported per decade.

Both the Python and TypeScript implementations are checked against `fixtures/trend-cases.json`, which is cross-checked with `pymannkendall` (`python make_fixtures.py`).

Known limitation: the test does not yet correct for serial autocorrelation, which can overstate significance.

## Deployment

The site is hosted on [Vercel](https://vercel.com/) with **Root Directory** set to `web` and the Vite preset.

| Variable | Needed by | Notes |
| --- | --- | --- |
| `EARTHDATA_TOKEN` | `web/api/giovanni.ts` | NASA Earthdata user token, stored as a Secret. Expires after about 60 days. |
| `SPHERE_KEY` | `web/api/flood.ts` | GISTDA sphere API key (free sign up at sphere.gistda.or.th), stored as a Secret. |

`npm run dev` does not run the functions in `web/api/`. Use `npx vercel dev` to test them locally.

- Every push to `main` deploys to production.
- Every pull request gets its own preview URL.

CI (`.github/workflows/ci.yml`) runs on every pull request and push to `main`: typecheck, tests in both languages, dataset validation, and build.

## Data

The workbench offers 12 variables in three Earth system layers. All series are monthly, 2001 to 2024.

| How it is reached | Source | Variables | Code |
| --- | --- | --- | --- |
| Browser calls NASA directly | [NASA POWER](https://power.larc.nasa.gov/) monthly point API (MERRA-2; sunlight from CERES) | Air temperature, daily high, daily low, rainfall, humidity, wind speed, sunlight | `web/src/core/data/power.ts` |
| Our function `/api/giovanni` | [NASA Giovanni](https://giovanni.gsfc.nasa.gov/) time series API | Haze (AOD 550 nm, MERRA-2 with MODIS Terra and Aqua as fallbacks), satellite rainfall (GPM IMERG V07), soil moisture, runoff and evaporation (GLDAS Noah 2.1) | `web/api/giovanni.ts`, `web/api/_proxy.ts`, `web/src/core/data/remote.ts` |
| Our function `/api/flood` | [GISTDA sphere](https://sphere.gistda.or.th/docs/web-service/disaster-information) flood recurrence API | Years each subdistrict flooded, 2011 to 2023. Shown under rainfall, satellite rainfall and runoff for context, not trend tested | `web/api/flood.ts`, `web/src/core/data/flood.ts`, `web/src/features/workbench/FloodHistory.tsx` |
| Static file | `web/public/datasets/` | Featured cases and offline fallback | `web/src/core/data/resolve.ts` |
| Static file | [geoBoundaries](https://www.geoboundaries.org/) (CC BY 4.0) | Thailand province boundaries | `web/public/geo/thailand-provinces.json` |
| Static file | [Natural Earth](https://www.naturalearthdata.com/) via `world-atlas` (public domain) | Neighbouring countries on the map | `web/public/geo/region-neighbors.json` |

If a live request fails, the app falls back to a saved dataset for the same place and shows a "Saved copy" badge.

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
