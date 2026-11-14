import { Redis } from '@upstash/redis';
import { roundProblem } from '../src/features/game/validate.js';
import type { GameRound } from '../src/features/game/types.js';

export const maxDuration = 30;

const QUESTIONS = 'game:questions';
const VERSIONS = 'game:versions';
const HISTORY = 'game:history:';
const HISTORY_KEEP = 30;
const MAX_BODY = 2_000_000;
const ID = /^[A-Za-z0-9_-]{1,80}$/;

export interface Stored {
  question: GameRound;
  version: string;
  createdAt: string;
  updatedAt: string;
}

// Compare and set: ARGV[2] is the version the editor started from, '' for a new question, '*' to overwrite

const SAVE = `
local current = redis.call('HGET', KEYS[2], ARGV[1])
if ARGV[2] ~= '*' then
  if current and current ~= ARGV[2] then return {'changed', redis.call('HGET', KEYS[1], ARGV[1])} end
  if (not current) and ARGV[2] ~= '' then return {'deleted', ''} end
end
local old = redis.call('HGET', KEYS[1], ARGV[1])
if old then
  redis.call('LPUSH', KEYS[3], old)
  redis.call('LTRIM', KEYS[3], 0, ${HISTORY_KEEP - 1})
end
redis.call('HSET', KEYS[1], ARGV[1], ARGV[4])
redis.call('HSET', KEYS[2], ARGV[1], ARGV[3])
return {'ok', old or ''}
`;

const REMOVE = `
local current = redis.call('HGET', KEYS[2], ARGV[1])
if not current then return {'ok', ''} end
if ARGV[2] ~= '*' and current ~= ARGV[2] then return {'changed', redis.call('HGET', KEYS[1], ARGV[1])} end
local old = redis.call('HGET', KEYS[1], ARGV[1])
redis.call('LPUSH', KEYS[3], old)
redis.call('LTRIM', KEYS[3], 0, ${HISTORY_KEEP - 1})
redis.call('HDEL', KEYS[1], ARGV[1])
redis.call('HDEL', KEYS[2], ARGV[1])
return {'ok', ''}
`;

function client(): Redis {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Redis is not connected to this project');
  return new Redis({ url, token, automaticDeserialization: false });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

const parse = (raw: string | null | undefined): Stored | null => (raw ? (JSON.parse(raw) as Stored) : null);

async function readBody<T>(request: Request): Promise<T | null> {
  const text = await request.text();
  if (text.length > MAX_BODY) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function save(redis: Redis, question: GameRound, base: string, createdAt?: string) {
  const now = new Date().toISOString();
  const previous = parse(await redis.hget<string>(QUESTIONS, question.id));
  const stored: Stored = {
    question,
    version: crypto.randomUUID(),
    createdAt: previous?.createdAt ?? createdAt ?? now,
    updatedAt: now,
  };
  const [outcome, other] = (await redis.eval(SAVE, [QUESTIONS, VERSIONS, `${HISTORY}${question.id}`], [
    question.id,
    base,
    stored.version,
    JSON.stringify(stored),
  ])) as [string, string];
  return { outcome, stored, current: parse(other) };
}

export async function GET(request: Request): Promise<Response> {
  try {
    const redis = client();
    const id = new URL(request.url).searchParams.get('history');
    if (id !== null) {
      if (!ID.test(id)) return json({ error: 'Unknown question' }, 400);
      const items = await redis.lrange<string>(`${HISTORY}${id}`, 0, HISTORY_KEEP - 1);
      return json({ versions: items.map((item) => parse(item)).filter(Boolean) });
    }
    const raw = (await redis.hgetall(QUESTIONS)) as unknown;
    const values = Array.isArray(raw) ? raw.filter((_, i) => i % 2 === 1) : Object.values((raw ?? {}) as Record<string, unknown>);
    const questions = values
      .map((value) => (typeof value === 'string' ? parse(value) : (value as Stored)))
      .filter((s): s is Stored => s !== null)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return json({ questions });
  } catch (error) {
    return json({ error: 'Could not read questions', detail: String(error) }, 502);
  }
}

export async function PUT(request: Request): Promise<Response> {
  const body = await readBody<{ question?: GameRound; baseVersion?: string | null; force?: boolean }>(request);
  if (!body?.question) return json({ error: 'Missing question' }, 400);
  if (!ID.test(body.question.id ?? '')) return json({ error: 'Question id may only use letters, numbers, - and _' }, 400);
  const problem = roundProblem(body.question);
  if (problem) return json({ error: problem }, 400);

  try {
    const redis = client();
    const base = body.force ? '*' : (body.baseVersion ?? '');
    const result = await save(redis, body.question, base);
    if (result.outcome !== 'ok') return json({ conflict: result.outcome, current: result.current }, 409);
    return json({ stored: result.stored });
  } catch (error) {
    return json({ error: 'Could not save the question', detail: String(error) }, 502);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const id = params.get('id') ?? '';
  if (!ID.test(id)) return json({ error: 'Unknown question' }, 400);
  const base = params.get('force') === '1' ? '*' : (params.get('baseVersion') ?? '');

  try {
    const redis = client();
    const [outcome, other] = (await redis.eval(REMOVE, [QUESTIONS, VERSIONS, `${HISTORY}${id}`], [id, base])) as [string, string];
    if (outcome !== 'ok') return json({ conflict: outcome, current: parse(other) }, 409);
    return json({ ok: true });
  } catch (error) {
    return json({ error: 'Could not delete the question', detail: String(error) }, 502);
  }
}

// Bulk import: merge adds or updates, replace also removes questions not in the file

export async function POST(request: Request): Promise<Response> {
  const body = await readBody<{ mode?: 'merge' | 'replace'; questions?: GameRound[] }>(request);
  if (!body || !Array.isArray(body.questions)) return json({ error: 'Missing questions' }, 400);
  if (body.questions.length > 200) return json({ error: 'At most 200 questions' }, 400);
  for (const [i, question] of body.questions.entries()) {
    const problem = ID.test(question?.id ?? '') ? roundProblem(question) : 'Question id may only use letters, numbers, - and _';
    if (problem) return json({ error: `Question ${i + 1}: ${problem}` }, 400);
  }

  try {
    const redis = client();
    if (body.mode === 'replace') {
      const keep = new Set(body.questions.map((q) => q.id));
      const existing = await redis.hkeys(QUESTIONS);
      for (const id of existing.filter((id) => !keep.has(id))) {
        await redis.eval(REMOVE, [QUESTIONS, VERSIONS, `${HISTORY}${id}`], [id, '*']);
      }
    }
    const start = Date.now();
    for (const [i, question] of body.questions.entries()) {
      await save(redis, question, '*', new Date(start + i).toISOString());
    }
    return GET(new Request(new URL('/api/questions', request.url)));
  } catch (error) {
    return json({ error: 'Could not import questions', detail: String(error) }, 502);
  }
}
