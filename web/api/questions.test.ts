import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ROUNDS } from '../src/features/game/rounds';
import type { ExtendRound } from '../src/features/game/types';

// In-memory stand-in for Upstash that runs the two scripts the API uses

const hashes = new Map<string, Map<string, string>>();
const lists = new Map<string, string[]>();
const hash = (key: string) => hashes.get(key) ?? hashes.set(key, new Map()).get(key)!;

vi.mock('@upstash/redis', () => ({
  Redis: class {
    async hget(key: string, field: string) {
      return hash(key).get(field) ?? null;
    }
    async hgetall(key: string) {
      return Object.fromEntries(hash(key));
    }
    async hkeys(key: string) {
      return [...hash(key).keys()];
    }
    async hexists(key: string, field: string) {
      return hash(key).has(field) ? 1 : 0;
    }
    async lrange(key: string) {
      return lists.get(key) ?? [];
    }
    async eval(script: string, [questions, versions, history]: string[], [id, base, version, body]: string[]) {
      const current = hash(versions).get(id);
      const old = hash(questions).get(id);
      const push = (value: string) => lists.set(history, [value, ...(lists.get(history) ?? [])]);
      if (script.includes('HSET')) {
        if (base !== '*') {
          if (current && current !== base) return ['changed', old ?? ''];
          if (!current && base !== '') return ['deleted', ''];
        }
        if (old) push(old);
        hash(questions).set(id, body);
        hash(versions).set(id, version);
        return ['ok', old ?? ''];
      }
      if (!current) return ['ok', ''];
      if (base !== '*' && current !== base) return ['changed', old ?? ''];
      push(old!);
      hash(questions).delete(id);
      hash(versions).delete(id);
      return ['ok', ''];
    }
  },
}));

process.env.KV_REST_API_URL = 'http://fake';
process.env.KV_REST_API_TOKEN = 'fake';
const api = await import('./questions');

const BASE = 'http://localhost/api/questions';
const send = (method: 'PUT' | 'POST' | 'DELETE', url: string, body?: unknown) =>
  api[method](new Request(url, { method, body: body === undefined ? undefined : JSON.stringify(body) }));
const list = async (url = BASE) => ((await (await api.GET(new Request(url))).json()) as { questions: { question: { id: string } }[] }).questions;

const extend = (id: string): ExtendRound => ({
  kind: 'extend',
  id,
  place: { en: 'Bangkok', th: 'กรุงเทพฯ' },
  time: ['2010', '2011', '2012', '2013', '2014'],
  timeLabel: { en: '', th: '' },
  series: { label: { en: 'Heat', th: 'ความร้อน' }, unit: '°C', values: [1, 2, 3, 4, 5] },
  showUntil: '2012',
  answer: { en: 'Up', th: 'ขึ้น' },
  source: '',
});

beforeEach(async () => {
  hashes.clear();
  lists.clear();
  await send('POST', BASE, { mode: 'merge', questions: DEFAULT_ROUNDS });
});

describe('questions API with two kinds', () => {
  it('keeps the original address for two-graph questions', async () => {
    expect((await list()).map((s) => s.question.id)).toEqual(DEFAULT_ROUNDS.map((r) => r.id));
    expect([...hash('game:questions').keys()].sort()).toEqual(DEFAULT_ROUNDS.map((r) => r.id).sort());
  });

  it('stores continue-the-line questions under their own keys', async () => {
    expect((await send('PUT', `${BASE}?kind=extend`, { question: extend('x1'), baseVersion: '' })).status).toBe(200);
    expect(hash('extend:questions').has('x1')).toBe(true);
    expect(hash('game:questions').has('x1')).toBe(false);
    expect((await list(`${BASE}?kind=extend`)).map((s) => s.question.id)).toEqual(['x1']);
    expect(await list()).toHaveLength(DEFAULT_ROUNDS.length);
  });

  it('replacing continue-the-line questions leaves two-graph questions alone', async () => {
    const before = new Map(hash('game:questions'));
    await send('POST', `${BASE}?kind=extend`, { mode: 'replace', questions: [extend('x1'), extend('x2')] });
    await send('POST', `${BASE}?kind=extend`, { mode: 'replace', questions: [extend('x3')] });
    expect(hash('game:questions')).toEqual(before);
    expect([...hash('extend:questions').keys()]).toEqual(['x3']);
  });

  it('rejects a question sent to the wrong kind', async () => {
    expect((await send('PUT', BASE, { question: extend('x1'), baseVersion: '' })).status).toBe(400);
    expect((await send('PUT', `${BASE}?kind=extend`, { question: DEFAULT_ROUNDS[0], baseVersion: '' })).status).toBe(400);
    expect((await send('PUT', `${BASE}?kind=nope`, { question: extend('x1') })).status).toBe(400);
  });

  it('does not let both kinds share an id', async () => {
    const taken = DEFAULT_ROUNDS[0].id;
    const response = await send('PUT', `${BASE}?kind=extend`, { question: extend(taken), baseVersion: '' });
    expect(response.status).toBe(400);
    expect(hash('extend:questions').has(taken)).toBe(false);
  });

  it('deletes only from the kind it is asked for', async () => {
    await send('PUT', `${BASE}?kind=extend`, { question: extend('x1'), baseVersion: '' });
    await send('DELETE', `${BASE}?kind=extend&id=${DEFAULT_ROUNDS[0].id}&force=1`);
    expect(hash('game:questions').has(DEFAULT_ROUNDS[0].id)).toBe(true);
    await send('DELETE', `${BASE}?kind=extend&id=x1&force=1`);
    expect(hash('extend:questions').has('x1')).toBe(false);
  });
});
