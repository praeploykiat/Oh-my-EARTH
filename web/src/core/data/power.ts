import { cachedSeries, fetchWithTimeout } from './cache';
import { END_YEAR, START_YEAR } from './range';
import type { SeriesPoint } from './types';

export const POWER_URL = 'https://power.larc.nasa.gov/api/temporal/monthly/point';
export const POWER_HOME = 'https://power.larc.nasa.gov/';

const MISSING = -999;
const TIMEOUT_MS = 20000;
const STORAGE_PREFIX = 'power:';

export interface PowerRequest {
  parameter: string;
  lat: number;
  lon: number;
}

interface PowerResponse {
  properties: { parameter: Record<string, Record<string, number>> };
}

// Parsing

export function parsePowerMonthly(body: PowerResponse, parameter: string): SeriesPoint[] {
  const raw = body.properties.parameter[parameter];
  if (!raw) throw new Error(`NASA POWER response has no ${parameter}`);

  return Object.keys(raw)
    .filter((key) => key.slice(4) !== '13')
    .sort()
    .map((key) => ({
      t: `${key.slice(0, 4)}-${key.slice(4)}`,
      value: raw[key] === MISSING ? null : raw[key],
    }));
}

export function requestUrl({ parameter, lat, lon }: PowerRequest): string {
  const params = new URLSearchParams({
    parameters: parameter,
    community: 'RE',
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    start: String(START_YEAR),
    end: String(END_YEAR),
    format: 'JSON',
  });
  return `${POWER_URL}?${params}`;
}

// Fetching

export function fetchPowerMonthly(request: PowerRequest): Promise<SeriesPoint[]> {
  return cachedSeries(cacheKey(request), async () => {
    const response = await fetchWithTimeout(requestUrl(request), TIMEOUT_MS);
    if (!response.ok) throw new Error(`NASA POWER returned ${response.status}`);
    return parsePowerMonthly((await response.json()) as PowerResponse, request.parameter);
  });
}

function cacheKey(request: PowerRequest): string {
  return `${STORAGE_PREFIX}${request.parameter}:${request.lat.toFixed(2)}:${request.lon.toFixed(2)}`;
}
