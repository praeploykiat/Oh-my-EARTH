export interface Axis {
  min: number;
  max: number;
  ticks: number[];
}

export function niceAxis(input: (number | null)[], steps = 5): Axis {
  const values = input.filter((v): v is number => v !== null);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo || 1) * 0.25;
  const raw = (hi + pad - Math.max(0, lo - pad)) / steps;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw)!;
  const min = Math.max(0, Math.floor((lo - pad) / step) * step);
  const max = Math.ceil((hi + pad) / step) * step;
  const ticks = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => +(min + i * step).toFixed(6));
  return { min, max, ticks };
}

export function fillGaps(values: (number | null)[]): number[] {
  const known = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null);
  if (known.length === 0) return values.map(() => 0);
  return values.map((v, i) => {
    if (v !== null) return v;
    const before = [...known].reverse().find(([k]) => k < i);
    const after = known.find(([k]) => k > i);
    if (!before) return after![1];
    if (!after) return before[1];
    const share = (i - before[0]) / (after[0] - before[0]);
    return before[1] + share * (after[1] - before[1]);
  });
}

export interface Feedback {
  score: number;
  meanError: number;
  peak: { guess: number; actual: number };
  low: { guess: number; actual: number };
  crest: 'right' | 'close' | 'off';
  trough: 'right' | 'close' | 'off';
}

function extreme(values: (number | null)[], pick: (a: number, b: number) => boolean): number {
  let best = -1;
  values.forEach((v, i) => {
    if (v !== null && (best < 0 || pick(v, values[best]!))) best = i;
  });
  return best;
}

function stepGap(a: number, b: number, length: number, cyclic: boolean): number {
  const d = Math.abs(a - b);
  return cyclic ? Math.min(d, length - d) : d;
}

const verdict = (gap: number) => (gap === 0 ? 'right' : gap === 1 ? 'close' : 'off');

export function judge(guess: number[], actual: (number | null)[], axis: Axis, cyclic: boolean): Feedback {
  const span = axis.max - axis.min || 1;
  const pairs = actual.flatMap((a, i) => (a === null ? [] : [Math.abs(guess[i] - a)]));
  const meanError = pairs.reduce((sum, e) => sum + e, 0) / (pairs.length || 1);
  const score = Math.round(Math.max(0, 1 - meanError / (0.3 * span)) * 100);
  const masked = guess.map((g, i) => (actual[i] === null ? null : g));
  const peak = { guess: extreme(masked, (a, b) => a > b), actual: extreme(actual, (a, b) => a > b) };
  const low = { guess: extreme(masked, (a, b) => a < b), actual: extreme(actual, (a, b) => a < b) };
  return {
    score,
    meanError,
    peak,
    low,
    crest: verdict(stepGap(peak.guess, peak.actual, actual.length, cyclic)),
    trough: verdict(stepGap(low.guess, low.actual, actual.length, cyclic)),
  };
}
