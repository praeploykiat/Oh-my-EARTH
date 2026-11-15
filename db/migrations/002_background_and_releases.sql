ALTER TABLE earth.ingestion_jobs ADD COLUMN spec jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE earth.ingestion_jobs ADD COLUMN lease_token uuid;
ALTER TABLE earth.ingestion_jobs ADD COLUMN failures integer NOT NULL DEFAULT 0 CHECK (failures >= 0);
ALTER TABLE earth.ingestion_jobs ADD COLUMN max_failures integer NOT NULL DEFAULT 5 CHECK (max_failures > 0);
CREATE TABLE earth.cache_releases (
 id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{64}$'),
 status text NOT NULL CHECK (status IN ('prepared', 'published')),
 manifest jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 published_at timestamptz
);
