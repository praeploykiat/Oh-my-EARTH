import { fetchPowerResponse, requestUrl } from '../../core/data/power';
import { START_YEAR, END_YEAR } from '../../core/data/range';
import { completeMonthlyRecord, GLOBAL_VARIABLES, type PowerVariable } from './data';
import type { SeriesPoint } from '../../core/data';

type ObjectValue = Record<string, unknown>;
export interface Coordinates { lat: number; lon: number }
export interface ValidatedVariable {
  series: SeriesPoint[];
  sourceUnit: string;
  missing: string[];
  rejected: string[];
}
export interface GlobalRecord {
  variables: Record<PowerVariable, ValidatedVariable>;
  requested: Coordinates;
  responseCoordinates: Coordinates;
  retrievedAt: string;
  requestUrl: string;
  sources: string[];
  raw: unknown;
}

function object(value: unknown, label: string): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid NASA POWER ${label}`);
  return value as ObjectValue;
}

// Conservative monthly terrestrial screening bounds; these are not NASA QC flags.
const RULES: Record<PowerVariable, { units: string[]; min: number; max: number }> = {
  T2M: { units: ['c', '°c'], min: -100, max: 70 },
  PRECTOTCORR: { units: ['mm/day'], min: 0, max: 1000 },
  RH2M: { units: ['%'], min: 0, max: 100 },
  ALLSKY_SFC_SW_DWN: { units: ['kw-hr/m^2/day', 'kwh/m^2/day', 'kwh/m²/day'], min: 0, max: 24 },
};

export function globalRequestUrl(point: Coordinates): string {
  return requestUrl({ parameter: GLOBAL_VARIABLES.join(','), ...point });
}

export function validateGlobalResponse(body: unknown, requested: Coordinates, retrievedAt: string): GlobalRecord {
  if (!Number.isFinite(requested.lat) || !Number.isFinite(requested.lon) || Math.abs(requested.lat) > 90 || Math.abs(requested.lon) > 180) throw new Error('Invalid requested coordinates');
  if (!Number.isFinite(Date.parse(retrievedAt))) throw new Error('Invalid retrieval timestamp');
  const root = object(body, 'response');
  const header = object(root.header, 'header');
  if (header.fill_value !== undefined && (typeof header.fill_value !== 'number' || !Number.isFinite(header.fill_value))) throw new Error('Invalid NASA POWER fill value');
  const fill = typeof header.fill_value === 'number' && Number.isFinite(header.fill_value) ? header.fill_value : -999;
  const geometry = object(root.geometry, 'geometry');
  const coords = geometry.coordinates;
  if (geometry.type !== 'Point' || !Array.isArray(coords) || coords.length < 2
    || !coords.slice(0, 2).every((v) => typeof v === 'number' && Number.isFinite(v))
    || Math.abs(coords[0] as number) > 180 || Math.abs(coords[1] as number) > 90) throw new Error('Invalid response coordinates');
  const responseCoordinates = { lon: coords[0] as number, lat: coords[1] as number };
  if (Math.abs(responseCoordinates.lat - requested.lat) > 0.01 || Math.abs(responseCoordinates.lon - requested.lon) > 0.01) throw new Error('NASA response is for a different location');
  const parameters = object(object(root.properties, 'properties').parameter, 'monthly parameters');
  const metadata = object(root.parameters, 'parameter units');
  const variables = {} as Record<PowerVariable, ValidatedVariable>;
  for (const key of GLOBAL_VARIABLES) {
    const raw = object(parameters[key], key);
    const sourceUnit = object(metadata[key], `${key} metadata`).units;
    const rule = RULES[key];
    if (typeof sourceUnit !== 'string' || !rule.units.includes(sourceUnit.toLowerCase().replace(/\s/g, ''))) throw new Error(`Unexpected units for ${key}: ${String(sourceUnit)}`);
    const rejected: string[] = [];
    const observations: SeriesPoint[] = [];
    for (const [date, value] of Object.entries(raw)) {
      if (/^\d{4}13$/.test(date)) continue;
      if (!/^\d{4}(0[1-9]|1[0-2])$/.test(date)) throw new Error(`Invalid ${key} month: ${date}`);
      const year = Number(date.slice(0, 4));
      if (year < START_YEAR || year > END_YEAR) throw new Error(`Unexpected ${key} year: ${year}`);
      const t = `${date.slice(0, 4)}-${date.slice(4)}`;
      if (value === fill || value === null) { observations.push({ t, value: null }); continue; }
      const valid = typeof value === 'number' && Number.isFinite(value) && value >= rule.min && value <= rule.max;
      if (!valid) rejected.push(t);
      observations.push({ t, value: valid ? value as number : null });
    }
    const series = completeMonthlyRecord(observations);
    variables[key] = { series, sourceUnit, rejected, missing: series.filter((p) => p.value === null && !rejected.includes(p.t)).map((p) => p.t) };
  }
  return {
    variables, requested: { lat: requested.lat, lon: requested.lon }, responseCoordinates, retrievedAt, requestUrl: globalRequestUrl(requested), raw: body,
    sources: Array.isArray(header.sources) ? header.sources.filter((s): s is string => typeof s === 'string') : [],
  };
}

const memory = new Map<string, Promise<GlobalRecord>>();

export function fetchGlobalRecord(point: Coordinates, refresh = false): Promise<GlobalRecord> {
  const key = `global-power:v1:${START_YEAR}:${END_YEAR}:${point.lat.toFixed(4)}:${point.lon.toFixed(4)}`;
  if (refresh) {
    memory.delete(key);
    try { sessionStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
  }
  if (!memory.has(key)) {
    const pending = (async () => {
      try {
        const cached = sessionStorage.getItem(key);
        if (cached) {
          const envelope = object(JSON.parse(cached), 'cached response');
          if (typeof envelope.retrievedAt === 'string') return validateGlobalResponse(envelope.body, point, envelope.retrievedAt);
        }
      } catch { /* Re-fetch corrupt or incompatible cached responses. */ }
      const body = await fetchPowerResponse({ ...point, parameter: GLOBAL_VARIABLES.join(',') });
      const retrievedAt = new Date().toISOString();
      const result = validateGlobalResponse(body, point, retrievedAt);
      try { sessionStorage.setItem(key, JSON.stringify({ body, retrievedAt })); } catch { /* Retain memory cache. */ }
      return result;
    })().catch((error: unknown) => { memory.delete(key); throw error; });
    memory.set(key, pending);
  }
  return memory.get(key)!;
}
