import { computeTrend } from '../analysis/trend';
import { geoDistance } from 'd3-geo';
import { loadProvinceBoundaries, nearestProvince, type Place } from '../geo';
import { loadCatalog, loadDataset } from './loadDataset';
import { fetchPowerMonthly } from './power';
import { fetchRemoteMonthly } from './proxy';
import type { Dataset, SeriesPoint } from './types';
import { variableByKey, type VariableSource } from './variables';

export interface Query {
  variable: string;
  place: Place;
}

export type Origin = 'live' | 'saved';

export interface Resolved {
  dataset: Dataset;
  origin: Origin;
}

export interface FeaturedCase {
  id: string;
  file: string;
  variable: string;
  place: Place;
  regionName: string;
  synthetic: boolean;
}

export class NoDataError extends Error {}

// Featured cases

let featured: Promise<FeaturedCase[]> | null = null;

export function loadFeaturedCases(): Promise<FeaturedCase[]> {
  featured ??= (async () => {
    const [catalog, boundaries] = await Promise.all([loadCatalog(), loadProvinceBoundaries()]);
    const datasets = await Promise.all(catalog.datasets.map((entry) => loadDataset(entry.file)));
    return datasets.map((dataset, i) => {
      const { lat, lon, name } = dataset.region;
      const province = nearestProvince(boundaries, { lat, lon });
      return {
        id: dataset.id,
        file: catalog.datasets[i].file,
        variable: dataset.variable.key,
        place: { lat, lon, provinceCode: province?.properties.code ?? null },
        regionName: name,
        synthetic: Boolean(dataset.source.synthetic),
      };
    });
  })();
  return featured;
}

const NEARBY_RADIANS = 0.5 / 57.3;

function isNearby(a: Place, b: Place): boolean {
  const sameProvince = a.provinceCode !== null && a.provinceCode === b.provinceCode;
  return sameProvince || geoDistance([a.lon, a.lat], [b.lon, b.lat]) < NEARBY_RADIANS;
}

async function savedDataset(query: Query): Promise<Dataset | null> {
  const cases = await loadFeaturedCases();
  const match = cases.find((c) => c.variable === query.variable && isNearby(c.place, query.place));
  return match ? loadDataset(match.file) : null;
}

// Live data

function fetchLive(query: Query, source: VariableSource): Promise<SeriesPoint[]> {
  const { lat, lon } = query.place;
  return source === 'power'
    ? fetchPowerMonthly({ parameter: query.variable, lat, lon })
    : fetchRemoteMonthly({ variable: query.variable, lat, lon });
}

async function liveDataset(query: Query): Promise<Dataset> {
  const definition = variableByKey(query.variable);
  if (!definition) throw new NoDataError(`Unknown variable ${query.variable}`);

  const series = await fetchLive(query, definition.source);
  return {
    id: `live-${query.variable}-${query.place.lat.toFixed(2)}-${query.place.lon.toFixed(2)}`.toLowerCase().replace(/\./g, '_'),
    variable: { key: query.variable, label: definition.label.en },
    unit: definition.unit,
    source: definition.provider,
    region: { name: query.place.provinceCode ?? 'Custom location', lat: query.place.lat, lon: query.place.lon },
    resolution: 'monthly',
    series,
    trend: computeTrend(series, 'monthly'),
  };
}

// Resolution

export async function resolveQuery(query: Query): Promise<Resolved> {
  try {
    return { dataset: await liveDataset(query), origin: 'live' };
  } catch (liveError) {
    const saved = await savedDataset(query);
    if (saved) return { dataset: { ...saved, trend: computeTrend(saved.series, saved.resolution) }, origin: 'saved' };
    throw new NoDataError(liveError instanceof Error ? liveError.message : String(liveError));
  }
}
