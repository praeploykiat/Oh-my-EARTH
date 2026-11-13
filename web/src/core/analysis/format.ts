import type { SeriesPoint } from '../data/types';

const MAX_DECIMALS = 4;

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

export function decimalsFor(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 2;
  return clamp(Math.ceil(-Math.log10(step)), 0, MAX_DECIMALS);
}

function span(series: SeriesPoint[]): number {
  const values = series.flatMap((p) => (p.value === null ? [] : [p.value]));
  return values.length ? Math.max(...values) - Math.min(...values) : 0;
}

export function valueDecimals(series: SeriesPoint[]): number {
  return clamp(decimalsFor(span(series)) + 1, 2, MAX_DECIMALS);
}

export function slopeDecimals(series: SeriesPoint[]): number {
  return clamp(decimalsFor(span(series)) + 2, 2, MAX_DECIMALS);
}
