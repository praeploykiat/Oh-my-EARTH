"""Durable, fenced work claims. Callers use autocommit connections."""
import hashlib
import json
from uuid import uuid4
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from .observations import catalog


class LeaseLost(RuntimeError):
    pass


def enqueue(conn, source, spec, external_task_id=None, reuse_existing=True):
    identity = hashlib.sha256(json.dumps([source, spec], sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    with conn.transaction():
        reused = False
        if source == "power" and reuse_existing:
            loc = next(c for c in catalog() if c["code"] == spec["country"])
            reused = conn.execute("""SELECT count(DISTINCT (o.variable,o.month))=1152 FROM earth.observations o
              JOIN earth.ingestion_batches b ON b.id=o.batch_id JOIN earth.products p ON p.id=o.product_id
              WHERE o.location_id=%s AND p.source='power' AND b.qa_policy='power-screen-v1'
              AND b.normalization_version='monthly-observation-v1'""",(loc["id"],)).fetchone()[0]
        conn.execute("""INSERT INTO earth.ingestion_jobs(work_key,source,spec,external_task_id,status,checkpoint)
          VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT (work_key) DO NOTHING""",
          (identity,source,Jsonb(spec),external_task_id,"succeeded" if reused else "pending",Jsonb({"reused_database": True} if reused else {})))
        with conn.cursor(row_factory=dict_row) as cur:
            return cur.execute("SELECT * FROM earth.ingestion_jobs WHERE work_key=%s",(identity,)).fetchone()


def claim(conn, source=None, lease_seconds=300, allowed_sources=None):
    token = uuid4()
    with conn.transaction(), conn.cursor(row_factory=dict_row) as cur:
        return cur.execute("""WITH candidate AS (
          SELECT id FROM earth.ingestion_jobs WHERE (%s::text IS NULL OR source=%s)
          AND (%s::text[] IS NULL OR source=ANY(%s))
          AND available_at <= clock_timestamp() AND failures < max_failures
          AND (status IN ('pending','failed') OR (status='running' AND (lease_until IS NULL OR lease_until < clock_timestamp())))
          ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 1
        ) UPDATE earth.ingestion_jobs j SET status='running',lease_token=%s,
          lease_until=clock_timestamp()+(%s * interval '1 second'),attempts=j.attempts+1,updated_at=clock_timestamp()
          FROM candidate WHERE j.id=candidate.id RETURNING j.*""",(source,source,allowed_sources,allowed_sources,token,lease_seconds)).fetchone()


def guard(conn, job, lock=False):
    query = "SELECT id FROM earth.ingestion_jobs WHERE id=%s AND status='running' AND lease_token=%s AND lease_until>clock_timestamp()"
    if lock: query += " FOR UPDATE"
    if not conn.execute(query,(job["id"],job["lease_token"])).fetchone():
        raise LeaseLost("Worker lease expired or was replaced")


def checkpoint(conn, job, data=None, external_task_id=None):
    with conn.transaction():
        guard(conn,job,lock=True)
        if data: job["checkpoint"].update(data)
        if external_task_id: job["external_task_id"] = external_task_id
        conn.execute("""UPDATE earth.ingestion_jobs SET checkpoint=%s,external_task_id=%s,
          lease_until=clock_timestamp()+interval '300 seconds',updated_at=clock_timestamp() WHERE id=%s""",
          (Jsonb(job["checkpoint"]),job["external_task_id"],job["id"]))


def finish(conn,job,doc):
    from .database import import_batch
    with conn.transaction():
        guard(conn,job,lock=True)
        result=import_batch(conn,doc)
        job["checkpoint"]["batch_id"]=result["batch_id"]
        conn.execute("""UPDATE earth.ingestion_jobs SET status='succeeded',checkpoint=%s,lease_token=NULL,
          lease_until=NULL,failures=0,last_error=NULL,updated_at=clock_timestamp() WHERE id=%s""",(Jsonb(job["checkpoint"]),job["id"]))
    return result


def defer(conn,job,seconds=60):
    with conn.transaction():
        guard(conn,job,lock=True)
        conn.execute("""UPDATE earth.ingestion_jobs SET status='pending',lease_token=NULL,lease_until=NULL,
          failures=0,available_at=clock_timestamp()+(%s * interval '1 second'),updated_at=clock_timestamp() WHERE id=%s""",(seconds,job["id"]))


def fail(conn,job,message,permanent=False,retry_after=0):
    with conn.transaction():
        guard(conn,job,lock=True)
        count=job["max_failures"] if permanent else job["failures"]+1
        delay=max(retry_after,min(3600,30 * 2**min(count,6)))
        conn.execute("""UPDATE earth.ingestion_jobs SET status='failed',failures=%s,last_error=%s,
          lease_token=NULL,lease_until=NULL,available_at=clock_timestamp()+(%s * interval '1 second'),updated_at=clock_timestamp() WHERE id=%s""",
          (count,message[:200],delay,job["id"]))
