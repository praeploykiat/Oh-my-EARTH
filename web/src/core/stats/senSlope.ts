import type { Series } from './mannKendall';

export function senSlope(values: Series): number {
  const points: Array<[number, number]> = [];
  values.forEach((v, i) => {
    if (v !== null && !Number.isNaN(v)) points.push([i, v]);
  });

  const slopes: number[] = [];
  for (let a = 0; a < points.length - 1; a++) {
    for (let b = a + 1; b < points.length; b++) {
      const [i, vi] = points[a];
      const [j, vj] = points[b];
      slopes.push((vj - vi) / (j - i));
    }
  }
  if (slopes.length === 0) throw new Error("Sen's slope needs at least 2 values");

  return median(slopes);
}

function median(values: number[]): number {
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
