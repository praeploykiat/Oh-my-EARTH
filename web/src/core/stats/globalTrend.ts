// Seasonal Kendall/Sen with a circular, whole-year residual block bootstrap.
// Specification, assumptions and Python validation: docs/global-trend-method.md.
export const GLOBAL_TREND_METHOD = 'seasonal-sen-cbb-v1';
export const BOOTSTRAP_REPLICATES = 999;
export const BOOTSTRAP_SEED = 271828;

export interface BootstrapEstimate {
  blockYears: number;
  pValue: number;
  lowerPerDecade: number;
  upperPerDecade: number;
  validReplicates: number;
  criticalScore: number;
}
export interface GlobalTrendResult {
  method: string;
  period: 1 | 12;
  slopePerDecade: number;
  lowerPerDecade: number;
  upperPerDecade: number;
  pValue: number;
  confidence: number;
  replicates: number;
  seed: number;
  blockYears: number;
  lag1: number | null;
  score: number;
  variance: number;
  seasonalSlopesPerDecade: Array<number | null>;
  sensitivity: BootstrapEstimate[];
  warnings: Array<'gaps' | 'persistence' | 'short'>;
  evidence: 'increase' | 'decrease' | 'inconclusive' | 'sensitive' | 'limited';
}

function median(values: number[]): number {
  if (!values.length) return NaN;
  values.sort((a, b) => a - b);
  const mid = values.length >> 1;
  return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
}

function summary(values: ReadonlyArray<number | null>, period: number, withSlope = true) {
  let score = 0;
  let variance = 0;
  let pairs = 0;
  const slopes: number[] = [];
  const seasonalSlopes: Array<number | null> = [];
  for (let month = 0; month < period; month++) {
    const points: Array<[number, number]> = [];
    for (let i = month; i < values.length; i += period) {
      if (values[i] !== null) points.push([Math.floor(i / period), values[i]!]);
    }
    const ties = new Map<number, number>();
    const season: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const [year, value] = points[i];
      ties.set(value, (ties.get(value) ?? 0) + 1);
      for (let j = i + 1; j < points.length; j++) {
        score += Math.sign(points[j][1] - value);
        if (withSlope) season.push((points[j][1] - value) / (points[j][0] - year));
      }
    }
    const n = points.length;
    pairs += n * (n - 1) / 2;
    let tieTerm = 0;
    for (const count of ties.values()) tieTerm += count * (count - 1) * (2 * count + 5);
    variance += (n * (n - 1) * (2 * n + 5) - tieTerm) / 18;
    slopes.push(...season);
    seasonalSlopes.push(season.length ? median(season) : null);
  }
  return { score, variance, pairs, slope: withSlope ? median(slopes) : NaN, slopes, seasonalSlopes };
}

function quantile(sorted: number[], probability: number): number {
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[Math.min(lower + 1, sorted.length - 1)] * weight;
}

function generator(seed: number) {
  let state = seed;
  return () => { state = state * 16807 % 2147483647; return state / 2147483647; };
}

export function residualLag1(residuals: ReadonlyArray<number | null>): number | null {
  const pairs: Array<[number, number]> = [];
  for (let i = 1; i < residuals.length; i++) {
    if (residuals[i - 1] !== null && residuals[i] !== null) pairs.push([residuals[i - 1]!, residuals[i]!]);
  }
  if (pairs.length < 3) return null;
  const mx = pairs.reduce((sum, [x]) => sum + x, 0) / pairs.length;
  const my = pairs.reduce((sum, [, y]) => sum + y, 0) / pairs.length;
  let cross = 0, xx = 0, yy = 0;
  for (const [x, y] of pairs) { cross += (x - mx) * (y - my); xx += (x - mx) ** 2; yy += (y - my) ** 2; }
  return xx > 0 && yy > 0 ? Math.max(-1, Math.min(1, cross / Math.sqrt(xx * yy))) : null;
}

export function analyzeGlobalTrend(values: ReadonlyArray<number | null>, period: 1 | 12, replicates = BOOTSTRAP_REPLICATES): GlobalTrendResult {
  if (period !== 1 && period !== 12) throw new Error('Expected annual or January-aligned monthly data');
  if (values.length % period || values.length / period < 10) throw new Error('At least 10 complete calendar positions are required');
  if (values.some((v) => v !== null && !Number.isFinite(v))) throw new Error('Nonfinite trend observation');
  if (!Number.isInteger(replicates) || replicates < 99) throw new Error('At least 99 bootstrap replicates are required');
  const years = values.length / period;
  const observedYears = Array.from({ length: years }, (_, y) => values.slice(y * period, (y + 1) * period).some((v) => v !== null)).filter(Boolean).length;
  if (observedYears < 10 || (period === 12 && values.filter((v) => v !== null).length / values.length < 0.8)) throw new Error('Insufficient trend coverage');
  const observed = summary(values, period);
  if (!Number.isFinite(observed.slope)) throw new Error('No comparable observations');
  const intercepts = Array.from({ length: period }, (_, month) => median(values.flatMap((v, i) => i % period === month && v !== null ? [v - observed.slope * i / period] : [])));
  if (intercepts.some((v) => !Number.isFinite(v))) throw new Error('Every calendar month needs observations');
  const tolerance = Math.max(1, ...values.flatMap((v) => v === null ? [] : [Math.abs(v)])) * 1e-12;
  const residuals = values.map((v, i) => {
    if (v === null) return null;
    const residual = v - observed.slope * i / period - intercepts[i % period];
    return Math.abs(residual) < tolerance ? 0 : residual;
  });
  const primaryBlock = Math.min(Math.floor(years / 3), Math.max(2, Math.ceil(Math.cbrt(years))));
  const blockChoices = [...new Set([primaryBlock - 1, primaryBlock, primaryBlock + 1].map((b) => Math.min(Math.floor(years / 3), Math.max(2, b))))].sort((a, b) => a - b);
  const observedStatistic = observed.variance > 0 ? Math.abs(observed.score) / Math.sqrt(observed.variance) : 0;
  const sensitivity: BootstrapEstimate[] = blockChoices.map((blockYears) => {
    const random = generator(BOOTSTRAP_SEED + blockYears);
    const bootstrapStatistics: number[] = [];
    let extreme = 0;
    for (let replicate = 0; replicate < replicates; replicate++) {
      const nullSample: Array<number | null> = [];
      while (nullSample.length < values.length) {
        const startYear = Math.floor(random() * years);
        for (let offset = 0; offset < blockYears && nullSample.length < values.length; offset++) {
          const sourceYear = (startYear + offset) % years;
          for (let month = 0; month < period; month++) {
            const residual = residuals[sourceYear * period + month];
            nullSample.push(residual === null ? null : intercepts[month] + residual);
          }
        }
      }
      const nullSummary = summary(nullSample, period, false);
      if (nullSummary.pairs === 0) continue;
      const statistic = nullSummary.variance > 0 ? Math.abs(nullSummary.score) / Math.sqrt(nullSummary.variance) : 0;
      bootstrapStatistics.push(statistic);
      if (statistic >= observedStatistic - 1e-12) extreme++;
    }
    if (bootstrapStatistics.length < Math.ceil(replicates * 0.9)) throw new Error('Too few usable bootstrap samples');
    bootstrapStatistics.sort((a, b) => a - b);
    const criticalScore = quantile(bootstrapStatistics, 0.95) * Math.sqrt(observed.variance);
    if (criticalScore >= observed.pairs) throw new Error('Slope uncertainty is unbounded for this record');
    const lower = Math.max(0, Math.ceil((observed.pairs - criticalScore) / 2) - 1);
    const upper = Math.min(observed.slopes.length - 1, Math.floor((observed.pairs + criticalScore) / 2));
    return {
      blockYears, pValue: (extreme + 1) / (bootstrapStatistics.length + 1), validReplicates: bootstrapStatistics.length, criticalScore,
      lowerPerDecade: observed.slopes[lower] * 10,
      upperPerDecade: observed.slopes[upper] * 10,
    };
  });
  const primary = sensitivity.find((s) => s.blockYears === primaryBlock)!;
  const direction = (sample: BootstrapEstimate) => sample.pValue < 0.05 && sample.lowerPerDecade > 0 ? 'increase' : sample.pValue < 0.05 && sample.upperPerDecade < 0 ? 'decrease' : 'inconclusive';
  const decisions = sensitivity.map(direction);
  const lag1 = residualLag1(residuals);
  const warnings: GlobalTrendResult['warnings'] = [];
  if (values.some((v) => v === null)) warnings.push('gaps');
  if (lag1 !== null && Math.abs(lag1) >= 0.8) warnings.push('persistence');
  if (years < 15) warnings.push('short');
  const evidence = warnings.length ? 'limited' : new Set(decisions).size > 1 ? 'sensitive' : direction(primary);
  return {
    method: GLOBAL_TREND_METHOD, period, slopePerDecade: observed.slope * 10,
    lowerPerDecade: primary.lowerPerDecade, upperPerDecade: primary.upperPerDecade,
    pValue: primary.pValue, confidence: 0.95, replicates, seed: BOOTSTRAP_SEED,
    blockYears: primaryBlock, lag1, score: observed.score, variance: observed.variance,
    seasonalSlopesPerDecade: observed.seasonalSlopes.map((s) => s === null ? null : s * 10), sensitivity, warnings, evidence,
  };
}
