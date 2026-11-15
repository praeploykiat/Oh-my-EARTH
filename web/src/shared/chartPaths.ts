import type { SeriesPoint } from '../core/data';

// Each contiguous run gets its own line and area; missing observations are visible gaps.
export function chartPaths(series: SeriesPoint[], x: (i: number) => number, y: (v: number) => number, bottom: number) {
  const runs: Array<{ first: number; last: number; points: string[] }> = [];
  let run: typeof runs[number] | undefined;
  series.forEach((point, i) => {
    if (point.value === null) { run = undefined; return; }
    if (!run) { run = { first: i, last: i, points: [] }; runs.push(run); }
    run.last = i;
    run.points.push(`${x(i).toFixed(1)},${y(point.value).toFixed(1)}`);
  });
  return {
    isolated: runs.filter((part) => part.first === part.last).map((part) => part.first),
    line: runs.map((part) => `M ${part.points.join(' L ')}`).join(' '),
    area: runs.map((part) => `M ${part.points.join(' L ')} L ${x(part.last)},${bottom} L ${x(part.first)},${bottom} Z`).join(' '),
  };
}
