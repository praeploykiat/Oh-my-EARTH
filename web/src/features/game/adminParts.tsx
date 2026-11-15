import { useState, type ReactNode } from 'react';
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

export function Badge({ required }: { required: boolean }) {
  return <em className={`admin-badge ${required ? 'is-required' : 'is-optional'}`}>{required ? 'Required' : 'Optional'}</em>;
}

export function Step({ n, id, title, required, hint, children }: { n: number; id: string; title: string; required: boolean; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="admin-card admin-step" id={id}>
      <header className="admin-step-head">
        <span className="admin-step-n">{n}</span>
        <h2>{title}</h2>
        <Badge required={required} />
      </header>
      {hint && <p className="admin-hint">{hint}</p>}
      {children}
    </section>
  );
}

export function questionTitle(r: GameRound): string {
  const given = r.given.label.en.trim();
  const hidden = r.hidden.label.en.trim();
  if (!given && !hidden) return 'New question';
  return `${given || '?'} → ${hidden || '?'}`;
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
    if (langs.length) items.push({ text: `${what} in ${langs.join(' and ')}`, target });
  };
  const count = (values: (number | null)[]) => values.filter((v) => v !== null).length;

  both(r.place, 'Place', 'step-place');
  both(r.given.label, 'Name of the bars', 'step-measures');
  both(r.hidden.label, 'Name of the line', 'step-measures');
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
    return <p className="admin-ready">{live ? 'Complete. This question is live in the game.' : 'Complete. Saving…'}</p>;
  }
  return (
    <div className="admin-missing">
      <p>
        <strong>Not saved yet.</strong> Fill in these and it saves by itself:
      </p>
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

// How to use the page

const GUIDE_KEY = 'game-admin-guide';

type GuideTab = 'hand' | 'json' | 'change' | 'tips';

const GUIDE: Record<GuideTab, { title: string; steps: ReactNode[]; ordered: boolean }> = {
  hand: {
    title: 'Add by hand',
    ordered: true,
    steps: [
      <>
        Press <b>+ Add a question</b> under the list on the left.
      </>,
      <>
        Fill in steps 1 to 6 of the form. Fields marked <b>Required</b> need both English and Thai.
      </>,
      <>
        For the numbers, type them in, or copy two columns from Excel or Google Sheets, click the first box and press <b>Ctrl+V</b>.
      </>,
      <>
        Write the answer. Select words and press <b>Bold</b> or <b>List</b>.
      </>,
      <>Try the question in the preview. Once nothing is missing, it saves by itself and appears in the game.</>,
    ],
  },
  json: {
    title: 'Add with JSON',
    ordered: true,
    steps: [
      <>
        Press <b>Import JSON</b> at the top.
      </>,
      <>
        Download the <b>template</b> (blank) or the <b>example</b>, and fill it in. Leave out <code>"id"</code> for new questions.
      </>,
      <>
        Choose the file, or paste the text, and press <b>Check</b>.
      </>,
      <>Read the summary: what will be added, changed or skipped, and why.</>,
      <>
        Press <b>Import</b>.
      </>,
    ],
  },
  change: {
    title: 'Change a question',
    ordered: false,
    steps: [
      <>
        <b>By hand:</b> click it in the list and edit. It saves by itself.
      </>,
      <>
        <b>One question as JSON:</b> open it and press <b>Edit as JSON</b>, change the text, then <b>Apply</b>.
      </>,
      <>
        <b>Many at once:</b> press <b>Download all</b>, edit the file, then <b>Import JSON</b> with <b>Add or update</b>. Keep each <code>"id"</code> as it is so
        the right question is changed.
      </>,
      <>
        <b>Made a mistake?</b> Press <b>Earlier versions</b> on the question to bring back one of its last 30 saves.
      </>,
    ],
  },
  tips: {
    title: 'Good to know',
    ordered: false,
    steps: [
      <>Changes save about a second after you stop typing, and the game shows them straight away.</>,
      <>An unfinished question stays in this browser until it is complete. It is not in the game yet.</>,
      <>If two people change the same question, you are asked which version to keep.</>,
      <>Changing the time axis removes numbers for time points that disappear. You are asked first.</>,
    ],
  },
};

function readGuideOpen(): boolean {
  try {
    return localStorage.getItem(GUIDE_KEY) !== 'closed';
  } catch {
    return true;
  }
}

export function useGuideOpen(): [boolean, () => void] {
  const [open, setOpen] = useState(readGuideOpen);
  const toggle = () =>
    setOpen((was) => {
      try {
        localStorage.setItem(GUIDE_KEY, was ? 'closed' : 'open');
      } catch {
        // Only remembers the choice; fine without it
      }
      return !was;
    });
  return [open, toggle];
}

export function Guide({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<GuideTab>('hand');
  const page = GUIDE[tab];
  const List = page.ordered ? 'ol' : 'ul';

  return (
    <section className="admin-card admin-guide">
      <div className="admin-card-head">
        <h2>How to use this page</h2>
        <button type="button" onClick={onClose}>
          Hide
        </button>
      </div>
      <div className="admin-tabs" role="tablist">
        {(Object.keys(GUIDE) as GuideTab[]).map((key) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'is-on' : ''} onClick={() => setTab(key)}>
            {GUIDE[key].title}
          </button>
        ))}
      </div>
      <List className="admin-guide-steps">
        {page.steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </List>
    </section>
  );
}
