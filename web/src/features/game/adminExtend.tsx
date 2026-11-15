import { useEffect, useState, type ClipboardEvent } from 'react';
import { parseNumber } from './adminParts';
import { withUnit } from './answer';
import { ExtendPeek, ExtendResult, ExtendRoundView, scoreExtend, type ExtendFeedback } from './extend';
import { formatTime, yearsBetween } from './time';
import type { ExtendRound } from './types';
import { extendProblem, MIN_SIDE } from './validate';

// A new continue-the-line question: yearly, players see two thirds

export function blankExtend(id: string): ExtendRound {
  const time = yearsBetween(2001, 2024);
  return {
    kind: 'extend',
    id,
    place: { en: '', th: '' },
    time,
    timeLabel: { en: 'Yearly average, 2001 to 2024', th: 'ค่าเฉลี่ยรายปี 2001 ถึง 2024' },
    series: { label: { en: '', th: '' }, unit: '', values: time.map(() => null) },
    showUntil: '2016',
    answer: { en: '', th: '' },
    source: '',
  };
}

// Where players stop seeing and start drawing

export function SplitPicker({ round, onChange }: { round: ExtendRound; onChange: (r: ExtendRound) => void }) {
  const choices = round.time.slice(MIN_SIDE - 1, round.time.length - MIN_SIDE);
  const split = round.time.indexOf(round.showUntil);
  return (
    <label className="admin-field admin-split">
      <span className="admin-label">Players see up to</span>
      <select value={split >= 0 ? round.showUntil : ''} onChange={(e) => onChange({ ...round, showUntil: e.target.value })}>
        {split < 0 && <option value="">Choose a time point</option>}
        {choices.map((t) => (
          <option key={t} value={t}>
            {formatTime(t, 'en', 'long')}
          </option>
        ))}
      </select>
      {split >= 0 && (
        <small>
          They see {split + 1} point{split === 0 ? '' : 's'} and draw the last {round.time.length - split - 1}.
        </small>
      )}
    </label>
  );
}

// Numbers, with the part players draw marked

export function ExtendValues({ round, onChange }: { round: ExtendRound; onChange: (r: ExtendRound) => void }) {
  const split = round.time.indexOf(round.showUntil);

  const setValue = (row: number, value: number | null) => {
    const values = [...round.series.values];
    values[row] = value;
    onChange({ ...round, series: { ...round.series, values } });
  };

  const paste = (event: ClipboardEvent<HTMLInputElement>, row: number) => {
    const text = event.clipboardData.getData('text');
    if (!/[\n\t]/.test(text.trim())) return;
    event.preventDefault();
    const values = [...round.series.values];
    text
      .replace(/\r/g, '')
      .split('\n')
      .filter((line, i, all) => line.trim() !== '' || i < all.length - 1)
      .forEach((line, r) => {
        if (row + r < values.length) values[row + r] = parseNumber(line.split('\t')[0]);
      });
    onChange({ ...round, series: { ...round.series, values } });
  };

  return (
    <div className="admin-field">
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>
                <span className="admin-key is-line" /> {withUnit(round.series.label.en || 'Value', round.series.unit)}
              </th>
              <th>Players</th>
            </tr>
          </thead>
          <tbody>
            {round.time.map((t, row) => (
              <tr key={`${t}-${row}`} className={split >= 0 && row > split ? 'is-guess' : undefined}>
                <td>{formatTime(t, 'en')}</td>
                <td>
                  <input
                    inputMode="decimal"
                    aria-label={`Value ${formatTime(t, 'en')}`}
                    value={round.series.values[row] ?? ''}
                    onChange={(e) => setValue(row, parseNumber(e.target.value))}
                    onPaste={(e) => paste(e, row)}
                  />
                </td>
                <td className="admin-split-cell">{split < 0 ? '' : row > split ? 'draw' : 'see'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Preview

export function ExtendPreview({ round }: { round: ExtendRound }) {
  const [guess, setGuess] = useState<(number | null)[]>(() => round.time.map(() => null));
  const [feedback, setFeedback] = useState<ExtendFeedback | null>(null);
  const ready = extendProblem(round) === null;
  const reset = () => {
    setGuess(round.time.map(() => null));
    setFeedback(null);
  };

  useEffect(reset, [round.id, round.time.length, round.showUntil]);

  if (!ready) return <p className="admin-note">The preview appears once every required field is filled in.</p>;

  return (
    <div className="game admin-preview">
      <ExtendRoundView
        round={round}
        kicker="Preview"
        guess={guess}
        onGuess={setGuess}
        feedback={feedback}
        onSubmit={() => {
          const result = scoreExtend(round, guess);
          setGuess(result.filled);
          setFeedback(result.feedback);
        }}
        onReset={reset}
      />
      {feedback ? <ExtendResult round={round} feedback={feedback} onNext={reset} nextLabel="Try again" /> : <ExtendPeek round={round} />}
    </div>
  );
}

