"""PostgreSQL migration and immutable, artifact-atomic observation imports."""
import hashlib
import os
from pathlib import Path
import psycopg
from psycopg.types.json import Jsonb
from .observations import ROOT, PROFILES, batch_id, payload_sha256, validate_batch, catalog


def connection_settings():
    values = {}
    path = ROOT / "db/.env"
    if path.exists():
        for line in path.read_text(encoding="utf-8-sig").splitlines():
            key, sep, value = line.strip().partition("=")
            if sep and key in {"PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD"}:
                values[key] = value.strip().strip("\"'")
    for key in ["PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD"]:
        if key in os.environ:
            values[key] = os.environ[key]
    return {key: values.get(env, default) for key, env, default in [
        ("host", "PGHOST", "127.0.0.1"), ("port", "PGPORT", "54329"),
        ("dbname", "PGDATABASE", "earth_trends"), ("user", "PGUSER", "earth_app"),
        ("password", "PGPASSWORD", "")]}


def connect(database=None):
    # Credentials never appear in arguments, logs, reports or browser configuration.
    if os.environ.get("DATABASE_URL"):
        return psycopg.connect(os.environ["DATABASE_URL"], **({"dbname": database} if database else {}), connect_timeout=5)
    settings = connection_settings()
    if database:
        settings["dbname"] = database
    return psycopg.connect(**settings, connect_timeout=5)


def migrate(conn, directory=None):
    directory = Path(directory or ROOT / "db/migrations")
    applied = []
    with conn.transaction():
        conn.execute("SELECT pg_advisory_xact_lock(hashtext('earth-schema-migrations-v1'))")
        conn.execute("CREATE SCHEMA IF NOT EXISTS earth")
        conn.execute("CREATE TABLE IF NOT EXISTS earth.schema_migrations (name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT clock_timestamp())")
        for path in sorted(directory.glob("*.sql")):
            checksum = hashlib.sha256(path.read_bytes()).hexdigest()
            previous = conn.execute("SELECT sha256 FROM earth.schema_migrations WHERE name = %s", (path.name,)).fetchone()
            if previous:
                if previous[0] != checksum:
                    raise ValueError(f"Applied migration changed: {path.name}. Add a new migration instead.")
                continue
            conn.execute(path.read_text(encoding="utf-8"))
            conn.execute("INSERT INTO earth.schema_migrations(name, sha256) VALUES (%s, %s)", (path.name, checksum))
            applied.append(path.name)
    return applied


def seed_locations(conn):
    checksum = hashlib.sha256((ROOT / "web/public/geo/capitals.json").read_bytes()).hexdigest()
    with conn.transaction():
        for c in catalog():
            conn.execute("""INSERT INTO earth.locations(id, country_code, iso3, country, capital, latitude, longitude, catalog_sha256)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING""",
                         (c["id"], c["code"], c["iso3"], c["country"], c["city"], c["lat"], c["lon"], checksum))
    return len(catalog())


def import_batch(conn, doc):
    validate_batch(doc)
    identity, digest = batch_id(doc), payload_sha256(doc)
    product = doc["product"]
    with conn.transaction():
        # Concurrent retries of this artifact serialize, without blocking unrelated imports.
        conn.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (identity,))
        previous = conn.execute("SELECT payload_sha256 FROM earth.ingestion_batches WHERE id = %s", (identity,)).fetchone()
        if previous:
            if previous[0] != digest:
                raise ValueError("Same artifact identity produced different observations; increment the normalizer/QA version")
            return {"batch_id": identity, "status": "already_imported", "inserted": 0}
        conn.execute("""INSERT INTO earth.products(id, source, name, version, source_url, resolution)
            VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING""",
                     tuple(product[k] for k in ["id", "source", "name", "version", "source_url", "resolution"]))
        existing = conn.execute("SELECT source,name,version,source_url,resolution FROM earth.products WHERE id=%s", (product["id"],)).fetchone()
        if existing != tuple(product[k] for k in ["source", "name", "version", "source_url", "resolution"]):
            raise ValueError("Existing product identity has different metadata")
        for variable in sorted({r["variable"] for r in doc["observations"]}):
            rule=PROFILES[product["source"]]["variables"][variable]
            values = tuple(rule[k] for k in ["unit", "temporal_kind", "annual_aggregation", "minimum", "maximum"])
            conn.execute("""INSERT INTO earth.product_variables(product_id, variable, unit, temporal_kind, annual_aggregation, minimum, maximum)
                VALUES (%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (product_id, variable) DO NOTHING""", (product["id"], variable, *values))
            saved = conn.execute("SELECT unit,temporal_kind,annual_aggregation,minimum,maximum FROM earth.product_variables WHERE product_id=%s AND variable=%s", (product["id"], variable)).fetchone()
            if saved != values:
                raise ValueError("Source variable profile changed; review schema/normalizer version before import")
        conn.execute("""INSERT INTO earth.ingestion_batches
          (id,product_id,artifact_sha256,artifact_path,payload_sha256,normalization_version,qa_policy,retrieved_at,observation_count,metadata)
          VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
          (identity, product["id"], doc["artifact"]["sha256"], doc["artifact"]["path"], digest,
           doc["normalization_version"], doc["qa_policy"], doc["retrieved_at"], len(doc["observations"]), Jsonb(doc["metadata"])))
        with conn.cursor() as cursor:
            cursor.executemany("""INSERT INTO earth.observations
                (batch_id,product_id,location_id,variable,month,unit,value,quality,reason)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                [(identity, product["id"], r["location_id"], r["variable"], r["month"] + "-01", r["unit"], r["value"], r["quality"], r["reason"]) for r in doc["observations"]])
    return {"batch_id": identity, "status": "imported", "inserted": len(doc["observations"])}


def status(conn):
    # Explicit names keep identifiers out of dynamic SQL.
    return {"locations": conn.execute("SELECT count(*) FROM earth.locations").fetchone()[0],
            "products": conn.execute("SELECT count(*) FROM earth.products").fetchone()[0],
            "batches": conn.execute("SELECT count(*) FROM earth.ingestion_batches").fetchone()[0],
            "observations": conn.execute("SELECT count(*) FROM earth.observations").fetchone()[0],
            "quality": dict(conn.execute("SELECT quality,count(*) FROM earth.observations GROUP BY quality ORDER BY quality").fetchall()),
            "migrations": [r[0] for r in conn.execute("SELECT name FROM earth.schema_migrations ORDER BY name").fetchall()]}
