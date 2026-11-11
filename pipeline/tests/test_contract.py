import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[2]
CONTRACTS = ROOT / "contracts"
DATASETS = ROOT / "web" / "public" / "datasets"


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def validator(name: str) -> Draft202012Validator:
    return Draft202012Validator(load(CONTRACTS / name))


def test_catalog_matches_schema():
    validator("catalog.schema.json").validate(load(DATASETS / "catalog.json"))


@pytest.mark.parametrize("entry", load(DATASETS / "catalog.json")["datasets"], ids=lambda e: e["id"])
def test_dataset_matches_schema(entry):
    dataset = load(DATASETS / entry["file"])
    validator("dataset.schema.json").validate(dataset)
    assert dataset["id"] == entry["id"]
