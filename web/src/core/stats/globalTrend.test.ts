import { describe, expect, it } from 'vitest';
import fixtures from '../../../../fixtures/global-trend-cases.json';
import { analyzeGlobalTrend, GLOBAL_TREND_METHOD, residualLag1 } from './globalTrend';

describe('global trend: independently generated Python/SciPy reference', () => {
  for (const testCase of fixtures.cases) {
    it(testCase.name, () => {
      const result = analyzeGlobalTrend(testCase.values, testCase.period as 1 | 12);
      const expected = testCase.expected;
      expect(result.method).toBe(GLOBAL_TREND_METHOD);
      expect(result.slopePerDecade).toBeCloseTo(expected.slopePerDecade, 8);
      expect(result.lowerPerDecade).toBeCloseTo(expected.lowerPerDecade, 8);
      expect(result.upperPerDecade).toBeCloseTo(expected.upperPerDecade, 8);
      expect(result.pValue).toBeCloseTo(expected.pValue, 8);
      expect(result.score).toBe(expected.score);
      expect(result.variance).toBeCloseTo(expected.variance, 8);
      expect(result.evidence).toBe(expected.evidence);
      expect(result.warnings).toEqual(expected.warnings);
      expect(result.blockYears).toBe(expected.blockYears);
      if (expected.lag1 === null) expect(result.lag1).toBeNull();
      else expect(result.lag1).toBeCloseTo(expected.lag1, 8);
      result.sensitivity.forEach((sample, i) => {
        expect(sample.pValue).toBeCloseTo(expected.sensitivity[i].pValue, 8);
        expect(sample.lowerPerDecade).toBeCloseTo(expected.sensitivity[i].lowerPerDecade, 8);
        expect(sample.upperPerDecade).toBeCloseTo(expected.sensitivity[i].upperPerDecade, 8);
      });
      expect(result.seasonalSlopesPerDecade).toHaveLength(testCase.period);
      result.seasonalSlopesPerDecade.forEach((slope, i) => expect(slope).toBeCloseTo(expected.seasonalSlopesPerDecade[i]!, 8));
    }, 30000);
  }
});

describe('trend safeguards and invariants', () => {
  it('does not mistake a repeating seasonal cycle for a trend', () => {
    const result = analyzeGlobalTrend(fixtures.cases.find((c) => c.name === 'season-only')!.values, 12, 99);
    expect(result.slopePerDecade).toBe(0);
    expect(result.pValue).toBe(1);
    expect(result.lowerPerDecade).toBe(0);
    expect(result.upperPerDecade).toBe(0);
    expect(result.evidence).toBe('inconclusive');
  });
  it('keeps direction uncertain when month-specific trends cancel', () => {
    const result = analyzeGlobalTrend(fixtures.cases.find((c) => c.name === 'opposing-months')!.values, 12, 99);
    expect(result.evidence).toBe('inconclusive');
    expect(Math.min(...result.seasonalSlopesPerDecade as number[])).toBeLessThan(0);
    expect(Math.max(...result.seasonalSlopesPerDecade as number[])).toBeGreaterThan(0);
  });
  it('is reproducible and retains units when values are scaled', () => {
    const annual = fixtures.cases.find((c) => c.name === 'annual-totals')!.values;
    const first = analyzeGlobalTrend(annual, 1, 99);
    expect(analyzeGlobalTrend(annual, 1, 99)).toEqual(first);
    const scaled = analyzeGlobalTrend(annual.map((v) => v === null ? null : v * 10), 1, 99);
    expect(scaled.slopePerDecade).toBeCloseTo(first.slopePerDecade * 10, 8);
    expect(scaled.lowerPerDecade).toBeCloseTo(first.lowerPerDecade * 10, 8);
    expect(scaled.upperPerDecade).toBeCloseTo(first.upperPerDecade * 10, 8);
    expect(scaled.pValue).toBe(first.pValue);
  });
  it('rejects short, sparse, misaligned and nonfinite inputs', () => {
    expect(() => analyzeGlobalTrend(Array(9 * 12).fill(1), 12)).toThrow('10');
    expect(() => analyzeGlobalTrend(Array(121).fill(1), 12)).toThrow('calendar');
    expect(() => analyzeGlobalTrend(Array(120).fill(null), 12)).toThrow('coverage');
    expect(() => analyzeGlobalTrend(Array(120).fill(Infinity), 12)).toThrow('Nonfinite');
    const oneMissingMonth = Array.from({ length: 120 }, (_, i) => i % 12 === 1 ? null : i);
    expect(() => analyzeGlobalTrend(oneMissingMonth, 12)).toThrow('Every calendar month');
  });
  it('never joins missing time steps when diagnosing lag-1 dependence', () => {
    expect(residualLag1([1, null, 9, null, 7, null, 3])).toBeNull();
    expect(residualLag1([5, 5, 5, 5])).toBeNull();
    expect(residualLag1([1, 2, 3, 4, 5])).toBeCloseTo(1);
  });
  it('labels short, gappy or persistent records as provisional even when a numeric threshold passes', () => {
    for (const name of ['minimum-ten-years', 'calendar-gaps', 'persistent-null']) {
      const fixture = fixtures.cases.find((testCase) => testCase.name === name)!;
      const result = analyzeGlobalTrend(fixture.values, fixture.period as 1 | 12, 99);
      expect(result.evidence).toBe('limited');
      expect(result.warnings.length).toBeGreaterThan(0);
    }
  });
});
