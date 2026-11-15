"""Validate already-scaled AppEEARS MOD13A3.061 point CSVs with conservative QA.

No authentication or network calls here. Missing/failed-QA months remain gaps.
"""
import csv
import math
from datetime import date
from pathlib import Path

PRODUCT = "MOD13A3.061"
LAYERS = ("_1_km_monthly_NDVI", "_1_km_monthly_VI_Quality", "_1_km_monthly_pixel_reliability")
QA_POLICY = "good-land-clear-v1"


def valid_quality(quality, reliability):
    """Require good summary/MODLAND QA, land, and no adjacent/mixed cloud/snow/shadow."""
    if not isinstance(quality, int) or not 0 <= quality < 65535 or reliability != 0:
        return False
    return ((quality & 3) == 0 and ((quality >> 11) & 7) == 1
            and (quality & ((1 << 8) | (1 << 10) | (1 << 14) | (1 << 15))) == 0)


def validate_layers(metadata):
    layers = metadata.get("layers", metadata)
    if not all(key in layers and layers[key].get("Available") is True for key in LAYERS):
        raise ValueError("NDVI or required quality layers are unavailable")
    ndvi = layers[LAYERS[0]]
    if (ndvi.get("Units") not in ("", "unitless", "dimensionless", "1")
            or not math.isclose(float(ndvi["ScaleFactor"]), 0.0001)
            or not math.isclose(float(ndvi["ValidMin"]), -0.2, abs_tol=1e-7)
            or not math.isclose(float(ndvi["ValidMax"]), 1.0)):
        raise ValueError("Unexpected NDVI units, scale or valid range")
    if not str(ndvi.get("DataType", "")).startswith("float"):
        raise ValueError("Expected AppEEARS scaled floating output, not raw int16")
    return layers


def read_point_csv(path, points, *, start=2001, end=2024):
    """points maps exact CSV point IDs to code/lat/lon. Reject malformed or wrong-point data."""
    months = [f"{y}-{m:02d}" for y in range(start, end + 1) for m in range(1, 13)]
    output = {key: {"values": {}, "missing": [], "rejected": []} for key in points}
    seen = set()
    def integer(value):
        x = float(value)
        if not math.isfinite(x) or not x.is_integer():
            raise ValueError("Non-integer QA")
        return int(x)
    with Path(path).open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        columns = reader.fieldnames or []
        def column(suffix):
            names = [name for name in columns if name.startswith("MOD13A3_061_") and name.endswith(suffix)]
            if len(names) != 1:
                raise ValueError(f"Missing/ambiguous column: {suffix}")
            return names[0]
        vi, quality, reliability = [column(layer) for layer in LAYERS]
        for row in reader:
            key = row["ID"]
            if key not in points:
                raise ValueError("Unexpected point ID")
            point = points[key]
            lat, lon = float(row["Latitude"]), float(row["Longitude"])
            if not math.isfinite(lat) or not math.isfinite(lon) or abs(lat - point["lat"]) > 0.0001 or abs(lon - point["lon"]) > 0.0001:
                raise ValueError("Response coordinates do not match requested point")
            stamp = date.fromisoformat(row["Date"])
            month = stamp.strftime("%Y-%m")
            if stamp.day != 1 or month not in months or (key, month) in seen:
                raise ValueError("Unexpected or duplicate monthly timestamp")
            seen.add((key, month))
            record = output[key]
            try:
                value = float(row[vi])
            except (ValueError, TypeError):
                value = math.nan
            if row[vi].strip() == "" or value == -3000:
                record["missing"].append(month)
                record["values"][month] = None
                continue
            if not math.isfinite(value) or value < -0.2000001 or value > 1:
                raise ValueError("NDVI output is unscaled, nonfinite, or outside its valid range")
            try:
                good = valid_quality(integer(row[quality]), integer(row[reliability]))
            except (ValueError, TypeError):
                good = False
            record["values"][month] = value if good else None
            if not good:
                record["rejected"].append(month)
    for key, record in output.items():
        absent = [month for month in months if month not in record["values"]]
        record["missing"].extend(absent)
        record["series"] = [{"t": month, "value": record["values"].get(month)} for month in months]
        record["valid"] = sum(p["value"] is not None for p in record["series"])
        record["total"] = len(months)
        record["sourceRows"] = len(record.pop("values"))
    return output
