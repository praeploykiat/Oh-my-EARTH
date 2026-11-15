import { DEFAULT_ROUNDS } from './rounds';
import { kindOf, type AnyRound, type RoundKind } from './types';

const URL_BASE = '/api/questions';

export interface Stored {
  question: AnyRound;
  version: string;
  createdAt: string;
  updatedAt: string;
}

export type SaveResult =
  | { kind: 'saved'; stored: Stored }
  | { kind: 'conflict'; reason: 'changed' | 'deleted'; current: Stored | null };

// Questions without a kind use the original endpoint, so older pages keep working
function url(kind: RoundKind, params: Record<string, string> = {}): string {
  const query = new URLSearchParams({ ...(kind === 'extend' ? { kind } : {}), ...params }).toString();
  return query ? `${URL_BASE}?${query}` : URL_BASE;
}

async function call<T>(target: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const response = await fetch(target, init);
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (response.status === 409 && body) return { status: 409, body };
  if (!response.ok || !body) throw new Error(body?.error ?? `Request failed (${response.status})`);
  return { status: response.status, body };
}

const byCreated = (a: Stored, b: Stored) => a.createdAt.localeCompare(b.createdAt);

export async function fetchRounds(): Promise<{ rounds: AnyRound[]; saved: boolean }> {
  let pairs: AnyRound[] = [];
  let saved = false;
  try {
    pairs = (await fetchQuestions('pair')).map((s) => s.question);
    saved = pairs.length > 0;
  } catch {
    // Falls back to the mock questions when nothing is saved yet or the API is not running
  }
  const extends_ = await fetchQuestions('extend').then(
    (list) => list.map((s) => s.question),
    () => [],
  );
  return { rounds: [...(saved ? pairs : DEFAULT_ROUNDS), ...extends_], saved: saved || extends_.length > 0 };
}

export async function fetchQuestions(kind: RoundKind = 'pair'): Promise<Stored[]> {
  return (await call<{ questions: Stored[] }>(url(kind), { cache: 'no-store' })).body.questions;
}

export async function fetchAllQuestions(): Promise<Stored[]> {
  const [pairs, extend] = await Promise.all([fetchQuestions('pair'), fetchQuestions('extend')]);
  return [...pairs, ...extend].sort(byCreated);
}

export async function saveQuestion(question: AnyRound, baseVersion: string | null, force = false): Promise<SaveResult> {
  const { status, body } = await call<{ stored?: Stored; conflict?: 'changed' | 'deleted'; current?: Stored | null }>(url(kindOf(question)), {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question, baseVersion, force }),
  });
  if (status === 409) return { kind: 'conflict', reason: body.conflict ?? 'changed', current: body.current ?? null };
  return { kind: 'saved', stored: body.stored! };
}

export async function deleteQuestion(question: AnyRound, baseVersion: string | null, force = false): Promise<SaveResult | { kind: 'deleted' }> {
  const params = { id: question.id, baseVersion: baseVersion ?? '', ...(force ? { force: '1' } : {}) };
  const { status, body } = await call<{ conflict?: 'changed'; current?: Stored | null }>(url(kindOf(question), params), { method: 'DELETE' });
  if (status === 409) return { kind: 'conflict', reason: 'changed', current: body.current ?? null };
  return { kind: 'deleted' };
}

// Each kind is sent on its own, so replacing one kind never touches the other.
// Returns every saved question of both kinds afterwards.
export async function importQuestions(questions: AnyRound[], mode: 'merge' | 'replace'): Promise<Stored[]> {
  for (const kind of ['pair', 'extend'] as RoundKind[]) {
    const group = questions.filter((q) => kindOf(q) === kind);
    if (group.length === 0) continue;
    await call<{ questions: Stored[] }>(url(kind), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questions: group, mode }),
    });
  }
  return fetchAllQuestions();
}

export async function questionHistory(question: AnyRound): Promise<Stored[]> {
  return (await call<{ versions: Stored[] }>(url(kindOf(question), { history: question.id }))).body.versions;
}
