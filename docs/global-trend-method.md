# Global explorer trend analysis

Method identifier: **seasonal-sen-cbb-v1**.

This is an exploratory seasonal Kendall/Sen analysis with circular residual
year-block resampling. It addresses seasonality and local serial dependence;
it does not guarantee correct inference for every environmental process. It is
not a port of the 3PW algorithm. The Thailand workbench and legacy exports retain
their existing method; the changes here apply to the global explorer.

## What users see

- A seasonal Sen rate (or annual Sen rate for annual rainfall), per decade.
- An approximate 95% interval for that rate, not a prediction interval.
- A two-sided, block-bootstrap-calibrated Kendall score p-value.
- Plain-English interpretation, coverage, and explicit provisional-result flags.
- Diagnostics for residual lag-1 correlation, month-specific slope range, method
  version, random seed, and sensitivity to block length.

The p-value is not the probability that there is no trend, and an interval
containing zero is not proof that nothing changed. A detected association does
not explain its cause. A capital-coordinate estimate is not a national trend.

## Seasonal slope and score

Input monthly arrays contain consecutive January–December calendar positions,
with nulls for missing observations. January is compared only with January,
February with February, etc. A missing observation or year never compresses time.

For each same-month pair `(i,j)`, compute `(value[j] - value[i]) / (year[j] - year[i])`.
The pooled median across all such pairs is the seasonal Sen estimate in units/year.
Multiplication by ten produces the displayed rate. Individual months also have
descriptive median slopes. Opposing point-estimate signs are reported, but this
is not a formal homogeneity test between months.

The seasonal Kendall score is the sum of signs of all within-month differences.
For annual rainfall, there is one season: the complete annual totals, in mm/year.
Its rate is therefore in mm/year per decade. Other annual charts still summarize
the monthly estimate; switching monthly/annual/anomaly display alone does not
change their inferential input. The anomaly baseline remains a display transform.

The score studentizer is the sum of the usual within-season tie-corrected
variances, `[n(n−1)(2n+5) − sum(t(t−1)(2t+5))] / 18`. This is a normalization, not
an assertion that the seasons are independent. Its analytic normal p-value is
not used: the null distribution below includes cross-month dependence.

The seasonal slope definition follows Hirsch, Slack and Smith (1982), as
implemented in [SciPy's seasonal Sen estimator](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.mstats.sen_seasonal_slopes.html).

## Dependence-aware null resampling

1. Estimate the pooled slope. For each calendar month, estimate a median intercept
   after detrending, then retain the residual at every original calendar position.
2. Remove residuals below `max(1, max(abs(values))) × 1e-12` to avoid treating
   floating-point round-off in noiseless synthetic records as genuine variation.
3. Resample consecutive whole-year residual blocks with circular wrap-around.
   Month columns remain together; missingness is resampled with the blocks.
   Reconstruct a **no-trend** record using the month intercepts and sampled residuals.
   Observed data are never interpolated or filled.
4. Calculate each sample's absolute studentized Kendall score `abs(S)/sqrt(V)`.
   A constant sample has statistic zero; samples with no comparable pairs are
   discarded. At least 90% of replicates must be usable.
5. The two-sided p-value is `(1 + number of null statistics >= observed) / (1 + B)`.
   A comparison tolerance of `1e-12` avoids floating-point boundary discrepancies.

There are **999 replicates per tested block length**. The primary length is
`min(floor(years/3), max(2, ceil(cuberoot(years))))` years. The adjacent lengths
are also tested, bounded to 2 through `floor(years/3)` and deduplicated. For a
24-year record these are 2, 3, and 4 years. This heuristic is deliberately exposed
through sensitivity results; it is not claimed to be an optimal bandwidth selector.

Randomness is reproducible using the Park–Miller generator with state
`271828 + blockYears`, recurrence `state × 16807 mod 2147483647`, and uniform
value `state / 2147483647`. Month comparisons retain actual elapsed years.

[Circular block resampling](https://bashtage.github.io/arch/bootstrap/generated/arch.bootstrap.CircularBlockBootstrap.html)
is an established way to preserve local dependence. This application combines
it with a fitted seasonal residual model. It does not preserve all possible
long-memory dependence or correct structural breaks.

## Approximate confidence limits

Let `q` be the linearly interpolated 95th percentile of the absolute bootstrap
studentized scores and let `C = q × sqrt(V_observed)`. Sort the `N` original
within-season pairwise slopes. The lower and upper zero-based indices are:

```
lower = max(0, ceil((N − C)/2) − 1)
upper = min(N − 1, floor((N + C)/2))
```

Those slopes, multiplied by ten, form the displayed limits. These are approximate
Sen score-inversion limits using an empirical block critical score. The variance
is held at its observed tie-corrected value during inversion; this is not an exact
finite-sample interval. If the score bound reaches the total pair count, uncertainty
is unbounded and the UI withholds inference instead of inventing finite limits.

The method assumes roughly stationary residuals around a common long-term slope,
and dependence mainly within the tested blocks. Uncertainty in NASA measurements,
spatial representativeness, model/source changes, multiple-testing across many
locations, and a user's choice of time window are not included in this interval.

## Interpretation and safeguards

Existing input gates require at least 10 selected calendar years, observations in
10 years, and 80% valid monthly coverage. Annual rainfall also requires 10 complete
annual values. Every monthly season needs an observed intercept. The same bootstrap
engine supports missing annual years without changing their elapsed positions.

Direction is described as supported only when every tested block length has
`p < 0.05` and limits excluding zero in the same direction. Different block decisions
produce a sensitivity warning. Both the primary numerical estimate and the full
block-length table remain available.

Additional conservative **product** flags mark the result provisional when:

- Any inferential input is missing.
- Absolute lag-1 correlation of detrended, season-adjusted residuals is at least 0.8.
- The selected record is shorter than 15 years.

These flags are not published statistical cutoffs or replacements for a power
calculation. Lag-1 correlation is a Pearson correlation of adjacent observed
residual pairs only; no pairs cross a gap. It is undefined for constant residuals.
High dependence may still evade this diagnostic in a short sample.

## Python validation and simulation evidence

The independent Python reference uses NumPy array operations instead of the
TypeScript pair loops. It cross-checks observed seasonal slopes with
`scipy.stats.mstats.sen_seasonal_slopes`, annual slopes with
`scipy.stats.theilslopes` using explicit year indices, and Kendall scores with
`scipy.stats.kendalltau` after accounting for ties. The bootstrap follows the same
documented random stream and numerical contract.

[Numerical parity report](global-trend-validation.json): **13/13 cases pass at
absolute tolerance 1e-8**, including all sensitivity bounds and p-values. Cases
cover constant data, pure seasonality, increasing/decreasing trends, serial noise,
persistence, ties, opposing month trends, a 10-year record, and monthly/annual gaps.
The committed fixture records the generating Python, NumPy and SciPy versions.
Both implementations run in CI. Numerical agreement validates implementation
consistency; it is not proof of inferential calibration.

[Simulation smoke report](global-trend-simulation.json) contains 20 deterministic
24-year cases per scenario and 199 replicates per block, compared with 999 in the UI.
The primary intervals contained the true slope in 20/20 independent-null cases,
18/20 AR(1)=0.8 null cases, 13/20 AR(1)=0.95 stress cases, 18/20 known-increase cases,
16/20 cases with gaps, and 17/20 annual correlated-null cases. This small study does
**not** establish nominal 95% coverage: persistence and gaps can under-cover.
The report separates numerical threshold passes from the UI's cautious direction
labels so the product safeguards do not conceal these limitations.

This is why the UI uses approximate intervals, avoids a definitive significant/
insignificant badge, and flags provisional results. Broader simulations, a formal
seasonal-homogeneity assessment, and comparison with a published method such as
[3PW](https://amt.copernicus.org/articles/13/6945/2020/) remain worthwhile scientific
review before treating this as a research-grade inference tool.

## Reproduce

From the repository root, create a virtual environment and install the scientific
reference dependencies (the examples assume an activated environment):

```bash
python -m pip install -r pipeline/requirements-trend.txt
python pipeline/make_global_trend_fixtures.py
python pipeline/validate_global_trend.py
```

From `web/`, run `npm run validate:trend` to compare the actual browser algorithm
with the committed Python fixture and write the parity report. `npm test` also
checks parity, input guards, missing-time diagnostics, unit scaling, and deterministic
results. Run `python -m pytest` in `pipeline/` with its normal requirements plus
`requirements-trend.txt` to verify the complete Python suite.

The browser calculation runs in a dedicated worker. Input changes terminate the
previous worker and hide its result immediately; failures never fall back to the
uncorrected legacy p-value. The chart remains usable during calculation.
