import { toAnomaly, type View } from '../../core/analysis';
import type { SeriesPoint } from '../../core/data';
import { START_YEAR, END_YEAR } from '../../core/data/range';
import sourceSettings from './sourceSettings.json';

export const GLOBAL_VARIABLES = ['T2M', 'PRECTOTCORR', 'RH2M', 'ALLSKY_SFC_SW_DWN'] as const;
export type PowerVariable = typeof GLOBAL_VARIABLES[number];
export type GlobalVariable = PowerVariable | 'NDVI';
// Deferred source implementations remain testable, but are unavailable in this release.
export const EXPLORER_VARIABLES: readonly GlobalVariable[] = GLOBAL_VARIABLES.filter((key)=>sourceSettings.enabledVariables.includes(key));
export interface YearRange { start: number; end: number }
export const YEARS = Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i);
export const MIN_TREND_YEARS = 10;
export const MIN_MONTHLY_COVERAGE = 0.8;

export function parseYearRange(params: URLSearchParams): YearRange {
  const year = (value: string | null, fallback: number) => {
    if (!value || !/^\d{4}$/.test(value)) return fallback;
    return Math.min(END_YEAR, Math.max(START_YEAR, Number(value)));
  };
  const start = year(params.get('start'), START_YEAR);
  const end = year(params.get('end'), END_YEAR);
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// Keep absent months in their calendar positions for seasonal removal and Sen's slope.
export function completeMonthlyRecord(series: SeriesPoint[], range: YearRange = { start: START_YEAR, end: END_YEAR }): SeriesPoint[] {
  const values = new Map<string, number | null>();
  for (const point of series) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(point.t)) throw new Error(`Invalid month: ${point.t}`);
    if (values.has(point.t)) throw new Error(`Duplicate month: ${point.t}`);
    values.set(point.t, typeof point.value === 'number' && Number.isFinite(point.value) ? point.value : null);
  }
  const complete: SeriesPoint[] = [];
  for (let year = range.start; year <= range.end; year++) {
    for (let month = 1; month <= 12; month++) {
      const t = `${year}-${String(month).padStart(2, '0')}`;
      complete.push({ t, value: values.get(t) ?? null });
    }
  }
  return complete;
}

export function annualRecord(monthly: SeriesPoint[], variable: GlobalVariable): SeriesPoint[] {
  if (!monthly.length) return [];
  const start = Math.min(...monthly.map((p) => Number(p.t.slice(0, 4))));
  const end = Math.max(...monthly.map((p) => Number(p.t.slice(0, 4))));
  const complete = completeMonthlyRecord(monthly, { start, end });
  return Array.from({ length: end - start + 1 }, (_, i) => {
    const year = start + i;
    const months = complete.slice(i * 12, (i + 1) * 12);
    if (months.some((p) => p.value === null)) return { t: String(year), value: null };
    const total = months.reduce((sum, p, m) => sum + p.value! * daysInMonth(year, m + 1), 0);
    return { t: String(year), value: variable === 'PRECTOTCORR' ? total : total / (daysInMonth(year, 2) === 29 ? 366 : 365) };
  });
}

export function recordCoverage(series: SeriesPoint[]) {
  const valid = series.filter((p) => p.value !== null).length;
  return { valid, total: series.length, fraction: series.length ? valid / series.length : 0 };
}

export function prepareGlobalAnalysis(record: SeriesPoint[], variable: GlobalVariable, range: YearRange, view: View) {
  const monthly = completeMonthlyRecord(record, range);
  const annual = annualRecord(monthly, variable);
  const coverage = recordCoverage(monthly);
  const completeYears = annual.filter((p) => p.value !== null).length;
  const observedYears = new Set(monthly.filter((p) => p.value !== null).map((p) => p.t.slice(0, 4))).size;
  const annualRain = variable === 'PRECTOTCORR' && view === 'annual';
  const shown = view === 'annual' ? annual : view === 'anomaly' ? toAnomaly(monthly) : monthly;
  const analysisSeries = annualRain ? annual : monthly;
  // Explicit MVP display safeguards, not a guarantee of valid statistical inference.
  const eligible = range.end - range.start + 1 >= MIN_TREND_YEARS
    && observedYears >= MIN_TREND_YEARS
    && coverage.fraction >= MIN_MONTHLY_COVERAGE
    && (!annualRain || completeYears >= MIN_TREND_YEARS);
  return {
    monthly, annual, shown, coverage, completeYears, annualRain, analysisSeries, eligible,
    unit: annualRain ? 'mm/year' : undefined,
  };
}
