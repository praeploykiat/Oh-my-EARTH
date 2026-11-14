import type { SeriesPoint } from '../../core/data';
import { START_YEAR, END_YEAR } from '../../core/data/range';

export const GLOBAL_VARIABLES = ['T2M', 'PRECTOTCORR', 'RH2M', 'ALLSKY_SFC_SW_DWN'] as const;

// Keep absent months in their calendar positions for seasonal removal and Sen's slope.
export function completeMonthlyRecord(series: SeriesPoint[]): SeriesPoint[] {
  const values = new Map(series.map((point) => [point.t, point.value]));
  const complete: SeriesPoint[] = [];
  for (let year = START_YEAR; year <= END_YEAR; year++) {
    for (let month = 1; month <= 12; month++) {
      const t = `${year}-${String(month).padStart(2, '0')}`;
      const value = values.get(t);
      complete.push({ t, value: typeof value === 'number' && Number.isFinite(value) ? value : null });
    }
  }
  if (complete.filter((point) => point.value !== null).length < 24) throw new Error('Insufficient observations');
  return complete;
}
