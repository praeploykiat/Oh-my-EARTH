import type { Catalog, Dataset } from './types';

export class DatasetError extends Error {}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export function assertCatalog(data: unknown): Catalog {
  if (!isObject(data) || !Array.isArray(data.datasets)) {
    throw new DatasetError('Catalog must have a "datasets" array');
  }
  return data as unknown as Catalog;
}

export function assertDataset(data: unknown): Dataset {
  if (!isObject(data)) throw new DatasetError('Dataset must be an object');

  const required = ['id', 'variable', 'unit', 'source', 'region', 'resolution', 'series', 'trend'];
  const missing = required.filter((key) => !(key in data));
  if (missing.length) throw new DatasetError(`Dataset is missing: ${missing.join(', ')}`);

  if (!Array.isArray(data.series) || data.series.length < 3) {
    throw new DatasetError('Dataset series must have at least 3 points');
  }
  return data as unknown as Dataset;
}
