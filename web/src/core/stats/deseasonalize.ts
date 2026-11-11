import type { Series } from './mannKendall';

export function deseasonalize(values: Series, period = 12): Array<number | null> {
  const sums = new Array<number>(period).fill(0);
  const counts = new Array<number>(period).fill(0);

  values.forEach((v, i) => {
    if (v === null || Number.isNaN(v)) return;
    sums[i % period] += v;
    counts[i % period] += 1;
  });

  const means = sums.map((sum, k) => (counts[k] ? sum / counts[k] : 0));
  return values.map((v, i) => (v === null ? null : v - means[i % period]));
}
