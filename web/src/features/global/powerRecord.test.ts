import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchGlobalRecord, globalRequestUrl, validateGlobalResponse } from './powerRecord';
import { GLOBAL_VARIABLES } from './data';
import { fetchPowerResponse } from '../../core/data/power';

vi.mock('../../core/data/power', async (original) => ({ ...await original<typeof import('../../core/data/power')>(), fetchPowerResponse: vi.fn() }));
const point = { lat: 13.75, lon: 100.52 };
const timestamp = '2026-11-15T00:00:00.000Z';
function response() {
  return {
    header: { fill_value: -999, sources: ['MERRA2', 'CERES'] },
    geometry: { type: 'Point', coordinates: [100.52, 13.75, 5] },
    parameters: { T2M: { units: 'C' }, PRECTOTCORR: { units: 'mm/day' }, RH2M: { units: '%' }, ALLSKY_SFC_SW_DWN: { units: 'kW-hr/m^2/day' } },
    properties: { parameter: Object.fromEntries(GLOBAL_VARIABLES.map((key) => [key, { '200101': key === 'T2M' ? -10 : 0, '200102': 10, '200113': 99999 }])) as Record<string, Record<string, unknown>> },
  };
}
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('four-variable POWER validation', () => {
  it('retains provenance, checks units and excludes annual summaries', () => {
    const body = response();
    const record = validateGlobalResponse(body, point, timestamp);
    expect(record.retrievedAt).toBe(timestamp);
    expect(record.raw).toBe(body);
    expect(record.sources).toEqual(['MERRA2', 'CERES']);
    for (const key of GLOBAL_VARIABLES) {
      expect(record.variables[key].series).toHaveLength(288);
      expect(record.variables[key].missing).toHaveLength(286);
      expect(record.variables[key].rejected).toEqual([]);
    }
    expect(record.variables.T2M.series[0].value).toBe(-10);
    expect(record.variables.PRECTOTCORR.series[0].value).toBe(0);
    expect(new URL(record.requestUrl).searchParams.get('parameters')).toBe(GLOBAL_VARIABLES.join(','));
  });
  it('separates fill/missing values from rejected nonfinite, nonnumeric and implausible values', () => {
    const body = response();
    body.header.fill_value = -9999;
    body.properties.parameter.RH2M = { '200101': -9999, '200102': 101, '200103': Infinity, '200104': '50', '200105': -1, '200106': 100 };
    const result = validateGlobalResponse(body, point, timestamp).variables.RH2M;
    expect(result.missing).toContain('2001-01');
    expect(result.rejected).toEqual(['2001-02', '2001-03', '2001-04', '2001-05']);
    expect(result.series[5].value).toBe(100);
    expect(result.series.slice(0, 5).every((p) => p.value === null)).toBe(true);
  });
  it.each(GLOBAL_VARIABLES)('rejects missing %s data or incompatible units', (key) => {
    const body = response();
    delete body.properties.parameter[key];
    expect(() => validateGlobalResponse(body, point, timestamp)).toThrow(key);
    const wrongUnit = response();
    wrongUnit.parameters[key].units = 'unexpected';
    expect(() => validateGlobalResponse(wrongUnit, point, timestamp)).toThrow('Unexpected units');
  });
  it('rejects malformed dates, unexpected years, malformed payloads and mismatched coordinates', () => {
    const body = response();
    body.properties.parameter.T2M['200114'] = 1;
    expect(() => validateGlobalResponse(body, point, timestamp)).toThrow('Invalid T2M month');
    delete body.properties.parameter.T2M['200114'];
    body.properties.parameter.T2M['199901'] = 1;
    expect(() => validateGlobalResponse(body, point, timestamp)).toThrow('Unexpected T2M year');
    expect(() => validateGlobalResponse({}, point, timestamp)).toThrow('header');
    expect(() => validateGlobalResponse(response(), { ...point, lat: 15 }, timestamp)).toThrow('different location');
    expect(() => validateGlobalResponse(response(), point, 'bad')).toThrow('timestamp');
  });
});

describe('validated raw-response caching', () => {
  it('deduplicates a city request and refreshes when requested', async () => {
    vi.mocked(fetchPowerResponse).mockResolvedValue(response());
    const first = fetchGlobalRecord(point, true);
    expect(fetchGlobalRecord(point)).toBe(first);
    await first;
    await fetchGlobalRecord(point);
    expect(fetchPowerResponse).toHaveBeenCalledTimes(1);
    await fetchGlobalRecord(point, true);
    expect(fetchPowerResponse).toHaveBeenCalledTimes(2);
  });
  it('revalidates stored data and keeps its original timestamp', async () => {
    vi.stubGlobal('sessionStorage', { getItem: () => JSON.stringify({ body: response(), retrievedAt: timestamp }) });
    const cached = await fetchGlobalRecord({ lat: 13.7501, lon: 100.5201 });
    expect(cached.retrievedAt).toBe(timestamp);
    expect(fetchPowerResponse).not.toHaveBeenCalled();
  });
  it('refetches corrupt storage and allows retry after a request failure', async () => {
    vi.stubGlobal('sessionStorage', { getItem: () => '{broken', setItem: vi.fn(), removeItem: vi.fn() });
    vi.mocked(fetchPowerResponse).mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(response());
    await expect(fetchGlobalRecord(point, true)).rejects.toThrow('timeout');
    await expect(fetchGlobalRecord(point)).resolves.toHaveProperty('variables');
    expect(fetchPowerResponse).toHaveBeenCalledTimes(2);
  });
  it('includes the full record and all four variables in source requests', () => {
    const url = new URL(globalRequestUrl(point));
    expect(url.searchParams.get('start')).toBe('2001');
    expect(url.searchParams.get('end')).toBe('2024');
    expect(url.searchParams.get('community')).toBe('RE');
  });
});
