"""Source-specific normalization into the shared, versioned monthly observation contract.

This module does not contact NASA, connect to PostgreSQL, or alter frontend datasets.
"""
import hashlib
import json
import math
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[2]
PROFILES = json.loads((ROOT / "contracts/observation-profiles.json").read_text(encoding="utf-8"))
SCHEMA = json.loads((ROOT / "contracts/observations.schema.json").read_text(encoding="utf-8"))
VALIDATOR = Draft202012Validator(SCHEMA, format_checker=FormatChecker())
NORMALIZATION_VERSION = "monthly-observation-v1"
MONTHS = [f"{y}-{m:02d}" for y in range(2001, 2025) for m in range(1, 13)]


def location_id(code, lat, lon):
    return f"{code}:{lat:.4f}:{lon:.4f}"


def catalog():
    path = ROOT / "web/public/geo/capitals.json"
    rows = json.loads(path.read_text(encoding="utf-8"))
    return [{**c, "id": location_id(c["code"], c["lat"], c["lon"])} for c in rows]


def finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def timestamp(value):
    if not isinstance(value, str):
        raise ValueError("Retrieval timestamp must be a string")
    stamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if stamp.tzinfo is None:
        raise ValueError("Retrieval timestamp must include a timezone")
    return stamp.astimezone(timezone.utc).isoformat()


def artifact(path):
    path = Path(path).resolve()
    try:
        name = path.relative_to(ROOT).as_posix()
    except ValueError:
        name = str(path)
    return {"sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "path": name}


def batch(product, retrieved_at, source_artifact, locations, observations, metadata):
    result = {"schema_version": 1, "normalization_version": NORMALIZATION_VERSION,
              "qa_policy": PROFILES[product["source"]]["qa_policy"], "retrieved_at": timestamp(retrieved_at),
              "product": product, "artifact": source_artifact, "locations": locations,
              "observations": observations, "metadata": metadata}
    validate_batch(result)
    return result


def validate_batch(doc):
    VALIDATOR.validate(doc)
    product = doc["product"]
    if product["source"] == "modis":
        if product["id"] != "modis:MOD13A3:061" or product["name"] != "MOD13A3" or product["version"] != "061":
            raise ValueError("Wrong MODIS product identity")
    elif product['source']=='gldas':
        if product['id']!='gldas:GLDAS_NOAH025_M:2.1' or product['name']!='GLDAS_NOAH025_M' or product['version']!='2.1':
            raise ValueError('Wrong GLDAS product identity')
    elif (not re.fullmatch(r"v\d+\.\d+\.\d+", product["version"])
          or product["id"] != f"power:monthly-point:RE:{product['version']}"
          or product["name"] != "NASA POWER monthly point RE"):
        raise ValueError("Wrong POWER product identity")
    profile = PROFILES[product["source"]]
    if doc["qa_policy"] != profile["qa_policy"]:
        raise ValueError("Product and QA policy disagree")
    timestamp(doc["retrieved_at"])
    known = {c["id"]: c for c in catalog()}
    ids = set()
    for c in doc["locations"]:
        expected = known.get(c["id"])
        if c["id"] in ids or c != expected:
            raise ValueError("Invalid or duplicate capital coordinate identity")
        ids.add(c["id"])
    seen = set()
    for row in doc["observations"]:
        key = (row["location_id"], row["variable"], row["month"])
        if row["location_id"] not in ids or key in seen or row["month"] not in MONTHS:
            raise ValueError("Duplicate observation, unknown location or unexpected month")
        seen.add(key)
        rule = profile["variables"].get(row["variable"])
        if not rule or row["unit"] != rule["unit"]:
            raise ValueError("Wrong variable or canonical unit for source")
        if row["quality"] == "valid" and (not finite(row["value"]) or not rule["minimum"] <= row["value"] <= rule["maximum"]):
            raise ValueError("Valid value is outside its source-specific range")
    # Canonical records are a complete calendar grid; source gaps are explicit nulls.
    for loc, var in {(r["location_id"], r["variable"]) for r in doc["observations"]}:
        if sum(r["location_id"] == loc and r["variable"] == var for r in doc["observations"]) != len(MONTHS):
            raise ValueError("Observation records must include all 288 calendar positions")
    return doc


def row(loc, variable, month, value, quality="valid", reason=None, source="power"):
    return {"location_id": loc["id"], "variable": variable, "month": month,
            "unit": PROFILES[source]["variables"][variable]["unit"], "value": value,
            "quality": quality, "reason": reason}


def power_batch(path):
    envelope = json.loads(Path(path).read_text(encoding="utf-8"))
    raw = envelope["raw"]
    point = envelope["requested"]
    if not finite(point["lat"]) or not finite(point["lon"]):
        raise ValueError("Invalid requested coordinates")
    candidates = [c for c in catalog() if abs(c["lat"] - point["lat"]) < 0.00005 and abs(c["lon"] - point["lon"]) < 0.00005]
    if len(candidates) != 1:
        raise ValueError("POWER request must match exactly one catalog capital")
    loc = candidates[0]
    if point.get("code", loc["code"]) != loc["code"]:
        raise ValueError("POWER country code and coordinates disagree")
    coords = raw["geometry"]["coordinates"]
    if raw["geometry"]["type"] != "Point" or len(coords) < 2 or not all(finite(x) for x in coords[:2]) or abs(coords[0] - loc["lon"]) > 0.01 or abs(coords[1] - loc["lat"]) > 0.01:
        raise ValueError("POWER response coordinates disagree with request")
    version = raw["header"]["api"]["version"]
    if not isinstance(version, str) or not re.fullmatch(r"v\d+\.\d+\.\d+", version):
        raise ValueError("Unsupported POWER API version metadata")
    fill = raw["header"].get("fill_value", -999)
    if not finite(fill):
        raise ValueError("Invalid source fill value")
    observations = []
    for variable, rule in PROFILES["power"]["variables"].items():
        source_unit = raw["parameters"][variable]["units"]
        if not isinstance(source_unit, str) or re.sub(r"\s", "", source_unit.lower()) not in rule["source_units"]:
            raise ValueError(f"Incompatible source unit for {variable}")
        values = raw["properties"]["parameter"][variable]
        if not isinstance(values, dict):
            raise ValueError("Expected a monthly value mapping")
        months = {}
        for key, value in values.items():
            if re.fullmatch(r"\d{4}13", key):
                continue
            if not re.fullmatch(r"\d{4}(0[1-9]|1[0-2])", key):
                raise ValueError("Invalid POWER month")
            month = key[:4] + "-" + key[4:]
            if month not in MONTHS:
                raise ValueError("Unexpected POWER year")
            months[month] = value
        for month in MONTHS:
            value = months.get(month)
            if month not in months:
                observations.append(row(loc, variable, month, None, "missing", "absent_month"))
            elif value is None or value == fill:
                observations.append(row(loc, variable, month, None, "missing", "source_fill"))
            elif not finite(value) or not rule["minimum"] <= value <= rule["maximum"]:
                observations.append(row(loc, variable, month, None, "rejected", "source_screen"))
            else:
                observations.append(row(loc, variable, month, value))
    product = {"id": f"power:monthly-point:RE:{version}", "source": "power", "name": "NASA POWER monthly point RE", "version": version,
               "source_url": "https://power.larc.nasa.gov/", "resolution": "source-native monthly grid"}
    return batch(product, envelope["retrievedAt"], artifact(path), [loc], observations,
                 {"sources": raw["header"].get("sources", []), "requested": {"lat": loc["lat"], "lon": loc["lon"]}, "response_coordinates": coords[:2]})


def gldas_batch(path):
    from .gldas import parse_csv,request_url
    data=json.loads(Path(path).read_text(encoding='utf-8'))
    point=data['requested']
    loc=next(c for c in catalog() if c['code']==point['code'])
    if any(not finite(point[k]) or abs(point[k]-loc[k])>0.00005 for k in ('lat','lon')):
        raise ValueError('GLDAS requested coordinates disagree with catalog')
    parsed=parse_csv(data['csv'],loc)
    product={'id':'gldas:GLDAS_NOAH025_M:2.1','source':'gldas','name':'GLDAS_NOAH025_M','version':'2.1',
      'source_url':'https://ldas.gsfc.nasa.gov/gldas','resolution':'0.25 degree monthly model grid; 0–10 cm soil layer'}
    observations=[row(loc,'SOIL_MOISTURE',p['t'],p['value'],p['quality'],p['reason'],source='gldas') for p in parsed['series']]
    cell=parsed['responseCoordinates']
    return batch(product,data['retrievedAt'],artifact(path),[loc],observations,
      {'response_coordinates':[cell['lon'],cell['lat']],'requested':{'lat':loc['lat'],'lon':loc['lon']},
       'request_url':request_url(loc),'sources':['GLDAS Noah 2.1','Giovanni point service','SoilMoi0_10cm_inst','DOI:10.5067/SXAVCZFAQLNO'],
       'screening':'Finite/range/fill screening only; no per-observation quality flags supplied by Giovanni. No neighbour fallback.',
       'sourceRows':parsed['sourceRows'],'depth_cm':[0,10],'source_unit':parsed['metadata']['unit']})


def ndvi_batch(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if (data["product"] != "MOD13A3.061" or data["schemaVersion"] != 1 or data["variable"] != "NDVI" or data["unit"] != "1"
            or data["qaPolicy"] != PROFILES["modis"]["qa_policy"] or data["period"] != {"start": 2001, "end": 2024}):
        raise ValueError("Unsupported NDVI snapshot contract")
    known = {c["code"]: c for c in catalog()}
    observations, locations = [], []
    for code, record in data["records"].items():
        loc = known[code]
        if any(not finite(record["requested"][k]) or abs(record["requested"][k] - loc[k]) > 0.0001 for k in ["lat", "lon"]):
            raise ValueError("NDVI snapshot coordinates disagree with catalog")
        locations.append(loc)
        values, missing, rejected = record["values"], record["missing"], record["rejected"]
        reasons = missing + rejected
        if len(values) != len(MONTHS) or len(set(reasons)) != len(reasons) or any(m not in MONTHS for m in reasons):
            raise ValueError("NDVI quality/month counts are invalid")
        for month, value in zip(MONTHS, values):
            if (value is None) != (month in reasons):
                raise ValueError("NDVI nulls and QA counts disagree")
            quality = "missing" if month in missing else "rejected" if month in rejected else "valid"
            reason = "source_qa" if quality == "rejected" else "source_missing" if quality == "missing" else None
            observations.append(row(loc, "NDVI", month, value, quality, reason, source="modis"))
    product = {"id": "modis:MOD13A3:061", "source": "modis", "name": "MOD13A3", "version": "061",
               "source_url": "https://appeears.earthdatacloud.nasa.gov/", "resolution": "1 km monthly composite"}
    return batch(product, data["retrievedAt"], artifact(path), locations, observations,
                 {"task_id": data["taskId"], "scaling": "already scaled; identity transform", "input": "validated published snapshot; raw QA bits remain in the original CSV"})


def batch_id(doc):
    identity = [doc["product"]["id"], doc["artifact"]["sha256"], doc["normalization_version"], doc["qa_policy"]]
    return hashlib.sha256(json.dumps(identity, separators=(",", ":")).encode()).hexdigest()


def payload_sha256(doc):
    normalized = {**doc, "artifact": {"sha256": doc["artifact"]["sha256"]}}
    return hashlib.sha256(json.dumps(normalized, sort_keys=True, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode()).hexdigest()


def summary(doc):
    return {"batch_id": batch_id(doc), "source": doc["product"]["source"], "artifact_sha256": doc["artifact"]["sha256"],
            "observations": len(doc["observations"]), "quality": dict(Counter(r["quality"] for r in doc["observations"]))}
