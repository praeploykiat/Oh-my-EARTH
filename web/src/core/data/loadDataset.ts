import type { Catalog, Dataset } from './types';
import { assertCatalog, assertDataset } from './validate';

const DATASETS_URL = `${import.meta.env.BASE_URL}datasets/`;

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
  return response.json();
}

export async function loadCatalog(): Promise<Catalog> {
  return assertCatalog(await fetchJson(`${DATASETS_URL}catalog.json`));
}

export async function loadDataset(file: string): Promise<Dataset> {
  return assertDataset(await fetchJson(`${DATASETS_URL}${file}`));
}
