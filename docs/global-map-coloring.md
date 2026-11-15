# Global explorer map coloring

Map colors describe NASA POWER grid observations at the 195 capital coordinates, not national averages. Boundaries remain geographic context. A gold halo identifies the selected capital without replacing its data color.

## Modes and time controls

Trend per decade is the default. It uses the inclusive start/end year controls and the existing monthly, annual, or anomaly chart views. Annual average (Annual rainfall total for precipitation), Lowest month, and Highest month each use a single calendar-year selector. The multi-year range and chart view remain saved when switching to a year mode and are restored when returning to Trend.

URLs retain country, variable, view, start, end, mode and year. Supported mode values are trend, average, lowest and highest. Missing/invalid modes default to trend; missing/malformed years default to 2024, numeric four-digit years clamp to the available 2001–2024 period. Existing links without mode/year remain compatible.

Year modes show a selected-city summary and its 12-month chart. Matching extreme months are marked in gold; tied months are all listed in both the summary and marker tooltip. Rainfall charts show monthly totals in mm/month, even when the summary is an annual total in mm/year. A one-year view does not run or display trend significance inference.

## Aggregation and inference

All three year summaries require 12 valid monthly observations. Missing or rejected months are not zero and do not yield a partial-year minimum/maximum; available observations remain visible in the chart with gaps.

- Annual average: day-weighted mean of monthly values, including leap days, for temperature, humidity and solar radiation.
- Annual rainfall total: sum of monthly mean daily precipitation (mm/day) multiplied by days in each month. Totals are approximate because the returned rates are rounded.
- Lowest/highest month: minimum/maximum monthly mean for temperature, humidity and solar radiation; minimum/maximum estimated monthly precipitation total for rainfall. These do not identify individual daily extremes. Month labels include the actual Gregorian year.

Trend retains prepareGlobalAnalysis and analyzeGlobalTrend (seasonal-sen-cbb-v1, 999 resamples), including eligibility, seasonality, serial dependence and uncertainty safeguards. Annual rainfall view uses annual totals; other views use the seasonal monthly method. Units are per decade. Filled points require increase/decrease evidence across tested blocks. Hollow colored rings show slope magnitude with inconclusive, sensitive or limited evidence. Hover/focus includes the estimate, period, evidence and primary exploratory interval. Individual exploratory tests have no global multiple-testing correction.

## Loading and result consistency

The selected location loads automatically. Load all capitals explicitly starts a two-consumer queue. Successful responses reuse the existing validated all-four-variable memory/session cache. Failures remain retryable. Stop prevents further queue requests; in-flight requests may finish. Variable, mode, year and period changes reuse loaded records. Navigating away prevents late state updates. No new dependencies, API endpoints or credentials are required.

Trend work runs sequentially in Web Workers, terminated on configuration changes or unmount. Results cache by variable, range, annual-rain basis, capital and retrieval timestamp. Stale configuration results are hidden immediately. Refreshing the selected chart updates the map record too.

## Fixed display scales

These are display choices, not physical limits or quality-control thresholds. Outliers retain their numeric values and use the endpoint color. Scales stay fixed when locations load or years change.

| Variable / basis | Annual average or total | Lowest/highest month | Trend per decade |
| --- | --- | --- | --- |
| Temperature, °C | -20 to 35 | -20 to 35 | -1 to 1 |
| Rainfall | 0 to 4000 mm/year | 0 to 700 mm/month | -300 to 300 mm/year in annual view; -1 to 1 mm/day otherwise |
| Relative humidity, % | 0 to 100 | 0 to 100 | -5 to 5 |
| Solar energy, kWh/m²/day | 0 to 8 | 0 to 8 | -0.5 to 0.5 |

Year-mode colors are sequential. Trend colors diverge blue–neutral–red around zero. Dashed gray points have no usable summary; accessible labels distinguish pending/calculating, insufficient data and failures. Zero remains valid. Point selection supports pointer, Enter and Space; the country selector provides another keyboard route.

## Verification

Fourteen map-data tests cover aggregation, leap years, selected-year isolation, ties, zeros, negative values, incomplete records, URL defaults/bounds, rainfall ranking by monthly total, display scales and evidence categories. The reviewed Bangkok 2023 response supplies numeric regression examples: 28.52120547945°C annual mean; 32.48°C highest monthly mean in April; approximately 1229.17 mm annual rainfall; 309.9 mm highest monthly total in September.

Full web suite: 126 tests passing; TypeScript and Vite production build pass. Browser checks confirmed default Trend, each year mode, preserved range/view, shareable links, rainfall unit conversions, highlighted extreme months, Thai month/year labels and mobile width. The existing workbench still displayed its chart without a Vite error overlay.
