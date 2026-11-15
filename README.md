# Oh my EARTH!

NASA Space Apps Challenge 2026 (Bangkok), challenge **Be An Earth System Trend Detective!**, team **Far Side of the Moon**.

A bilingual (English and Thai) website that turns NASA Earth observation data into games and explorers. People guess how a record continues, find where change is strongest, and test whether a change at a place is a real trend or could be chance.

Live site: <https://oh-my-earth.vercel.app>

## What is on the site

| Page | Route | What it does |
| --- | --- | --- |
| Home | `#/` | Draw how Phuket's yearly air temperature continued after 2012, then compare with the real NASA POWER record (2001 to 2024) and see its tested trend. |
| Guess the graph | `#/game` | Questions curated by the team, stored in Upstash Redis. Two types: **Two graphs** (see one measure as bars, draw how a second measure goes with it) and **Continue the line** (see a record up to a point, draw the rest). Each answer is scored and explained. |
| Question admin | `#/game/admin` | Team tool to write questions: guided form with preview, auto-save, edit conflict detection, the last 30 versions of each question, JSON import and export. |
| Hotspot map | `#/hotspot` | A globe of 632 land points (one every 5°) showing only places where air temperature, rainfall, humidity or sunlight has a clear tested trend, 2001 to 2024. |
| World explorer | `#/global` | 195 capital-city coordinates, 8 measurements, monthly or annual views, trend maps and a per-capital trend test with a 95% interval. |
| Thailand explorer | `#/workbench` | Any of Thailand's 77 provinces, 12 measurements in three Earth system layers, live NASA data, trend test, decade comparison and GISTDA flood history. |
| Methods | `#/methods` | How each page tests a trend, and which data it uses. |

## Data

Every trend on the site is computed from the sources below. Periods are monthly, January 2001 to December 2024, unless noted.

### Home and Hotspot map

| Source | Variables | How it is reached | Code |
| --- | --- | --- | --- |
| [NASA POWER](https://power.larc.nasa.gov/) monthly point API (MERRA-2; sunlight from CERES SYN1DEG) | Home: air temperature (`T2M`) at Phuket, 7.88°N 98.39°E. Hotspot: `T2M`, `PRECTOTCORR`, `RH2M`, `ALLSKY_SFC_SW_DWN` at 632 points | Home: fetched live in the browser. Hotspot: precomputed once into `web/public/data/hotspots.json` by `npm run build:hotspots` | `web/src/features/landing/`, `web/scripts/build-hotspots.mjs` |
| [Natural Earth](https://www.naturalearthdata.com/) 1:110m countries (public domain) | Land mask for the hotspot grid, country outlines on the globe | Static file | `web/public/geo/world-countries.json` |
| NASA Blue Marble (public domain), from the [`three-globe`](https://github.com/vasturiano/three-globe) example textures | Earth image at the bottom of the home page, rendered as a horizon over Southeast Asia | Static image | `web/public/images/earth-horizon.webp` |

### World explorer

All values come from a checked-in cache published from the team's local PostgreSQL database. The deployed page makes no NASA request and needs no credentials.

| Source | Variables | Coverage |
| --- | --- | --- |
| NASA POWER monthly point (RE community, v2.10.0) | Air temperature, rainfall, humidity, sunlight | 195 of 195 capitals |
| GLDAS Noah 2.1 monthly, 0.25° (`GLDAS_NOAH025_M.2.1`, DOI 10.5067/SXAVCZFAQLNO), through the Giovanni point service | Soil moisture 0 to 10 cm (`SoilMoi0_10cm_inst`), evapotranspiration (`Evap_tavg`) | 148 capitals complete, 47 coastal or island cells have no land-model data |
| MERRA-2 `M2T1NXAER.5.12.4`, `TOTEXTTAU` (DOI 10.5067/KLICLTZ8EM9D), through Giovanni | Aerosol optical depth at 550 nm (hourly values averaged to complete months) | 195 of 195 capitals |
| OCO-2 GEOS Level 3 daily `OCO2_GEOS_L3CO2_DAY.10r` (DOI 10.5067/Y9M4NM9MPCGH), through Giovanni | Column-average CO₂ (`XCO2`), ppm | 195 capitals, 2015 to 2021 only. Descriptive slope only (see Methods) |
| [REST Countries](https://github.com/restcountries/restcountries) (MPL-2.0) | Capital names and coordinates | `web/public/geo/capitals.json`, licence in `web/public/licenses/` |

Cache files: `web/public/explorer-cache/` and `web/public/co2-cache/`. Details: [GLDAS](docs/global-gldas-soil.md), [AOD and ET](docs/global-giovanni-aod-et.md), [CO₂](docs/global-co2.md), [validation](docs/global-data-validation.md), [cache deployment](docs/vercel-power-checkpoint.md).

### Thailand explorer

| Source | Variables | How it is reached | Code |
| --- | --- | --- | --- |
| NASA POWER monthly point API | Air temperature, daily high, daily low, rainfall, humidity, wind speed, sunlight | Browser calls NASA directly | `web/src/core/data/power.ts` |
| NASA Giovanni time series API | Haze (MERRA-2 AOD 550 nm), satellite rainfall (GPM IMERG V07 monthly), soil moisture, runoff and evapotranspiration (GLDAS Noah 2.1) | Our function `/api/giovanni` with an Earthdata token | `web/api/giovanni.ts`, `web/src/core/data/remote.ts` |
| [GISTDA sphere](https://sphere.gistda.or.th/docs/web-service/disaster-information) flood recurrence API | Years each subdistrict flooded, 2011 to 2023. Shown next to rainfall and runoff for context, not trend tested | Our function `/api/flood` | `web/api/flood.ts` |
| [geoBoundaries](https://www.geoboundaries.org/) (CC BY 4.0) | Thailand's 77 province boundaries | Static file | `web/public/geo/thailand-provinces.json` |

Both functions answered on the production site on 15 November 2026 (`/api/giovanni?variable=AOD&lat=18.79&lon=98.98` and `/api/flood?lat=14.3615&lon=100.5816`).

If a live request fails, three featured place and variable pairs fall back to files in `web/public/datasets/`. **These files are synthetic samples**, and the page labels them "Synthetic sample".

### Guess the graph

Questions are written by the team, so each one carries its own data source. The live database on 15 November 2026 holds seven questions:

| Type | Place | Measures | Source given in the question |
| --- | --- | --- | --- |
| Two graphs | Bangkok | Rainfall and PM2.5, average month | NASA Giovanni: GPM IMERG V07 and MERRA-2 M2TMNXAER |
| Two graphs | Chiang Mai | Rainfall and surface soil wetness, average month | NASA POWER (MERRA-2) |
| Two graphs | Station ALOHA, Hawaii | Seawater CO₂ partial pressure and ocean pH, 2005 to 2024 | Hawaii Ocean Time-series, University of Hawaiʻi |
| Two graphs | Central Himalayas | Winter precipitation and snow detection frequency, 2005 to 2023 | *Not filled in yet* |
| Two graphs | Arctic Ocean | Air temperature anomaly and September sea ice extent, 2005 to 2025 | *Not filled in yet* |
| Two graphs | Nioro du Sahel, Mali | Vegetation greenness (NDVI) and monthly rainfall, average month | *Not filled in yet* |
| Continue the line | Global, 60°S to 90°N | Mid-tropospheric CO₂, Sep 2002 to Feb 2012 | NASA Giovanni: AIRS/Aqua AIRX3C2M V005 |

When nothing is saved yet, the game shows three built-in example questions (`web/src/features/game/rounds.ts`).

## Methods

| Where | Method |
| --- | --- |
| Thailand explorer | Seasonal cycle removed by subtracting each calendar month's mean, then a Mann-Kendall test (two-sided, tie-corrected, α = 0.05) and Sen's slope, reported per decade. Checked against `fixtures/trend-cases.json` (cross-checked with `pymannkendall`). Does not correct for serial autocorrelation, which can overstate significance. |
| World explorer, Hotspot map | **seasonal-sen-cbb-v1**: seasonal Kendall score and Sen slope over matching calendar months, with a whole-year circular block bootstrap (999 replicates, seed 271828) for an approximate 95% interval and p-value. Rainfall uses complete annual totals (mm/year). Results need at least 10 years and 80% valid months, and are marked provisional when records are short, gappy or strongly persistent. See [method and validation](docs/global-trend-method.md). The hotspot map shows a point only when the evidence is a clear increase or decrease. With 632 points tested per measure, some clear results can happen by chance (no multiple-testing correction). |
| World explorer, CO₂ | Descriptive seasonal Sen slope only (2015 to 2021 is seven complete years). No interval, p-value or significance label. |
| Home | Mann-Kendall test and Sen's slope on the 24 yearly means. The change since 2001 is the Sen slope times 23 years. |
| Guess the graph | Score 0 to 100 from the mean distance between the drawn line and the real one, relative to 30% of the axis range. Two graphs also checks the month or year of the highest and lowest point. Continue the line checks the direction (straight-line slope of the drawn part against the real part) and runs the Thailand explorer test on the whole record when its time axis is years or months (monthly records have seasons removed first). |

All trend calculations run in TypeScript in the browser or at build time (`web/src/core/stats/`). NASA POWER, MERRA-2 and GLDAS values are model or reanalysis estimates for a grid cell, not station measurements. A detected trend does not explain its cause.

## Structure

```
contracts/     JSON schemas shared by the pipeline and the web app
db/            Local PostgreSQL migrations for the World explorer cache
docs/          Method, validation and data source notes
fixtures/      Reference trend cases both implementations must match
pipeline/      Python: fetch NASA data, validate, publish caches and datasets
web/           Vite + React + TypeScript app
  api/               Vercel functions: giovanni, flood, questions
  public/            Caches, datasets, hotspots, geography, images
  scripts/           Data validation, cache and hotspot builders
  src/core/          Stats, data loading, geography, i18n
  src/features/      landing, game, hotspot, global, workbench, methods
  src/shared/        Shared chart, map and layout components
```

## Getting started

```bash
cd web
npm install
npm run dev
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local dev server, including the `/api` functions |
| `npm test` | Unit tests |
| `npm run typecheck` | TypeScript check |
| `npm run validate:data` | Check datasets and both caches |
| `npm run validate:trend` | Compare the global trend engine with the Python reference |
| `npm run build:hotspots` | Rebuild `public/data/hotspots.json` from NASA POWER (about 10 minutes, resumable) |
| `npm run build` | Production build into `web/dist` |

Strings live in `web/src/core/i18n/en.ts` and `th.ts`. Add a key to `en.ts` first; the build fails until `th.ts` has it too.

The pipeline and local database are optional and only needed to refresh caches. See `pipeline/` and [db/README.md](db/README.md).

## Deployment

Vercel, **Root Directory** `web`, Vite preset. Every push to `main` deploys to production; pull requests get preview URLs. CI (`.github/workflows/ci.yml`) runs typecheck, tests, data validation and build.

| Variable | Needed by | Notes |
| --- | --- | --- |
| `EARTHDATA_TOKEN` | `api/giovanni.ts` | NASA Earthdata user token. Expires after about 60 days. |
| `SPHERE_KEY` | `api/flood.ts` | GISTDA sphere API key. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | `api/questions.ts` | Upstash Redis for game questions. Two-graph questions use `game:*` keys, continue-the-line questions use `extend:*`. Preview and production share the same database. |

## Use of AI

| Tool | Where | How |
| --- | --- | --- |
| Claude (Anthropic) | Project scaffold, statistics, CI, data connectors, Thailand explorer, map, share and image export | Generated code, reviewed and tested by the team |
| Claude (Anthropic) | Home page, Guess the graph and its admin, Hotspot globe, site design and mockups, this README | Generated code and designs from the team's plans and feedback, tested by the team |
| Claude (Anthropic) | Ideation | Brainstorming the challenge interpretation and story |
| *Add any other tool the team used* | | |

## License

[MIT](LICENSE). Geography: REST Countries (MPL-2.0), Natural Earth (public domain), geoBoundaries (CC BY 4.0). See `web/public/geo/ATTRIBUTION.md`.
