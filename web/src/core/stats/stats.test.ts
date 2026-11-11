import { describe, expect, it } from 'vitest';
import fixtures from '../../../../fixtures/trend-cases.json';
import { analyzeTrend, deseasonalize, mannKendall, senSlope } from '.';

interface TrendCase {
  name: string;
  values: Array<number | null>;
  expected: { s: number; pValue: number; senSlope: number };
}

const cases = fixtures.cases as TrendCase[];
const tolerance = fixtures.tolerance;

describe('matches shared fixtures', () => {
  it.each(cases.map((c) => [c.name, c] as const))('%s', (_, c) => {
    const result = mannKendall(c.values);
    expect(result.s).toBe(c.expected.s);
    expect(Math.abs(result.pValue - c.expected.pValue)).toBeLessThan(tolerance);
    expect(Math.abs(senSlope(c.values) - c.expected.senSlope)).toBeLessThan(tolerance);
  });
});

describe('deseasonalize', () => {
  it('removes a repeating monthly cycle', () => {
    const cycle = Array.from({ length: 36 }, (_, i) => i % 12);
    for (const v of deseasonalize(cycle)) expect(Math.abs(v ?? 0)).toBeLessThan(1e-12);
  });
});

describe('analyzeTrend', () => {
  it('flags a clear trend as significant', () => {
    expect(analyzeTrend(Array.from({ length: 20 }, (_, i) => i)).significant).toBe(true);
  });

  it('does not flag noise as significant', () => {
    expect(analyzeTrend([1, 3, 2, 1, 3, 2]).significant).toBe(false);
  });

  it('rejects series that are too short', () => {
    expect(() => mannKendall([1, 2])).toThrow();
  });
});
