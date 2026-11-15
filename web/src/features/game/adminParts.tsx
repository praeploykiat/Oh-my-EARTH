import { useCallback, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import type { GameRound } from './types';

// Files

export function download(data: unknown, name: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${name}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// Labels

export function Optional() {
  return <span className="admin-optional">optional</span>;
}

export function Step({ n, id, title, optional, hint, children }: { n: number; id: string; title: string; optional?: boolean; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="admin-step" id={id}>
      <span className="admin-step-n" aria-hidden="true">
        {n}
      </span>
      <div className="admin-step-body">
        <h2>
          {title} {optional && <Optional />}
        </h2>
        {hint && <p className="admin-hint">{hint}</p>}
        {children}
      </div>
    </section>
  );
}

export function questionTitle(r: GameRound): string {
  const given = r.given.label.en.trim();
  const hidden = r.hidden.label.en.trim();
  if (!given && !hidden) return 'New question';
  return `${given || '?'} and ${hidden || '?'}`;
}

// What differs between two versions of a question

const PARTS: { name: string; pick: (r: GameRound) => unknown }[] = [
  { name: 'Place', pick: (r) => r.place },
  { name: 'Time axis', pick: (r) => r.time },
  { name: 'Caption under the time axis', pick: (r) => r.timeLabel },
  { name: 'Name of the bars', pick: (r) => r.given.label },
  { name: 'Unit of the bars', pick: (r) => r.given.unit },
  { name: 'Numbers for the bars', pick: (r) => r.given.values },
  { name: 'Name of the line', pick: (r) => r.hidden.label },
  { name: 'Unit of the line', pick: (r) => r.hidden.unit },
  { name: 'Numbers for the line', pick: (r) => r.hidden.values },
  { name: 'Answer', pick: (r) => r.answer },
  { name: 'Data source', pick: (r) => r.source },
];

export function changedParts(from: GameRound | undefined, to: GameRound): string[] {
  if (!from) return [];
  return PARTS.filter((p) => JSON.stringify(p.pick(from)) !== JSON.stringify(p.pick(to))).map((p) => p.name);
}

// What still needs filling in

export interface MissingItem {
  text: string;
  target: string;
}

export function missingItems(r: GameRound): MissingItem[] {
  const items: MissingItem[] = [];
  const both = (value: { en: string; th: string }, what: string, target: string) => {
    const langs = [!value.en.trim() && 'English', !value.th.trim() && 'Thai'].filter(Boolean);
    if (langs.length) items.push({ text: `${what} (${langs.join(' and ')})`, target });
  };
  const count = (values: (number | null)[]) => values.filter((v) => v !== null).length;

  both(r.place, 'Place', 'step-place');
  both(r.given.label, 'Name of the bars', 'step-measures');
  both(r.hidden.label, 'Name of the line', 'step-measures');
  if (!r.given.unit.trim()) items.push({ text: 'Unit of the bars', target: 'step-measures' });
  if (!r.hidden.unit.trim()) items.push({ text: 'Unit of the line', target: 'step-measures' });
  if (count(r.given.values) < 2) items.push({ text: 'At least 2 numbers for the bars', target: 'step-numbers' });
  if (count(r.hidden.values) < 2) items.push({ text: 'At least 2 numbers for the line', target: 'step-numbers' });
  both(r.answer, 'Answer', 'step-answer');
  return items;
}

export function jumpTo(target: string) {
  const section = document.getElementById(target);
  if (!section) return;
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const field = [...section.querySelectorAll<HTMLElement>('input, [contenteditable="true"]')].find(
    (el) => (el instanceof HTMLInputElement ? el.value === '' : !el.textContent?.trim()),
  );
  window.setTimeout(() => field?.focus({ preventScroll: true }), 400);
}

export function Checklist({ items, live }: { items: MissingItem[]; live: boolean }) {
  if (items.length === 0) {
    return <p className="admin-done">{live ? 'Complete. Players can get this question now.' : 'Complete. Saving…'}</p>;
  }
  return (
    <div className="admin-todo">
      <p>Still needed before it saves:</p>
      <ul>
        {items.map((item) => (
          <li key={item.text}>
            <button type="button" onClick={() => jumpTo(item.target)}>
              {item.text}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// What an ID is

export const ID_EXPLAINED =
  'The ID is the fixed name the system uses to tell questions apart. You never type it when you edit here. It only matters in JSON: leave "id" out to add a new question, or keep it to change the question that has it.';

export function IdNote({ id, onCopy, copied }: { id: string; onCopy: () => void; copied: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="admin-id">
      <span>
        ID <code>{id}</code>
      </span>
      <button type="button" className="admin-link" onClick={onCopy}>
        {copied ? 'Copied' : 'Copy'}
      </button>
      <button type="button" className="admin-link" aria-expanded={open} onClick={() => setOpen(!open)}>
        What is this?
      </button>
      {open && <p className="admin-hint">{ID_EXPLAINED}</p>}
    </div>
  );
}

// Tour shown when the page opens

const TOUR_KEY = 'game-admin-tour';

interface TourStep {
  target: string;
  title: string;
  body: string;
  importOpen?: boolean;
}

const TOUR: TourStep[] = [
  { target: '.admin-list', title: 'Your questions', body: 'Every question players can get. Click one to open it.' },
  { target: '.admin-add', title: 'Add a question by hand', body: 'Starts a blank question. It saves by itself as soon as nothing is missing.' },
  { target: '.admin-todo, .admin-done', title: 'What is left to do', body: 'Lists anything still missing. Click an item to jump straight to it.' },
  { target: '#step-place', title: 'Fill in the steps', body: 'Work from top to bottom. Every field needs English and Thai unless it says optional.' },
  { target: '#step-numbers', title: 'Paste your numbers', body: 'Copy two columns from Excel or Google Sheets, click the first box, then press Ctrl+V.' },
  { target: '.admin-preview-pane', title: 'Try it like a player', body: 'The preview shows exactly what players see, including the answer. Draw on it to test.' },
  { target: '[data-tour="import"]', title: 'Add many questions with JSON', body: 'JSON is a text file that holds questions. Import JSON opens the panel for it. The next steps walk through it.' },
  {
    target: '[data-tour="starters"]',
    title: 'Start from a file',
    body: 'Download a blank template or a filled example. There is one for each kind of time axis, and one with all three. Open it in any text editor, such as Notepad, fill it in and save.',
    importOpen: true,
  },
  {
    target: '[data-tour="fields"]',
    title: 'What each field means',
    body: 'Open this list to see every field, whether it is required, and what to put in it.',
    importOpen: true,
  },
  {
    target: '[data-tour="modes"]',
    title: 'Add, or replace everything',
    body: 'Add or update keeps every question not in the file. Replace everything removes saved questions that are not in the file. Pick before you check.',
    importOpen: true,
  },
  {
    target: '[data-tour="file"]',
    title: 'Choose the file',
    body: 'Pick your .json file, or paste its text into the box below.',
    importOpen: true,
  },
  {
    target: '[data-tour="check"]',
    title: 'Check before anything is saved',
    body: 'Shows what will be added, changed, removed or skipped, and why. Nothing is saved until you press Import.',
    importOpen: true,
  },
  {
    target: '[data-tour="json-edit"]',
    title: 'Change one question as JSON',
    body: 'Opens the question you are looking at as JSON. Change the text and press Apply. You do not need its ID for this.',
  },
  { target: '.admin-id', title: 'The question’s ID', body: ID_EXPLAINED },
  { target: '[data-tour="tour"]', title: 'See this again', body: 'Press Tour any time to go through these steps again.' },
];

export function tourWanted(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) !== 'off';
  } catch {
    return true;
  }
}

function rememberTour(show: boolean) {
  try {
    if (show) localStorage.removeItem(TOUR_KEY);
    else localStorage.setItem(TOUR_KEY, 'off');
  } catch {
    // Without storage the tour simply shows again next time
  }
}

export function Tour({ onClose, onImport }: { onClose: () => void; onImport: (open: boolean) => void }) {
  const [steps] = useState(() => TOUR.filter((s) => s.importOpen || document.querySelector(s.target)));
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<DOMRect | null>(null);
  const [hideNext, setHideNext] = useState(!tourWanted());
  const step = steps[index];

  const measure = useCallback(() => {
    const el = step && document.querySelector<HTMLElement>(step.target);
    setBox(el ? el.getBoundingClientRect() : null);
  }, [step]);

  useLayoutEffect(() => {
    if (!step) return;
    onImport(!!step.importOpen);
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>(step.target);
        if (!el) return setBox(null);
        const rect = el.getBoundingClientRect();
        if (rect.top < 80 || rect.bottom > window.innerHeight - 260) {
          el.scrollIntoView({ block: rect.height > window.innerHeight * 0.5 ? 'start' : 'center' });
        }
        measure();
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [step, measure, onImport]);

  useEffect(() => {
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  const close = useCallback(() => {
    rememberTour(!hideNext);
    if (step?.importOpen) onImport(false);
    onClose();
  }, [hideNext, onClose, onImport, step]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, steps.length - 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [close, steps.length]);

  if (!step) return null;

  const pad = 8;
  const hole = box && {
    top: Math.max(box.top - pad, 4),
    left: Math.max(box.left - pad, 4),
    width: Math.min(box.width + pad * 2, window.innerWidth - 8),
    height: Math.min(box.height + pad * 2, window.innerHeight - 8),
  };
  const cardHeight = 290;
  const below = !hole || hole.top + hole.height + cardHeight < window.innerHeight;
  const cardTop = !hole
    ? window.innerHeight / 2 - cardHeight / 2
    : below
      ? hole.top + hole.height + 12
      : Math.max(hole.top - 12 - cardHeight, 12);
  const cardLeft = Math.min(Math.max(hole?.left ?? 0, 12), window.innerWidth - 372);
  const last = index === steps.length - 1;

  return (
    <div className="admin-tour" role="dialog" aria-modal="true" aria-label="Page tour">
      {hole ? <div className="admin-tour-hole" style={hole} /> : <div className="admin-tour-dim" />}
      <div className="admin-tour-card" style={{ top: Math.min(cardTop, window.innerHeight - cardHeight), left: cardLeft }}>
        <p className="admin-tour-count">
          {index + 1} of {steps.length}
        </p>
        <h2>{step.title}</h2>
        <p>{step.body}</p>
        <label className="admin-tour-hide">
          <input type="checkbox" checked={hideNext} onChange={(e) => setHideNext(e.target.checked)} />
          Don’t show this when the page opens
        </label>
        <div className="admin-tour-actions">
          <button type="button" className="admin-link" onClick={close}>
            Skip tour
          </button>
          <span>
            {index > 0 && (
              <button type="button" onClick={() => setIndex(index - 1)}>
                Back
              </button>
            )}
            <button type="button" className="is-primary" onClick={() => (last ? close() : setIndex(index + 1))}>
              {last ? 'Done' : 'Next'}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
