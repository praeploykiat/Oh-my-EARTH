import type { GameRound, Localized, RoundSeries } from './types';

export const LIMITS = { rounds: 200, points: 400, text: 4000, short: 200 };

const isString = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;

function isLocalized(v: unknown, max: number): v is Localized {
  const o = v as Localized;
  return !!o && isString(o.en, max) && isString(o.th, max);
}

const MISSING = (l: Localized) => [!l.en.trim() && 'English', !l.th.trim() && 'Thai'].filter(Boolean).join(' and ');

function missing(what: string, l: Localized): string | null {
  const langs = MISSING(l);
  return langs ? `${what} is missing ${langs}` : null;
}

function isSeries(v: unknown, length: number): v is RoundSeries {
  const o = v as RoundSeries;
  return (
    !!o &&
    isLocalized(o.label, LIMITS.short) &&
    isString(o.unit, LIMITS.short) &&
    Array.isArray(o.values) &&
    o.values.length === length &&
    o.values.every((x) => x === null || (typeof x === 'number' && Number.isFinite(x)))
  );
}

export function roundProblem(v: unknown): string | null {
  const r = v as GameRound;
  if (!r || typeof r !== 'object') return 'Not a question';
  if (!isString(r.id, LIMITS.short) || !r.id) return 'Missing id';
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(r.id)) return 'The id may only use English letters, numbers, - and _ (no spaces)';
  if (!isLocalized(r.place, LIMITS.short)) return 'Place must have English and Thai';
  if (!Array.isArray(r.time) || r.time.length < 2 || r.time.length > LIMITS.points) return `Time axis needs 2 to ${LIMITS.points} points`;
  if (!r.time.every((t) => isString(t, 20))) return 'Time labels must be short';
  if (!isLocalized(r.timeLabel, LIMITS.short)) return 'Time caption must have English and Thai fields';
  if (!isSeries(r.given, r.time.length)) return 'The shown values must match the number of time points';
  if (!isSeries(r.hidden, r.time.length)) return 'The values to guess must match the number of time points';
  if (r.given.values.filter((x) => x !== null).length < 2) return 'The bars need at least 2 numbers';
  if (r.hidden.values.filter((x) => x !== null).length < 2) return 'The line needs at least 2 numbers';
  if (!isLocalized(r.answer, LIMITS.text)) return 'Answer must have English and Thai fields';
  if (!isString(r.source, LIMITS.short)) return 'Source is too long';
  if (!r.given.unit.trim()) return 'Unit of the bars is missing';
  if (!r.hidden.unit.trim()) return 'Unit of the line is missing';
  return (
    missing('Place', r.place) ??
    missing('Name of the shown measure', r.given.label) ??
    missing('Name of the measure to guess', r.hidden.label) ??
    missing('Answer', r.answer)
  );
}

export function roundsProblem(v: unknown): string | null {
  if (!Array.isArray(v)) return 'Expected a list of questions';
  if (v.length > LIMITS.rounds) return `At most ${LIMITS.rounds} questions`;
  const ids = new Set<string>();
  for (const [i, round] of v.entries()) {
    const problem = roundProblem(round);
    if (problem) return `Question ${i + 1}: ${problem}`;
    if (ids.has((round as GameRound).id)) return `Question ${i + 1}: id is used twice`;
    ids.add((round as GameRound).id);
  }
  return null;
}
