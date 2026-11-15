import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const datasetsDir = join(root, 'web', 'public', 'datasets');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf-8'));

const ajv = new Ajv2020({ allErrors: true });
const validateCatalog = ajv.compile(readJson(join(root, 'contracts', 'catalog.schema.json')));
const validateDataset = ajv.compile(readJson(join(root, 'contracts', 'dataset.schema.json')));

const errors = [];
const catalog = readJson(join(datasetsDir, 'catalog.json'));
if (!validateCatalog(catalog)) errors.push(['catalog.json', validateCatalog.errors]);

for (const entry of catalog.datasets ?? []) {
  const dataset = readJson(join(datasetsDir, entry.file));
  if (!validateDataset(dataset)) errors.push([entry.file, validateDataset.errors]);
}

const validateNDVI = ajv.compile(readJson(join(root, 'contracts', 'global-ndvi.schema.json')));
if (!validateNDVI(readJson(join(root, 'pipeline', 'fixtures', 'ndvi-pilot.json')))) errors.push(['archived ndvi-pilot.json', validateNDVI.errors]);

if (errors.length > 0) {
  for (const [file, details] of errors) console.error(file, JSON.stringify(details, null, 2));
  process.exit(1);
}
console.log(`Validated catalog and ${catalog.datasets.length} datasets, plus the archived NDVI test fixture (not deployed)`);
