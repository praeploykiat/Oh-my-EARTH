"""Independent NumPy/SciPy reference for seasonal-sen-cbb-v1.

SciPy supplies the observed seasonal/annual slope and Kendall scores; vectorized
NumPy supplies bootstrap statistics, independently of the browser's pair loops.
"""
from __future__ import annotations

import math
import numpy as np
from scipy import stats

METHOD = "seasonal-sen-cbb-v1"
SEED = 271828


def summary(matrix, slope=True):
    n, period = matrix.shape
    i, j = np.triu_indices(n, 1)
    differences = matrix[j] - matrix[i]
    valid = np.isfinite(differences)
    score = int(np.sign(differences[valid]).sum())
    variance = 0.0
    seasonal = []
    all_slopes = differences / (j - i)[:, None]
    for month in range(period):
        column = matrix[:, month]
        finite = column[np.isfinite(column)]
        _, counts = np.unique(finite, return_counts=True)
        count = len(finite)
        variance += (count * (count - 1) * (2 * count + 5) - np.sum(counts * (counts - 1) * (2 * counts + 5))) / 18
        candidates = all_slopes[:, month][valid[:, month]]
        seasonal.append(float(np.median(candidates)) if slope and candidates.size else None)
    return {
        "score": score, "variance": float(variance),
        "slope": float(np.median(all_slopes[valid])) if slope and valid.any() else math.nan,
        "seasonal": seasonal,
        "pairs": int(valid.sum()),
        "slopes": np.sort(all_slopes[valid]) if slope else np.array([]),
    }


def analyze(values, period=12, replicates=999):
    if period not in (1, 12) or len(values) % period or len(values) // period < 10:
        raise ValueError("Expected at least 10 aligned calendar years")
    array = np.array([np.nan if v is None else v for v in values], dtype=float)
    if np.isinf(array).any() or (period == 12 and np.isfinite(array).sum() / array.size < 0.8):
        raise ValueError("Insufficient or nonfinite data")
    matrix = array.reshape(-1, period)
    years = len(matrix)
    if np.any(np.isfinite(matrix), axis=1).sum() < 10:
        raise ValueError("Insufficient observed years")
    observed = summary(matrix)
    # Independent library cross-checks, not simply two translations of the same code.
    if period == 12:
        library_slope = float(stats.mstats.sen_seasonal_slopes(np.ma.masked_invalid(matrix)).inter_slope)
    else:
        finite = np.isfinite(array)
        library_slope = float(stats.theilslopes(array[finite], np.arange(years)[finite]).slope)
    if not math.isclose(observed["slope"], library_slope, abs_tol=1e-10, rel_tol=1e-10):
        raise AssertionError("SciPy slope disagreement")
    library_score = 0
    for column in matrix.T:
        finite = column[np.isfinite(column)]
        n = len(finite)
        if n < 2 or np.all(finite == finite[0]):
            continue
        _, counts = np.unique(finite, return_counts=True)
        pairs = n * (n - 1) / 2
        ties = np.sum(counts * (counts - 1) / 2)
        tau = stats.kendalltau(np.arange(n), finite).statistic
        library_score += round(float(tau * math.sqrt(pairs * (pairs - ties))))
    if library_score != observed["score"]:
        raise AssertionError("SciPy Kendall score disagreement")
    slope = observed["slope"]
    time = np.arange(array.size) / period
    intercepts = np.nanmedian((array - slope * time).reshape(-1, period), axis=0)
    if not np.isfinite(intercepts).all():
        raise ValueError("Every month needs observations")
    residuals = array - slope * time - np.tile(intercepts, years)
    tolerance = max(1, float(np.nanmax(np.abs(array)))) * 1e-12
    residuals[np.abs(residuals) < tolerance] = 0
    lag_mask = np.isfinite(residuals[:-1]) & np.isfinite(residuals[1:])
    x, y = residuals[:-1][lag_mask], residuals[1:][lag_mask]
    lag1 = float(np.corrcoef(x, y)[0, 1]) if len(x) >= 3 and np.std(x) > 0 and np.std(y) > 0 else None
    residuals = residuals.reshape(-1, period)
    block = min(years // 3, max(2, math.ceil(years ** (1 / 3))))
    choices = sorted({min(years // 3, max(2, b)) for b in (block - 1, block, block + 1)})
    observed_stat = abs(observed["score"]) / math.sqrt(observed["variance"]) if observed["variance"] > 0 else 0
    sensitivity = []
    for size in choices:
        state = SEED + size
        bootstrap_statistics, extreme = [], 0
        for _ in range(replicates):
            indices = []
            while len(indices) < years:
                state = state * 16807 % 2147483647
                start = math.floor(state / 2147483647 * years)
                indices.extend((start + offset) % years for offset in range(size))
            sample = residuals[indices[:years]] + intercepts
            null = summary(sample, slope=False)
            if not null["pairs"]:
                continue
            null_stat = abs(null["score"]) / math.sqrt(null["variance"]) if null["variance"] > 0 else 0
            bootstrap_statistics.append(null_stat)
            extreme += null_stat >= observed_stat - 1e-12
        if len(bootstrap_statistics) < math.ceil(replicates * 0.9):
            raise ValueError("Too few usable bootstrap samples")
        critical = float(np.quantile(bootstrap_statistics, 0.95, method="linear") * math.sqrt(observed["variance"]))
        if critical >= observed["pairs"]:
            raise ValueError("Slope uncertainty is unbounded")
        lower = max(0, math.ceil((observed["pairs"] - critical) / 2) - 1)
        upper = min(len(observed["slopes"]) - 1, math.floor((observed["pairs"] + critical) / 2))
        sensitivity.append({
            "blockYears": size, "pValue": (int(extreme) + 1) / (len(bootstrap_statistics) + 1),
            "lowerPerDecade": float(observed["slopes"][lower] * 10),
            "upperPerDecade": float(observed["slopes"][upper] * 10), "validReplicates": len(bootstrap_statistics), "criticalScore": critical,
        })
    primary = next(s for s in sensitivity if s["blockYears"] == block)

    def decision(sample):
        if sample["pValue"] < 0.05 and sample["lowerPerDecade"] > 0:
            return "increase"
        if sample["pValue"] < 0.05 and sample["upperPerDecade"] < 0:
            return "decrease"
        return "inconclusive"

    decisions = {decision(sample) for sample in sensitivity}
    warnings = []
    if np.isnan(array).any():
        warnings.append("gaps")
    if lag1 is not None and abs(lag1) >= 0.8:
        warnings.append("persistence")
    if years < 15:
        warnings.append("short")
    return {
        "method": METHOD, "period": period, "slopePerDecade": slope * 10,
        "lowerPerDecade": primary["lowerPerDecade"], "upperPerDecade": primary["upperPerDecade"],
        "pValue": primary["pValue"], "confidence": 0.95, "replicates": replicates, "seed": SEED,
        "blockYears": block, "lag1": lag1, "score": observed["score"], "variance": observed["variance"],
        "seasonalSlopesPerDecade": [None if s is None else s * 10 for s in observed["seasonal"]],
        "sensitivity": sensitivity, "warnings": warnings, "evidence": "limited" if warnings else "sensitive" if len(decisions) > 1 else decision(primary),
    }
