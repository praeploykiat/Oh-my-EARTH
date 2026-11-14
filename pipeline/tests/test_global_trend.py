from pathlib import Path
import json
import pytest
from src.global_trend import analyze

FIXTURES = json.loads((Path(__file__).resolve().parents[2] / "fixtures/global-trend-cases.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", FIXTURES["cases"], ids=lambda case: case["name"])
def test_global_reference_remains_reproducible(case):
    actual = analyze(case["values"], case["period"])
    expected = case["expected"]
    for key in ("slopePerDecade", "lowerPerDecade", "upperPerDecade", "pValue", "score", "variance"):
        assert actual[key] == pytest.approx(expected[key], abs=1e-8)
    assert actual["evidence"] == expected["evidence"]
    assert actual["method"] == expected["method"]


def test_reference_preserves_short_record_guard():
    with pytest.raises(ValueError):
        analyze([1.0] * 108, 12)
