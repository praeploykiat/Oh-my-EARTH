import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent } from 'react';
import { deleteQuestion, fetchQuestions, questionHistory, saveQuestion, type Stored } from './api';
import { Result, RoundView, scoreRound } from './index';
import { normalizeRound } from './normalize';
import { htmlToMarkdown, markdownToHtml } from './richText';
import type { Feedback } from './score';
import { Badge, Checklist, download, Guide, missingItems, questionTitle, Step, useGuideOpen } from './adminParts';
import { ImportPanel } from './adminImport';
import { withUnit } from './answer';
import { formatTime, monthsBetween, monthsOfYear, timeKind, yearsBetween } from './time';
import type { GameRound, Localized, RoundSeries } from './types';
import { LIMITS, roundProblem } from './validate';

const SAVE_DELAY_MS = 900;
const REFRESH_MS = 8000;

type SeriesKey = 'given' | 'hidden';
type EntryState = 'saved' | 'waiting' | 'saving' | 'incomplete' | 'conflict' | 'error';

interface Entry {
  draft: GameRound;
  base: Stored | null;
  state: EntryState;
  message?: string;
  remote?: Stored | null;
}

const same = (a: GameRound, b: GameRound | undefined) => !!b && JSON.stringify(a) === JSON.stringify(b);
const isDirty = (e: Entry) => !e.base || !same(e.draft, e.base.question);
const newId = () => `q-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Unfinished work kept in this browser

const DRAFTS_KEY = 'game-admin-drafts';

interface SavedDraft {
  draft: GameRound;
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

function draftEntry(draft: GameRound, base: Stored | null): Entry {
  const problem = roundProblem(draft);
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

function remap(round: GameRound, time: string[]): GameRound {
  const pick = (series: RoundSeries): RoundSeries => {
    const old = new Map(round.time.map((t, i) => [t, series.values[i]]));
    return { ...series, values: time.map((t) => old.get(t) ?? null) };
  };
  return { ...round, time, given: pick(round.given), hidden: pick(round.hidden) };
}

function parseNumber(text: string): number | null {
  const cleaned = text.trim().replace(/,/g, '');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Small fields

interface TextPairProps {
  label: string;
  value: Localized;
  onChange: (v: Localized) => void;
  hint?: string;
  required?: boolean;
  placeholder?: Localized;
}

function TextPair({ label, value, onChange, hint, required = true, placeholder }: TextPairProps) {
  return (
    <div className="admin-field">
      <span className="admin-label">
        {label} {!required && <Badge required={false} />}
      </span>
      {hint && <small>{hint}</small>}
      <div className="admin-pair">
        <label className="admin-lang-input">
          <small>English</small>
          <input aria-label={`${label} in English`} placeholder={placeholder?.en} value={value.en} onChange={(e) => onChange({ ...value, en: e.target.value })} />
        </label>
        <label className="admin-lang-input">
          <small>Thai</small>
          <input aria-label={`${label} in Thai`} placeholder={placeholder?.th} value={value.th} onChange={(e) => onChange({ ...value, th: e.target.value })} />
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

function TimeEditor({ round, onChange }: { round: GameRound; onChange: (r: GameRound) => void }) {
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
    const lost = gone.reduce((sum, { i }) => sum + (round.given.values[i] !== null ? 1 : 0) + (round.hidden.values[i] !== null ? 1 : 0), 0);
    if (lost === 0) return onChange(remap(round, time));
    const withData = gone.filter(({ i }) => round.given.values[i] !== null || round.hidden.values[i] !== null);
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

function AnswerEditor({ value, onChange }: { value: Localized; onChange: (v: Localized) => void }) {
  return (
    <div className="admin-field">
      <div className="admin-answer-pair">
        <div>
          <p className="admin-lang">English</p>
          <RichAnswer label="Answer in English" value={value.en} onChange={(en) => onChange({ ...value, en })} />
        </div>
        <div>
          <p className="admin-lang">Thai</p>
          <RichAnswer label="Answer in Thai" value={value.th} onChange={(th) => onChange({ ...value, th })} />
        </div>
      </div>
    </div>
  );
}

// Preview

function Preview({ round }: { round: GameRound }) {
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
      {feedback && <Result round={round} feedback={feedback} onNext={reset} nextLabel="Try again" />}
    </div>
  );
}

// One question as JSON

function JsonEditor({ round, onApply, onClose }: { round: GameRound; onApply: (r: GameRound) => void; onClose: () => void }) {
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
    const next = { ...normalizeRound(raw, id), id };
    const o = raw as { given?: { values?: unknown[] }; hidden?: { values?: unknown[] } };
    const short = [o.given?.values, o.hidden?.values].some((v) => !Array.isArray(v) || v.length !== next.time.length);
    if (next.time.length < 2) return setError('"time" needs at least 2 time points.');
    if (short) return setError(`"given.values" and "hidden.values" need ${next.time.length} values each, one per time point.`);
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

function History({ id, onRestore }: { id: string; onRestore: (q: GameRound) => void }) {
  const [versions, setVersions] = useState<Stored[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    questionHistory(id).then(setVersions, (e: Error) => setError(e.message));
  }, [id]);

  if (error) return <p className="admin-status is-error">{error}</p>;
  if (!versions) return <p className="admin-note">Loading…</p>;
  if (versions.length === 0) return <p className="admin-note">No earlier versions of this question yet.</p>;

  return (
    <ul className="admin-history">
      {versions.map((v) => (
        <li key={v.version}>
          <span>
            Saved {when(v.updatedAt)} · {v.question.place.en || 'no place'}
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
  const [guideOpen, toggleGuide] = useGuideOpen();
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
      const problem = roundProblem(entry.draft);
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

  const edit = (next: GameRound) => {
    const problem = roundProblem(next);
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
      remote = await fetchQuestions();
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
    fetchQuestions()
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

  if (!entries) return <p className="status">Loading…</p>;

  const entry = entries.find((e) => e.draft.id === selected) ?? null;
  const round = entry?.draft ?? null;

  const add = (question: GameRound, after?: number) => {
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
        const result = await deleteQuestion(e.draft.id, e.base.version);
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
          <h1>Guess the graph: questions</h1>
          <p>Add, change and remove the questions players get. Everything saves by itself.</p>
        </div>
        <div className="admin-top-actions">
          <span className={`admin-overall ${unsaved ? 'is-busy' : ''}`}>
            {offline ? 'Offline: changes will save when the connection is back' : unsaved ? `${unsaved} not saved yet` : 'All changes saved'}
          </span>
          {!guideOpen && (
            <button type="button" className="button button-secondary" onClick={toggleGuide}>
              How to use
            </button>
          )}
          <button type="button" className="button button-secondary" onClick={() => setImporting(!importing)}>
            Import JSON
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => download(entries.map((e) => e.draft), `game-questions-${new Date().toISOString().slice(0, 10)}`)}
          >
            Download all
          </button>
        </div>
      </header>

      {guideOpen && <Guide onClose={toggleGuide} />}

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
          <p className="admin-list-title">Questions ({entries.length})</p>
          <ol>
            {entries.map((e, i) => (
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
                  <small>{e.draft.place.en || 'No place yet'}</small>
                  <em className={`admin-state is-${e.state}`}>{STATE_LABEL[e.state]}</em>
                </button>
                <div className="admin-list-tools">
                  <button type="button" onClick={() => add({ ...structuredClone(e.draft), id: newId() }, i)}>
                    Duplicate
                  </button>
                  <button
                    type="button"
                    className="is-danger"
                    onClick={() => {
                      if (confirmDelete !== e.draft.id) return setConfirmDelete(e.draft.id);
                      setConfirmDelete(null);
                      remove(e);
                    }}
                  >
                    {confirmDelete === e.draft.id ? 'Click again to delete' : 'Delete'}
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <button type="button" className="button admin-add" onClick={() => add(blankQuestion())}>
            + Add a question
          </button>
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

              <section className="admin-card admin-head">
                <div className="admin-head-row">
                  <div>
                    <p className="admin-kicker">{entry.base ? 'Editing' : 'New question'}</p>
                    <h2>
                      {round.place.en ? `${round.place.en} · ` : ''}
                      {questionTitle(round)}
                    </h2>
                    <p className="admin-meta">
                      <code>ID {round.id}</code>
                      <button type="button" className="admin-link" onClick={() => copyId(round.id)}>
                        {copied ? 'Copied' : 'Copy ID'}
                      </button>
                      <span className={`admin-state is-${entry.state}`}>{status(entry)}</span>
                    </p>
                  </div>
                  <div className="admin-head-tools">
                    <button type="button" className={panel === 'json' ? 'is-on' : ''} onClick={() => setPanel(panel === 'json' ? null : 'json')}>
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
                  </div>
                </div>
                {panel === 'json' && <JsonEditor round={round} onApply={edit} onClose={() => setPanel(null)} />}
                {panel === 'history' && entry.base && <History id={round.id} onRestore={(q) => edit({ ...q, id: round.id })} />}
                {entry.state === 'error' && entry.message ? (
                  <p className="admin-status is-error">
                    Could not save: {entry.message}{' '}
                    <button type="button" className="admin-dismiss" onClick={() => save(round.id)}>
                      Try again
                    </button>
                  </p>
                ) : (
                  <Checklist items={missing} live={entry.state === 'saved'} />
                )}
              </section>

              <Step n={1} id="step-place" title="Place" required>
                <TextPair label="Place name" value={round.place} placeholder={{ en: 'Chiang Mai', th: 'เชียงใหม่' }} onChange={(place) => edit({ ...round, place })} />
              </Step>

              <Step n={2} id="step-time" title="Time axis" required hint="What the bottom of both charts shows. Pick a kind, set the range, then press Use this time axis.">
                <TimeEditor round={round} onChange={edit} />
                <TextPair
                  label="Caption under the time axis"
                  required={false}
                  placeholder={{ en: 'Average for each month, 2001 to 2024', th: 'ค่าเฉลี่ยแต่ละเดือน 2001 ถึง 2024' }}
                  value={round.timeLabel}
                  onChange={(timeLabel) => edit({ ...round, timeLabel })}
                />
              </Step>

              <Step n={3} id="step-measures" title="The two measures" required hint="Players see the bars, then draw the line they think goes with them.">
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
                        onChange={(label) => edit({ ...round, [key]: { ...round[key], label } })}
                      />
                      <label className="admin-field">
                        <span className="admin-label">
                          Unit <Badge required={false} />
                        </span>
                        <input
                          placeholder={key === 'given' ? 'mm/day' : 'kg/m²'}
                          value={round[key].unit}
                          onChange={(e) => edit({ ...round, [key]: { ...round[key], unit: e.target.value } })}
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
                required
                hint={
                  <>
                    Type numbers, or copy columns from Excel or Google Sheets, click the first box and press <b>Ctrl+V</b>. Leave a box empty when there is no data.
                    Each column needs at least 2 numbers.
                  </>
                }
              >
                <ValuesTable round={round} onChange={edit} />
              </Step>

              <Step
                n={5}
                id="step-answer"
                title="Answer"
                required
                hint={
                  <>
                    Shown after players submit. Select words and press <b>Bold</b> or <b>List</b>; press again to undo. Write English and Thai yourself.
                  </>
                }
              >
                <AnswerEditor value={round.answer} onChange={(answer) => edit({ ...round, answer })} />
              </Step>

              <Step n={6} id="step-source" title="Data source" required={false}>
                <input
                  aria-label="Data source"
                  placeholder="NASA POWER (MERRA-2), NASA GLDAS Noah 2.1"
                  value={round.source}
                  onChange={(e) => edit({ ...round, source: e.target.value })}
                />
              </Step>
            </main>

            <aside className="admin-preview-pane">
              <div className="admin-preview-head">
                <h2>Preview</h2>
                <p>Exactly what players see. Draw on the chart to try it.</p>
              </div>
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
