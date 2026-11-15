# NDVI suitability review — partial, 2026-11-15

> Archived integration: AppEEARS/NDVI is disabled in the current POWER-only release. Historical instructions below do not describe the active deployment. The pilot fixture is now `pipeline/fixtures/ndvi-pilot.json`.

Recommendation: retain the MODIS NDVI connector and labeled pilot as experimental, but defer NDVI from the core MVP until multi-capital validation passes. Bangkok alone cannot support the current trend or annual modes. No QA rule, observation, map, or published coverage was changed by this audit.

## Evidence measured from the original CSV

Product MOD13A3.061; 1 km monthly composite at Bangkok 13.75, 100.52; January 2001–December 2024. The original AppEEARS task is `3cb29fbb-080a-4f88-b2ed-46c07b5ea360`. The audit validates the product, period, requested coordinates, monthly timestamps, range, source units/scaling assumption, and QA using the production parser. It decodes the raw quality flags independently for explanation. The machine-readable report contains the CSV SHA-256.

| Result | Months |
|---|---:|
| Source rows | 288 |
| Source fill/missing | 1 |
| Retained under current QA | 4 (1.39%) |
| Rejected under current QA | 283 |
| Complete annual records | 0 |
| Years with any retained month | 3 (2002, 2003, 2004) |

Pixel-reliability categories among the 287 non-fill months are: good 13, marginal 112, cloudy 162. The current policy requires good reliability; that rejects 274 months immediately. Of the remaining 13, nine have land/water mask code 2 (shoreline), leaving four pure-land observations. The other strict rules remove no additional months after these two steps. The four retained NDVI values range from 0.2422 to 0.2919.

Other raw flags, counted independently with overlaps, are: non-good MODLAND 229 (162 code 2 and 67 code 1), shoreline 166, adjacent cloud 83, mixed cloud 28, possible shadow 58, and snow 0. These counts must not be summed as distinct rejected months. The product's shoreline classification is a QA flag; this audit does not establish an exact ground land-cover type or attribute the flag to a particular river/coast feature.

The current parser matches the documented bit positions for MOD13A3. This is not a reversed-bit or double-scaling error. AppEEARS values are already scaled floating NDVI; they are not multiplied by 0.0001 again. The original product's raw integer scale and AppEEARS layer metadata are documented separately in the original source validation.

## Sensitivity diagnostics, not proposed production policies

- Ignoring only the land-only restriction would retain 13/288 months (4.51%).
- Allowing marginal reliability while keeping all other current rules still retains only 4 months.
- Even accepting every good or marginal summary category, ignoring all other restrictions, yields at most 125/288 (43.40%). This is an upper bound for policies excluding cloudy summary observations, not an approved filter.

None approaches the current trend coverage requirement of at least 80% over at least 10 observed years. No complete annual record exists under the current policy. Filling cloudy months, substituting zero, or loosening rules merely to produce a trend would not establish adequate data quality.

## Multi-capital validation: not completed

The planned comparison uses the exact catalog coordinates for Bangkok (TH), Canberra (AU), Brasília (BR), Ottawa (CA), Nairobi (KE), and Madrid (ES), with the same product, 2001–2024 period, and QA policy. These contrasting locations are a diagnostic sample, not a representative global performance estimate.

The existing 195-capital task `970961e5-ac1d-4652-9731-a0fc45b8dbd0` was not resubmitted. At this check, public AppEEARS product metadata returned HTTP 200, while authenticated task retrieval and listing returned HTTP 403. The response did not specify whether the token expired, was revoked, or lacked access; expiry is not confirmed. No reusable username/password is stored for an automatic login. No additional capitals have been claimed as validated.

The user was asked to refresh the AppEEARS token privately using the existing login script. This is required to retrieve the existing task or submit a bounded six-capital validation task if the global task is still pending. A separate public ORNL subset endpoint was probed as a fallback, but did not provide usable data during this check; it is not evidence of a permanent service outage.

After refresh, inspect the existing task first and reuse its completed results. If it remains incomplete, submit at most one named six-capital validation task and persist its task ID before any later resumption. Audit its saved CSV before importing or publishing. Compare valid fraction, complete years, coverage by calendar month, and dominant failure reasons. Passing the coverage gate alone does not guarantee a valid trend; the existing seasonality/autocorrelation safeguards still apply.

Refresh from the workspace root (prompts privately; do not paste credentials into chat):

```powershell
./space-apps-challenge-th/pipeline/.venv/Scripts/python.exe nasa_source_tests/appeears/auth.py
```

The existing production ingestion job may have exhausted its bounded retries while access was unavailable. After verifying refreshed access, resume it explicitly with `python pipeline/worker.py retry --id 196` from the repository root; this preserves the task ID and checkpoints. A website login alone does not update the saved API token.

## Reproduction

From the repository root, provide the saved AppEEARS CSV and task JSON:

```powershell
./pipeline/.venv/Scripts/python.exe pipeline/audit_ndvi.py --csv PATH_TO_RESULTS_CSV --task PATH_TO_TASK_JSON --output docs/ndvi-capital-audit.json
./pipeline/.venv/Scripts/python.exe -m pytest pipeline/tests/test_ndvi.py pipeline/tests/test_ndvi_audit.py -q
```

The audit is offline and does not publish data or make API calls. Alternative-policy counts are clearly separated from production accepted observations.

Sources: [MODIS Collection 6.1 VI User Guide, tables 4–5 and section 7](https://lpdaac.usgs.gov/documents/621/MOD13_User_Guide_V61.pdf); [NASA MODIS VI validation status](https://modis-land.gsfc.nasa.gov/ValStatus.php?ProductID=MOD13A3). Numerical capital findings come from the saved NASA CSV, not these general documents.
