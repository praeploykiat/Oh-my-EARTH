# MODIS NDVI in Global Explorer

> Archived integration: AppEEARS/NDVI is disabled in the current POWER-only release. Historical instructions below do not describe the active deployment. The pilot fixture is now `pipeline/fixtures/ndvi-pilot.json`.

Current release scope: **Bangkok NDVI pilot, 1 of 195 capitals**. The user selected a labeled pilot release while the batch continues. The global batch remains processing; it is not represented as completed coverage. Unpublished locations have an explicit unavailable state and an action to open a published location. The map load action loads only published locations.

The explorer adds monthly Terra MODIS vegetation greenness from MOD13A3.061, accessed through NASA AppEEARS. It is a dimensionless index of the approximately 1 km sampled pixel at each capital coordinate. An urban, mixed or water-adjacent capital pixel does not represent the vegetation of its country. NDVI is neither percent vegetation cover nor a direct drought measurement.

## Live retrieval and conditional release

The existing AppEEARS token successfully accessed the task list and submitted the extraction. The first live pilot sampled Bangkok (13.75, 100.52) for 2001–2024 with NDVI, VI Quality and pixel-reliability layers. It completed and returned all 288 calendar-month rows. Values such as 0.2658 in January 2001 were already scaled. The strict QA policy retained 4 months, rejected 283 and marked 1 missing; no complete year or reliable trend can be shown for that pixel under this policy. Successful retrieval must not be mistaken for complete usable coverage.

Pilot task: `3cb29fbb-080a-4f88-b2ed-46c07b5ea360`. A single 195-capital task was subsequently submitted: `970961e5-ac1d-4652-9731-a0fc45b8dbd0`. See `global-ndvi-validation.json` for the latest completed validation and CSV hash. Raw result CSVs, QA descriptions, XML metadata and request manifests remain in the Git-ignored sibling workspace folder `nasa_source_tests/output/appeears/extractions/`.

## Quality and scaling contract

- Require product MOD13A3.061, its NDVI layer and both quality layers. Check the current AppEEARS metadata's source scale 0.0001, output floating type and scaled valid range approximately −0.2 to 1.
- AppEEARS result CSVs already contain floating NDVI values. Do not apply 0.0001 a second time. No percentages or Kelvin conversion is appropriate.
- Validate exact capital point IDs and echoed requested coordinates, monthly first-of-month dates, unique point/month keys and calendar positions.
- `good-land-clear-v1` requires pixel reliability 0, MODLAND bits 0–1 equal 0, land/water bits 11–13 equal 1, and no adjacent cloud (8), mixed cloud (10), snow/ice (14) or shadow (15) flag. This is an explicit conservative application screening choice based on NASA QA definitions, not a claim of perfect observation accuracy. Do not relax QA merely to improve coverage.
- Source fill values and absent months remain missing. Rejected QA values become null and are counted separately. Malformed timestamps, wrong coordinates, nonfinite/unscaled/out-of-range values fail validation. Negative NDVI and zero are valid within the product range.
- Water, cloud and snow exclusions can be seasonal or persistent. A location may have no usable annual result. Do not interpolate, move to another pixel, or replace it with POWER/GLDAS values.

## Explorer behavior

POWER remains a four-variable all-in-one direct request. NDVI uses a source-specific record adapter and a validated, published extraction snapshot at `web/public/datasets/global-ndvi.json`. The browser never receives an AppEEARS credential or submits extraction jobs. Updating NDVI requires rebuilding that snapshot; the UI labels it as a snapshot and its reload action only reloads the published file.

The existing map modes apply:

- Trend: matching-calendar-month seasonal Sen/Kendall analysis with existing block-bootstrap intervals and safeguards. Units: NDVI per decade. Missingness and short/dependent records retain existing provisional/insufficient labels.
- Annual average: day-weighted average of 12 valid monthly NDVI composites; complete years only.
- Lowest/highest month: extrema among the selected year's 12 valid monthly composites, including ties; complete years only.
- Monthly/anomaly charts retain calendar gaps. Switching to NDVI defaults its chart to Monthly so available observations are visible even when annual results are unavailable.

Display scales are fixed at −0.2 to 1 for annual/lowest/highest values and −0.1 to 0.1 NDVI per decade for trends. These are display choices, not new quality bounds. The provenance panel reports source units, valid/missing/rejected counts, retrieval time, source products and the QA policy. Echoed AppEEARS coordinates are requested sample coordinates, not a reported pixel centroid.

## Reproduce with the existing nasa_source_tests workflow

Commands run from `C:/Users/User/Documents/nasa_space_app_2026`. These reuse the existing AppEEARS authentication, layer catalog, task submission, polling and token-safe bundle download modules. The saved AppEEARS token must be valid; no credentials should be placed in source code or command arguments.

```powershell
# Submit one capital, or one batch of all 195. Submission prints a resumable task ID.
python -m nasa_source_tests.appeears.ndvi_pilot --submit
python -m nasa_source_tests.appeears.ndvi_pilot --submit --all-capitals

# Resume an existing task; do not submit duplicates while it is processing.
python -m nasa_source_tests.appeears.ndvi_pilot --task-id TASK_UUID --export

# Offline request/QA validator tests (no live results are fabricated).
python -m unittest discover -s nasa_source_tests/tests -q
```

The runner checks once per invocation and reports PENDING while NASA works. After a task is done, it downloads the real CSV and metadata, checks the layer contract and point/time values, retains missing/QA exclusions, and only then exports the browser snapshot. Snapshot metadata contains product, period, units, retrieval time, QA version and task ID; it excludes user/account identifiers and tokens. Country records with no valid observations remain explicitly unavailable for calculations.

Ordinary web tests validate the actual published snapshot's coordinates, units, period and QA count consistency. `npm run validate:data` validates its dedicated JSON schema; the existing featured-dataset schema and catalog are unchanged. The shared chart also now reattaches its size observer when switching from an empty annual view to available monthly values.

## Primary references

- [NASA MOD13 Collection 6.1 user guide](https://modis-land.gsfc.nasa.gov/pdf/MOD13_User_Guide_V61.pdf).
- [NASA MOD13A3 product](https://ladsweb.modaps.eosdis.nasa.gov/missions-and-measurements/products/MOD13A3).
- [AppEEARS API and authentication/extraction workflow](https://appeears.earthdatacloud.nasa.gov/api/).
- [AppEEARS live MOD13A3.061 layer metadata](https://appeears.earthdatacloud.nasa.gov/api/product/MOD13A3.061).

## Pilot release checks

- 133 web tests, 29 source-playground tests and 27 existing Python pipeline tests passed.
- TypeScript/production build, featured and NDVI dataset schema checks, and all 13 independent trend-reference comparisons passed.
- Browser checks covered real Bangkok monthly values and QA counts, withheld annual/trend results, unpublished-capital handling, snapshot loading, POWER switching, Thai/mobile layout and the existing workbench chart.
- The all-capital batch remains a future coverage update; no all-capital success or soil/vegetation accuracy validation is claimed.
