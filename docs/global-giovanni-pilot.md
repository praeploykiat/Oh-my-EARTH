# Second-source pilot: GLDAS soil moisture via Giovanni

Decision: recommend GLDAS Noah 2.1 monthly soil moisture at 0–10 cm as the first additional Global Explorer variable, conditional on successful access with the intended server credential. Current live access is BLOCKED. No variable has been enabled in the explorer and no existing connector, authentication setting, or credential has been changed.

## What was inspected

- `nasa_source_tests/power/`: numerical daily POWER values and regional requests.
- `nasa_source_tests/gpm/precipitation.py` and `smap/soil_moisture.py`: CMR granule discovery, not numerical extraction. Their saved November 14 reports show socket restrictions, not successful science-data retrieval.
- `nasa_source_tests/appeears/`: a separate authenticated extraction workflow and saved MOD11A2.061 land-surface temperature results. This is neither Giovanni nor GLDAS; SMAP SPL3SMP is also a different product from GLDAS soil moisture.
- Workbench: `web/src/core/data/variables.ts`, `remote.ts`, `web/api/giovanni.ts`, `_proxy.ts`, parser tests, and the previous Giovanni investigation.

## Recommended source and variable

| Item | Selection |
| --- | --- |
| Scientific source | GLDAS Noah 2.1 land-surface model |
| Access service | NASA Giovanni cloud time-series service |
| Existing variable key | `SOIL_MOISTURE` |
| Catalog product | `GLDAS_NOAH025_M_2_1_SoilMoi0_10cm_inst` |
| Quantity | Monthly mean water mass per unit area in the top 0–10 cm of soil |
| Units | kg/m², not percent and not SMAP volumetric moisture |
| Source resolution | 0.25° monthly grid |
| Source history | January 2000 onward; overlaps the explorer's 2001–2024 selection |
| Existing workbench scale | 1; no rainfall or flux conversion |

This is a useful new land-water quantity, with a natively monthly product and an existing connector. It avoids the subdaily aggregation and rate-unit conversions needed by other candidates. It should be labeled as modeled soil moisture, not a direct satellite measurement or country average. The product is a land dataset: water masks and coastal/island grid cells can yield missing observations. NASA documents a land-mask reprocessing and forcing changes; these matter when interpreting trends. A catalog match and nominal coverage do not prove every capital has data.

## Live checks performed

The opt-in pilot loads the existing `EARTHDATA_TOKEN` in memory, then imports the actual workbench URL builder, CSV parser, and API handler through Vite SSR. It makes no credential-file edits and does not log tokens or substitute alternate authentication. The first sandbox run encountered local network restrictions; the recorded report is from the subsequent network-enabled run.

| Check | Observed result |
| --- | --- |
| Current configured-variable catalog | HTTP 200; selected product is listed |
| Direct Bangkok request, January–December 2023 | HTTP 500, `{"message":null}`; zero parsed observations |
| Same direct request without authentication | HTTP 403, `Bad or missing token` |
| Existing workbench handler, Bangkok 2001–2024 | HTTP 502 reporting upstream HTTP 500; zero parsed observations |
| Cairo/Oslo numerical checks | Not run: gated on a successful small Bangkok request to avoid repeating an access failure |
| Annual summaries, lowest/highest month, trend, global map coverage | Not validated against live soil-moisture observations because no numeric response was returned |

See `global-giovanni-pilot.json` for timestamps, safe request URLs, elapsed times and exact statuses. The upstream 500 is reproducible outside the application. This rules out our proxy as the sole cause of that particular failure, but does not distinguish service, token compatibility, or account-access causes. It does not prove the generated token is invalid. Further authentication changes remain outside this pilot.

Reproduce from the repo's `web` directory:

```powershell
node scripts/probe-giovanni-soil.mjs
```

Exit 0 means all pilot gates passed; exit 1 means access/data gates remain blocked. A rerun overwrites the JSON report. Validated successful CSVs, if obtained, are retained only in ignored `pipeline/raw/global-giovanni-pilot/`. A successful short request requires 12 valid 2023 monthly values, recognized kg/m² units and values between 0 and 100 kg/m² as a broad application screening check, not a NASA quality flag. Full-range checks require 288 valid months. Completing this pilot would still not establish global coverage or scientific measurement accuracy.

## Integration contract after access succeeds

1. Validate Bangkok, Cairo and Oslo first, then coastal/island capitals to inspect masks and actual returned grid metadata. Preserve requested and sampled coordinates; never silently substitute a neighboring point.
2. Add source-specific variable definitions and fetching. The current global `GlobalRecord` requires all four POWER variables in one response; a Giovanni variable needs its own record/provenance contract, not a fifth POWER request parameter.
3. Preserve CSV units, product/version, fill value, timestamp, source grid metadata and retrieval time. The existing workbench parser/proxy discards much of this metadata, averages all observations into monthly buckets, and can try neighboring coordinates when values are empty. Those behaviors need explicit handling in the new global adapter; leave legacy workbench behavior stable.
4. Annual average: day-weighted monthly mean, requiring 12 valid months. Lowest/highest month: extrema of the selected year's monthly mean soil moisture, including ties. Never sum soil moisture across a year or apply rainfall multipliers.
5. Trend: reuse seasonal monthly analysis and the existing conservative eligibility/uncertainty safeguards; report kg/m² per decade. Numeric parity of the general engine does not validate this source's scientific suitability by itself.
6. Define and review soil-specific fixed display scales from representative validated records. Do not reuse temperature, humidity or precipitation scales. Show missing land-grid values explicitly.
7. Keep global batch loading disabled for this source until server access, response time, caching and rate limits are established. Add one selected-capital path first.

## Primary sources

- [NASA GLDAS monthly product description](https://data.nasa.gov/dataset/gldas-noah-land-surface-model-l4-monthly-0-25-x-0-25-degree-v2-1-gldas-noah025-m-at-ges-di-23acd): history, temporal averaging, model, resolution, forcing changes and land masks.
- [NASA Giovanni configured-variable catalog](https://api.giovanni.earthdata.nasa.gov/configured-variables): live product availability checked by the pilot.
- [NASA published time-series tutorial](https://github.com/nasa/gesdisc-tutorials/blob/main/notebooks/How_to_Access_GiC_Time_Series_Service.ipynb): request fields, authentication and CSV metadata structure.
- [NASA GLDAS variable metadata](https://hydro1.gesdisc.eosdis.nasa.gov/opendap/GLDAS/GLDAS_NOAH025_M.2.1/2026/GLDAS_NOAH025_M.A202605.021.nc4.dmr.html): soil-moisture units and fill value.
