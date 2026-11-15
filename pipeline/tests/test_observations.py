"""Offline canonical-contract tests. POWER fixtures here are synthetic, not live evidence."""
import copy
import json
from pathlib import Path
import pytest
from jsonschema import ValidationError
from src.observations import (ROOT, MONTHS, PROFILES, power_batch, ndvi_batch,
                              validate_batch, payload_sha256, batch_id)


@pytest.fixture
def power_envelope():
    values = {"T2M": 25, "PRECTOTCORR": 2, "RH2M": 60, "ALLSKY_SFC_SW_DWN": 5}
    return {"requested": {"code": "TH", "lat": 13.75, "lon": 100.52}, "retrievedAt": "2026-11-15T00:00:00Z", "raw": {
        "header": {"api": {"version": "v2.10.0"}, "fill_value": -999, "sources": ["test-fixture"]},
        "geometry": {"type": "Point", "coordinates": [100.52, 13.75]},
        "parameters": {key: {"units": rule["source_units"][0]} for key, rule in PROFILES["power"]["variables"].items()},
        "properties": {"parameter": {key: {m.replace("-", ""): value for m in MONTHS} for key, value in values.items()}}}}


@pytest.fixture
def power_doc(tmp_path, power_envelope):
    path = tmp_path / "TH.json"
    path.write_text(json.dumps(power_envelope), encoding="utf-8")
    return power_batch(path)


def test_four_power_variables_keep_source_rates_and_month_positions(power_doc):
    assert len(power_doc["observations"]) == 1152
    assert {r["quality"] for r in power_doc["observations"]} == {"valid"}
    rain = [r for r in power_doc["observations"] if r["variable"] == "PRECTOTCORR"]
    assert rain[0]["value"] == 2 and rain[0]["unit"] == "mm/day"
    assert rain[0]["month"] == "2001-01" and rain[-1]["month"] == "2024-12"
    assert power_doc["retrieved_at"] == "2026-11-15T00:00:00+00:00"


def test_fill_absent_rejected_and_negative_values_are_distinct(tmp_path, power_envelope):
    series = power_envelope["raw"]["properties"]["parameter"]["T2M"]
    series["200101"] = -10
    series["200102"] = -999
    del series["200103"]
    series["200104"] = 100
    series["200105"] = True
    series["200113"] = 99999  # Native annual entry is excluded.
    path = tmp_path / "mixed.json"; path.write_text(json.dumps(power_envelope))
    doc = power_batch(path)
    rows = doc["observations"][:5]
    assert rows[0]["value"] == -10
    assert [r["quality"] for r in rows] == ["valid", "missing", "missing", "rejected", "rejected"]
    assert rows[1]["reason"] == "source_fill" and rows[2]["reason"] == "absent_month"
    assert len(doc["observations"]) == 1152


@pytest.mark.parametrize("change", ["units", "coordinates", "month", "timezone"])
def test_wrong_source_metadata_fails_before_database_write(tmp_path, power_envelope, change):
    if change == "units": power_envelope["raw"]["parameters"]["T2M"]["units"] = "kelvin"
    if change == "coordinates": power_envelope["raw"]["geometry"]["coordinates"][0] = 90
    if change == "month": power_envelope["raw"]["properties"]["parameter"]["T2M"]["202414"] = 25
    if change == "timezone": power_envelope["retrievedAt"] = "2026-11-15T00:00:00"
    path = tmp_path / "bad.json"; path.write_text(json.dumps(power_envelope))
    with pytest.raises(ValueError): power_batch(path)


def test_actual_ndvi_snapshot_preserves_qa_and_does_not_scale_twice():
    source = ROOT / "pipeline/fixtures/ndvi-pilot.json"
    original = json.loads(source.read_text(encoding="utf-8"))
    doc = ndvi_batch(source)
    rows = [r for r in doc["observations"] if r["location_id"].startswith("TH:")]
    assert [r["value"] for r in rows] == original["records"]["TH"]["values"]
    assert sum(r["quality"] == "valid" for r in rows) == 4
    assert sum(r["quality"] == "rejected" for r in rows) == 283
    assert sum(r["quality"] == "missing" for r in rows) == 1
    assert all(r["unit"] == "1" for r in rows)
    assert doc["metadata"]["task_id"] == original["taskId"]


def test_ndvi_quality_mismatch_or_wrong_unit_fails(tmp_path):
    data = json.loads((ROOT / "pipeline/fixtures/ndvi-pilot.json").read_text(encoding="utf-8"))
    data["records"]["TH"]["values"][0] = 0.5
    path = tmp_path / "bad-ndvi.json"; path.write_text(json.dumps(data))
    with pytest.raises(ValueError): ndvi_batch(path)
    data["unit"] = "%"; path.write_text(json.dumps(data))
    with pytest.raises(ValueError): ndvi_batch(path)


@pytest.mark.parametrize("change", ["unit", "quality", "duplicate", "value", "product"])
def test_shared_contract_rejects_invalid_observations(power_doc, change):
    doc = copy.deepcopy(power_doc)
    if change == "unit": doc["observations"][0]["unit"] = "1"
    if change == "quality": doc["observations"][0]["quality"] = "missing"
    if change == "duplicate": doc["observations"].append(doc["observations"][0])
    if change == "value": doc["observations"][0]["value"] = float("inf")
    if change == "product": doc["product"]["id"] = "modis:MOD13A3:061"
    with pytest.raises((ValueError, ValidationError)): validate_batch(doc)


def test_artifact_identity_survives_file_moves_but_detects_changed_values(power_doc):
    moved = copy.deepcopy(power_doc); moved["artifact"]["path"] = "elsewhere/TH.json"
    assert batch_id(moved) == batch_id(power_doc)
    assert payload_sha256(moved) == payload_sha256(power_doc)
    moved["observations"][0]["value"] = 24
    assert payload_sha256(moved) != payload_sha256(power_doc)
