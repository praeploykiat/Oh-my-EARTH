import { analyzeTrend } from '../stats';
import type { Dataset, SeriesPoint } from '../data/types';

export const ALPHA = 0.05;
export const TREND_METHOD = "Mann-Kendall on deseasonalized series, Sen's slope";

export function stepsPerDecade(resolution: Dataset['resolution']): number {
  return resolution === 'monthly' ? 120 : 10;
}

export function computeTrend(series: SeriesPoint[], resolution: Dataset['resolution']): Dataset['trend'] {
  const result = analyzeTrend(
    series.map((p) => p.value),
    { alpha: ALPHA, seasonalPeriod: resolution === 'monthly' ? 12 : undefined },
  );
  return {
    method: TREND_METHOD,
    slopePerDecade: result.slopePerStep * stepsPerDecade(resolution),
    pValue: result.pValue,
    significant: result.significant,
    alpha: ALPHA,
  };
}
