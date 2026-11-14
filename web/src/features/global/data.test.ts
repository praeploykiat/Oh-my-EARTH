import { describe, expect, it } from 'vitest';
import { CAPITALS, capitalByCode } from '../../core/geo/capitals';
import { variableByKey } from '../../core/data/variables';
import { START_YEAR, END_YEAR } from '../../core/data/range';
import { GLOBAL_VARIABLES, completeMonthlyRecord, annualRecord, daysInMonth, parseYearRange, prepareGlobalAnalysis, type GlobalVariable } from './data';

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
  it('keeps sparse and nonfinite observations as gaps for coverage reporting', () => {
    expect(completeMonthlyRecord(observations.slice(0, 23))[23].value).toBeNull();
    expect(completeMonthlyRecord(observations.map((p) => ({ ...p, value: Infinity }))).every((p) => p.value === null)).toBe(true);
  });
  it('rejects duplicate and malformed months rather than silently changing seasonal positions', () => {
    expect(() => completeMonthlyRecord([...observations, observations[0]])).toThrow('Duplicate');
    expect(() => completeMonthlyRecord([{ t: '2001-13', value: 1 }])).toThrow('Invalid month');
  });
});

function yearRecord(year: number, value: (month: number) => number | null = () => 1) {
  return Array.from({ length: 12 }, (_, i) => ({ t: `${year}-${String(i + 1).padStart(2, '0')}`, value: value(i + 1) }));
}

describe('global annual aggregation', () => {
  it('weights means by days in common and leap years for all three mean variables', () => {
    for (const key of ['T2M', 'RH2M', 'ALLSKY_SFC_SW_DWN'] as GlobalVariable[]) {
      expect(annualRecord(yearRecord(2003, (m) => m === 2 ? 12 : 0), key)[0].value).toBeCloseTo(12 * 28 / 365, 12);
      expect(annualRecord(yearRecord(2004, (m) => m === 2 ? 12 : 0), key)[0].value).toBeCloseTo(12 * 29 / 366, 12);
    }
    expect(daysInMonth(2004, 2)).toBe(29);
    expect(daysInMonth(2100, 2)).toBe(28);
  });
  it('integrates daily precipitation rates into annual totals, preserving zero rainfall', () => {
    expect(annualRecord(yearRecord(2003, () => 2), 'PRECTOTCORR')[0].value).toBe(730);
    expect(annualRecord(yearRecord(2004, () => 2), 'PRECTOTCORR')[0].value).toBe(732);
    expect(annualRecord(yearRecord(2004, () => 0), 'PRECTOTCORR')[0].value).toBe(0);
  });
  it('never scales partial years and preserves entirely missing years', () => {
    const series = [...yearRecord(2001, (m) => m === 2 ? null : 5), ...yearRecord(2003)];
    for (const key of GLOBAL_VARIABLES) {
      const annual = annualRecord(series, key);
      expect(annual.map((p) => p.t)).toEqual(['2001', '2002', '2003']);
      expect(annual[0].value).toBeNull();
      expect(annual[1].value).toBeNull();
      expect(annual[2].value).not.toBeNull();
    }
  });
});

describe('range and analysis consistency', () => {
  const record = Array.from({ length: 24 }, (_, y) => yearRecord(2001 + y, (m) => y + m)).flat();
  it('defaults, bounds and orders URL years', () => {
    expect(parseYearRange(new URLSearchParams())).toEqual({ start: 2001, end: 2024 });
    expect(parseYearRange(new URLSearchParams('start=2020&end=2010'))).toEqual({ start: 2010, end: 2020 });
    expect(parseYearRange(new URLSearchParams('start=1900&end=2099'))).toEqual({ start: 2001, end: 2024 });
    expect(parseYearRange(new URLSearchParams('start=NaN&end=2004x'))).toEqual({ start: 2001, end: 2024 });
  });
  it('restricts chart, coverage and trend inputs to the same period', () => {
    const result = prepareGlobalAnalysis(record, 'T2M', { start: 2010, end: 2019 }, 'monthly');
    expect(result.shown).toHaveLength(120);
    expect(result.shown[0].t).toBe('2010-01');
    expect(result.shown.at(-1)?.t).toBe('2019-12');
    expect(result.coverage).toEqual({ valid: 120, total: 120, fraction: 1 });
    expect(result.completeYears).toBe(10);
    expect(result.trend?.slopePerDecade).toBeGreaterThan(0);
    const changedOutsideRange = record.map((p) => ({ ...p, value: p.t < '2010' || p.t >= '2020' ? 5000 : p.value }));
    expect(prepareGlobalAnalysis(changedOutsideRange, 'T2M', { start: 2010, end: 2019 }, 'monthly').trend).toEqual(result.trend);
    const annualRain = prepareGlobalAnalysis(record, 'PRECTOTCORR', { start: 2010, end: 2019 }, 'annual');
    expect(annualRain.unit).toBe('mm/year');
    expect(annualRain.analysisSeries).toEqual(annualRain.annual);
    expect(annualRain.trend).not.toBeNull();
  });
  it('withholds inference for short periods, low coverage and insufficient complete rainfall years', () => {
    expect(prepareGlobalAnalysis(record, 'T2M', { start: 2020, end: 2024 }, 'annual').trend).toBeNull();
    const partial = record.map((p, i) => ({ ...p, value: i % 12 === 0 ? null : p.value }));
    expect(prepareGlobalAnalysis(partial, 'PRECTOTCORR', { start: 2001, end: 2024 }, 'annual').trend).toBeNull();
    const sparse = record.map((p, i) => ({ ...p, value: i % 2 ? null : p.value }));
    expect(prepareGlobalAnalysis(sparse, 'T2M', { start: 2001, end: 2024 }, 'monthly').trend).toBeNull();
    expect(prepareGlobalAnalysis([], 'T2M', { start: 2001, end: 2024 }, 'monthly').trend).toBeNull();
    const eightYears = record.filter((p) => p.t < '2009');
    expect(prepareGlobalAnalysis(eightYears, 'T2M', { start: 2001, end: 2010 }, 'monthly').coverage.fraction).toBe(0.8);
    expect(prepareGlobalAnalysis(eightYears, 'T2M', { start: 2001, end: 2010 }, 'monthly').trend).toBeNull();
  });
  it('recomputes anomaly baselines within the selected years', () => {
    const result = prepareGlobalAnalysis(record, 'T2M', { start: 2010, end: 2011 }, 'anomaly');
    expect(result.shown[0].value).toBeCloseTo(-0.5);
    expect(result.shown[12].value).toBeCloseTo(0.5);
    for (let month = 0; month < 12; month++) expect(result.shown[month].value! + result.shown[month + 12].value!).toBeCloseTo(0);
  });
});
