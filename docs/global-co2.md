# CO₂ in Global Explorer

CO₂ is enabled as **Atmospheric CO₂ (column average)**, in **ppm**, using the validated OCO-2 GEOS Giovanni cache for all 195 capitals. Selecting it defaults to Trend per decade over 2015–2021. Users can select a period within those years and switch among monthly, annual and anomaly chart views. Annual averages, lowest month and highest month retain the single-year selector and fixed 390–430 ppm legend. The trend legend uses −30 to +30 ppm per decade.

CO₂ now supports a **descriptive seasonal Sen slope**, expressed in ppm per decade. It compares every pair of matching calendar months between years and takes the median of all those annual rates, multiplied by ten. The point estimator matches [SciPy's seasonal Sen implementation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.mstats.sen_seasonal_slopes.html). It is unchanged by monthly, annual or anomaly display. The chart shows a reference slope line and a signed numeric estimate. For Bangkok, the 2015–2021 estimate is +24.9637 ppm per decade.

A per-decade rate is a unit conversion, not a requirement to observe ten years. Seven complete years support a descriptive point estimate, but the production uncertainty procedure still requires at least ten. **No CO₂ confidence interval, p-value, significance classification or forecast is provided.** All CO₂ trend markers are hollow and their tooltips explain this limit. A conservative display rule requires at least three complete calendar years with every monthly value; shorter or incomplete selected periods have no slope. Other variables retain the validated inference engine unchanged. Deep links and period selectors stay within 2015–2021.

The product is **OCO2_GEOS_L3CO2_DAY.10r, XCO2**, DOI [10.5067/Y9M4NM9MPCGH](https://doi.org/10.5067/Y9M4NM9MPCGH). It combines satellite retrievals and atmospheric modelling into assimilated dry-air column-average concentration. It is not surface CO₂, emissions or local air pollution. Source mole fractions are converted to ppm before daily-to-monthly aggregation. Every calendar day must be valid for a monthly mean; annual means weight complete monthly means by calendar days. Lowest/highest compare monthly means, not daily extremes. No interpolation or neighbouring-cell substitution is used.

The underlying cache preserves 86 months from January 2015 through February 2022. Only the seven complete calendar years are selectable or mapped; partial 2022 is not presented as an annual value. Downloads preserve source metadata, model grid coordinates and retrieval timestamps. English and Thai explain the product, screening, units and descriptive-only trend limitations.

## Static deployment and refresh

`web/public/co2-cache/manifest.json` points to immutable checksum-protected capital and annual-map files. The reader pins the manifest during a session; **Reload published data** resets both CO₂ and existing source caches. Missing/corrupt files produce a retryable error, with no NASA fallback. CO₂ uses a separate manifest because its shorter period and descriptive-only slopes differ from the original 2001–2024 release. Existing POWER/GLDAS/AOD/ET assets are unchanged.

Vercel needs **no database, ingestion worker, Earthdata token or NASA request for Global Explorer**. Deploy the app together with both public cache directories. The CO₂ release adds approximately 1.65 MB. Private compressed daily artifacts remain ignored in `pipeline/raw`; review evidence in `docs` is not copied into the Vite deployment. Existing Workbench live services retain their separate upstream requirements.

Local refresh commands, from the repository root:

```powershell
./pipeline/.venv/Scripts/python.exe pipeline/co2_review.py
./pipeline/.venv/Scripts/python.exe pipeline/verify_co2_review.py
./pipeline/.venv/Scripts/python.exe pipeline/validate_co2_trend.py
./pipeline/.venv/Scripts/python.exe pipeline/publish_co2_web.py
npm --prefix web test
npm --prefix web run validate:data
npm --prefix web run build
```

Local PostgreSQL stores CO₂ in the isolated review table created by migration 005. The existing 2001–2024 observation publisher never selects this table. Re-running ingestion resumes from validated artifacts without new requests for completed capitals; only one sequential NASA request runs at a time. The web publisher reads the validated candidate assets without a database connection, verifies their checksums, copies immutable files first and switches the manifest last. An intentional source refresh must use newly reviewed raw artifacts; the normal resume command does not automatically re-download saved capitals.

`npm run validate:data` verifies all existing published files and every CO₂ capital and annual map using the production readers. CO₂ map values and extreme months are compared against the shared aggregation applied to monthly records. Dedicated tests forbid external requests, check ppm conversion semantics, reject corrupt checksums, verify retry behavior and prevent inference even for an artificially enlarged selected period.

See [the historical pre-integration review](co2-review.md) and [independent daily-data validation](co2-review-verification.json). No deployment or commit is performed automatically by this integration.

## Descriptive trend publication and validation

The web publisher also derives a checksum-addressed default-period trend map from saved monthly files. It writes the immutable `co2-cache/trends/<sha256>.json` first and then updates the manifest. Each slope references the exact source release. Custom-period maps derive the same estimator from saved capital files with at most two concurrent static downloads, without NASA or database calls. The legacy manifest `trendAvailable: false` continues to mean that bootstrap inference is unavailable; `descriptiveTrendAvailable` and the separate descriptive map reference expose the point estimates.

`pipeline/validate_co2_trend.py` produces 211 independent SciPy references: all 195 full-period capital estimates plus selected shorter periods for four capitals. Tests compare the browser estimator to these references, cover seasonal offsets, decreasing/zero slopes and incomplete periods, and ensure no confidence bounds are attached. Full cache validation verifies 203 CO₂ assets, including the descriptive map, against shared aggregation. All 169 web tests and a production build with an invalid database URL passed. Local browser verification covered the default and custom CO₂ periods, insufficient periods, annual summaries, switching back to POWER and existing routes without console errors. See [the trend verification report](co2-trend-integration.json). These checks do not certify a live Vercel deployment or live Workbench upstream service availability.
