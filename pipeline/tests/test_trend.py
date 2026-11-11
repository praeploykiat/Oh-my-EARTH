import json
from pathlib import Path

import pytest

from src.trend import analyze, deseasonalize, mann_kendall, sen_slope

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = json.loads((ROOT / "fixtures" / "trend-cases.json").read_text())
TOLERANCE = FIXTURES["tolerance"]


@pytest.mark.parametrize("case", FIXTURES["cases"], ids=lambda c: c["name"])
def test_matches_fixtures(case):
    mk = mann_kendall(case["values"])
    expected = case["expected"]
    assert mk.s == expected["s"]
    assert mk.p_value == pytest.approx(expected["pValue"], abs=TOLERANCE)
    assert sen_slope(case["values"]) == pytest.approx(expected["senSlope"], abs=TOLERANCE)


def test_deseasonalize_removes_monthly_cycle():
    cycle = [float(m) for m in range(12)] * 3
    assert all(abs(v) < 1e-12 for v in deseasonalize(cycle))


def test_analyze_flags_significance():
    assert analyze([float(i) for i in range(20)]).significant
    assert not analyze([1.0, 3.0, 2.0, 1.0, 3.0, 2.0]).significant


def test_requires_enough_points():
    with pytest.raises(ValueError):
        mann_kendall([1.0, 2.0])
