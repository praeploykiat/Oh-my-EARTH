from __future__ import annotations

import requests

POWER_MONTHLY_URL = "https://power.larc.nasa.gov/api/temporal/monthly/point"
MISSING = -999.0


def fetch_power_monthly(
    parameter: str,
    lat: float,
    lon: float,
    start_year: int,
    end_year: int,
    community: str = "RE",
) -> list[tuple[str, float | None]]:
    """Return [(YYYY-MM, value)] from NASA POWER (MERRA-2 based), skipping annual means."""
    response = requests.get(
        POWER_MONTHLY_URL,
        params={
            "parameters": parameter,
            "community": community,
            "latitude": lat,
            "longitude": lon,
            "start": start_year,
            "end": end_year,
            "format": "JSON",
        },
        timeout=60,
    )
    response.raise_for_status()
    raw = response.json()["properties"]["parameter"][parameter]

    series = []
    for key in sorted(raw):
        year, month = key[:4], key[4:]
        if month == "13":
            continue
        value = raw[key]
        series.append((f"{year}-{month}", None if value == MISSING else float(value)))
    return series
