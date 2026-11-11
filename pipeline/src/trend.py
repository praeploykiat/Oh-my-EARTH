from __future__ import annotations

import math
from dataclasses import dataclass
from statistics import median


@dataclass(frozen=True)
class MannKendallResult:
    s: int
    variance: float
    z: float
    p_value: float
    tau: float


@dataclass(frozen=True)
class TrendResult:
    slope_per_step: float
    p_value: float
    significant: bool
    alpha: float


def _sign(x: float) -> int:
    return (x > 0) - (x < 0)


def _normal_cdf(x: float) -> float:
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def _clean(values: list[float | None]) -> list[tuple[int, float]]:
    return [(i, v) for i, v in enumerate(values) if v is not None and not math.isnan(v)]


# Mann-Kendall test

def mann_kendall(values: list[float | None]) -> MannKendallResult:
    points = [v for _, v in _clean(values)]
    n = len(points)
    if n < 3:
        raise ValueError("Mann-Kendall needs at least 3 values")

    s = sum(_sign(points[j] - points[i]) for i in range(n - 1) for j in range(i + 1, n))

    tie_counts: dict[float, int] = {}
    for v in points:
        tie_counts[v] = tie_counts.get(v, 0) + 1
    tie_term = sum(t * (t - 1) * (2 * t + 5) for t in tie_counts.values())
    variance = (n * (n - 1) * (2 * n + 5) - tie_term) / 18

    if s > 0:
        z = (s - 1) / math.sqrt(variance)
    elif s < 0:
        z = (s + 1) / math.sqrt(variance)
    else:
        z = 0.0

    p_value = 2 * (1 - _normal_cdf(abs(z)))
    tau = s / (0.5 * n * (n - 1))
    return MannKendallResult(s=s, variance=variance, z=z, p_value=p_value, tau=tau)


# Sen's slope

def sen_slope(values: list[float | None]) -> float:
    points = _clean(values)
    slopes = [
        (vj - vi) / (j - i)
        for a, (i, vi) in enumerate(points)
        for (j, vj) in points[a + 1:]
    ]
    if not slopes:
        raise ValueError("Sen's slope needs at least 2 values")
    return float(median(slopes))


# Seasonality

def deseasonalize(values: list[float | None], period: int = 12) -> list[float | None]:
    sums = [0.0] * period
    counts = [0] * period
    for i, v in _clean(values):
        sums[i % period] += v
        counts[i % period] += 1
    means = [sums[k] / counts[k] if counts[k] else 0.0 for k in range(period)]
    return [None if v is None else v - means[i % period] for i, v in enumerate(values)]


# Combined analysis

def analyze(values: list[float | None], alpha: float = 0.05) -> TrendResult:
    mk = mann_kendall(values)
    return TrendResult(
        slope_per_step=sen_slope(values),
        p_value=mk.p_value,
        significant=mk.p_value < alpha,
        alpha=alpha,
    )
