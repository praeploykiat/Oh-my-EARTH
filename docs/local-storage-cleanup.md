# Local storage cleanup and database shutdown

Removed 635 confirmed obsolete staging/archive files and a byte-identical pilot console duplicate, reclaiming 27.33 MB. Database artifact references were checked before removal. Active published caches, private credentials, source fixtures, unique raw downloads, CO2 review publication inputs and durable ingestion checkpoints remain intact.

PostgreSQL was backed up to ignored `pipeline/raw/backups/earth-trends-20261115-before-cleanup.dump` (3.83 MB). The dump was restored into a new disposable database and its 393,408 observations, 781 batches, 781 jobs and 195 CO2 records matched the original. The disposable database was removed. PostgreSQL container `earth-trend-detective-db-1` is stopped; its original database volume remains available. No ingestion worker was running.

To resume local refresh work, start Docker Desktop if necessary and run:

```powershell
docker start earth-trend-detective-db-1
```

Normal web use and Vercel deployment do not require this container. Global Explorer automatically loads its selected variable and capital from published static data. Custom-period maps now automatically load saved monthly records with two simultaneous downloads at most; there is no separate fetch step and no live NASA request. Existing stop/retry controls remain available. Changes of variable or period cancel obsolete loading work.

With PostgreSQL stopped, all 169 web tests, validation of 575 referenced cache assets and the production build passed. Browser verification reached 195 loaded and 195 colored capitals for a custom POWER range without clicking fetch. Switching to CO2 loaded its map and chart automatically. Workbench, Game, Hotspot and Methods rendered without console errors. These checks cover local production behavior, not live upstream NASA service availability.

See `local-cleanup-verification.json` for backup checksum and verification details. Per-file cleanup evidence is kept privately in `pipeline/raw/cleanup-removed-files.json`. The backup and private raw files are excluded from Git. No deployment or commit was performed.
