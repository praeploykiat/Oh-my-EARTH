"""Deterministic simulation smoke checks, not proof of nominal coverage/power."""
from pathlib import Path
import json
import platform
import numpy as np
import scipy
from make_global_trend_fixtures import synthetic
from src.global_trend import analyze

ROOT = Path(__file__).resolve().parents[1]


def validate():
    scenarios = [
        ("independent-null", 0.0, 0.0, 12, False),
        ("correlated-null", 0.8, 0.0, 12, False),
        ("persistent-null-stress", 0.95, 0.0, 12, False),
        ("correlated-known-increase", 0.6, 0.2, 12, False),
        ("correlated-with-gaps", 0.6, 0.0, 12, True),
        ("annual-correlated-null", 0.6, 0.0, 1, False),
    ]
    report = {"method": "seasonal-sen-cbb-v1", "python": platform.python_version(), "numpy": np.__version__, "scipy": scipy.__version__, "replicatesPerBlock": 199, "casesPerScenario": 20, "scope": "Small deterministic simulation smoke checks. The production method uses 999 replicates per block. These scenarios cannot certify nominal 95% coverage or a universal 5% false-positive rate.", "scenarios": []}
    for name, phi, slope, period, gaps in scenarios:
        supported, contains, sensitive, numeric_passes, limited = 0, 0, 0, 0, 0
        cases = []
        for seed in range(100, 120):
            values = synthetic(seed, slope=slope, phi=phi, period=period)
            if gaps:
                values = [None if i % 17 == 0 or i // 12 == 8 else v for i, v in enumerate(values)]
            result = analyze(values, period, replicates=199)
            clear = result["evidence"] in ("increase", "decrease")
            covered = result["lowerPerDecade"] <= slope * 10 <= result["upperPerDecade"]
            supported += clear
            contains += covered
            sensitive += result["evidence"] == "sensitive"
            numeric_pass = all(s["pValue"] < 0.05 and (s["lowerPerDecade"] > 0 or s["upperPerDecade"] < 0) for s in result["sensitivity"])
            numeric_passes += numeric_pass
            limited += result["evidence"] == "limited"
            cases.append({"seed": seed, "slopePerDecade": result["slopePerDecade"], "pValue": result["pValue"], "interval": [result["lowerPerDecade"], result["upperPerDecade"]], "evidence": result["evidence"], "warnings": result["warnings"]})
        report["scenarios"].append({"name": name, "ar1": phi, "trueSlopePerDecade": slope * 10, "period": period, "supportedDirections": supported, "numericDirectionalPassesBeforeSafeguards": numeric_passes, "limitedConclusions": limited, "primaryIntervalsContainingTruth": contains, "sensitiveConclusions": sensitive, "cases": cases})
        print(f"{name}: supported={supported}/20, numeric pass={numeric_passes}/20, interval covers truth={contains}/20, limited={limited}/20", flush=True)
    output = ROOT / "docs/global-trend-simulation.json"
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    validate()
