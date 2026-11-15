import { useState } from 'react';
import { download, questionTitle } from './adminParts';
import { importQuestions, type Stored } from './api';
import { importRounds, type ImportMode, type ImportResult } from './normalize';
import type { GameRound } from './types';

// Field guide and starter files

const FIELDS: { name: string; required: boolean; text: string }[] = [
  { name: 'id', required: false, text: 'Leave it out for a new question; one is made for you. To change a question that already exists, keep its id exactly as it is (copy it from the question, or Download it).' },
  { name: 'place', required: true, text: '{ "en": "…", "th": "…" }' },
  { name: 'time', required: true, text: 'Jan…Dec, or years like "2001", or months like "2020-01". 2 to 400 points.' },
  { name: 'timeLabel', required: false, text: 'Caption under the time axis, { "en", "th" }.' },
  { name: 'given.label', required: true, text: 'Name of the bars, { "en", "th" }.' },
  { name: 'given.unit', required: true, text: 'For example "mm/day".' },
  { name: 'given.values', required: true, text: 'One number per time point. null where there is no data. At least 2 numbers.' },
  { name: 'hidden.label', required: true, text: 'Name of the line players draw, { "en", "th" }.' },
  { name: 'hidden.unit', required: true, text: 'For example "kg/m²".' },
  { name: 'hidden.values', required: true, text: 'Same as given.values.' },
  { name: 'answer', required: true, text: '{ "en", "th" }. **bold**, "- " starts a list item, \\n\\n starts a new paragraph.' },
  { name: 'source', required: false, text: 'Where the data comes from.' },
];

// Starter files: a blank template and a filled example for each kind of time axis

type StarterKind = 'months' | 'years' | 'monthly';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const YEARS = Array.from({ length: 24 }, (_, i) => String(2001 + i));
const MONTHLY = Array.from({ length: 36 }, (_, i) => `${2020 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`);

const STARTER_TIME: Record<StarterKind, { label: string; time: string[] }> = {
  months: { label: '12 months of the year', time: MONTHS },
  years: { label: 'Year by year (2001 to 2024)', time: YEARS },
  monthly: { label: 'Month by month (Jan 2020 to Dec 2022)', time: MONTHLY },
};

function blankTemplate(kind: StarterKind) {
  const time = STARTER_TIME[kind].time;
  const empty = time.map(() => null);
  return [
    {
      place: { en: '', th: '' },
      time,
      timeLabel: { en: '', th: '' },
      given: { label: { en: '', th: '' }, unit: '', values: empty },
      hidden: { label: { en: '', th: '' }, unit: '', values: empty },
      answer: { en: '', th: '' },
      source: '',
    },
  ];
}

const RAIN = [0.3, 0.4, 0.9, 2.1, 5.6, 5.2, 6.1, 7.4, 7.0, 3.9, 1.2, 0.4];
const SOIL = [20, 18, 17, 18, 22, 26, 29, 32, 34, 33, 28, 23];
const YEAR_RAIN = [4.2, 4.7, 4.8, 4.5, 4.0, 3.7, 3.9, 4.3, 4.8, 5.0, 4.6, 4.1, 3.9, 4.0, 4.5, 5.0, 5.1, 4.8, 4.3, 4.0, 4.2, 4.6, 5.1, 5.2];
const AOD = [0.55, 0.7, 0.85, 0.6, 0.3, 0.2, 0.18, 0.17, 0.2, 0.25, 0.3, 0.4];

const EXAMPLES: Record<StarterKind, object> = {
  months: {
    place: { en: 'Chiang Mai', th: 'เชียงใหม่' },
    time: MONTHS,
    timeLabel: { en: 'Average for each month, 2001 to 2024', th: 'ค่าเฉลี่ยแต่ละเดือน 2001 ถึง 2024' },
    given: { label: { en: 'Rainfall', th: 'ปริมาณฝน' }, unit: 'mm/day', values: RAIN },
    hidden: { label: { en: 'Soil moisture', th: 'ความชื้นในดิน' }, unit: 'kg/m²', values: SOIL },
    answer: {
      en: '**Soil follows the rain, about a month later.**\n\n- Rain peaks in August\n- Soil moisture peaks in September',
      th: '**ดินชื้นตามฝน แต่ช้ากว่าราว 1 เดือน**\n\n- ฝนมากที่สุดเดือนสิงหาคม\n- ดินชื้นที่สุดเดือนกันยายน',
    },
    source: 'NASA POWER',
  },
  years: {
    place: { en: 'Ayutthaya', th: 'พระนครศรีอยุธยา' },
    time: YEARS,
    timeLabel: { en: 'Yearly average, 2001 to 2024', th: 'ค่าเฉลี่ยรายปี 2001 ถึง 2024' },
    given: { label: { en: 'Rainfall', th: 'ปริมาณฝน' }, unit: 'mm/day', values: YEAR_RAIN },
    hidden: {
      label: { en: 'Runoff', th: 'น้ำไหลบ่า' },
      unit: 'mm/day',
      values: YEAR_RAIN.map((r) => Math.round(Math.max(0.1, (r - 3.6) * 1.1) * 100) / 100),
    },
    answer: {
      en: '**Wet years bring much more runoff.**\n\nRunoff only rises once rain passes what the ground can soak up.',
      th: '**ปีที่ฝนมาก น้ำไหลบ่าก็มากขึ้นชัดเจน**\n\nน้ำไหลบ่าจะเพิ่มก็ต่อเมื่อฝนมากเกินกว่าที่ดินจะซึมรับได้',
    },
    source: 'NASA GLDAS',
  },
  monthly: {
    place: { en: 'Chiang Rai', th: 'เชียงราย' },
    time: MONTHLY,
    timeLabel: { en: 'Each month, January 2020 to December 2022', th: 'รายเดือน มกราคม 2020 ถึง ธันวาคม 2022' },
    given: { label: { en: 'Rainfall', th: 'ปริมาณฝน' }, unit: 'mm/day', values: [...RAIN, ...RAIN, ...RAIN] },
    hidden: { label: { en: 'Haze (aerosol)', th: 'หมอกควัน (ละอองลอย)' }, unit: 'AOD', values: [...AOD, ...AOD.map((v, i) => (i === 2 ? null : v)), ...AOD] },
    answer: {
      en: '**Haze is worst in the dry season and clears when the rain comes.**\n\n- Worst in March\n- Cleanest in July and August\n\nnull marks a month with no data, like March 2021 here.',
      th: '**หมอกควันหนักสุดหน้าแล้ง และหายไปเมื่อฝนมา**\n\n- แย่ที่สุดเดือนมีนาคม\n- สะอาดที่สุดเดือนกรกฎาคมถึงสิงหาคม\n\nnull คือเดือนที่ไม่มีข้อมูล เช่น มีนาคม 2021 ในตัวอย่างนี้',
    },
    source: 'NASA MERRA-2',
  },
};

function Starters() {
  const kinds = Object.keys(STARTER_TIME) as StarterKind[];
  return (
    <div className="admin-starters" data-tour="starters">
      <table>
        <thead>
          <tr>
            <th>Time axis</th>
            <th>Blank template</th>
            <th>Filled example</th>
          </tr>
        </thead>
        <tbody>
          {kinds.map((kind) => (
            <tr key={kind}>
              <td>{STARTER_TIME[kind].label}</td>
              <td>
                <button type="button" className="admin-link" onClick={() => download(blankTemplate(kind), `template-${kind}`)}>
                  Download
                </button>
              </td>
              <td>
                <button type="button" className="admin-link" onClick={() => download([EXAMPLES[kind]], `example-${kind}`)}>
                  Download
                </button>
              </td>
            </tr>
          ))}
          <tr>
            <td>All three in one file</td>
            <td>
              <button type="button" className="admin-link" onClick={() => download(kinds.flatMap(blankTemplate), 'template-all')}>
                Download
              </button>
            </td>
            <td>
              <button type="button" className="admin-link" onClick={() => download(kinds.map((k) => EXAMPLES[k]), 'example-all')}>
                Download
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p className="admin-hint">
        Open the file in any text editor, fill it in and save it. To use your own years or months, change <code>"time"</code> and give{' '}
        <code>"values"</code> one number per time point.
      </p>
    </div>
  );
}

function FieldGuide() {
  return (
    <details className="admin-details" data-tour="fields">
      <summary>Which fields are required?</summary>
      <table className="admin-fields">
        <tbody>
          {FIELDS.map((f) => (
            <tr key={f.name}>
              <td>
                <code>{f.name}</code>
              </td>
              <td>
                <span className={f.required ? undefined : 'is-optional'}>{f.required ? 'Required' : 'optional'}</span>
              </td>
              <td>{f.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="admin-hint">Every field with "en" and "th" needs both languages. One question {'{ … }'} or a list {'[ {…}, {…} ]'} both work.</p>
    </details>
  );
}

// Summary shown before anything is saved

function Summary({ result, mode, saved }: { result: ImportResult; mode: ImportMode; saved: Stored[] }) {
  const existing = new Map(saved.map((s) => [s.question.id, s.question]));
  const incoming = new Set(result.rounds.map((r) => r.id));
  const adds = result.rounds.filter((r) => !existing.has(r.id));
  const updates = result.rounds.filter((r) => existing.has(r.id));
  const removes = mode === 'replace' ? saved.filter((s) => !incoming.has(s.question.id)).map((s) => s.question) : [];
  const name = (r: GameRound) => `${r.place.en || 'No place'}: ${questionTitle(r)}`;

  const group = (title: string, kind: string, items: string[]) =>
    items.length > 0 && (
      <div className={`admin-summary-group is-${kind}`}>
        <h3>
          {title} <span>{items.length}</span>
        </h3>
        <ul>
          {items.map((text, i) => (
            <li key={i}>{text}</li>
          ))}
        </ul>
      </div>
    );

  return (
    <div className="admin-summary">
      {group('Will be added', 'add', adds.map(name))}
      {group('Will be changed', 'update', updates.map((r) => `${name(r)} (id ${r.id})`))}
      {group('Will be removed', 'remove', removes.map(name))}
      {group('Will be skipped', 'skip', result.problems)}
      {result.rounds.length === 0 && <p className="admin-status is-error">Nothing can be imported. Fix the problems above and check again.</p>}
    </div>
  );
}

// Panel

interface ImportPanelProps {
  saved: Stored[];
  onDone: (stored: Stored[], imported: Set<string>, message: string) => void;
  onClose: () => void;
}

export function ImportPanel({ saved, onDone, onClose }: ImportPanelProps) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<ImportMode>('merge');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const check = (json: string) => {
    setError(null);
    setResult(null);
    try {
      setResult(importRounds([], json));
    } catch {
      setError('This is not valid JSON. Check the brackets, quotes and commas.');
    }
  };

  const run = async () => {
    if (!result || result.rounds.length === 0) return;
    setBusy(true);
    try {
      const stored = await importQuestions(result.rounds, mode);
      const skipped = result.problems.length ? ` Skipped ${result.problems.length}.` : '';
      const what = mode === 'replace' ? `Replaced all questions with ${result.rounds.length} from the file.` : `Imported ${result.rounds.length} question(s).`;
      onDone(stored, new Set(result.rounds.map((r) => r.id)), `${what}${skipped}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const edit = (next: string) => {
    setText(next);
    setResult(null);
  };

  return (
    <section className="admin-card admin-import">
      <div className="admin-card-head">
        <h2>Import JSON</h2>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <Starters />
      <FieldGuide />

      <div className="admin-modes" role="radiogroup" aria-label="How to import" data-tour="modes">
        <button type="button" role="radio" aria-checked={mode === 'merge'} className={mode === 'merge' ? 'is-on' : ''} onClick={() => setMode('merge')}>
          <strong>Add or update</strong>
          <small>Adds new questions. A question whose id already exists is changed. Nothing else is touched.</small>
        </button>
        <button type="button" role="radio" aria-checked={mode === 'replace'} className={mode === 'replace' ? 'is-on' : ''} onClick={() => setMode('replace')}>
          <strong>Replace everything</strong>
          <small>Removes every saved question that is not in the file. Unfinished questions stay in the list.</small>
        </button>
      </div>

      <label className="admin-file" data-tour="file">
        <span>Choose a .json file</span>
        <input
          type="file"
          accept=".json,application/json"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            const content = await file.text();
            setText(content);
            check(content);
          }}
        />
      </label>
      <textarea rows={8} placeholder="Or paste JSON here" value={text} onChange={(e) => edit(e.target.value)} />

      {error && <p className="admin-status is-error">{error}</p>}
      {result && <Summary result={result} mode={mode} saved={saved} />}

      <div className="admin-import-actions">
        {result ? (
          <>
            <button type="button" onClick={() => setResult(null)}>
              Back
            </button>
            <button type="button" className="button" disabled={busy || result.rounds.length === 0} onClick={run}>
              {busy ? 'Importing…' : `Import ${result.rounds.length} question${result.rounds.length === 1 ? '' : 's'}`}
            </button>
          </>
        ) : (
          <button type="button" className="button" data-tour="check" disabled={!text.trim()} onClick={() => check(text)}>
            Check
          </button>
        )}
      </div>
    </section>
  );
}
