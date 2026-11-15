-- Isolated review data. Never selected by the production observation publisher.
CREATE TABLE earth.co2_review_records (
  capital_code text PRIMARY KEY,
  product text NOT NULL CHECK (product = 'OCO2_GEOS_L3CO2_DAY.10r'),
  artifact_sha256 text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  payload jsonb NOT NULL
);
