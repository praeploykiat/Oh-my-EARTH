import { afterEach, describe, expect, it, vi } from 'vitest';
import { importQuestions } from './api';
import { scoreExtend } from './extend';
import { importRounds } from './normalize';
import { DEFAULT_ROUNDS } from './rounds';
import { kindOf, type ExtendRound } from './types';
import { anyProblem, extendProblem, roundProblem } from './validate';

const YEARS = Array.from({ length: 10 }, (_, i) => String(2010 + i));

const extendRound = (over: Partial<ExtendRound> = {}): ExtendRound => ({
  kind: 'extend',
  id: 'x-1',
  place: { en: 'Bangkok', th: 'กรุงเทพฯ' },
  time: YEARS,
  timeLabel: { en: '', th: '' },
  series: { label: { en: 'Air temperature', th: 'อุณหภูมิ' }, unit: '°C', values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  showUntil: '2015',
  answer: { en: 'Up', th: 'ขึ้น' },
  source: '',
  ...over,
});

describe('continue the line questions', () => {
  it('accepts a complete question', () => {
    expect(extendProblem(extendRound())).toBeNull();
    expect(anyProblem(extendRound())).toBeNull();
  });

  it('needs a last shown point inside the time axis', () => {
    expect(extendProblem(extendRound({ showUntil: '1999' }))).toMatch(/last time point/);
  });

  it('needs at least 2 numbers on each side', () => {
    expect(extendProblem(extendRound({ showUntil: '2010' }))).toMatch(/see at least 2/);
    expect(extendProblem(extendRound({ showUntil: '2018' }))).toMatch(/guess after/);
  });

  it('keeps checking two-graph questions the old way', () => {
    for (const round of DEFAULT_ROUNDS) {
      expect(roundProblem(round)).toBeNull();
      expect(anyProblem(round)).toBeNull();
      expect(kindOf(round)).toBe('pair');
    }
    expect(roundProblem(extendRound())).not.toBeNull();
  });

  it('scores a perfect continuation as 100 and reads the direction', () => {
    const round = extendRound();
    const guess = round.series.values.map((v, i) => (i > 5 ? v : null));
    const { feedback } = scoreExtend(round, guess);
    expect(feedback.score).toBe(100);
    expect(feedback.direction).toEqual({ guess: 'up', actual: 'up' });
    expect(feedback.trend?.perDecade).toBeCloseTo(10);
  });

  it('marks a guess that goes the wrong way', () => {
    const round = extendRound();
    const guess = round.series.values.map((_, i) => (i > 5 ? 6 - (i - 5) * 2 : null));
    const { feedback } = scoreExtend(round, guess);
    expect(feedback.direction.guess).toBe('down');
    expect(feedback.score).toBeLessThan(50);
  });
});

describe('importing a mixed file', () => {
  it('reads both types and keeps old files as two-graph questions', () => {
    const pair = { ...DEFAULT_ROUNDS[0], id: 'old-one' };
    const { rounds, problems } = importRounds([], JSON.stringify([pair, { ...extendRound(), id: 'new-one' }]));
    expect(problems).toEqual([]);
    expect(rounds.map(kindOf)).toEqual(['pair', 'extend']);
    expect(rounds[0]).toEqual(pair);
  });

  it('explains a values list of the wrong length', () => {
    const bad = { ...extendRound(), series: { ...extendRound().series, values: [1, 2] } };
    expect(importRounds([], JSON.stringify(bad)).problems[0]).toMatch(/series.values needs 10 values/);
  });
});

describe('replacing questions of one type', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('never sends the other type to the server', async () => {
    const calls: { url: string; method: string; body: { questions: unknown[]; mode: string } | null }[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : null });
      return new Response(JSON.stringify({ questions: [] }), { status: 200 });
    });
    await importQuestions([extendRound()], 'replace');
    const posts = calls.filter((c) => c.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toBe('/api/questions?kind=extend');
    expect(posts[0].body?.mode).toBe('replace');
  });

  it('sends two-graph questions to the original address', async () => {
    const calls: { url: string; method: string }[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET' });
      return new Response(JSON.stringify({ questions: [] }), { status: 200 });
    });
    await importQuestions([DEFAULT_ROUNDS[0]], 'merge');
    expect(calls.filter((c) => c.method === 'POST').map((c) => c.url)).toEqual(['/api/questions']);
  });
});
