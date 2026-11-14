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
    const result = judge(actual, actual, axis, true);
    expect(result.score).toBe(100);
    expect(result.crest).toBe('right');
    expect(result.peak.actual).toBe(8);
  });

  it('marks a peak one month off as close, wrapping around the year', () => {
    const shifted = [...actual.slice(1), actual[0]];
    expect(judge(shifted, actual, axis, true).crest).toBe('close');
    expect(judge(shifted, actual, axis, true).score).toBeLessThan(100);
  });

  it('does not wrap around for yearly series and skips missing values', () => {
    const years = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    expect(judge([...years.slice(1), 1], years, niceAxis(years), false).trough).toBe('off');
    expect(judge([...years.slice(1), 1], years, niceAxis(years), true).trough).toBe('close');
    expect(judge([1, 2, 3], [1, null, 3], niceAxis([1, 3]), false).score).toBe(100);
  });

  it('fills untouched months by straight lines', () => {
    expect(fillGaps([0, null, null, 0.9]).map((v) => +v.toFixed(2))).toEqual([0, 0.3, 0.6, 0.9]);
    expect(fillGaps([null, 0.4, null])).toEqual([0.4, 0.4, 0.4]);
  });
});
