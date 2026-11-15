> Historical pre-integration review. The user subsequently approved CO2 web integration; see [current behavior and deployment](global-co2.md).

# Atmospheric CO₂ candidate — awaiting user verification

The full candidate is prepared for review. CO₂ is **not implemented on the web**: this CO2 task changed no web files, variable registry or active cache manifest, and no Vercel deployment was performed. Review files are outside `web/public` and the deployed app does not access the review database.

## Product and coverage

Giovanni's live configured-variable catalog lists `OCO2_GEOS_L3CO2_DAY_10r_XCO2`. This is OCO-2 GEOS assimilated dry-air column-average CO₂. It combines satellite observations with atmospheric modelling. It is not surface concentration, national emissions, local pollution, or a direct observation at every capital. The native grid is 0.5° latitude × 0.625° longitude; each record retains the actual grid-cell centre separately from the capital coordinate.

NASA collection metadata starts in June 2014, but the four initial pilot responses all start in January 2015. The global review therefore requests the actual returned period, **January 2015–February 2022**. Complete calendar years are **2015–2021**.

Only seven complete years are available. The existing production trend engine requires at least ten; the candidate contains **no trend estimate, significance result, confidence interval or trend map**. That safeguard must stay intact if this product is approved for display. A value-exploration mode or a longer compatible product needs a separate design decision.

## Validation and values

All 195 capitals completed successfully: 510,120 valid daily values produced 16,770 complete monthly means. Source mol CO₂/mol dry-air values are multiplied by 1,000,000 to obtain ppm. The adapter verifies product, DOI, units, fill sentinel, timestamps, duplicates and actual model grid. Nonfinite values or concentrations outside the broad implementation guard of 250–600 ppm fail validation. This is numerical screening, not a physical accuracy certification; per-retrieval QA flags are not available in this CSV.

Every expected daily value is required for a monthly mean. Annual means are weighted by calendar days and require all 12 valid months. Lowest/highest months are extrema of monthly mean concentration, not daily extremes. The two months in 2022 remain available monthly; all 2022 annual summaries are null. No interpolation or neighbouring-cell substitutions are made.

Independent NumPy calculations matched all monthly values within 2.28e-13 ppm. All 195 capital files and eight annual summary files passed checksum and aggregation checks. The current candidate release is **1.65 MB**; an earlier retained monthly-only review release brings total review assets to approximately 3.10 MB.

Sample day-weighted annual averages:

| Capital | 2015 (ppm) | 2021 (ppm) |
|---|---:|---:|
| Bangkok | 400.55 | 416.21 |
| Oslo | 399.66 | 415.05 |
| Canberra | 397.50 | 412.20 |
| Malé | 399.54 | 414.90 |

## Local maintenance

```powershell
./pipeline/.venv/Scripts/python.exe pipeline/co2_review.py
./pipeline/.venv/Scripts/python.exe pipeline/co2_review.py --publish-only
./pipeline/.venv/Scripts/python.exe pipeline/verify_co2_review.py
```

Run only one ingestion process at a time. It sends one NASA request at a time, validates the response, saves compressed checksum-protected checkpoints to ignored `pipeline/raw/co2-review`, and upserts monthly records into local PostgreSQL table `earth.co2_review_records`. Additive migration 005 creates this isolated table; the production observation publisher never selects it. Re-running resumes from existing valid artifacts without requesting completed capitals. Failed capitals prevent publication; invalid checkpoint checksums require inspecting the affected artifact.

Publication reads local review records and writes monthly capital files and annual summaries to `docs/co2-candidate-cache/releases/<releaseId>/`. The candidate manifest switches last, only after all 195 records exist. `--publish-only` makes no NASA requests. Credentials stay private, travel only in authorization headers to the fixed HTTPS service, and redirects are refused. The candidate files passed a credential scan. Raw daily data stay private and ignored.

## Existing application checks

160 web tests and 91 pipeline tests passed, including six dedicated CO₂ review tests. Active cache validation and the production build passed with an invalid database URL. Local production-browser checks passed for World Explorer, Thailand Explorer, Guess the Graph, Hotspot Map, Methods and Landing, with no console errors. These checks do not certify live Vercel deployment or upstream NASA service availability for Workbench. The existing deployed explorer still needs no database connection.

Review [the full verification report](co2-review-verification.json), [candidate manifest](co2-candidate-cache/manifest.json), and [initial pilot evidence](co2-pilot-validation.json).

Before web work, the user must verify acceptance of the assimilated column-average product, 2015–2021 complete-year coverage, ppm values, and exploration without trend inference. Enabling the variable in the active web release awaits that explicit verification.

Sources: [NASA product DOI](https://doi.org/10.5067/Y9M4NM9MPCGH), [NASA CMR collection metadata](https://cmr.earthdata.nasa.gov/search/collections.json?short_name=OCO2_GEOS_L3CO2_DAY), [Giovanni configured-variable catalog](https://api.giovanni.earthdata.nasa.gov/configured-variables).

A separate edit to `web/src/styles.css` appeared after the production build/browser checks. It was left untouched; those checks cover the build before that independent styling edit.
