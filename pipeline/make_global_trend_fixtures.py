"""Generate independently checked Python expectations for browser regression tests."""
from pathlib import Path
import json
import platform
import numpy as np
import scipy
from src.global_trend import analyze

ROOT = Path(__file__).resolve().parents[1]


def synthetic(seed, slope=0.0, phi=0.0, period=12, years=24):
    rng = np.random.default_rng(seed)
    seasonal = [8, 5, 2, -2, -5, -8, -6, -3, 1, 4, 7, 9] if period == 12 else [0]
    noise = 0.0
    values = []
    for i in range(years * period):
        noise = phi * noise + rng.normal()
        values.append(round(20 + slope * i / period + seasonal[i % period] + noise, 6))
    return values


def generate():
    cases = [
        ("constant", [4.0] * 288, 12),
        ("season-only", [float(m * 3) for _ in range(24) for m in range(12)], 12),
        ("increasing", synthetic(14, slope=0.2), 12),
        ("decreasing", synthetic(15, slope=-0.2), 12),
        ("correlated-null", synthetic(16, phi=0.85), 12),
        ("correlated-trend", synthetic(17, slope=0.12, phi=0.7), 12),
        ("persistent-null", synthetic(100, phi=0.95), 12),
        ("ties", [float(round(v)) for v in synthetic(18, slope=0.05)], 12),
        ("annual-totals", synthetic(19, slope=2, phi=0.6, period=1), 1),
        ("minimum-ten-years", synthetic(20, slope=0.2, years=10), 12),
        ("opposing-months", [float(20 + m + (0.2 if m < 6 else -0.2) * y) for y in range(24) for m in range(12)], 12),
    ]
    gaps = synthetic(21, slope=0.08, phi=0.6)
    gaps = [None if i % 17 == 0 or i // 12 == 8 else v for i, v in enumerate(gaps)]
    cases.append(("calendar-gaps", gaps, 12))
    annual = synthetic(22, slope=-1, phi=0.5, period=1)
    annual[5] = annual[6] = None
    cases.append(("annual-gaps", annual, 1))
    output = {"method": "seasonal-sen-cbb-v1", "python": platform.python_version(), "numpy": np.__version__, "scipy": scipy.__version__, "replicates": 999, "cases": []}
    for name, values, period in cases:
        expected = analyze(values, period)
        output["cases"].append({"name": name, "values": values, "period": period, "expected": expected})
        print(f"{name}: slope={expected['slopePerDecade']:.6f}, p={expected['pValue']:.3f}, evidence={expected['evidence']}", flush=True)
    destination = ROOT / "fixtures/global-trend-cases.json"
    destination.write_text(json.dumps(output, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(destination)


if __name__ == "__main__":
    generate()
