import { describe, expect, it } from 'vitest';
import { importRounds } from './normalize';
import { DEFAULT_ROUNDS } from './rounds';

const SAMPLE = {
  id: 'chiang-mai-rain-soil',
  place: { en: 'Chiang Mai', th: 'เชียงใหม่' },
  time: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  timeLabel: { en: 'Average for each month, 2001 to 2024', th: 'ค่าเฉลี่ยแต่ละเดือน 2001 ถึง 2024' },
  given: { label: { en: 'Rainfall', th: 'ปริมาณฝน' }, unit: 'mm/day', values: [0.5, 0.3, 0.7, 2.2, 6.1, 4.6, 5.8, 7.8, 8.1, 4.3, 1.2, 0.4] },
  hidden: {
    label: { en: 'Surface soil wetness', th: 'ความชื้นผิวดิน' },
    unit: '% of saturation',
    values: [54.7, 49.6, 45.7, 46.4, 58.0, 59.7, 62.1, 68.2, 72.9, 70.7, 64.8, 59.2],
  },
  answer: { en: 'Soil acts like a sponge.', th: 'ดินทำหน้าที่เหมือนฟองน้ำ' },
};

describe('importing rounds', () => {
  it('accepts a single round with month names and no source', () => {
    const result = importRounds([], JSON.stringify(SAMPLE));
    expect(result.problems).toEqual([]);
    expect(result.added).toBe(1);
    expect(result.rounds[0].time.slice(0, 3)).toEqual(['01', '02', '03']);
    expect(result.rounds[0].source).toBe('');
  });

  it('replaces a round with the same id and accepts a rounds wrapper', () => {
    const first = importRounds(DEFAULT_ROUNDS, JSON.stringify({ rounds: [SAMPLE] }));
    const again = importRounds(first.rounds, JSON.stringify([SAMPLE]));
    expect(again.replaced).toBe(1);
    expect(again.rounds).toHaveLength(DEFAULT_ROUNDS.length + 1);
  });

  it('does not copy one language into the other', () => {
    const oneLanguage = { ...SAMPLE, id: 'th-only', answer: { th: 'ไทยอย่างเดียว' } };
    const result = importRounds([], JSON.stringify(oneLanguage));
    expect(result.added).toBe(0);
    expect(result.problems[0]).toContain('English');
  });

  it('replaces everything in replace mode', () => {
    const result = importRounds(DEFAULT_ROUNDS, JSON.stringify([SAMPLE]), 'replace');
    expect(result.rounds.map((r) => r.id)).toEqual(['chiang-mai-rain-soil']);
  });

  it('reports rounds whose values do not match the time points', () => {
    const broken = { ...SAMPLE, id: 'broken', hidden: { ...SAMPLE.hidden, values: [1] } };
    const result = importRounds([], JSON.stringify(broken));
    expect(result.added).toBe(0);
    expect(result.problems[0]).toContain('broken');
  });
});
