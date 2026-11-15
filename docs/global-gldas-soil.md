# GLDAS soil moisture in Global Explorer

The additional variable is GLDAS Noah 2.1 monthly soil water mass in the top 0–10 cm, retrieved through Giovanni. It is a model estimate, not SMAP soil moisture or a direct satellite/field measurement. The canonical unit is **kg/m²**, not percent. No scale conversion is applied.

## Validation and coverage

The initial live comparison used Bangkok, Cairo, Oslo, Canberra, Brasília, Ottawa, Nairobi and Malé for January 2001–December 2024. The first seven each returned 288 valid months and 24 complete years. Malé returned 288 missing values. A separate repeated Bangkok request produced identical monthly values. See [the pilot evidence](gldas-soil-validation.json).

After this gate passed, all 195 capital points were ingested with at most two concurrent requests. 148 have complete valid records; 47 have no valid values. There are 42,624 valid and 13,536 missing monthly positions, with no range-rejected values. This is coverage and contract validation, not an independent assessment of model accuracy or a guarantee of trend significance. Coarse land-grid representation can leave coastal and island capitals without data.

The adapter verifies product `GLDAS_NOAH025_M.2.1`, DOI `10.5067/SXAVCZFAQLNO`, parameter `SoilMoi0_10cm_inst`, source unit `kg m-2`, fill value `-9999`, 0.25° grid resolution, requested period, first-of-month timestamps, duplicate/extra months, finite values and a conservative 0–100 kg/m² screening range. Fill/absent months remain null; nonfinite or out-of-range values are counted separately as rejected. Giovanni supplies no per-month QA flags in this response, so the policy is called `gldas-soil-screen-v1`, not satellite quality assurance.

Each response must name the exact containing grid cell. For Bangkok the capital coordinate is 13.7500, 100.5200; the GLDAS cell centre is 13.8750, 100.6250. Both are retained and displayed. The explorer ingestion path never uses the Workbench proxy's neighbouring-cell fallback. Existing Workbench behavior is unchanged.

Annual values are day-weighted means of monthly soil moisture, requiring all 12 valid months. Lowest/highest are the extrema of monthly means, with tied months retained; they are not daily extrema. Trend analysis reuses the existing seasonal Sen/Kendall engine, whole-year residual block resampling, confidence intervals, and completeness/autocorrelation safeguards. Annual chart display does not switch soil-moisture inference to rainfall totals. Model changes, forcing uncertainty, frozen soil and nonstationarity can still affect interpretation. A soil-moisture trend alone does not establish drought or causation.

## Local preparation, static deployment

The browser reads published JSON only. Vercel needs no PostgreSQL connection or Earthdata token for Global Explorer. Keep the current and prior release directories available for pinned clients and deploy the complete cache with the normal Vite build. PostgreSQL remains local; AppEEARS/NDVI remains disabled.

The private ingestion credential is `EARTHDATA_TOKEN`, read from the process environment first, then `web/.env`, `pipeline/.env`, or the sibling source-test environment. The working regenerated web token is used without overwriting the older source-test token. Tokens are sent only in an HTTPS authorization header to the fixed Giovanni endpoint; redirects are refused, and no credential is stored in artifacts, public URLs or JSON. Source links contain only product, coordinates and dates.

From the repository root:

```powershell
./pipeline/.venv/Scripts/python.exe pipeline/validate_gldas.py
./pipeline/.venv/Scripts/python.exe pipeline/database.py migrate
./pipeline/.venv/Scripts/python.exe pipeline/worker.py enqueue-gldas --countries all
./pipeline/.venv/Scripts/python.exe pipeline/worker.py run --source gldas --max-jobs 195 --workers 2
./pipeline/.venv/Scripts/python.exe pipeline/publish_cache.py
npm --prefix web test
npm --prefix web run validate:data
npm --prefix web run build
```

The live validator saves original responses privately under ignored `pipeline/raw/gldas-validation/`. Ingestion reuses these for an initial generation when available, and uses checksummed job artifacts on resume. Identical enqueue calls are idempotent. Refresh intentionally with a new `--generation` value. Failed jobs retain checkpoints and bounded retries; they do not erase the published snapshot. The current release is enabled in `web/src/features/global/sourceSettings.json`; no always-running cloud service or automatic production deployment is required.

The only database schema change is additive migration `003_gldas_source.sql`, extending source identities. Applied migrations 001 and 002 are unchanged. Source products, units, QA policies and actual response cell centres remain distinct from POWER within each capital's cached file.

References: [NASA GLDAS dataset description](https://ldas.gsfc.nasa.gov/gldas/dataset), [NASA GLDAS Version 2 README](https://hydro1.gesdisc.eosdis.nasa.gov/data/GLDAS/GLDAS_NOAH025_M.2.1/doc/README_GLDAS2.pdf). The README describes monthly files as averages of their 3-hourly inputs; the `_inst` suffix does not make the monthly product a single instantaneous reading.
