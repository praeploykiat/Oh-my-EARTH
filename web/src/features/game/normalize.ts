import { isExtend, type AnyRound, type ExtendRound, type GameRound, type Localized, type RoundSeries } from './types';
import { anyProblem } from './validate';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function normalizeTime(t: unknown): string {
  const text = String(t ?? '').trim();
  const month = MONTHS.indexOf(text.slice(0, 3).toLowerCase());
  if (month >= 0 && /^[a-z]+\.?$/i.test(text)) return String(month + 1).padStart(2, '0');
  if (/^\d$/.test(text)) return `0${text}`;
  return text;
}

function localized(v: unknown): Localized {
  const o = (v ?? {}) as Partial<Localized>;
  return { en: String(o.en ?? ''), th: String(o.th ?? '') };
}

function series(v: unknown, length: number): RoundSeries {
  const o = (v ?? {}) as Partial<Omit<RoundSeries, 'values'>> & { values?: unknown[] };
  const values = Array.from({ length }, (_, i) => {
    const raw: unknown = o.values?.[i];
    if (raw === null || raw === undefined || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  });
  return { label: localized(o.label), unit: String(o.unit ?? ''), values };
}

export function normalizeRound(raw: unknown, fallbackId: string): GameRound {
  const o = (raw ?? {}) as Record<string, unknown>;
  const time = Array.isArray(o.time) ? o.time.map(normalizeTime) : [];
  return {
    id: typeof o.id === 'string' && o.id.trim() ? o.id.trim() : fallbackId,
    place: localized(o.place),
    time,
    timeLabel: localized(o.timeLabel),
    given: series(o.given, time.length),
    hidden: series(o.hidden, time.length),
    answer: localized(o.answer),
    source: String(o.source ?? ''),
  };
}

export function normalizeExtend(raw: unknown, fallbackId: string): ExtendRound {
  const o = (raw ?? {}) as Record<string, unknown>;
  const time = Array.isArray(o.time) ? o.time.map(normalizeTime) : [];
  return {
    kind: 'extend',
    id: typeof o.id === 'string' && o.id.trim() ? o.id.trim() : fallbackId,
    place: localized(o.place),
    time,
    timeLabel: localized(o.timeLabel),
    series: series(o.series, time.length),
    showUntil: normalizeTime(o.showUntil),
    answer: localized(o.answer),
    source: String(o.source ?? ''),
  };
}

export function normalizeAny(raw: unknown, fallbackId: string): AnyRound {
  return (raw as { kind?: unknown })?.kind === 'extend' ? normalizeExtend(raw, fallbackId) : normalizeRound(raw, fallbackId);
}

// Each list of values must have one number per time point
export function valuesMismatch(raw: unknown, round: AnyRound): string | null {
  const o = (raw ?? {}) as { given?: { values?: unknown[] }; hidden?: { values?: unknown[] }; series?: { values?: unknown[] } };
  const fits = (v: unknown[] | undefined) => Array.isArray(v) && v.length === round.time.length;
  if (isExtend(round)) return fits(o.series?.values) ? null : `series.values needs ${round.time.length} values, one per time point`;
  return fits(o.given?.values) && fits(o.hidden?.values) ? null : `given and hidden need ${round.time.length} values each, one per time point`;
}

export interface ImportResult {
  rounds: AnyRound[];
  added: number;
  replaced: number;
  problems: string[];
}

export type ImportMode = 'merge' | 'replace';

export function importRounds(current: AnyRound[], text: string, mode: ImportMode = 'merge'): ImportResult {
  const parsed: unknown = JSON.parse(text);
  const list: unknown[] = Array.isArray(parsed) ? parsed : [parsed];

  const rounds = mode === 'replace' ? [] : [...current];
  const problems: string[] = [];
  const wrapper = !Array.isArray(parsed) && parsed && typeof parsed === 'object' && !('place' in parsed) && Object.values(parsed).some(Array.isArray);
  if (wrapper) {
    problems.push('Use one question { … } or a list [ { … }, { … } ]. Remove the outer { "…": [ ] } around the list.');
    return { rounds, added: 0, replaced: 0, problems };
  }
  let added = 0;
  let replaced = 0;
  if (list.length === 0) problems.push('The file has no questions in it.');
  const seen = new Map<string, number>();

  list.forEach((raw, i) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      problems.push(`Question ${i + 1}: this is not a question { … }`);
      return;
    }
    const round = normalizeAny(raw, `q-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}${i}`);
    const problem = valuesMismatch(raw, round) ?? anyProblem(round);
    if (problem) {
      const named = typeof (raw as { id?: unknown })?.id === 'string' ? ` (id ${round.id})` : '';
      const place = round.place.en ? ` ${round.place.en}` : '';
      problems.push(`Question ${i + 1}${place}${named}: ${problem}`);
      return;
    }
    const earlier = seen.get(round.id);
    if (earlier !== undefined) {
      problems.push(`Question ${i + 1} ${round.place.en}: uses the same id as question ${earlier + 1} (${round.id}). Give each question its own id.`);
      return;
    }
    seen.set(round.id, i);
    const at = rounds.findIndex((r) => r.id === round.id);
    if (at >= 0) {
      rounds[at] = round;
      replaced += 1;
    } else {
      rounds.push(round);
      added += 1;
    }
  });

  return { rounds, added, replaced, problems };
}
