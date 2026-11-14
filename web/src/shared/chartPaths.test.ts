import { expect, it } from 'vitest';
import { chartPaths } from './chartPaths';

it('does not draw observed lines or areas across missing years', () => {
  const result = chartPaths([1, 2, null, 3, 4].map((value, i) => ({ t: String(2001 + i), value })), (i) => i * 10, (v) => v, 100);
  expect(result.line).toBe('M 0.0,1.0 L 10.0,2.0 M 30.0,3.0 L 40.0,4.0');
  expect(result.area).toBe('M 0.0,1.0 L 10.0,2.0 L 10,100 L 0,100 Z M 30.0,3.0 L 40.0,4.0 L 40,100 L 30,100 Z');
});

it('preserves isolated observations so one-year selections can display a point', () => {
  const result = chartPaths([null, 4, null].map((value, i) => ({ t: String(2020 + i), value })), (i) => i * 10, (v) => v, 100);
  expect(result.isolated).toEqual([1]);
  expect(result.line).toBe('M 10.0,4.0');
});
