export interface Axis {
  min: number;
  max: number;
  ticks: number[];
}

export function niceAxis(values: number[], steps = 5): Axis {
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
  trough: 'right' | 'close' | 'off';
  crest: 'right' | 'close' | 'off';
}

const argmax = (v: number[]) => v.indexOf(Math.max(...v));
const argmin = (v: number[]) => v.indexOf(Math.min(...v));

function monthGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 12;
  return Math.min(d, 12 - d);
}

const verdict = (gap: number) => (gap === 0 ? 'right' : gap === 1 ? 'close' : 'off');

export function judge(guess: number[], actual: number[], axis: Axis): Feedback {
  const span = axis.max - axis.min || 1;
  const meanError = guess.reduce((sum, g, i) => sum + Math.abs(g - actual[i]), 0) / guess.length;
  const score = Math.round(Math.max(0, 1 - meanError / (0.3 * span)) * 100);
  const peak = { guess: argmax(guess), actual: argmax(actual) };
  const low = { guess: argmin(guess), actual: argmin(actual) };
  return {
    score,
    meanError,
    peak,
    low,
    crest: verdict(monthGap(peak.guess, peak.actual)),
    trough: verdict(monthGap(low.guess, low.actual)),
  };
}
