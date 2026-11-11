"""Regenerate fixtures/trend-cases.json, cross-checked against pymannkendall."""

import json
import math
import random
from pathlib import Path

import pymannkendall as pmk

from src.trend import mann_kendall, sen_slope

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "fixtures" / "trend-cases.json"


def build_cases() -> dict[str, list[float | None]]:
    rng = random.Random(42)
    return {
        "increasing-linear": [float(i) for i in range(10)],
        "decreasing-linear": [10.0 - 0.5 * i for i in range(12)],
        "flat-with-noise": [rng.gauss(0, 1) for _ in range(30)],
        "warming-with-noise": [26 + 0.03 * i + rng.gauss(0, 0.4) for i in range(25)],
        "with-ties": [1, 2, 2, 3, 3, 3, 4, 5, 5, 6],
        "with-gaps": [1.0, None, 2.5, 3.1, None, 4.2, 4.0, 5.3, 6.1, 5.9],
    }


def main() -> None:
    cases = []
    for name, raw in build_cases().items():
        values = [None if v is None else round(v, 6) for v in raw]
        mk = mann_kendall(values)
        slope = sen_slope(values)

        clean = [v for v in values if v is not None]
        reference = pmk.original_test(clean)
        assert math.isclose(mk.p_value, reference.p, abs_tol=1e-9), name
        assert mk.s == reference.s, name
        if None not in values:
            assert math.isclose(slope, reference.slope, abs_tol=1e-9), name

        cases.append({
            "name": name,
            "values": values,
            "expected": {
                "s": mk.s,
                "pValue": mk.p_value,
                "senSlope": slope,
            },
        })

    OUTPUT.write_text(json.dumps({"tolerance": 1e-6, "cases": cases}, indent=2) + "\n")
    print(f"Wrote {len(cases)} cases to {OUTPUT}")


if __name__ == "__main__":
    main()
