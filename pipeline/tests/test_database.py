"""Opt-in real PostgreSQL tests. Only throwaway earth_test_<uuid> databases are created/dropped."""
import copy
import os
import re
import uuid
from pathlib import Path
import pytest
from test_observations import power_envelope, power_doc  # fixture reuse

pytestmark = pytest.mark.skipif(os.environ.get("RUN_DATABASE_TESTS") != "1", reason="Set RUN_DATABASE_TESTS=1 with local/CI PostgreSQL")


@pytest.fixture
def db():
    pytest.importorskip("psycopg")
    from psycopg import sql
    from src.database import connect, migrate
    name = "earth_test_" + uuid.uuid4().hex
    assert re.fullmatch(r"earth_test_[a-f0-9]{32}", name)
    with connect() as admin:
        admin.autocommit = True
        admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
        try:
            with connect(database=name) as connection:
                connection.autocommit = True
                migrate(connection)
                yield connection
        finally:
            admin.execute(sql.SQL("DROP DATABASE {}").format(sql.Identifier(name)))


def test_migrations_are_repeatable_and_changed_checksums_are_rejected(db, tmp_path):
    from src.database import migrate
    from src.observations import ROOT
    assert migrate(db) == []
    original = ROOT / "db/migrations/001_observations.sql"
    (tmp_path / original.name).write_text(original.read_text(encoding="utf-8") + "\n-- changed")
    with pytest.raises(ValueError, match="Applied migration changed"): migrate(db, tmp_path)
    assert db.execute("SELECT count(*) FROM earth.schema_migrations").fetchone()[0] == len(list((ROOT / "db/migrations").glob("*.sql")))


def test_duplicate_import_is_noop_and_changed_payload_is_not_overwritten(db, power_doc):
    from src.database import seed_locations, import_batch, status
    seed_locations(db)
    assert import_batch(db, power_doc)["inserted"] == 1152
    assert import_batch(db, power_doc)["inserted"] == 0
    assert status(db)["observations"] == 1152
    changed = copy.deepcopy(power_doc); changed["observations"][0]["value"] = 24
    with pytest.raises(ValueError, match="different observations"): import_batch(db, changed)
    assert status(db)["batches"] == 1


def test_failure_rolls_back_entire_artifact(db, power_doc):
    import psycopg
    from src.database import import_batch
    # Valid contract but locations were deliberately not seeded: FK fails after batch insertion.
    with pytest.raises(psycopg.errors.ForeignKeyViolation): import_batch(db, power_doc)
    assert db.execute("SELECT count(*) FROM earth.ingestion_batches").fetchone()[0] == 0
    assert db.execute("SELECT count(*) FROM earth.products").fetchone()[0] == 0
    assert db.execute("SELECT count(*) FROM earth.observations").fetchone()[0] == 0


def test_revisions_preserve_history_and_older_retrieval_cannot_replace_newer(db, power_doc):
    from src.database import seed_locations, import_batch
    seed_locations(db); import_batch(db, power_doc)
    older = copy.deepcopy(power_doc)
    older["artifact"]["sha256"] = "a" * 64
    older["retrieved_at"] = "2025-01-01T00:00:00Z"
    older["observations"][0]["value"] = 20
    import_batch(db, older)
    assert db.execute("SELECT count(*) FROM earth.observations").fetchone()[0] == 2304
    assert db.execute("SELECT value FROM earth.latest_observations WHERE variable='T2M' AND month='2001-01-01'").fetchone()[0] == 25
    assert db.execute("SELECT count(*) FROM earth.latest_observations").fetchone()[0] == 1152


@pytest.mark.parametrize("column,value", [("unit","1"),("value",1000),("value",float("inf")),("month","2001-01-02")])
def test_database_enforces_units_ranges_and_month_boundaries(db, power_doc, column, value):
    import psycopg
    from psycopg import sql
    from src.database import seed_locations, import_batch
    seed_locations(db); import_batch(db,power_doc)
    with pytest.raises(psycopg.IntegrityError):
        db.execute(sql.SQL("UPDATE earth.observations SET {} = %s WHERE variable='T2M' AND month='2001-01-01'").format(sql.Identifier(column)),(value,))
