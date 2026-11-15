import { describe, expect, it } from 'vitest';
import { completeMonthlyRecord, GLOBAL_VARIABLES } from './data';
import type { GlobalRecord } from './powerRecord';
import { mapAnalysis, mapColor, mapScale, mapUnit, parseMapSettings, supported, yearSummary } from './mapData';
function record(value: number | null = 2) {
  const series = completeMonthlyRecord([], { start: 2003, end: 2004 }).map((p) => ({ ...p, value }));
  return { variables: Object.fromEntries(GLOBAL_VARIABLES.map((v) => [v, { series, missing: [], rejected: [], sourceUnit: '' }])) } as unknown as GlobalRecord;
}
const range = { start: 2003, end: 2004 };
describe('map summaries', () => {
  it('uses day weights across leap years and raw values in anomaly view', () => {
    const r = record(0);
    r.variables.T2M.series[13].value = 10; // February 2004, 29 days
    expect(mapAnalysis(r, 'T2M', range, 'anomaly').average).toBeCloseTo(290 / 731, 12);
  });
  it('uses mean annual rain totals only for annual rain view', () => {
    expect(mapAnalysis(record(), 'PRECTOTCORR', range, 'annual').average).toBe(731);
    expect(mapAnalysis(record(), 'PRECTOTCORR', range, 'monthly').average).toBe(2);
  });
  it('does not color incomplete periods as biased averages or zero', () => {
    const r = record(); r.variables.RH2M.series[0].value = null;
    expect(mapAnalysis(r, 'RH2M', range, 'annual').average).toBeNull();
    expect(mapAnalysis(record(0), 'T2M', range, 'annual').average).toBe(0);
  });
  it('retains the existing trend eligibility safeguards', () => {
    expect(mapAnalysis(record(), 'T2M', range, 'annual').eligible).toBe(false);
  });
});
describe('map scales and evidence', () => {
  it('clamps outliers, uses a neutral zero, and separates negative and positive trends', () => {
    const d: [number, number] = [-1, 1];
    expect(mapColor(-20, d, 'trend')).toBe(mapColor(-1, d, 'trend'));
    expect(mapColor(20, d, 'trend')).toBe(mapColor(1, d, 'trend'));
    expect(mapColor(0, d, 'trend')).toBe('rgb(247, 247, 247)');
    expect(mapColor(-1, d, 'trend')).not.toBe(mapColor(1, d, 'trend'));
  });
  it('uses rainfall scales matching the displayed units', () => {
    expect(mapScale('PRECTOTCORR', 'average', true)).toEqual([0, 4000]);
    expect(mapScale('PRECTOTCORR', 'trend', false)).toEqual([-1, 1]);
    expect(mapScale('PRECTOTCORR', 'trend', true)).toEqual([-300, 300]);
  });
  it('never treats limited, sensitive or inconclusive evidence as supported', () => {
    for (const evidence of ['limited', 'sensitive', 'inconclusive'] as const) expect(supported({ value: 2, evidence })).toBe(false);
    expect(supported({ value: -2, evidence: 'decrease' })).toBe(true);
  });
});


describe('single-year map modes', () => {
  it('defaults to trend and bounds shareable year settings', () => {
    expect(parseMapSettings(new URLSearchParams())).toEqual({ mode: 'trend', year: 2024 });
    expect(parseMapSettings(new URLSearchParams('mode=highest&year=2023'))).toEqual({ mode: 'highest', year: 2023 });
    expect(parseMapSettings(new URLSearchParams('mode=invalid&year=2023x'))).toEqual({ mode: 'trend', year: 2024 });
    expect(parseMapSettings(new URLSearchParams('mode=lowest&year=1990')).year).toBe(2001);
    expect(parseMapSettings(new URLSearchParams('mode=average&year=2099')).year).toBe(2024);
  });
  it('uses only the selected calendar year and includes leap-day weights', () => {
    const r = record(0);
    r.variables.T2M.series[0].value = 100; // outside selected year
    r.variables.T2M.series[13].value = 10;
    const result = yearSummary(r, 'T2M', 2004, 'average');
    expect(result.value).toBeCloseTo(290 / 366, 12);
    expect(result.monthly).toHaveLength(12);
    expect(result.monthly[0].t).toBe('2004-01');
    expect(result.months).toEqual([]);
  });
  it('finds all tied months without mistaking negative values or zero for missing', () => {
    const r = record(0);
    r.variables.T2M.series[12].value = -5;
    r.variables.T2M.series[13].value = -5;
    const low = yearSummary(r, 'T2M', 2004, 'lowest');
    expect(low.value).toBe(-5);
    expect(low.months).toEqual(['2004-01', '2004-02']);
    const high = yearSummary(r, 'T2M', 2004, 'highest');
    expect(high.value).toBe(0);
    expect(high.months).toHaveLength(10);
  });
  it('matches the reviewed Bangkok 2023 API output', () => {
    const temperature = [24.77,28.55,30.54,32.48,31.57,29.69,28.42,28.3,27.83,27.8,26.34,26.04];
    const rain = [0.13,0.69,0.18,1.03,2.86,4.57,6.92,5.79,10.33,5.66,1.82,0.31];
    const r = record();
    r.variables.T2M.series = temperature.map((value, i) => ({ t: `2023-${String(i+1).padStart(2,'0')}`, value }));
    r.variables.PRECTOTCORR.series = rain.map((value, i) => ({ t: `2023-${String(i+1).padStart(2,'0')}`, value }));
    expect(yearSummary(r, 'T2M', 2023, 'average').value).toBeCloseTo(28.52120547945, 9);
    expect(yearSummary(r, 'T2M', 2023, 'highest')).toMatchObject({ value: 32.48, months: ['2023-04'] });
    expect(yearSummary(r, 'T2M', 2023, 'lowest')).toMatchObject({ value: 24.77, months: ['2023-01'] });
    expect(yearSummary(r, 'PRECTOTCORR', 2023, 'average').value).toBeCloseTo(1229.17, 9);
    expect(yearSummary(r, 'PRECTOTCORR', 2023, 'highest')).toMatchObject({ value: 309.9, months: ['2023-09'] });
    expect(yearSummary(r, 'PRECTOTCORR', 2023, 'lowest').value).toBeCloseTo(4.03, 9);
  });
  it('ranks rainfall by monthly totals rather than average daily rates', () => {
    const r = record(10);
    r.variables.PRECTOTCORR.series[12].value = 1.9; // January: 58.9 mm
    r.variables.PRECTOTCORR.series[13].value = 2; // February: 58 mm
    expect(yearSummary(r, 'PRECTOTCORR', 2004, 'lowest')).toMatchObject({ value: 58, months: ['2004-02'] });
    expect(yearSummary(record(2), 'PRECTOTCORR', 2004, 'average').value).toBe(732);
  });
  it('suppresses incomplete summaries while retaining available monthly chart values', () => {
    const r = record(); r.variables.RH2M.series[15].value = null;
    for (const mode of ['average', 'lowest', 'highest'] as const) {
      const result = yearSummary(r, 'RH2M', 2004, mode);
      expect(result.value).toBeNull();
      expect(result.months).toEqual([]);
      expect(result.coverage.valid).toBe(11);
      expect(result.monthly[3].value).toBeNull();
    }
    expect(yearSummary(r, 'RH2M', 2003, 'average').value).toBe(2);
  });
  it('uses sequential colors for all year modes and units matching rainfall totals', () => {
    expect(mapColor(10, [0, 100], 'lowest')).toBe(mapColor(10, [0, 100], 'average'));
    expect(mapColor(10, [0, 100], 'highest')).toBe(mapColor(10, [0, 100], 'average'));
    expect(mapScale('PRECTOTCORR', 'highest', false)).toEqual([0, 700]);
    expect(mapScale('PRECTOTCORR', 'lowest', true)).toEqual([0, 700]);
    expect(mapUnit('PRECTOTCORR', 'average', 'mm/day', false)).toBe('mm/year');
    expect(mapUnit('PRECTOTCORR', 'highest', 'mm/day', true)).toBe('mm/month');
    expect(mapUnit('PRECTOTCORR', 'trend', 'mm/day', false)).toBe('mm/day');
    expect(mapUnit('PRECTOTCORR', 'trend', 'mm/day', true)).toBe('mm/year');
    expect(mapUnit('T2M', 'lowest', '°C', true)).toBe('°C');
  });
});
