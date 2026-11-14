# Global explorer data milestone

## Scope and live evidence

The pilot run on November 15, 2026 (Asia/Bangkok) covered Bangkok (TH), Oslo (NO),
Cairo (EG), Canberra (AU), and Singapore (SG). Each returned 288 valid monthly
observations for each of the four variables for 2001–2024, with zero missing or
rejected observations: 5,760 monthly values across 20 location-variable records.
Each record yielded 24 complete annual values. These are diverse pilot locations;
this is not validation of all 195 locations, ground-truth accuracy, or the trend method.

The machine-readable evidence is [global-data-validation.json](global-data-validation.json).
Original responses and request metadata are retained locally in
`pipeline/raw/global-validation/` (ignored by Git). Run `npm run validate:global:live`
from `web/` to reproduce the checks against the current service. The script records
partial progress, marks incomplete responses PARTIAL, and exits nonzero on failed
requests or structural validation. It overwrites its report and per-city snapshots.

## Validation contract

NASA POWER's monthly point endpoint supports multiple parameters per request:
https://power.larc.nasa.gov/docs/services/api/temporal/monthly/

The explorer uses the RE community and requests `T2M`, `PRECTOTCORR`, `RH2M`,
and `ALLSKY_SFC_SW_DWN` together. Community-specific units are checked rather than
assumed: https://power.larc.nasa.gov/docs/methodology/communities/

Responses must contain the expected structure and all four variable/unit entries.
Point coordinates must be finite, geographically valid, and within 0.01 degrees of
the requested capital, allowing API coordinate rounding. Reported coordinates are
not labeled as grid-cell centers. Retrieval timestamps and raw source headers are
retained, including when a cached response is used. Cached payloads are revalidated
on restoration; incompatible storage is discarded. Refresh bypasses both caches.

| Variable | Accepted source unit aliases | Conservative monthly screening range |
| --- | --- | --- |
| T2M | C, °C | −100 to 70 °C |
| PRECTOTCORR | mm/day | 0 to 1000 mm/day |
| RH2M | % | 0 to 100% |
| ALLSKY_SFC_SW_DWN | kW-hr/m^2/day, kWh/m^2/day, kWh/m²/day | 0 to 24 kWh/m²/day |

Unit matching is case-insensitive and ignores whitespace. Unknown units are rejected
rather than silently converted. These deliberately broad bounds are application
screening rules, not NASA quality-control flags or guarantees of measurement accuracy.
Negative temperatures and zero rainfall/solar radiation are valid.

Month keys must be YYYYMM with months 01–12 and years 2001–2024. NASA's YYYY13
annual summaries are excluded from the monthly record. Fill values and nulls are
missing; nonnumeric, nonfinite, or out-of-bounds observations are rejected. Both
become nulls for analysis. Absent months are padded; no interpolation occurs.
Duplicate normalized month keys are rejected. All-empty variable records can be
inspected with zero coverage but cannot produce trend statistics.

## Annual calculations and selected years

Only complete calendar years with 12 valid months produce annual values.
For a year with month lengths d and monthly values x:

- Temperature, humidity, daily solar energy: `sum(x × d) / sum(d)`.
- Rainfall: `sum(monthly mean daily rainfall × d)`, displayed in mm/year.
- February has 29 days in leap years; no partial year is scaled to a full year.
- Fully missing years retain a null position. The shared chart breaks its observed
  line and filled area at missing positions rather than joining across gaps.

Rainfall totals are reconstructed from monthly rates and inherit their rounding;
they should not be described as independently measured annual totals. Native
YYYY13 source summaries remain available in saved raw responses, but do not override
the explicit aggregation contract above.

Start/end-year controls are inclusive within 2001–2024. Reversed URL ranges are
ordered, out-of-bound years are clamped, and malformed values use default bounds.
The UI moves the opposite endpoint when needed to keep a valid range. Old links
without year parameters retain the full record. Coverage, annual values, anomaly
baselines, chart inputs, and trend inputs all follow the selected period.

For annual rainfall, statistics operate on annual totals and report mm/year per
decade. Other views use deseasonalized monthly data and the source measurement unit
per decade. Trend inference requires 10 selected calendar years, observations in
10 distinct years, and 80% valid monthly coverage; annual rainfall also requires
10 complete annual totals. These thresholds are product safeguards, not a published
power calculation. Seasonality is removed with the existing calendar-month mean
method, and serial autocorrelation is still uncorrected.

The unit suite covers validation failures, unit mismatch, cache restoration and
refresh, missing years, leap-year weighting, annual rainfall units, short/sparse
records, calendar-preserving gaps, selected-period isolation, and anomaly baselines.
