ALTER TABLE earth.products DROP CONSTRAINT products_source_check;
ALTER TABLE earth.products ADD CONSTRAINT products_source_check CHECK (source IN ('power','modis','gldas','giovanni'));
ALTER TABLE earth.ingestion_jobs DROP CONSTRAINT ingestion_jobs_source_check;
ALTER TABLE earth.ingestion_jobs ADD CONSTRAINT ingestion_jobs_source_check CHECK (source IN ('power','modis','gldas','giovanni'));
