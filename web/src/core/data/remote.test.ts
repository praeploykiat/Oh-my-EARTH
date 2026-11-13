import { describe, expect, it } from 'vitest';
import { fillMonths, giovanniLink, parseTimeSeriesText, proxyUrl, REMOTE_DATASETS, upstreamUrl } from './remote';
import { VARIABLES } from './variables';

const GIOVANNI_CSV = [
  'prod_name,M2TMNXAER',
  'param_name,TOTEXTTAU',
  'unit,1',
  '',
  'Timestamp (UTC),Data',
  '2001-01-01 00:00:00,0.25',
  '2001-02-01 00:00:00,0.35',
  '2001-03-01 00:00:00,-9999',
].join('\n');

const DATARODS_ASC = [
  'Metadata for Requested Time Series:',
  'prod_name=GLDAS_NOAH025_3H_v2.1',
  '      Date&Time        Data',
  '2001-01-01T00:00:00\t0.5',
  '2001-01-01T03:00:00\t1.5',
  '2001-02-01T00:00:00\t2.0',
].join('\n');

describe('remote time series parsing', () => {
  it('reads Giovanni CSV and drops fill values', () => {
    expect(parseTimeSeriesText(GIOVANNI_CSV)).toEqual([
      { t: '2001-01', value: 0.25 },
      { t: '2001-02', value: 0.35 },
      { t: '2001-03', value: null },
    ]);
  });

  it('averages sub-daily data rods into months and applies the scale', () => {
    expect(parseTimeSeriesText(DATARODS_ASC, 8)).toEqual([
      { t: '2001-01', value: 8 },
      { t: '2001-02', value: 16 },
    ]);
  });

  it('fills missing months with null', () => {
    const filled = fillMonths([{ t: '2001-02', value: 1 }], 2001, 2001);
    expect(filled).toHaveLength(12);
    expect(filled[0]).toEqual({ t: '2001-01', value: null });
    expect(filled[1]).toEqual({ t: '2001-02', value: 1 });
  });
});

describe('remote urls', () => {
  it('routes each variable to its own proxy', () => {
    expect(proxyUrl('AOD', 18.79, 98.98)).toBe('/api/giovanni?variable=AOD&lat=18.7900&lon=98.9800');
    expect(proxyUrl('RUNOFF', 18.79, 98.98)).toMatch(/^\/api\/datarods\?/);
    expect(proxyUrl('T2M', 18.79, 98.98)).toBeNull();
  });

  it('builds upstream requests for both services', () => {
    const giovanni = new URL(upstreamUrl(REMOTE_DATASETS.AOD, 18.79, 98.98, 2001, 2024));
    expect(giovanni.searchParams.get('location')).toBe('[18.7900,98.9800]');
    expect(giovanni.searchParams.get('time')).toBe('2001-01-01T00:00:00/2024-12-31T23:59:59');

    const rods = new URL(upstreamUrl(REMOTE_DATASETS.RUNOFF, 18.79, 98.98, 2001, 2024));
    expect(rods.searchParams.get('location')).toBe('GEOM:POINT(98.9800, 18.7900)');
  });

  it('links to Giovanni with a small box around the point', () => {
    expect(giovanniLink('X', 18.79, 98.98, 2001, 2024)).toContain('bbox=98.73,18.54,99.23,19.04&data=X');
  });

  it('has a remote dataset for every remote variable', () => {
    for (const variable of VARIABLES.filter((v) => v.source !== 'power')) {
      expect(REMOTE_DATASETS[variable.key]?.service, variable.key).toBe(variable.source);
    }
  });
});
