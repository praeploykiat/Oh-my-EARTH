# AOD and evapotranspiration through the shared Giovanni service

Both additions use the existing Earthdata token and Giovanni point endpoint, but preserve distinct scientific products and model grids. PostgreSQL remains a local preparation tool. The deployed Global Explorer reads published monthly files and map summaries, without NASA requests, credentials or a database connection.

| Variable | Scientific product | Source sampling | Canonical monthly value |
|---|---|---|---|
| Aerosol optical depth at 550 nm | MERRA-2 `M2T1NXAER.5.12.4`, `TOTEXTTAU` | Hourly midpoint values; 0.5° latitude × 0.625° longitude | Dimensionless mean of a complete calendar month's hours |
| Evapotranspiration | GLDAS Noah `GLDAS_NOAH025_M.2.1`, `Evap_tavg` | Monthly mean flux; 0.25° land grid | Source kg/m²/s multiplied by 86,400 to mm/day |

## Validation

The live pilot covers Bangkok, Cairo, Oslo, Canberra, Brasília, Ottawa, Nairobi and Malé for 2001–2024. Each AOD response contains 210,384 hourly values (including leap days), yielding all 288 monthly means. Seven ET capitals have all 288 valid monthly values; Malé's land-model cell is entirely missing. Independent NumPy monthly calculations match all 16 pilot series within floating-point tolerance; the largest difference is about 1.1e-15. See [the pilot evidence](giovanni-expansion-validation.json).

Source metadata must match the exact product, parameter, DOI, units, fill sentinel, temporal coverage, and actual model cell. AOD uses nearest MERRA-2 grid centres. ET uses the containing GLDAS cell. No neighbouring land cells replace missing coastal/island data. Neither dataset provides observational QA flags in this CSV; `giovanni-monthly-screen-v1` describes numerical and completeness screening only.

AOD's fill value is **positive 1e15**. It must be masked before averaging; the legacy Workbench parser's negative-fill convention is insufficient for this source. Missing, nonfinite, negative, or greater-than-100 source AOD values are excluded. Every expected calendar hour must be valid for the month to be published; incomplete months remain null. Hourly expected/present/valid counts are retained in the cached provenance. Annual AOD means require all 12 monthly means and are weighted by calendar days. Lowest/highest mean the extrema of monthly means, not hourly peaks. AOD represents the atmospheric aerosol column, not surface PM2.5 or an air-quality index.

ET signed rates are preserved, including small negative values found in Cairo and Oslo. Negative net fluxes can represent condensation; the adapter does not turn them into zero or claim gross water loss. A broad −100 to 100 mm/day screening range is an implementation safeguard, not a physical accuracy certification. Annual ET is the sum of monthly daily rates multiplied by calendar days, in mm/year. Lowest/highest months compare monthly totals in mm/month. Complete annual records require all 12 valid months.

Default and custom-period trends use the existing validated seasonal Sen/Kendall and year-block bootstrap engine, 999 replicates and seed 271828. Annual ET trends use annual totals, just as annual rainfall does; monthly ET uses monthly daily rates. AOD always uses matching-month seasonal inference even when its chart displays annual means. Confidence intervals remain exploratory, with the existing gaps, autocorrelation and record-length safeguards. The GLDAS/MERRA-2 labels identify model/reanalysis data; trends do not establish causation, drought or health outcomes.

## Published global coverage

All 390 capital-variable jobs completed successfully. AOD has 195 complete records (56,160 valid monthly values). ET has 148 complete records (42,624 valid months) and 47 all-missing land-model cells (13,536 missing months). No neighbouring cells were substituted and no months were range-rejected.

## Local maintenance and deployment

```powershell
./pipeline/.venv/Scripts/python.exe pipeline/validate_giovanni.py --resume
./pipeline/.venv/Scripts/python.exe pipeline/database.py migrate
./pipeline/.venv/Scripts/python.exe pipeline/worker.py enqueue-giovanni --variable EVAPOTRANSPIRATION --countries all
./pipeline/.venv/Scripts/python.exe pipeline/worker.py enqueue-giovanni --variable AOD --countries all
./pipeline/.venv/Scripts/python.exe pipeline/worker.py run --source giovanni --max-jobs 390 --workers 2
./pipeline/.venv/Scripts/python.exe pipeline/publish_cache.py
npm --prefix web test
npm --prefix web run validate:data
npm --prefix web run build
```

Omit `--resume` to fetch a fresh pilot. Initial ingestion reuses validated pilot artifacts. New downloads are compressed privately as `.json.gz`; restart recovery verifies artifact checksums before importing. Jobs identify source, variable, capital, period and generation. Repeating an enqueue is idempotent; use a new generation for an intentional refresh. There are at most two simultaneous requests, and browser interactions never enqueue jobs. Raw hourly records stay in ignored `pipeline/raw/`; only monthly values, completeness counts and prepared maps are published.

The private token is read by the shared credential helper, preferring the process environment and the existing web environment over the older source-test environment. Tokens are sent only in HTTPS headers to the fixed service, with redirects refused. They never enter public JSON or source URLs. AppEEARS/NDVI remains disabled. Existing Workbench connectors are unchanged; the stronger AOD normalization is part of the Global Explorer pipeline.

Apply additive migration 004; do not edit prior applied migrations. Commit the intended cache release and application changes together before a normal Vercel deployment. Retained older immutable releases support already-open clients. No cloud database, background cloud server or user login is required by the deployed explorer.

Primary references: [NASA MERRA-2 file specification](https://gmao.gsfc.nasa.gov/pubs/docs/Bosilovich785.pdf), [NASA GLDAS model output](https://ldas.gsfc.nasa.gov/index.php/gldas/model-output), [NASA GLDAS Version 2 README](https://hydro1.gesdisc.eosdis.nasa.gov/data/GLDAS/README_GLDAS2.pdf).
