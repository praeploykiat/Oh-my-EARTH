import type { View } from '../../core/analysis';
import { END_YEAR, START_YEAR } from '../../core/data/range';
import type { GlobalTrendResult } from '../../core/stats/globalTrend';
import { daysInMonth, prepareGlobalAnalysis, type GlobalVariable, type YearRange } from './data';
import type { GlobalRecord } from './powerRecord';
export const MAP_MODES = ['trend', 'average', 'lowest', 'highest'] as const;
export type MapMode = typeof MAP_MODES[number];
export function parseMapSettings(params: URLSearchParams): { mode: MapMode; year: number } {
  const raw = params.get('year');
  return {
    mode: MAP_MODES.find((mode) => mode === params.get('mode')) ?? 'trend',
    year: raw && /^\d{4}$/.test(raw) ? Math.max(START_YEAR, Math.min(END_YEAR, Number(raw))) : END_YEAR,
  };
}
export type MapValue = { value: number | null; evidence?: GlobalTrendResult['evidence']; lower?: number; upper?: number; failed?: boolean; months?: string[] };
export function mapAnalysis(record: GlobalRecord, variable: GlobalVariable, range: YearRange, view: View) {
  const analysis = prepareGlobalAnalysis(record.variables[variable].series, variable, range, view);
  // A complete period prevents missing seasons from biasing cross-location comparisons.
  let average: number | null = null;
  if (analysis.coverage.fraction === 1) {
    if (analysis.annualRain) average = analysis.annual.reduce((sum, p) => sum + p.value!, 0) / analysis.annual.length;
    else {
      let days = 0;
      average = analysis.monthly.reduce((sum, p) => {
        const weight = daysInMonth(Number(p.t.slice(0, 4)), Number(p.t.slice(5)));
        days += weight;
        return sum + p.value! * weight;
      }, 0) / days;
    }
  }
  return { ...analysis, average };
}
// Each non-trend map summarizes one complete calendar year. Rain rates become monthly totals.
export function yearSummary(record: GlobalRecord, variable: GlobalVariable, year: number, mode: Exclude<MapMode, 'trend'>) {
  const analysis = mapAnalysis(record, variable, { start: year, end: year }, 'annual');
  const monthly = analysis.monthly.map((p) => ({
    ...p,
    value: p.value === null ? null : variable === 'PRECTOTCORR'
      ? p.value * daysInMonth(year, Number(p.t.slice(5))) : p.value,
  }));
  let value: number | null = null;
  let months: string[] = [];
  if (analysis.coverage.fraction === 1) {
    if (mode === 'average') value = analysis.annual[0].value;
    else {
      value = (mode === 'lowest' ? Math.min : Math.max)(...monthly.map((p) => p.value!));
      // Compare at the input's decimal precision; rainfall multiplication may add floating noise.
      months = monthly.filter((p) => Math.abs(p.value! - value!) < 1e-9).map((p) => p.t);
    }
  }
  return { value, months, monthly, coverage: analysis.coverage };
}
export function mapUnit(variable: GlobalVariable, mode: MapMode, sourceUnit: string, annualRain: boolean): string {
  if (variable !== 'PRECTOTCORR') return sourceUnit;
  return mode === 'lowest' || mode === 'highest' ? 'mm/month' : mode === 'average' || annualRain ? 'mm/year' : sourceUnit;
}
export function mapModeLabel(mode: MapMode, variable: GlobalVariable) {
  return mode === 'average' && variable === 'PRECTOTCORR' ? 'global.map.total' as const
    : `global.map.${mode}` as const;
}
export function mapScale(variable: GlobalVariable, mode: MapMode, annualRain: boolean) {
  const average: Record<GlobalVariable, [number, number]> = { T2M: [-20, 35], PRECTOTCORR: [0, annualRain ? 4000 : 12], RH2M: [0, 100], ALLSKY_SFC_SW_DWN: [0, 8] };
  const extent = { T2M: 1, PRECTOTCORR: annualRain ? 300 : 1, RH2M: 5, ALLSKY_SFC_SW_DWN: 0.5 }[variable];
  if (mode === 'trend') return [-extent, extent] as [number, number];
  if (variable === 'PRECTOTCORR') return [0, mode === 'average' ? 4000 : 700] as [number, number];
  return average[variable];
}
const AVERAGE = ['#153e75', '#2b8cbe', '#7bccc4', '#fdd49e', '#ef6548'];
const TREND = ['#2166ac', '#67a9cf', '#f7f7f7', '#ef8a62', '#b2182b'];
export function mapColor(value: number, domain: [number, number], mode: MapMode): string {
  const stops = mode === 'trend' ? TREND : AVERAGE;
  const position = Math.max(0, Math.min(1, (value - domain[0]) / (domain[1] - domain[0]))) * 4;
  const index = Math.min(3, Math.floor(position));
  const mix = position - index;
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const a = rgb(stops[index]), b = rgb(stops[index + 1]);
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * mix)).join(', ')})`;
}
export function supported(value: MapValue) { return value.evidence === 'increase' || value.evidence === 'decrease'; }
