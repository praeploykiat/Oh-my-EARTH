import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent } from 'react';
import { deleteQuestion, fetchAllQuestions, questionHistory, saveQuestion, type Stored } from './api';
import { Result, ResultPeek, RoundView, scoreRound } from './index';
import { normalizeExtend, normalizeRound, valuesMismatch } from './normalize';
import { htmlToMarkdown, markdownToHtml } from './richText';
import type { Feedback } from './score';
import { changedParts, Checklist, download, IdNote, KIND_LABEL, missingItems, Optional, parseNumber, questionTitle, Step, Tour, tourWanted } from './adminParts';
import { blankExtend, ExtendPreview, ExtendValues, SplitPicker } from './adminExtend';
import { ImportPanel } from './adminImport';
import { withUnit } from './answer';
import { formatTime, monthsBetween, monthsOfYear, timeKind, yearsBetween } from './time';
import { isExtend, kindOf, type AnyRound, type GameRound, type Localized, type RoundKind, type RoundSeries } from './types';
import { anyProblem, LIMITS, roundProblem } from './validate';

const SAVE_DELAY_MS = 900;
const REFRESH_MS = 8000;

type SeriesKey = 'given' | 'hidden';
type EntryState = 'saved' | 'waiting' | 'saving' | 'incomplete' | 'conflict' | 'error';

interface Entry {
  draft: AnyRound;
  base: Stored | null;
  state: EntryState;
  message?: string;
  remote?: Stored | null;
}

const same = (a: AnyRound, b: AnyRound | undefined) => !!b && JSON.stringify(a) === JSON.stringify(b);
const isDirty = (e: Entry) => !e.base || !same(e.draft, e.base.question);
const newId = () => `q-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Unfinished work kept in this browser

const DRAFTS_KEY = 'game-admin-drafts';

interface SavedDraft {
  draft: AnyRound;
  base: Stored | null;
}

function readDrafts(): SavedDraft[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(DRAFTS_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((d) => d && d.draft && typeof d.draft.id === 'string') : [];
  } catch {
    return [];
  }
}

function writeDrafts(entries: Entry[]) {
  try {
    const drafts: SavedDraft[] = entries.filter(isDirty).map((e) => ({ draft: e.draft, base: e.base }));
    if (drafts.length) localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
    else localStorage.removeItem(DRAFTS_KEY);
  } catch {
    // Storage can be full or blocked; saving to the database still works
  }
}

function draftEntry(draft: AnyRound, base: Stored | null): Entry {
  const problem = anyProblem(draft);
  return { draft, base, state: problem ? 'incomplete' : 'waiting', message: problem ?? undefined };
}

function restoreDrafts(remote: Stored[], drafts: SavedDraft[]): { entries: Entry[]; restored: number } {
  const byId = new Map(drafts.map((d) => [d.draft.id, d]));
  let restored = 0;
  const entries: Entry[] = remote.map((r) => {
    const d = byId.get(r.question.id);
    byId.delete(r.question.id);
    if (!d || same(d.draft, r.question)) return { draft: r.question, base: r, state: 'saved' };
    restored += 1;
    if (d.base && d.base.version === r.version) return draftEntry(d.draft, r);
    return { draft: d.draft, base: d.base, state: 'conflict', remote: r };
  });
  for (const d of byId.values()) {
    restored += 1;
    entries.push(d.base ? { draft: d.draft, base: d.base, state: 'conflict', remote: null } : draftEntry(d.draft, null));
  }
  return { entries, restored };
}

function blankQuestion(): GameRound {
  const time = monthsOfYear();
  const empty = () => time.map(() => null);
  return {
    id: newId(),
    place: { en: '', th: '' },
    time,
    timeLabel: { en: 'Average for each month', th: 'ค่าเฉลี่ยแต่ละเดือน' },
    given: { label: { en: '', th: '' }, unit: '', values: empty() },
    hidden: { label: { en: '', th: '' }, unit: '', values: empty() },
    answer: { en: '', th: '' },
    source: '',
  };
}

function remap(round: AnyRound, time: string[]): AnyRound {
  const pick = (series: RoundSeries): RoundSeries => {
    const old = new Map(round.time.map((t, i) => [t, series.values[i]]));
    return { ...series, values: time.map((t) => old.get(t) ?? null) };
  };
  if (isExtend(round)) {
    const showUntil = time.includes(round.showUntil) ? round.showUntil : (time[Math.max(1, Math.round(time.length * 0.66) - 1)] ?? '');
    return { ...round, time, series: pick(round.series), showUntil };
  }
  return { ...round, time, given: pick(round.given), hidden: pick(round.hidden) };
}

const valueLists = (round: AnyRound) => (isExtend(round) ? [round.series.values] : [round.given.values, round.hidden.values]);

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Small fields

interface TextPairProps {
  label: string;
  value: Localized;
  onChange: (change: (v: Localized) => Localized) => void;
  hint?: string;
  required?: boolean;
  placeholder?: Localized;
}

function TextPair({ label, value, onChange, hint, required = true, placeholder }: TextPairProps) {
  return (
    <div className="admin-field">
      <span className="admin-label">
        {label} {!required && <Optional />}
      </span>
      {hint && <small>{hint}</small>}
      <div className="admin-pair">
        <label className="admin-lang-input">
          <small>English</small>
          <input aria-label={`${label} in English`} placeholder={placeholder?.en} value={value.en} onChange={(e) => {
              const en = e.target.value;
              onChange((v) => ({ ...v, en }));
            }} />
        </label>
        <label className="admin-lang-input">
          <small>Thai</small>
          <input aria-label={`${label} in Thai`} placeholder={placeholder?.th} value={value.th} onChange={(e) => {
              const th = e.target.value;
              onChange((v) => ({ ...v, th }));
            }} />
        </label>
      </div>
    </div>
  );
}

// Time axis

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

type AxisKind = 'month-of-year' | 'year' | 'month';

interface YearMonth {
  year: number;
  month: number;
}

const validYear = (y: number) => Number.isInteger(y) && y >= MIN_YEAR && y <= MAX_YEAR;
const ymText = (v: YearMonth) => `${v.year}-${String(v.month).padStart(2, '0')}`;
const ymLabel = (v: YearMonth) => `${MONTH_NAMES[v.month - 1]} ${v.year}`;
const parseYm = (t: string): YearMonth => ({ year: Number(t.slice(0, 4)), month: Number(t.slice(5, 7)) });

function MonthPicker({ label, value, onChange }: { label: string; value: YearMonth; onChange: (v: YearMonth) => void }) {
  return (
    <span className="admin-month">
      <select aria-label={`${label} month`} value={value.month} onChange={(e) => onChange({ ...value, month: Number(e.target.value) })}>
        {MONTH_NAMES.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <input
        type="number"
        aria-label={`${label} year`}
        min={MIN_YEAR}
        max={MAX_YEAR}
        value={Number.isNaN(value.year) ? '' : value.year}
        onChange={(e) => onChange({ ...value, year: e.target.value === '' ? NaN : Number(e.target.value) })}
      />
    </span>
  );
}

function TimeEditor({ round, onChange }: { round: AnyRound; onChange: (r: AnyRound) => void }) {
  const current = timeKind(round.time);
  const [kind, setKind] = useState<AxisKind>(current === 'other' ? 'month-of-year' : current);
  const [years, setYears] = useState(() =>
    current === 'year' ? { from: Number(round.time[0]), to: Number(round.time[round.time.length - 1]) } : { from: 2001, to: 2024 },
  );
  const [months, setMonths] = useState(() =>
    current === 'month'
      ? { from: parseYm(round.time[0]), to: parseYm(round.time[round.time.length - 1]) }
      : { from: { year: 2020, month: 1 }, to: { year: 2022, month: 12 } },
  );

  let time: string[] = [];
  let summary = '';
  let problem: string | null = null;

  if (kind === 'month-of-year') {
    time = monthsOfYear();
    summary = 'Jan to Dec, one value per month of the year (for example a 20-year average)';
  } else if (kind === 'year') {
    if (!validYear(years.from) || !validYear(years.to)) problem = `Type both years (${MIN_YEAR} to ${MAX_YEAR}).`;
    else if (years.from > years.to) problem = 'The first year must come before the last year.';
    else {
      time = yearsBetween(years.from, years.to);
      summary = `${years.from} to ${years.to}`;
    }
  } else {
    if (!validYear(months.from.year) || !validYear(months.to.year)) problem = `Type both years (${MIN_YEAR} to ${MAX_YEAR}).`;
    else if (ymText(months.from) > ymText(months.to)) problem = 'The first month must come before the last month.';
    else {
      time = monthsBetween(ymText(months.from), ymText(months.to));
      summary = `${ymLabel(months.from)} to ${ymLabel(months.to)}`;
    }
  }
  if (!problem && time.length > LIMITS.points) problem = `That is ${time.length} time points. The most is ${LIMITS.points}.`;

  const inUse = !problem && time.join() === round.time.join();
  const [pending, setPending] = useState<{ time: string[]; lost: number; from: string; to: string } | null>(null);

  const use = () => {
    const keep = new Set(time);
    const gone = round.time.map((t, i) => ({ t, i })).filter(({ t }) => !keep.has(t));
    const lists = valueLists(round);
    const lost = gone.reduce((sum, { i }) => sum + lists.filter((values) => values[i] !== null).length, 0);
    if (lost === 0) return onChange(remap(round, time));
    const withData = gone.filter(({ i }) => lists.some((values) => values[i] !== null));
    setPending({ time, lost, from: formatTime(withData[0].t, 'en'), to: formatTime(withData[withData.length - 1].t, 'en') });
  };
  const options: { kind: AxisKind; label: string }[] = [
    { kind: 'month-of-year', label: '12 months of the year' },
    { kind: 'year', label: 'Year by year' },
    { kind: 'month', label: 'Month by month' },
  ];

  return (
    <div className="admin-field">
      <div className="admin-axis-kinds" role="radiogroup" aria-label="Kind of time axis">
        {options.map((o) => (
          <button key={o.kind} type="button" role="radio" aria-checked={kind === o.kind} className={kind === o.kind ? 'is-on' : ''} onClick={() => setKind(o.kind)}>
            {o.label}
            {current === o.kind && <small> · in use</small>}
          </button>
        ))}
      </div>
      <div className="admin-axis-panel">
        {kind === 'year' && (
          <div className="admin-axis-inputs">
            <span>From</span>
            <input
              type="number"
              aria-label="First year"
              min={MIN_YEAR}
              max={MAX_YEAR}
              value={Number.isNaN(years.from) ? '' : years.from}
              onChange={(e) => setYears({ ...years, from: e.target.value === '' ? NaN : Number(e.target.value) })}
            />
            <span>to</span>
            <input
              type="number"
              aria-label="Last year"
              min={MIN_YEAR}
              max={MAX_YEAR}
              value={Number.isNaN(years.to) ? '' : years.to}
              onChange={(e) => setYears({ ...years, to: e.target.value === '' ? NaN : Number(e.target.value) })}
            />
          </div>
        )}
        {kind === 'month' && (
          <div className="admin-axis-inputs">
            <span>From</span>
            <MonthPicker label="First" value={months.from} onChange={(from) => setMonths({ ...months, from })} />
            <span>to</span>
            <MonthPicker label="Last" value={months.to} onChange={(to) => setMonths({ ...months, to })} />
          </div>
        )}
        <div className="admin-axis-apply">
          {problem ? (
            <small className="is-problem">{problem}</small>
          ) : (
            <small>
              {summary} · <strong>{time.length} points</strong>
            </small>
          )}
          {inUse ? (
            <small className="admin-axis-current">This is the current time axis</small>
          ) : (
            <button type="button" className="button" disabled={!!problem || !!pending} onClick={use}>
              Use this time axis
            </button>
          )}
        </div>
        {pending && (
          <div className="admin-confirm" role="alertdialog" aria-label="Confirm time axis change">
            <p>
              <strong>
                This removes {pending.lost} number{pending.lost === 1 ? '' : 's'}
                {pending.from === pending.to ? ` (${pending.from})` : ` (${pending.from} to ${pending.to})`}.
              </strong>{' '}
              Numbers for time points that stay are kept. You can get them back with Earlier versions.
            </p>
            <div className="admin-import-actions">
              <button type="button" onClick={() => setPending(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="button button-danger"
                onClick={() => {
                  onChange(remap(round, pending.time));
                  setPending(null);
                }}
              >
                Remove and switch
              </button>
            </div>
          </div>
        )}
      </div>
      <small className="admin-hint">
        Now: {round.time.length} time points
        {round.time.length > 0 && ` (${formatTime(round.time[0], 'en')} to ${formatTime(round.time[round.time.length - 1], 'en')})`}. Making the range bigger keeps
        every number.
      </small>
    </div>
  );
}

// Values table

function ValuesTable({ round, onChange }: { round: GameRound; onChange: (r: GameRound) => void }) {
  const columns: SeriesKey[] = ['given', 'hidden'];

  const setValue = (key: SeriesKey, row: number, value: number | null) => {
    const values = [...round[key].values];
    values[row] = value;
    onChange({ ...round, [key]: { ...round[key], values } });
  };

  const paste = (event: ClipboardEvent<HTMLInputElement>, row: number, col: number) => {
    const text = event.clipboardData.getData('text');
    if (!/[\n\t]/.test(text.trim())) return;
    event.preventDefault();
    const next = { ...round, given: { ...round.given, values: [...round.given.values] }, hidden: { ...round.hidden, values: [...round.hidden.values] } };
    text
      .replace(/\r/g, '')
      .split('\n')
      .filter((line, i, all) => line.trim() !== '' || i < all.length - 1)
      .forEach((line, r) => {
        line.split('\t').forEach((cell, c) => {
          const key = columns[col + c];
          if (key && row + r < round.time.length) next[key].values[row + r] = parseNumber(cell);
        });
      });
    onChange(next);
  };

  return (
    <div className="admin-field">
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>
                <span className="admin-key is-bars" /> Bars: {withUnit(round.given.label.en || 'shown', round.given.unit)}
              </th>
              <th>
                <span className="admin-key is-line" /> Line: {withUnit(round.hidden.label.en || 'to guess', round.hidden.unit)}
              </th>
            </tr>
          </thead>
          <tbody>
            {round.time.map((t, row) => (
              <tr key={`${t}-${row}`}>
                <td>{formatTime(t, 'en')}</td>
                {columns.map((key, col) => (
                  <td key={key}>
                    <input
                      inputMode="decimal"
                      aria-label={`${key === 'given' ? 'Shown' : 'To guess'} ${formatTime(t, 'en')}`}
                      value={round[key].values[row] ?? ''}
                      onChange={(e) => setValue(key, row, parseNumber(e.target.value))}
                      onPaste={(e) => paste(e, row, col)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Answer text, edited as it will look

function RichAnswer({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const emitted = useRef<string | null>(null);
  const [active, setActive] = useState({ bold: false, list: false });

  useEffect(() => {
    if (ref.current && value !== emitted.current) {
      ref.current.innerHTML = markdownToHtml(value);
      emitted.current = value;
    }
  }, [value]);

  const sync = () => {
    const next = htmlToMarkdown(ref.current!);
    emitted.current = next;
    onChange(next);
  };

  const refreshState = () =>
    setActive({ bold: document.queryCommandState('bold'), list: document.queryCommandState('insertUnorderedList') });

  const command = (name: 'bold' | 'insertUnorderedList') => {
    ref.current!.focus();
    document.execCommand(name);
    sync();
    refreshState();
  };

  return (
    <>
      <div className="admin-answer-tools">
        <button type="button" className={active.bold ? 'is-on' : ''} aria-pressed={active.bold} onMouseDown={(e) => e.preventDefault()} onClick={() => command('bold')}>
          <strong>B</strong> Bold
        </button>
        <button type="button" className={active.list ? 'is-on' : ''} aria-pressed={active.list} onMouseDown={(e) => e.preventDefault()} onClick={() => command('insertUnorderedList')}>
          • List
        </button>
      </div>
      <div
        ref={ref}
        className="admin-rich"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label={label}
        aria-multiline="true"
        onInput={sync}
        onKeyUp={refreshState}
        onMouseUp={refreshState}
        onFocus={() => {
          document.execCommand('defaultParagraphSeparator', false, 'div');
          refreshState();
        }}
        onPaste={(e) => {
          e.preventDefault();
          document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
        }}
      />
    </>
  );
}

function AnswerEditor({ value, onChange }: { value: Localized; onChange: (change: (v: Localized) => Localized) => void }) {
  return (
    <div className="admin-field">
      <div className="admin-answer-pair">
        <div>
          <p className="admin-lang">English</p>
          <RichAnswer label="Answer in English" value={value.en} onChange={(en) => onChange((v) => ({ ...v, en }))} />
        </div>
        <div>
          <p className="admin-lang">Thai</p>
          <RichAnswer label="Answer in Thai" value={value.th} onChange={(th) => onChange((v) => ({ ...v, th }))} />
        </div>
      </div>
    </div>
  );
}

// Preview

function Preview({ round }: { round: AnyRound }) {
  return isExtend(round) ? <ExtendPreview round={round} /> : <PairPreview round={round} />;
}

function PairPreview({ round }: { round: GameRound }) {
  const [guess, setGuess] = useState<(number | null)[]>(() => round.time.map(() => null));
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const ready = roundProblem(round) === null;
  const reset = () => {
    setGuess(round.time.map(() => null));
    setFeedback(null);
  };

  useEffect(reset, [round.id, round.time.length]);

  if (!ready) return <p className="admin-note">The preview appears once every required field is filled in.</p>;

  return (
    <div className="game admin-preview">
      <RoundView
        round={round}
        kicker="Preview"
        guess={guess}
        onGuess={setGuess}
        feedback={feedback}
        onSubmit={() => {
          const result = scoreRound(round, guess);
          setGuess(result.filled);
          setFeedback(result.feedback);
        }}
        onReset={reset}
      />
      {feedback ? <Result round={round} feedback={feedback} onNext={reset} nextLabel="Try again" /> : <ResultPeek round={round} />}
    </div>
  );
}

// One question as JSON

function JsonEditor({ round, onApply, onClose }: { round: AnyRound; onApply: (r: AnyRound) => void; onClose: () => void }) {
  const { id, ...rest } = round;
  const [text, setText] = useState(() => JSON.stringify(rest, null, 2));
  const [error, setError] = useState<string | null>(null);

  const apply = () => {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return setError('This is not valid JSON. Check the brackets, quotes and commas.');
    }
    if (Array.isArray(raw) || !raw || typeof raw !== 'object') return setError('Paste one question { … }, not a list.');
    const next = isExtend(round) ? { ...normalizeExtend(raw, id), id } : { ...normalizeRound(raw, id), id };
    if (next.time.length < 2) return setError('"time" needs at least 2 time points.');
    const short = valuesMismatch(raw, next);
    if (short) return setError(`${short.charAt(0).toUpperCase()}${short.slice(1)}.`);
    onApply(next);
    onClose();
  };

  return (
    <div className="admin-json">
      <p className="admin-hint">Change anything here, then press Apply. The ID stays the same, so this question is updated. It saves like any other edit.</p>
      <textarea rows={18} spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} aria-label="Question as JSON" />
      {error && <p className="admin-status is-error">{error}</p>}
      <div className="admin-import-actions">
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="button" onClick={apply}>
          Apply
        </button>
      </div>
    </div>
  );
}

// History of one question

function History({ round, current, onRestore }: { round: AnyRound; current: Stored; onRestore: (q: AnyRound) => void }) {
  const [versions, setVersions] = useState<Stored[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    questionHistory(round).then(setVersions, (e: Error) => setError(e.message));
    // Only reload when a different question is opened
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.id]);

  if (error) return <p className="admin-status is-error">{error}</p>;
  if (!versions) return <p className="admin-note">Loading…</p>;
  const all = [current, ...versions.filter((v) => v.version !== current.version)];

  return (
    <ul className="admin-history">
      {all.map((v, i) => (
        <li key={v.version}>
          <span>
            {i === 0 ? 'Last saved, live now' : 'Saved'} {when(v.updatedAt)} · {v.question.place.en || 'no place'} · {v.question.time.length} time points
          </span>
          <button type="button" onClick={() => onRestore(v.question)}>
            Restore this
          </button>
        </li>
      ))}
    </ul>
  );
}

// Status labels

const STATE_LABEL: Record<EntryState, string> = {
  saved: 'Saved',
  waiting: 'Saving…',
  saving: 'Saving…',
  incomplete: 'Not saved yet',
  conflict: 'Needs a decision',
  error: 'Could not save',
};

// Page

export function GameAdmin() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error' | 'info'; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [panel, setPanel] = useState<'history' | 'json' | null>(null);
  const [copied, setCopied] = useState(false);
  const [touring, setTouring] = useState(false);
  const [filter, setFilter] = useState<RoundKind | 'all'>('all');
  const [choosing, setChoosing] = useState(false);
  const toured = useRef(false);
  const [offline, setOffline] = useState(false);
  const entriesRef = useRef<Entry[]>([]);
  const timers = useRef(new Map<string, number>());

  const commit = useCallback((next: Entry[]) => {
    entriesRef.current = next;
    setEntries(next);
    writeDrafts(next);
  }, []);

  const patch = useCallback(
    (id: string, change: (e: Entry) => Entry | null) => {
      const next = entriesRef.current.flatMap((e) => {
        if (e.draft.id !== id) return [e];
        const changed = change(e);
        return changed ? [changed] : [];
      });
      commit(next);
    },
    [commit],
  );

  // Saving

  const save = useCallback(
    async (id: string, force = false) => {
      const entry = entriesRef.current.find((e) => e.draft.id === id);
      if (!entry || entry.state === 'saving') return;
      const problem = anyProblem(entry.draft);
      if (problem) return patch(id, (e) => ({ ...e, state: 'incomplete', message: problem }));
      if (!force && !isDirty(entry)) return patch(id, (e) => ({ ...e, state: 'saved', message: undefined }));

      const sent = entry.draft;
      patch(id, (e) => ({ ...e, state: 'saving' }));
      try {
        const result = await saveQuestion(sent, entry.base?.version ?? null, force);
        if (result.kind === 'conflict') {
          return patch(id, (e) => ({ ...e, state: 'conflict', remote: result.current }));
        }
        patch(id, (e) => {
          const changedSince = !same(e.draft, sent);
          return { ...e, base: result.stored, state: changedSince ? 'waiting' : 'saved', message: undefined, remote: undefined };
        });
        const after = entriesRef.current.find((e) => e.draft.id === id);
        if (after?.state === 'waiting') schedule(id);
      } catch (error) {
        patch(id, (e) => ({ ...e, state: 'error', message: error instanceof Error ? error.message : String(error) }));
      }
    },
    // schedule is stable, defined below with the same refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patch],
  );

  const schedule = useCallback(
    (id: string) => {
      window.clearTimeout(timers.current.get(id));
      timers.current.set(id, window.setTimeout(() => save(id), SAVE_DELAY_MS));
    },
    [save],
  );

  const edit = (next: AnyRound) => {
    const problem = anyProblem(next);
    patch(next.id, (e) =>
      e.state === 'conflict' ? { ...e, draft: next } : { ...e, draft: next, state: problem ? 'incomplete' : 'waiting', message: problem ?? undefined },
    );
    const entry = entriesRef.current.find((e) => e.draft.id === next.id);
    if (entry && entry.state === 'waiting') schedule(next.id);
  };

  // Loading and live refresh

  const refresh = useCallback(async () => {
    let remote: Stored[];
    try {
      remote = await fetchAllQuestions();
      setOffline(false);
    } catch {
      setOffline(true);
      return;
    }
    const byId = new Map(remote.map((s) => [s.question.id, s]));
    const merged: Entry[] = [];

    for (const e of entriesRef.current) {
      const r = byId.get(e.draft.id);
      byId.delete(e.draft.id);
      if (!r) {
        if (!e.base) merged.push(e);
        else if (isDirty(e) && e.state !== 'conflict') merged.push({ ...e, state: 'conflict', remote: null });
        else if (e.state === 'conflict') merged.push(e);
        continue;
      }
      if (e.base?.version === r.version || e.state === 'saving') merged.push(e);
      else if (!isDirty(e)) merged.push({ draft: r.question, base: r, state: 'saved' });
      else merged.push({ ...e, state: 'conflict', remote: r });
    }
    for (const r of byId.values()) merged.push({ draft: r.question, base: r, state: 'saved' });
    commit(merged);
  }, [commit]);

  useEffect(() => {
    const drafts = readDrafts();
    fetchAllQuestions()
      .then((remote) => {
        const { entries: restoredEntries, restored } = restoreDrafts(remote, drafts);
        commit(restoredEntries);
        restoredEntries.filter((e) => e.state === 'waiting').forEach((e) => schedule(e.draft.id));
        if (restored) {
          setNotice({ kind: 'info', text: `Brought back ${restored} unfinished question(s) you left in this browser.` });
        } else if (remote.length === 0) {
          setNotice({ kind: 'info', text: 'No questions yet. Until you add some, the game shows three example questions.' });
        }
        setSelected((current) => current ?? restoredEntries[0]?.draft.id ?? null);
      })
      .catch(() => {
        setOffline(true);
        commit(drafts.map((d) => ({ ...draftEntry(d.draft, d.base), state: 'error' as const, message: 'offline' })));
        setNotice({ kind: 'error', text: 'Could not reach the question database. Check that Upstash Redis is connected to the project in Vercel.' });
      });
  }, [commit, schedule]);

  useEffect(() => {
    const tick = () => document.visibilityState === 'visible' && refresh();
    const id = window.setInterval(tick, REFRESH_MS);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', tick);
    };
  }, [refresh]);

  const unsaved = useMemo(() => (entries ?? []).filter((e) => e.state !== 'saved').length, [entries]);
  const sending = useMemo(() => (entries ?? []).some((e) => e.state === 'waiting' || e.state === 'saving'), [entries]);

  useEffect(() => {
    if (!sending) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [sending]);

  useEffect(() => {
    if (!entries || toured.current) return;
    toured.current = true;
    if (tourWanted()) window.setTimeout(() => setTouring(true), 300);
  }, [entries]);

  if (!entries) return <p className="status">Loading…</p>;

  const entry = entries.find((e) => e.draft.id === selected) ?? null;
  const round = entry?.draft ?? null;

  const add = (question: AnyRound, after?: number) => {
    const next = [...entriesRef.current];
    next.splice(after === undefined ? next.length : after + 1, 0, { draft: question, base: null, state: 'incomplete' });
    commit(next);
    setSelected(question.id);
    edit(question);
  };

  const remove = async (e: Entry) => {
    window.clearTimeout(timers.current.get(e.draft.id));
    if (!e.base) {
      patch(e.draft.id, () => null);
    } else {
      try {
        const result = await deleteQuestion(e.draft, e.base.version);
        if (result.kind === 'conflict') {
          patch(e.draft.id, (x) => ({ ...x, state: 'conflict', remote: result.current }));
          setNotice({ kind: 'info', text: 'Someone else changed this question just now, so it was not deleted. Check it and try again.' });
          return;
        }
        patch(e.draft.id, () => null);
      } catch (error) {
        setNotice({ kind: 'error', text: `Could not delete: ${error instanceof Error ? error.message : String(error)}` });
        return;
      }
    }
    if (selected === e.draft.id) setSelected(entriesRef.current[0]?.draft.id ?? null);
  };

  const keepMine = (e: Entry) => {
    patch(e.draft.id, (x) => ({ ...x, base: x.remote ?? null, state: 'waiting', remote: undefined }));
    save(e.draft.id, true);
  };

  const useTheirs = (e: Entry) => {
    if (!e.remote) {
      patch(e.draft.id, () => null);
      if (selected === e.draft.id) setSelected(entriesRef.current[0]?.draft.id ?? null);
      return;
    }
    patch(e.draft.id, () => ({ draft: e.remote!.question, base: e.remote!, state: 'saved' }));
  };

  const missing = round ? missingItems(round) : [];

  const update = (change: (r: AnyRound) => AnyRound) => {
    const latest = entriesRef.current.find((e) => e.draft.id === selected)?.draft;
    if (latest) edit(change(latest));
  };
  const updatePair = (change: (r: GameRound) => GameRound) => update((r) => (isExtend(r) ? r : change(r)));
  const visible = entries.filter((e) => filter === 'all' || kindOf(e.draft) === filter);
  const counts = { pair: entries.filter((e) => !isExtend(e.draft)).length, extend: entries.filter((e) => isExtend(e.draft)).length };
  const saved = entries.flatMap((e) => (e.base ? [e.base] : []));

  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setNotice({ kind: 'info', text: `Could not copy. The ID is ${id}` });
    }
  };

  const status = (e: Entry) => {
    if (e.state === 'saved' && e.base) return `Saved ${when(e.base.updatedAt)}`;
    return STATE_LABEL[e.state];
  };

  return (
    <div className="admin">
      <header className="admin-top">
        <div>
          <h1>Questions for Guess the graph</h1>
          <p>Changes save by themselves and reach players straight away.</p>
        </div>
        <div className="admin-top-actions">
          <span className={`admin-overall ${unsaved ? 'is-busy' : ''}`}>
            {offline ? 'Offline: changes will save when the connection is back' : unsaved ? `${unsaved} not saved yet` : 'All changes saved'}
          </span>
          <button type="button" data-tour="tour" onClick={() => setTouring(true)}>
            Tour
          </button>
          <button type="button" data-tour="import" onClick={() => setImporting(!importing)}>
            Import JSON
          </button>
          <button
            type="button"
            onClick={() => download(entries.map((e) => e.draft), `game-questions-${new Date().toISOString().slice(0, 10)}`)}
          >
            Download all
          </button>
        </div>
      </header>

      {touring && <Tour onClose={() => setTouring(false)} onImport={setImporting} />}

      {notice && (
        <p className={`admin-status is-${notice.kind}`}>
          {notice.text}{' '}
          <button type="button" className="admin-dismiss" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </p>
      )}

      {importing && (
        <ImportPanel
          saved={saved}
          onClose={() => setImporting(false)}
          onDone={(stored, imported, message) => {
            const current = new Map(entriesRef.current.map((e) => [e.draft.id, e]));
            const kept: Entry[] = stored.map((s) => {
              const e = current.get(s.question.id);
              if (imported.has(s.question.id) || !e || !isDirty(e)) return { draft: s.question, base: s, state: 'saved' };
              return e.base?.version === s.version ? e : { ...e, state: 'conflict', remote: s };
            });
            const unfinished = entriesRef.current.filter((e) => !e.base && !stored.some((s) => s.question.id === e.draft.id));
            commit([...kept, ...unfinished]);
            setImporting(false);
            setSelected(stored.find((s) => imported.has(s.question.id))?.question.id ?? stored[0]?.question.id ?? null);
            const extra = unfinished.length ? ` ${unfinished.length} unfinished question(s) are still at the end of the list.` : '';
            setNotice({ kind: 'ok', text: `${message}${extra}` });
          }}
        />
      )}

      <div className="admin-body">
        <aside className="admin-list">
          <p className="admin-list-title">{entries.length} questions</p>
          <div className="admin-filter" role="radiogroup" aria-label="Show questions of type">
            {(['all', 'pair', 'extend'] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={filter === k} className={filter === k ? 'is-on' : ''} onClick={() => setFilter(k)}>
                {k === 'all' ? 'All' : KIND_LABEL[k]} <small>{k === 'all' ? entries.length : counts[k]}</small>
              </button>
            ))}
          </div>
          <ol>
            {visible.map((e) => (
              <li key={e.draft.id} className={e.draft.id === selected ? 'is-on' : ''}>
                <button
                  type="button"
                  className="admin-list-main"
                  onClick={() => {
                    setSelected(e.draft.id);
                    setPanel(null);
                  }}
                >
                  <strong>{questionTitle(e.draft)}</strong>
                  <small>
                    <span className={`admin-kind is-${kindOf(e.draft)}`}>{KIND_LABEL[kindOf(e.draft)]}</span>
                    <span className={`admin-dot is-${e.state}`} title={STATE_LABEL[e.state]} />
                    {e.draft.place.en || 'No place yet'}
                    {e.state !== 'saved' && ` · ${STATE_LABEL[e.state]}`}
                  </small>
                </button>
              </li>
            ))}
          </ol>
          {choosing ? (
            <div className="admin-add-choice" role="group" aria-label="Type of the new question">
              <p>What kind of question?</p>
              <button
                type="button"
                onClick={() => {
                  setChoosing(false);
                  add(blankQuestion());
                }}
              >
                <strong>{KIND_LABEL.pair}</strong>
                <small>Players see one measure as bars and draw how a second one goes with it.</small>
              </button>
              <button
                type="button"
                onClick={() => {
                  setChoosing(false);
                  add(blankExtend(newId()));
                }}
              >
                <strong>{KIND_LABEL.extend}</strong>
                <small>Players see one measure up to a point in time and draw what comes next.</small>
              </button>
              <button type="button" className="admin-link" onClick={() => setChoosing(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" className="button admin-add" onClick={() => setChoosing(true)}>
              + Add a question
            </button>
          )}
        </aside>

        {entry && round ? (
          <>
            <main className="admin-editor" key={round.id}>
              {entry.state === 'conflict' && (
                <section className="admin-card admin-conflict">
                  <h2>{entry.remote ? 'Someone else changed this question' : 'Someone else deleted this question'}</h2>
                  <p>
                    {entry.remote
                      ? `Another person saved a different version at ${when(entry.remote.updatedAt)} while you were editing. Which one should we keep?`
                      : 'Another person deleted it while you were editing. Keep your version, or let it go?'}
                  </p>
                  {entry.remote && (
                    <dl className="admin-diff">
                      <dt>They changed</dt>
                      <dd>{changedParts(entry.base?.question, entry.remote.question).join(', ') || 'Nothing you can see'}</dd>
                      <dt>You changed</dt>
                      <dd>{changedParts(entry.base?.question, entry.draft).join(', ') || 'Nothing yet'}</dd>
                    </dl>
                  )}
                  {entry.remote && (
                    <p className="admin-hint">Use theirs throws away your changes. Keep mine saves yours on top, and theirs stays in Earlier versions.</p>
                  )}
                  <div className="admin-import-actions">
                    <button type="button" onClick={() => useTheirs(entry)}>
                      {entry.remote ? 'Use theirs' : 'Let it go'}
                    </button>
                    <button type="button" className="button" onClick={() => keepMine(entry)}>
                      Keep mine
                    </button>
                  </div>
                </section>
              )}

              <section className="admin-head">
                <div className="admin-head-row">
                  <div>
                    <h2>{questionTitle(round)}</h2>
                    <p className="admin-meta">
                      <span className={`admin-kind is-${kindOf(round)}`}>{KIND_LABEL[kindOf(round)]}</span> {round.place.en || 'No place yet'} <span className={`admin-dot is-${entry.state}`} /> {status(entry)}
                    </p>
                  </div>
                  <div className="admin-head-tools">
                    <button type="button" data-tour="json-edit" className={panel === 'json' ? 'is-on' : ''} onClick={() => setPanel(panel === 'json' ? null : 'json')}>
                      Edit as JSON
                    </button>
                    <button
                      type="button"
                      className={panel === 'history' ? 'is-on' : ''}
                      disabled={!entry.base}
                      onClick={() => setPanel(panel === 'history' ? null : 'history')}
                    >
                      Earlier versions
                    </button>
                    <button type="button" onClick={() => download(round, round.id)}>
                      Download
                    </button>
                    <button type="button" onClick={() => add({ ...structuredClone(round), id: newId() }, entries.indexOf(entry))}>
                      Duplicate
                    </button>
                    <button
                      type="button"
                      className="is-danger"
                      onClick={() => {
                        if (confirmDelete !== round.id) return setConfirmDelete(round.id);
                        setConfirmDelete(null);
                        remove(entry);
                      }}
                    >
                      {confirmDelete === round.id ? 'Click again to delete' : 'Delete'}
                    </button>
                  </div>
                </div>
                <IdNote id={round.id} copied={copied} onCopy={() => copyId(round.id)} />
                {panel === 'json' && <JsonEditor round={round} onApply={edit} onClose={() => setPanel(null)} />}
                {panel === 'history' && entry.base && <History round={round} current={entry.base} onRestore={(q) => edit({ ...q, id: round.id })} />}
                {entry.state === 'error' && entry.message ? (
                  <p className="admin-status is-error">
                    Could not save: {entry.message}{' '}
                    <button type="button" className="admin-link" onClick={() => save(round.id)}>
                      Try again
                    </button>
                  </p>
                ) : (
                  <Checklist items={missing} live={entry.state === 'saved'} />
                )}
              </section>

              <Step n={1} id="step-place" title="Place">
                <TextPair label="Place name" value={round.place} placeholder={{ en: 'Chiang Mai', th: 'เชียงใหม่' }} onChange={(f) => update((r) => ({ ...r, place: f(r.place) }))} />
              </Step>

              <Step
                n={2}
                id="step-time"
                title="Time axis"
                hint={`What runs along the bottom of ${isExtend(round) ? 'the chart' : 'both charts'}. Pick a kind, set the range, then press Use this time axis.`}
              >
                <TimeEditor round={round} onChange={edit} />
                <TextPair
                  label="Caption under the time axis"
                  required={false}
                  placeholder={{ en: 'Average for each month, 2001 to 2024', th: 'ค่าเฉลี่ยแต่ละเดือน 2001 ถึง 2024' }}
                  value={round.timeLabel}
                  onChange={(f) => update((r) => ({ ...r, timeLabel: f(r.timeLabel) }))}
                />
              </Step>

              {isExtend(round) ? (
                <>
                  <Step n={3} id="step-measures" title="The measure" hint="One line. Players see the first part and draw the rest.">
                    <TextPair
                      label="Name"
                      placeholder={{ en: 'Air temperature', th: 'อุณหภูมิอากาศ' }}
                      value={round.series.label}
                      onChange={(f) => update((r) => (isExtend(r) ? { ...r, series: { ...r.series, label: f(r.series.label) } } : r))}
                    />
                    <label className="admin-field">
                      <span className="admin-label">Unit</span>
                      <input
                        placeholder="°C"
                        value={round.series.unit}
                        onChange={(e) => {
                          const unit = e.target.value;
                          update((r) => (isExtend(r) ? { ...r, series: { ...r.series, unit } } : r));
                        }}
                      />
                    </label>
                  </Step>

                  <Step
                    n={4}
                    id="step-numbers"
                    title="Numbers and where players start drawing"
                    hint={
                      <>
                        Type numbers, or copy a column from Excel or Google Sheets, click the first box and press <b>Ctrl+V</b>. Rows marked draw are hidden
                        until players submit. Each part needs at least 2 numbers.
                      </>
                    }
                  >
                    <SplitPicker round={round} onChange={edit} />
                    <ExtendValues round={round} onChange={edit} />
                  </Step>
                </>
              ) : (
                <>
                <Step n={3} id="step-measures" title="The two measures" hint="Players see the bars, then draw the line they think goes with them.">
                  <div className="admin-series">
                    {(['given', 'hidden'] as SeriesKey[]).map((key) => (
                      <div key={key}>
                        <h3>
                          <span className={`admin-key ${key === 'given' ? 'is-bars' : 'is-line'}`} />
                          {key === 'given' ? 'Bars: players see this' : 'Line: players draw this'}
                        </h3>
                        <TextPair
                          label="Name"
                          placeholder={key === 'given' ? { en: 'Rainfall', th: 'ปริมาณฝน' } : { en: 'Soil moisture', th: 'ความชื้นในดิน' }}
                          value={round[key].label}
                          onChange={(f) => updatePair((r) => ({ ...r, [key]: { ...r[key], label: f(r[key].label) } }))}
                        />
                        <label className="admin-field">
                          <span className="admin-label">
                            Unit
                          </span>
                          <input
                            placeholder={key === 'given' ? 'mm/day' : 'kg/m²'}
                            value={round[key].unit}
                            onChange={(e) => {
                              const unit = e.target.value;
                              updatePair((r) => ({ ...r, [key]: { ...r[key], unit } }));
                            }}
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                </Step>

                <Step
                  n={4}
                  id="step-numbers"
                  title="Numbers"
                  hint={
                    <>
                      Type numbers, or copy columns from Excel or Google Sheets, click the first box and press <b>Ctrl+V</b>. Leave a box empty when there is no data.
                      Each column needs at least 2 numbers.
                    </>
                  }
                >
                  <ValuesTable round={round} onChange={edit} />
                </Step>
                </>
              )}

              <Step
                n={5}
                id="step-answer"
                title="Answer"
                hint={
                  <>
                    Shown after players submit. Select words and press <b>Bold</b> or <b>List</b>; press again to undo. Write English and Thai yourself.
                  </>
                }
              >
                <AnswerEditor value={round.answer} onChange={(f) => update((r) => ({ ...r, answer: f(r.answer) }))} />
              </Step>

              <Step n={6} id="step-source" title="Data source" optional>
                <input
                  aria-label="Data source"
                  placeholder="NASA POWER (MERRA-2), NASA GLDAS Noah 2.1"
                  value={round.source}
                  onChange={(e) => {
                    const source = e.target.value;
                    update((r) => ({ ...r, source }));
                  }}
                />
              </Step>
            </main>

            <aside className="admin-preview-pane">
              <p className="admin-preview-head">Preview. Draw on the chart to try it.</p>
              <Preview round={round} />
            </aside>
          </>
        ) : (
          <p className="admin-note">No questions yet. Press “+ Add a question”, or use Import JSON.</p>
        )}
      </div>
    </div>
  );
}
