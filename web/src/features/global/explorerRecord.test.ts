import { describe, expect, it } from 'vitest';
import { completeMonthlyRecord } from './data';
import { validateNDVIDataset, recordVariable, type ExplorerRecord } from './explorerRecord';
import { mapAnalysis, mapScale, yearSummary } from './mapData';
import published from '../../../../pipeline/fixtures/ndvi-pilot.json';
import { globalVariableByKey } from './variables';

// Synthetic parser fixtures; live AppEEARS retrieval evidence is recorded separately.
function snapshot() {
  return {
    schemaVersion: 1, product: 'MOD13A3.061', variable: 'NDVI', unit: '1',
    period: { start: 2001, end: 2024 }, retrievedAt: '2026-11-15T00:00:00Z', qaPolicy: 'good-land-clear-v1', taskId: 'test-fixture',
    records: { TH: { requested: { lat: 13.75, lon: 100.52 }, values: Array.from({ length: 288 }, () => 0.25 as number | null), missing: [] as string[], rejected: [] as string[] } },
  };
}
describe('NDVI snapshot validation', () => {
  it('validates the archived NASA extraction, including every capital coordinate and QA count', () => {
    const data = validateNDVIDataset(published);
    expect(data.records.TH.values).toHaveLength(288);
    expect(data.records.TH.values.filter((v) => v !== null)).toHaveLength(4);
  });
  it('keeps already-scaled values, negative observations, zero and explicit QA gaps', () => {
    const d = snapshot(); d.records.TH.values[0] = -0.1; d.records.TH.values[1] = 0; d.records.TH.values[2] = null; d.records.TH.rejected = ['2001-03'];
    expect(validateNDVIDataset(d).records.TH.values.slice(0, 3)).toEqual([-0.1, 0, null]);
  });
  it('rejects wrong product, scale/units, source period and QA policy', () => {
    for (const changes of [{ product: 'MOD13Q1.061' }, { unit: 'percent' }, { qaPolicy: 'none' }, { period: { start: 2015, end: 2024 } }]) {
      expect(() => validateNDVIDataset({ ...snapshot(), ...changes })).toThrow();
    }
    const d = snapshot(); d.records.TH.values[0] = 2500;
    expect(() => validateNDVIDataset(d)).toThrow();
  });
  it('rejects coordinate mismatches, truncated records, and inconsistent quality counts', () => {
    const d = snapshot(); d.records.TH.requested.lat = 13.8;
    expect(() => validateNDVIDataset(d)).toThrow();
    const short = snapshot(); short.records.TH.values.pop();
    expect(() => validateNDVIDataset(short)).toThrow();
    const missing = snapshot(); missing.records.TH.values[0] = null;
    expect(() => validateNDVIDataset(missing)).toThrow();
    missing.records.TH.missing = ['2001-01']; missing.records.TH.rejected = ['2001-01'];
    expect(() => validateNDVIDataset(missing)).toThrow();
  });
});
describe('source-aware global analysis', () => {
  const record: ExplorerRecord = {
    source: 'modis', variables: { NDVI: { series: completeMonthlyRecord([]).map((p) => ({ ...p, value: 0.25 })), sourceUnit: '1', missing: [], rejected: [] } },
    requested: { lat: 13.75, lon: 100.52 }, responseCoordinates: { lat: 13.75, lon: 100.52 }, retrievedAt: '2026-11-15T00:00:00Z', requestUrl: 'https://appeears.earthdatacloud.nasa.gov/', sources: ['MOD13A3.061'], raw: null,
  };
  it('uses mean aggregation, unitless scales and monthly seasonal inference for NDVI', () => {
    expect(yearSummary(record, 'NDVI', 2024, 'average').value).toBe(0.25);
    const analysis = mapAnalysis(record, 'NDVI', { start: 2001, end: 2024 }, 'annual');
    expect(analysis.annualRain).toBe(false);
    expect(analysis.analysisSeries).toHaveLength(288);
    expect(analysis.eligible).toBe(true);
    expect(mapScale('NDVI', 'average', false)).toEqual([-0.2, 1]);
    expect(mapScale('NDVI', 'trend', false)).toEqual([-0.1, 0.1]);
    expect(globalVariableByKey('NDVI').unit).toBe('NDVI');
  });
  it('never silently substitutes another source variable', () => {
    expect(() => recordVariable(record, 'T2M')).toThrow('does not contain');
    expect(yearSummary(record, 'NDVI', 2024, 'highest').months).toHaveLength(12);
  });
});
