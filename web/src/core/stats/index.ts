import { deseasonalize } from './deseasonalize';
import { mannKendall, type Series } from './mannKendall';
import { senSlope } from './senSlope';

export { deseasonalize, mannKendall, senSlope };
export type { Series };

export interface TrendResult {
  slopePerStep: number;
  pValue: number;
  significant: boolean;
  alpha: number;
}

export interface AnalyzeOptions {
  alpha?: number;
  seasonalPeriod?: number;
}

export function analyzeTrend(values: Series, { alpha = 0.05, seasonalPeriod }: AnalyzeOptions = {}): TrendResult {
  const input = seasonalPeriod ? deseasonalize(values, seasonalPeriod) : values;
  const { pValue } = mannKendall(input);
  return {
    slopePerStep: senSlope(input),
    pValue,
    significant: pValue < alpha,
    alpha,
  };
}
