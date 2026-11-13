import { describe, expect, it } from 'vitest';
import type { SeriesPoint } from '../data/types';
import { parseState, serializeState, splitHash } from '../url';
import { compareDecades, decimalsFor, slopeDecimals, toAnnual, toAnomaly, valueDecimals, verdictKeys } from '.';

function monthly(years: number, valueAt: (year: number, month: number) => number | null): SeriesPoint[] {
  return Array.from({ length: years * 12 }, (_, i) => {
    const year = 2001 + Math.floor(i / 12);
    const month = (i % 12) + 1;
    return { t: `${year}-${String(month).padStart(2, '0')}`, value: valueAt(year, month) };
  });
}

describe('toAnnual', () => {
  it('averages each year and drops years with too few months', () => {
    const series = monthly(2, (year, month) => (year === 2002 && month > 6 ? null : year - 2000));
    expect(toAnnual(series)).toEqual([
      { t: '2001', value: 1 },
      { t: '2002', value: null },
    ]);
  });
});

describe('toAnomaly', () => {
  it('removes the monthly cycle', () => {
    const series = monthly(3, (_, month) => month);
    for (const point of toAnomaly(series)) expect(Math.abs(point.value ?? 1)).toBeLessThan(1e-12);
  });
});

describe('compareDecades', () => {
  it('compares the first and last ten years', () => {
    const series = monthly(24, (year) => year - 2000);
    const result = compareDecades(series)!;
    expect(result.first).toEqual({ from: '2001', to: '2010', mean: 5.5 });
    expect(result.last).toEqual({ from: '2015', to: '2024', mean: 19.5 });
    expect(result.change).toBe(14);
  });

  it('needs at least twenty years', () => {
    expect(compareDecades(monthly(15, () => 1))).toBeNull();
  });
});

describe('verdictKeys', () => {
  const trend = { method: '', alpha: 0.05 };

  it('describes a strong rise', () => {
    expect(verdictKeys({ ...trend, slopePerDecade: 0.271, pValue: 0.0001, significant: true })).toEqual({
      direction: 'verdict.rising',
      confidence: 'verdict.veryUnlikelyChance',
      value: '0.27',
    });
  });

  it('describes a weak fall that is not significant', () => {
    const keys = verdictKeys({ ...trend, slopePerDecade: -0.2, pValue: 0.3, significant: false });
    expect(keys.direction).toBe('verdict.falling');
    expect(keys.confidence).toBe('verdict.notProven');
  });

  it('treats a rounded zero as flat', () => {
    expect(verdictKeys({ ...trend, slopePerDecade: 0.001, pValue: 0.9, significant: false }).direction).toBe('verdict.flat');
  });
});

describe('url state', () => {
  it('round-trips the workbench state', () => {
    const state = {
      variable: 'T2M',
      place: { lat: 8.6, lon: 98.2, provinceCode: 'TH-82' },
      compare: { lat: 18.79, lon: 98.98, provinceCode: 'TH-50' },
      view: 'monthly' as const,
    };
    expect(parseState(serializeState(state))).toEqual(state);
  });

  it('falls back to defaults for missing or invalid values', () => {
    expect(parseState('view=bogus')).toEqual({ variable: null, place: null, compare: null, view: 'annual' });
  });

  it('splits the route from the query', () => {
    expect(splitHash('#/workbench?v=T2M')).toEqual({ path: '/workbench', query: 'v=T2M' });
    expect(splitHash('')).toEqual({ path: '/', query: '' });
  });
});

describe('number formatting', () => {
  const series = (values: number[]) => values.map((value, i) => ({ t: String(2001 + i), value }));

  it('shows more decimals for small ranges', () => {
    expect(decimalsFor(0.3)).toBe(1);
    expect(decimalsFor(0.02)).toBe(2);
    expect(valueDecimals(series([26.9, 27.8]))).toBe(2);
    expect(slopeDecimals(series([0.3, 0.9]))).toBe(3);
    expect(slopeDecimals(series([20, 35]))).toBe(2);
  });
});
