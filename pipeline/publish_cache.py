"""Publish cached explorer files from PostgreSQL; no NASA calls."""
import json
from src.database import connect, migrate
from src.publication import publish
if __name__=='__main__':
    with connect() as conn:
        conn.autocommit=True;migrate(conn);print(json.dumps(publish(conn)))
