import { describe, expect, it } from 'vitest';
import { CAPITALS, capitalByCode } from '../../core/geo/capitals';
import { variableByKey } from '../../core/data/variables';
import { START_YEAR, END_YEAR } from '../../core/data/range';
import { GLOBAL_VARIABLES, completeMonthlyRecord } from './data';

describe('global capital catalog', () => {
  it('provides one valid capital coordinate per country', () => {
    expect(CAPITALS.length).toBe(195);
    expect(new Set(CAPITALS.map((c) => c.code)).size).toBe(CAPITALS.length);
    expect(new Set(CAPITALS.map((c) => c.iso3)).size).toBe(CAPITALS.length);
    for (const capital of CAPITALS) {
      expect(capital.city && capital.country).toBeTruthy();
      expect(Number.isFinite(capital.lat) && Math.abs(capital.lat) <= 90).toBe(true);
      expect(Number.isFinite(capital.lon) && Math.abs(capital.lon) <= 180).toBe(true);
    }
    expect(capitalByCode('TH')?.city).toBe('Bangkok');
    expect(capitalByCode('ZA')?.city).toBe('Pretoria');
  });
  it('uses POWER definitions for all four initial variables', () => {
    expect(GLOBAL_VARIABLES).toHaveLength(4);
    for (const key of GLOBAL_VARIABLES) expect(variableByKey(key)?.source).toBe('power');
  });
});

describe('global monthly record', () => {
  const observations = Array.from({ length: 24 }, (_, i) => ({
    t: `${START_YEAR + Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, '0')}`, value: i,
  }));
  it('retains calendar gaps and pads the configured record without inventing observations', () => {
    const series = completeMonthlyRecord([...observations.filter((p) => p.t !== `${START_YEAR}-02`), { t: `${START_YEAR + 2}-01`, value: 42 }].reverse());
    expect(series).toHaveLength((END_YEAR - START_YEAR + 1) * 12);
    expect(series[0]).toEqual({ t: `${START_YEAR}-01`, value: 0 });
    expect(series[1]).toEqual({ t: `${START_YEAR}-02`, value: null });
    expect(series[24].value).toBe(42);
    expect(series.at(-1)).toEqual({ t: `${END_YEAR}-12`, value: null });
  });
  it('rejects sparse, nonfinite and out-of-range observations before analysis', () => {
    expect(() => completeMonthlyRecord(observations.slice(0, 23))).toThrow('Insufficient');
    expect(() => completeMonthlyRecord(observations.map((p) => ({ ...p, value: Infinity })))).toThrow('Insufficient');
    expect(() => completeMonthlyRecord(observations.map((p) => ({ ...p, t: '1900-01' })))).toThrow('Insufficient');
  });
});
