"""Local database commands. No command fetches NASA data or changes web datasets."""
import argparse
import json
from pathlib import Path
from src.observations import ROOT, power_batch, ndvi_batch, summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("migrate")
    sub.add_parser("status")
    load = sub.add_parser("import-validated")
    load.add_argument("--power-dir", type=Path, default=ROOT / "pipeline/raw/global-validation")
    load.add_argument("--ndvi", type=Path, help="Explicit offline archival NDVI import; excluded from the current published release")
    load.add_argument("--dry-run", action="store_true")
    load.add_argument("--report", type=Path, default=ROOT / "pipeline/raw/database-import-report.json")
    args = parser.parse_args()
    docs = []
    if args.command == "import-validated":
        if not args.power_dir.is_dir():
            raise ValueError("POWER snapshot directory is missing; supply --power-dir or first run validate:global:live")
        paths = sorted(args.power_dir.glob("*.json"))
        if not paths:
            raise ValueError("No POWER snapshots found")
        # Normalize and validate every input before writing anything to the database.
        docs = [power_batch(p) for p in paths] + ([ndvi_batch(args.ndvi)] if args.ndvi else [])
        if args.dry_run:
            print(json.dumps({"status": "validated_only", "batches": [summary(d) for d in docs]}, indent=2))
            return
    from src.database import connect, migrate, seed_locations, import_batch, status
    with connect() as conn:
        if args.command == "migrate":
            print(json.dumps({"applied": migrate(conn)}))
        elif args.command == "status":
            print(json.dumps(status(conn), indent=2))
        else:
            seed_locations(conn)
            outcomes = [import_batch(conn, d) for d in docs]
            report = {"imports": outcomes, "database": status(conn), "inputs": [summary(d) for d in docs],
                      "scope": "Local validated snapshots only; no new NASA fetches and no frontend data changes."}
            args.report.parent.mkdir(parents=True, exist_ok=True)
            args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
            print(json.dumps(report, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Never print connection strings or credential-bearing driver diagnostics.
        if type(error).__module__.startswith("psycopg"):
            print(f"Database operation failed ({type(error).__name__}, SQLSTATE {getattr(error, 'sqlstate', None)}). Check Docker, local configuration, and migrations.")
        else:
            print(f"ERROR: {error}")
        raise SystemExit(1) from None
