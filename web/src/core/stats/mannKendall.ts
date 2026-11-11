export type Series = ReadonlyArray<number | null>;

export interface MannKendallResult {
  s: number;
  variance: number;
  z: number;
  pValue: number;
  tau: number;
}

export function presentValues(values: Series): number[] {
  return values.filter((v): v is number => v !== null && !Number.isNaN(v));
}

export function mannKendall(values: Series): MannKendallResult {
  const points = presentValues(values);
  const n = points.length;
  if (n < 3) throw new Error('Mann-Kendall needs at least 3 values');

  let s = 0;
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      s += Math.sign(points[j] - points[i]);
    }
  }

  const tieCounts = new Map<number, number>();
  for (const v of points) tieCounts.set(v, (tieCounts.get(v) ?? 0) + 1);
  let tieTerm = 0;
  for (const t of tieCounts.values()) tieTerm += t * (t - 1) * (2 * t + 5);
  const variance = (n * (n - 1) * (2 * n + 5) - tieTerm) / 18;

  const z = s > 0 ? (s - 1) / Math.sqrt(variance) : s < 0 ? (s + 1) / Math.sqrt(variance) : 0;
  const pValue = erfc(Math.abs(z) / Math.SQRT2);
  const tau = s / (0.5 * n * (n - 1));

  return { s, variance, z, pValue, tau };
}

function erfc(x: number): number {
  const t = 1 / (1 + 0.5 * x);
  const poly =
    -1.26551223 +
    t * (1.00002368 +
    t * (0.37409196 +
    t * (0.09678418 +
    t * (-0.18628806 +
    t * (0.27886807 +
    t * (-1.13520398 +
    t * (1.48851587 +
    t * (-0.82215223 +
    t * 0.17087277))))))));
  return t * Math.exp(-x * x + poly);
}
