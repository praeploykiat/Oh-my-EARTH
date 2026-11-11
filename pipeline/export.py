"""Build datasets for the web app.

Usage:
    python export.py            # fetch real data from NASA POWER
    python export.py --sample   # write synthetic data for offline development
"""

from __future__ import annotations

import argparse
import json
import math
import random
from dataclasses import dataclass
from pathlib import Path

from src.fetch import fetch_power_monthly
from src.trend import analyze, deseasonalize

ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT / "web" / "public" / "datasets"
START_YEAR, END_YEAR = 2001, 2024
ALPHA = 0.05


@dataclass(frozen=True)
class DatasetSpec:
    id: str
    parameter: str
    label: str
    unit: str
    region: str
    lat: float
    lon: float


SPECS = [
    DatasetSpec("phangnga-t2m", "T2M", "Air temperature at 2 m", "°C", "Phang Nga", 8.6, 98.2),
    DatasetSpec("chiangmai-precip", "PRECTOTCORR", "Precipitation", "mm/day", "Chiang Mai", 18.8, 98.98),
    DatasetSpec("songkhla-precip", "PRECTOTCORR", "Precipitation", "mm/day", "Songkhla", 7.2, 100.6),
]

SAMPLE_SLOPES = {"phangnga-t2m": 0.002, "chiangmai-precip": -0.002, "songkhla-precip": 0.0015}


# Data sources

def real_series(spec: DatasetSpec) -> list[tuple[str, float | None]]:
    return fetch_power_monthly(spec.parameter, spec.lat, spec.lon, START_YEAR, END_YEAR)


def sample_series(spec: DatasetSpec) -> list[tuple[str, float | None]]:
    rng = random.Random(spec.id)
    base, amplitude = (27.0, 1.5) if spec.parameter == "T2M" else (5.0, 4.0)
    slope = SAMPLE_SLOPES.get(spec.id, 0.0)
    series = []
    for i in range((END_YEAR - START_YEAR + 1) * 12):
        year, month = START_YEAR + i // 12, i % 12 + 1
        seasonal = amplitude * math.sin(2 * math.pi * (month - 3) / 12)
        value = max(0.0, base + seasonal + slope * i + rng.gauss(0, 0.4))
        series.append((f"{year}-{month:02d}", round(value, 3)))
    return series


# Dataset assembly

def build_dataset(spec: DatasetSpec, series: list[tuple[str, float | None]], synthetic: bool) -> dict:
    values = [v for _, v in series]
    result = analyze(deseasonalize(values), alpha=ALPHA)
    return {
        "id": spec.id,
        "variable": {"key": spec.parameter, "label": spec.label},
        "unit": spec.unit,
        "source": {
            "provider": "NASA POWER",
            "product": "MERRA-2 monthly point data",
            "url": "https://power.larc.nasa.gov/",
            "synthetic": synthetic,
        },
        "region": {"name": spec.region, "lat": spec.lat, "lon": spec.lon},
        "resolution": "monthly",
        "series": [{"t": t, "value": v} for t, v in series],
        "trend": {
            "method": "Mann-Kendall on deseasonalized series, Sen's slope",
            "slopePerDecade": result.slope_per_step * 120,
            "pValue": result.p_value,
            "significant": result.significant,
            "alpha": ALPHA,
        },
    }


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sample", action="store_true", help="write synthetic data")
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    catalog = []
    for spec in SPECS:
        series = sample_series(spec) if args.sample else real_series(spec)
        dataset = build_dataset(spec, series, synthetic=args.sample)
        filename = f"{spec.id}.json"
        write_json(OUTPUT_DIR / filename, dataset)
        catalog.append({"id": spec.id, "file": filename, "variable": spec.label, "region": spec.region})
        print(f"{spec.id}: {dataset['trend']['slopePerDecade']:+.3f} {spec.unit}/decade, p={dataset['trend']['pValue']:.4f}")

    write_json(OUTPUT_DIR / "catalog.json", {"datasets": catalog})


if __name__ == "__main__":
    main()
