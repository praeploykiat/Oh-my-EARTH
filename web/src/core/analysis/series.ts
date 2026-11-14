import { deseasonalize } from '../stats';
import type { SeriesPoint } from '../data/types';

export type View = 'monthly' | 'annual' | 'anomaly';

const MIN_MONTHS_PER_YEAR = 10;
const DECADE_YEARS = 10;

export function toAnnual(series: SeriesPoint[]): SeriesPoint[] {
  const years = new Map<string, number[]>();
  for (const point of series) {
    if (point.value === null) continue;
    const year = point.t.slice(0, 4);
    years.set(year, [...(years.get(year) ?? []), point.value]);
  }

  return [...years.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, values]) => ({
      t: year,
      value: values.length >= MIN_MONTHS_PER_YEAR ? values.reduce((sum, v) => sum + v, 0) / values.length : null,
    }));
}

export function toAnomaly(series: SeriesPoint[]): SeriesPoint[] {
  const values = deseasonalize(series.map((p) => p.value));
  return series.map((p, i) => ({ t: p.t, value: values[i] }));
}

export function seriesForView(monthly: SeriesPoint[], view: View): SeriesPoint[] {
  if (view === 'annual') return toAnnual(monthly);
  if (view === 'anomaly') return toAnomaly(monthly);
  return monthly;
}

export interface DecadeMean {
  from: string;
  to: string;
  mean: number;
}

export interface DecadeComparison {
  first: DecadeMean;
  last: DecadeMean;
  change: number;
}

function meanOf(points: SeriesPoint[]): number | null {
  const values = points.map((p) => p.value).filter((v): v is number => v !== null);
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
}

export function compareDecades(monthly: SeriesPoint[]): DecadeComparison | null {
  const annual = toAnnual(monthly).filter((p) => p.value !== null);
  if (annual.length < DECADE_YEARS * 2) return null;

  const firstYears = annual.slice(0, DECADE_YEARS);
  const lastYears = annual.slice(-DECADE_YEARS);
  const firstMean = meanOf(firstYears);
  const lastMean = meanOf(lastYears);
  if (firstMean === null || lastMean === null) return null;

  return {
    first: { from: firstYears[0].t, to: firstYears[firstYears.length - 1].t, mean: firstMean },
    last: { from: lastYears[0].t, to: lastYears[lastYears.length - 1].t, mean: lastMean },
    change: lastMean - firstMean,
  };
}

export function trendIntercept(series: SeriesPoint[], slope: number): number {
  const residuals = series
    .map((p, i) => (p.value === null ? null : p.value - slope * i))
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  return residuals[Math.floor(residuals.length / 2)];
}
