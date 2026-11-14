import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent } from 'react';
import { deleteQuestion, fetchQuestions, importQuestions, questionHistory, saveQuestion, type Stored } from './api';
import { Result, RoundView, scoreRound } from './index';
import { importRounds, type ImportMode } from './normalize';
import { htmlToMarkdown, markdownToHtml } from './richText';
import type { Feedback } from './score';
import { formatTime, monthsBetween, monthsOfYear, timeKind, yearsBetween } from './time';
import type { GameRound, Localized, RoundSeries } from './types';
import { roundProblem } from './validate';

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

function download(data: unknown, name: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${name}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Small fields

function TextPair({ label, value, onChange, hint }: { label: string; value: Localized; onChange: (v: Localized) => void; hint?: string }) {
  return (
    <div className="admin-field">
      <span>{label}</span>
      {hint && <small>{hint}</small>}
      <div className="admin-pair">
        <input aria-label={`${label} in English`} placeholder="English" value={value.en} onChange={(e) => onChange({ ...value, en: e.target.value })} />
        <input aria-label={`${label} in Thai`} placeholder="Thai" value={value.th} onChange={(e) => onChange({ ...value, th: e.target.value })} />
      </div>
    </div>
  );
}

// Time axis

function TimeEditor({ round, onChange }: { round: GameRound; onChange: (r: GameRound) => void }) {
  const kind = timeKind(round.time);
  const [years, setYears] = useState({ from: 2001, to: 2024 });
  const [months, setMonths] = useState({ from: '2020-01', to: '2022-12' });

  return (
    <div className="admin-field">
      <span>Time axis</span>
      <div className="admin-time">
        <button type="button" className={kind === 'month-of-year' ? 'is-on' : ''} onClick={() => onChange(remap(round, monthsOfYear()))}>
          12 months of the year
        </button>
        <div className={`admin-time-range ${kind === 'year' ? 'is-on' : ''}`}>
          <span>Years</span>
          <input type="number" aria-label="First year" value={years.from} onChange={(e) => setYears({ ...years, from: Number(e.target.value) })} />
          <span>to</span>
          <input type="number" aria-label="Last year" value={years.to} onChange={(e) => setYears({ ...years, to: Number(e.target.value) })} />
          <button type="button" onClick={() => onChange(remap(round, yearsBetween(years.from, years.to).slice(0, 400)))}>
            Use
          </button>
        </div>
        <div className={`admin-time-range ${kind === 'month' ? 'is-on' : ''}`}>
          <span>Month by month</span>
          <input type="month" aria-label="First month" value={months.from} onChange={(e) => setMonths({ ...months, from: e.target.value })} />
          <span>to</span>
          <input type="month" aria-label="Last month" value={months.to} onChange={(e) => setMonths({ ...months, to: e.target.value })} />
          <button type="button" onClick={() => onChange(remap(round, monthsBetween(months.from, months.to).slice(0, 400)))}>
            Use
          </button>
        </div>
      </div>
      <small>{round.time.length} time points. Values that still match a time point are kept when you switch.</small>
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
      <span>Numbers</span>
      <small>Paste whole columns from Excel or Google Sheets: click the first cell and press Ctrl+V. Leave a cell empty when there is no data.</small>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>{round.given.label.en || 'Shown first'}</th>
              <th>{round.hidden.label.en || 'To guess'}</th>
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
      <span>Answer</span>
      <small>Select text and press Bold or List. Press again to undo it. Enter starts a new paragraph.</small>
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

  if (!ready) return <p className="admin-note">Fill in every required field to see the preview.</p>;

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

// Import from a file or pasted JSON

const EXAMPLE = `[
  {
    "id": "chiang-mai-rain-soil",
    "place": { "en": "Chiang Mai", "th": "เชียงใหม่" },
    "time": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    "timeLabel": { "en": "Average for each month", "th": "ค่าเฉลี่ยแต่ละเดือน" },
    "given": { "label": { "en": "Rainfall", "th": "ปริมาณฝน" }, "unit": "mm/day", "values": [ ... ] },
    "hidden": { "label": { "en": "Soil wetness", "th": "ความชื้นผิวดิน" }, "unit": "%", "values": [ ... ] },
    "answer": { "en": "…", "th": "…" },
    "source": "NASA POWER"
  }
]`;

function ImportPanel({ onDone, onClose }: { onDone: (stored: Stored[], message: string) => void; onClose: () => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [busy, setBusy] = useState(false);

  const run = async (json: string) => {
    setError(null);
    let result;
    try {
      result = importRounds([], json);
    } catch {
      setError('This is not valid JSON. Check the brackets, quotes and commas.');
      return;
    }
    if (result.rounds.length === 0) {
      setError(result.problems.join('\n') || 'No questions found in this JSON.');
      return;
    }
    setBusy(true);
    try {
      const stored = await importQuestions(result.rounds, mode);
      const skipped = result.problems.length ? ` Skipped ${result.problems.length}: ${result.problems.join(' / ')}` : '';
      const what = mode === 'replace' ? `Replaced all questions with ${result.rounds.length} from the file.` : `Added or updated ${result.rounds.length} question(s).`;
      onDone(stored, `${what}${skipped}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-card admin-import">
      <h2>Import JSON</h2>
      <div className="admin-modes" role="radiogroup" aria-label="How to import">
        <button type="button" role="radio" aria-checked={mode === 'merge'} className={mode === 'merge' ? 'is-on' : ''} onClick={() => setMode('merge')}>
          <strong>Add or update</strong>
          <small>One question or several. A question with the same id as an existing one replaces it. Everything else stays.</small>
        </button>
        <button type="button" role="radio" aria-checked={mode === 'replace'} className={mode === 'replace' ? 'is-on' : ''} onClick={() => setMode('replace')}>
          <strong>Replace everything</strong>
          <small>Removes all current questions and uses the ones in this file. Old versions stay in each question’s history.</small>
        </button>
      </div>
      <p className="admin-note">
        Use one question {'{ ... }'} or a list {'[ {...}, {...} ]'}. Every question needs English and Thai. Month names in time (Jan, Feb, …) are
        converted for you. Imported questions are saved straight away.
      </p>
      <label className="admin-file">
        <span>Choose a .json file</span>
        <input
          type="file"
          accept=".json,application/json"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) await run(await file.text());
          }}
        />
      </label>
      <textarea rows={10} placeholder={`Or paste JSON here\n\n${EXAMPLE}`} value={text} onChange={(e) => setText(e.target.value)} />
      {error && <p className="admin-status is-error admin-pre">{error}</p>}
      <div className="admin-import-actions">
        <button type="button" onClick={onClose}>
          Close
        </button>
        <button type="button" className="button" disabled={!text.trim() || busy} onClick={() => run(text)}>
          {busy ? 'Importing…' : 'Import pasted JSON'}
        </button>
      </div>
    </section>
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
  const [showHistory, setShowHistory] = useState(false);
  const [offline, setOffline] = useState(false);
  const entriesRef = useRef<Entry[]>([]);
  const timers = useRef(new Map<string, number>());

  const commit = useCallback((next: Entry[]) => {
    entriesRef.current = next;
    setEntries(next);
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
    fetchQuestions()
      .then((remote) => {
        commit(remote.map((s) => ({ draft: s.question, base: s, state: 'saved' })));
        if (remote.length === 0) {
          setNotice({ kind: 'info', text: 'No questions yet. Until you add some, the game shows three example questions.' });
        }
        setSelected((current) => current ?? remote[0]?.question.id ?? null);
      })
      .catch(() => {
        setOffline(true);
        commit([]);
        setNotice({ kind: 'error', text: 'Could not reach the question database. Check that Upstash Redis is connected to the project in Vercel.' });
      });
  }, [commit]);

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

  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

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

  return (
    <div className="admin">
      <header className="admin-top">
        <div>
          <h1>Guess the graph: questions</h1>
          <p>Changes save automatically and go live in the game straight away. Players get the questions in random order.</p>
        </div>
        <div className="admin-top-actions">
          <span className={`admin-overall ${unsaved ? 'is-busy' : ''}`}>
            {offline ? 'Offline: changes will save when the connection is back' : unsaved ? `${unsaved} not saved yet` : 'All changes saved'}
          </span>
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
          onClose={() => setImporting(false)}
          onDone={(stored, message) => {
            const local = entriesRef.current.filter((e) => !e.base && !stored.some((s) => s.question.id === e.draft.id));
            commit([...stored.map((s) => ({ draft: s.question, base: s, state: 'saved' as const })), ...local]);
            setImporting(false);
            setSelected(stored[0]?.question.id ?? null);
            setNotice({ kind: 'ok', text: message });
          }}
        />
      )}

      <div className="admin-body">
        <aside className="admin-list">
          <ol>
            {entries.map((e, i) => (
              <li key={e.draft.id} className={e.draft.id === selected ? 'is-on' : ''}>
                <button type="button" className="admin-list-main" onClick={() => setSelected(e.draft.id)}>
                  <strong>
                    {e.draft.given.label.en || 'Untitled'} → {e.draft.hidden.label.en || '?'}
                  </strong>
                  <small>{e.draft.place.en || 'No place yet'}</small>
                  <em className={`admin-state is-${e.state}`}>{STATE_LABEL[e.state]}</em>
                </button>
                <div className="admin-list-tools">
                  <button type="button" onClick={() => add({ ...structuredClone(e.draft), id: newId() }, i)}>
                    Copy
                  </button>
                  <button type="button" onClick={() => download(e.draft, e.draft.id)}>
                    Download
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

            {(entry.state === 'incomplete' || entry.state === 'error') && entry.message && (
              <p className={`admin-status ${entry.state === 'error' ? 'is-error' : 'is-info'}`}>
                {entry.state === 'error' ? `Could not save: ${entry.message}` : `Not saved yet: ${entry.message}`}{' '}
                {entry.state === 'error' && (
                  <button type="button" className="admin-dismiss" onClick={() => save(round.id)}>
                    Try again
                  </button>
                )}
              </p>
            )}

            <section className="admin-card">
              <div className="admin-card-head">
                <h2>Question</h2>
                <button type="button" onClick={() => setShowHistory(!showHistory)} disabled={!entry.base}>
                  {showHistory ? 'Hide history' : 'History'}
                </button>
              </div>
              {showHistory && entry.base && <History id={round.id} onRestore={(q) => edit({ ...q, id: round.id })} />}
              <TextPair label="Place" value={round.place} onChange={(place) => edit({ ...round, place })} />
              <TimeEditor round={round} onChange={edit} />
              <TextPair
                label="Caption under the time axis"
                hint="Optional. For example: Average for each month, 2001 to 2024."
                value={round.timeLabel}
                onChange={(timeLabel) => edit({ ...round, timeLabel })}
              />
            </section>

            <section className="admin-card admin-series">
              {(['given', 'hidden'] as SeriesKey[]).map((key) => (
                <div key={key}>
                  <h2>{key === 'given' ? 'Shown first (bars)' : 'Players draw this (line)'}</h2>
                  <TextPair label="Name" value={round[key].label} onChange={(label) => edit({ ...round, [key]: { ...round[key], label } })} />
                  <label className="admin-field">
                    <span>Unit</span>
                    <input value={round[key].unit} onChange={(e) => edit({ ...round, [key]: { ...round[key], unit: e.target.value } })} />
                  </label>
                </div>
              ))}
            </section>

            <section className="admin-card">
              <ValuesTable round={round} onChange={edit} />
            </section>

            <section className="admin-card">
              <AnswerEditor value={round.answer} onChange={(answer) => edit({ ...round, answer })} />
              <label className="admin-field">
                <span>Data source</span>
                <input placeholder="For example: NASA POWER (MERRA-2), NASA GLDAS Noah 2.1" value={round.source} onChange={(e) => edit({ ...round, source: e.target.value })} />
              </label>
            </section>

            <section className="admin-card">
              <h2>Preview (you can draw here)</h2>
              <Preview round={round} />
            </section>
          </main>
        ) : (
          <p className="admin-note">No questions yet. Press “Add a question”.</p>
        )}
      </div>
    </div>
  );
}
