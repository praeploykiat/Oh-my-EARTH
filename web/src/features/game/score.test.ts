import { describe, expect, it } from 'vitest';
import { fillGaps, judge, niceAxis } from './score';

describe('game scoring', () => {
  const actual = [20, 18, 17, 18, 22, 26, 29, 32, 34, 33, 28, 23];
  const axis = niceAxis(actual);

  it('builds an axis with round ticks around the data', () => {
    expect(axis.min).toBeLessThanOrEqual(17);
    expect(axis.max).toBeGreaterThanOrEqual(34);
    expect(axis.ticks[0]).toBe(axis.min);
    expect(axis.ticks.at(-1)).toBe(axis.max);
  });

  it('gives 100 and the right peak for a perfect line', () => {
    const result = judge(actual, actual, axis);
    expect(result.score).toBe(100);
    expect(result.crest).toBe('right');
    expect(result.peak.actual).toBe(8);
  });

  it('marks a peak one month off as close, wrapping around the year', () => {
    const shifted = [...actual.slice(1), actual[0]];
    expect(judge(shifted, actual, axis).crest).toBe('close');
    expect(judge(shifted, actual, axis).score).toBeLessThan(100);
  });

  it('fills untouched months by straight lines', () => {
    expect(fillGaps([0, null, null, 0.9]).map((v) => +v.toFixed(2))).toEqual([0, 0.3, 0.6, 0.9]);
    expect(fillGaps([null, 0.4, null])).toEqual([0.4, 0.4, 0.4]);
  });
});
