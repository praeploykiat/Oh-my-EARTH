import { capitalByCode, type Capital } from '../../core/geo/capitals';
import { type GlobalRecord, type ValidatedVariable } from './powerRecord';
import { loadPublishedRecord, publishedAvailability, PublishedDataUnavailableError } from './publishedCache';
import { completeMonthlyRecord, type GlobalVariable } from './data';

export type ExplorerRecord = Omit<GlobalRecord, 'variables'> & {
  cache?: { releaseId: string; publishedAt: string; path: string };
  source: 'power' | 'modis' | 'gldas' | 'giovanni';
  variables: Partial<Record<GlobalVariable, ValidatedVariable>>;
};
export function recordVariable(record: Pick<ExplorerRecord, 'variables'>, variable: GlobalVariable): ValidatedVariable {
  const data = record.variables[variable];
  if (!data) throw new Error(`Record does not contain ${variable}`);
  return data;
}
export const NDVI_SOURCE = 'https://appeears.earthdatacloud.nasa.gov/';
type NDVIRow = { requested: { lat: number; lon: number }; values: (number | null)[]; missing: string[]; rejected: string[] };
export interface NDVIDataset { schemaVersion: 1; product: string; unit: string; variable: string; period: { start: number; end: number }; retrievedAt: string; qaPolicy: string; taskId: string; records: Record<string, NDVIRow> }
export function validateNDVIDataset(value: unknown): NDVIDataset {
  if (!value || typeof value !== 'object') throw new Error('Invalid NDVI snapshot');
  const d = value as NDVIDataset;
  if (d.schemaVersion !== 1 || d.product !== 'MOD13A3.061' || d.variable !== 'NDVI' || d.unit !== '1'
    || d.period?.start !== 2001 || d.period?.end !== 2024 || d.qaPolicy !== 'good-land-clear-v1'
    || !Number.isFinite(Date.parse(d.retrievedAt)) || typeof d.taskId !== 'string'
    || !d.records || typeof d.records !== 'object' || !Object.keys(d.records).length) throw new Error('Incompatible NDVI snapshot metadata');
  const months = completeMonthlyRecord([]).map((p) => p.t);
  for (const [code, record] of Object.entries(d.records)) {
    const capital = capitalByCode(code);
    if (!capital || !record || !record.requested || !Number.isFinite(record.requested.lat) || !Number.isFinite(record.requested.lon)
      || Math.abs(record.requested.lat - capital.lat) > 0.0001 || Math.abs(record.requested.lon - capital.lon) > 0.0001
      || !Array.isArray(record.values) || record.values.length !== months.length
      || !record.values.every((v) => v === null || typeof v === 'number' && Number.isFinite(v) && v >= -0.2000001 && v <= 1)
      || !Array.isArray(record.missing) || !Array.isArray(record.rejected)) throw new Error(`Invalid NDVI record: ${code}`);
    const reasons = [...record.missing, ...record.rejected];
    if (new Set(reasons).size !== reasons.length || reasons.some((month) => !months.includes(month))
      || months.some((month, i) => (record.values[i] === null) !== reasons.includes(month))) throw new Error(`Invalid NDVI quality counts: ${code}`);
  }
  return d;
}
export async function ndviAvailability() { return publishedAvailability('NDVI'); }
export { PublishedDataUnavailableError as NDVIUnavailableError };
export async function fetchExplorerRecord(capital: Capital, variable: GlobalVariable, _refresh = false): Promise<ExplorerRecord> {
  return loadPublishedRecord(capital,variable);
}
