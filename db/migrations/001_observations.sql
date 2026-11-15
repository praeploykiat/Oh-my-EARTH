-- Additive, PostgreSQL 17-compatible foundation. Never edits frontend datasets.
CREATE TABLE earth.locations (
  id text PRIMARY KEY,
  country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  iso3 text NOT NULL CHECK (iso3 ~ '^[A-Z]{3}$'),
  country text NOT NULL,
  capital text NOT NULL,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  catalog_sha256 text NOT NULL CHECK (catalog_sha256 ~ '^[a-f0-9]{64}$'),
  UNIQUE (country_code, latitude, longitude)
);
CREATE TABLE earth.products (
  id text PRIMARY KEY,
  source text NOT NULL CHECK (source IN ('power', 'modis')),
  name text NOT NULL,
  version text NOT NULL,
  source_url text NOT NULL CHECK (source_url LIKE 'https://%'),
  resolution text NOT NULL,
  UNIQUE (source, name, version)
);
CREATE TABLE earth.product_variables (
  product_id text NOT NULL REFERENCES earth.products(id),
  variable text NOT NULL,
  unit text NOT NULL,
  temporal_kind text NOT NULL CHECK (temporal_kind IN ('monthly_mean', 'mean_daily_rate', 'monthly_composite')),
  annual_aggregation text NOT NULL CHECK (annual_aggregation IN ('day_weighted_mean', 'sum_rate_by_calendar_days')),
  minimum double precision NOT NULL,
  maximum double precision NOT NULL CHECK (maximum >= minimum),
  PRIMARY KEY (product_id, variable),
  UNIQUE (product_id, variable, unit)
);
CREATE TABLE earth.ingestion_batches (
  id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{64}$'),
  product_id text NOT NULL REFERENCES earth.products(id),
  artifact_sha256 text NOT NULL CHECK (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  artifact_path text NOT NULL,
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  normalization_version text NOT NULL,
  qa_policy text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  observation_count integer NOT NULL CHECK (observation_count >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (artifact_sha256, product_id, normalization_version, qa_policy),
  UNIQUE (id, product_id)
);
CREATE TABLE earth.observations (
  batch_id text NOT NULL,
  product_id text NOT NULL,
  location_id text NOT NULL REFERENCES earth.locations(id),
  variable text NOT NULL,
  month date NOT NULL CHECK (EXTRACT(DAY FROM month) = 1),
  unit text NOT NULL,
  value double precision,
  quality text NOT NULL CHECK (quality IN ('valid', 'missing', 'rejected')),
  reason text,
  PRIMARY KEY (batch_id, location_id, variable, month),
  FOREIGN KEY (batch_id, product_id) REFERENCES earth.ingestion_batches(id, product_id),
  FOREIGN KEY (product_id, variable, unit) REFERENCES earth.product_variables(product_id, variable, unit),
  CHECK ((quality = 'valid' AND value IS NOT NULL AND reason IS NULL)
      OR (quality IN ('missing', 'rejected') AND value IS NULL AND reason IS NOT NULL)),
  CHECK (value IS NULL OR (value > '-Infinity'::double precision AND value < 'Infinity'::double precision))
);
CREATE INDEX observations_lookup ON earth.observations (product_id, location_id, variable, month);
CREATE INDEX batches_freshness ON earth.ingestion_batches (product_id, retrieved_at DESC);
-- Durable work identities/external task IDs for the next background-worker milestone.
CREATE TABLE earth.ingestion_jobs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  work_key text NOT NULL UNIQUE,
  source text NOT NULL CHECK (source IN ('power', 'modis')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
  external_task_id uuid,
  checkpoint jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  lease_until timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX jobs_available ON earth.ingestion_jobs (available_at, id) WHERE status IN ('pending', 'failed');
-- A range check is tied to the source/variable profile, rather than a generic NDVI/POWER bound.
CREATE FUNCTION earth.check_observation_range() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE low double precision; high double precision;
BEGIN
  IF NEW.value IS NOT NULL THEN
    SELECT minimum, maximum INTO low, high FROM earth.product_variables
      WHERE product_id = NEW.product_id AND variable = NEW.variable;
    IF NEW.value < low OR NEW.value > high THEN
      RAISE EXCEPTION 'Observation is outside the product variable range' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER observation_range BEFORE INSERT OR UPDATE ON earth.observations
FOR EACH ROW EXECUTE FUNCTION earth.check_observation_range();
-- Keep QA policies and normalizer versions separate; never silently combine processing methods.
CREATE VIEW earth.latest_observations AS
SELECT DISTINCT ON (o.product_id, o.location_id, o.variable, o.month, b.qa_policy, b.normalization_version)
  o.*, b.qa_policy, b.normalization_version, b.retrieved_at, b.imported_at, b.artifact_sha256
FROM earth.observations o JOIN earth.ingestion_batches b ON b.id = o.batch_id
ORDER BY o.product_id, o.location_id, o.variable, o.month, b.qa_policy, b.normalization_version,
  b.retrieved_at DESC, b.imported_at DESC, b.id DESC;
