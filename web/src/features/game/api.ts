import { DEFAULT_ROUNDS } from './rounds';
import type { GameRound } from './types';

const URL_BASE = '/api/questions';

export interface Stored {
  question: GameRound;
  version: string;
  createdAt: string;
  updatedAt: string;
}

export type SaveResult =
  | { kind: 'saved'; stored: Stored }
  | { kind: 'conflict'; reason: 'changed' | 'deleted'; current: Stored | null };

async function call<T>(url: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (response.status === 409 && body) return { status: 409, body };
  if (!response.ok || !body) throw new Error(body?.error ?? `Request failed (${response.status})`);
  return { status: response.status, body };
}

export async function fetchRounds(): Promise<{ rounds: GameRound[]; saved: boolean }> {
  try {
    const questions = await fetchQuestions();
    if (questions.length > 0) return { rounds: questions.map((s) => s.question), saved: true };
  } catch {
    // Falls back to the mock questions when nothing is saved yet or the API is not running
  }
  return { rounds: DEFAULT_ROUNDS, saved: false };
}

export async function fetchQuestions(): Promise<Stored[]> {
  return (await call<{ questions: Stored[] }>(URL_BASE, { cache: 'no-store' })).body.questions;
}

export async function saveQuestion(question: GameRound, baseVersion: string | null, force = false): Promise<SaveResult> {
  const { status, body } = await call<{ stored?: Stored; conflict?: 'changed' | 'deleted'; current?: Stored | null }>(URL_BASE, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question, baseVersion, force }),
  });
  if (status === 409) return { kind: 'conflict', reason: body.conflict ?? 'changed', current: body.current ?? null };
  return { kind: 'saved', stored: body.stored! };
}

export async function deleteQuestion(id: string, baseVersion: string | null, force = false): Promise<SaveResult | { kind: 'deleted' }> {
  const params = new URLSearchParams({ id, baseVersion: baseVersion ?? '', ...(force ? { force: '1' } : {}) });
  const { status, body } = await call<{ conflict?: 'changed'; current?: Stored | null }>(`${URL_BASE}?${params}`, { method: 'DELETE' });
  if (status === 409) return { kind: 'conflict', reason: 'changed', current: body.current ?? null };
  return { kind: 'deleted' };
}

export async function importQuestions(questions: GameRound[], mode: 'merge' | 'replace'): Promise<Stored[]> {
  return (
    await call<{ questions: Stored[] }>(URL_BASE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questions, mode }),
    })
  ).body.questions;
}

export async function questionHistory(id: string): Promise<Stored[]> {
  return (await call<{ versions: Stored[] }>(`${URL_BASE}?history=${encodeURIComponent(id)}`)).body.versions;
}
