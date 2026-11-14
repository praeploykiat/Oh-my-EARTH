import { useMemo, useState } from 'react';
import { variableByKey } from '../../core/data';
import { useI18n } from '../../core/i18n';
import { DrawChart, GivenChart } from './GameChart';
import { ROUNDS, type GameRound } from './rounds';
import { fillGaps, judge, niceAxis, type Feedback } from './score';

const MIN_TOUCHED = 6;

function startGuess(round: GameRound): (number | null)[] {
  const guess = Array<number | null>(12).fill(null);
  guess[round.hidden.hint] = round.hidden.values[round.hidden.hint];
  return guess;
}

function useMonths(language: string, style: 'short' | 'long'): string[] {
  return useMemo(() => {
    const format = new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-GB', { month: style });
    return Array.from({ length: 12 }, (_, m) => format.format(new Date(2001, m, 1)));
  }, [language, style]);
}

function formatValue(value: number): string {
  return Math.abs(value) >= 10 ? value.toFixed(0) : value.toFixed(1);
}

// Feedback

interface ResultProps {
  round: GameRound;
  feedback: Feedback;
  unit: string;
  isLast: boolean;
  onNext: () => void;
}

function Result({ round, feedback, unit, isLast, onNext }: ResultProps) {
  const { language, t } = useI18n();
  const months = useMonths(language, 'long');
  const headline = feedback.score >= 80 ? t('game.great') : feedback.score >= 50 ? t('game.good') : t('game.tryAgain');

  return (
    <section className="game-result" aria-live="polite">
      <div className="game-score">
        <strong>{feedback.score}</strong>
        <span>{t('game.outOf')}</span>
      </div>
      <div className="game-feedback">
        <h3>{headline}</h3>
        <ul>
          <li className={`is-${feedback.crest}`}>
            {t('game.peak', { actual: months[feedback.peak.actual], guess: months[feedback.peak.guess] })}{' '}
            <em>{t(`game.verdict.${feedback.crest}`)}</em>
          </li>
          <li className={`is-${feedback.trough}`}>
            {t('game.lowest', { actual: months[feedback.low.actual], guess: months[feedback.low.guess] })}{' '}
            <em>{t(`game.verdict.${feedback.trough}`)}</em>
          </li>
          <li>{t('game.gap', { value: formatValue(feedback.meanError), unit })}</li>
        </ul>
        <div className="game-why">
          <h4>{t('game.why')}</h4>
          <p>{round.why[language]}</p>
        </div>
        <p className="game-how">{t('game.how')}</p>
      </div>
      <button type="button" className="button game-next" onClick={onNext}>
        {isLast ? t('game.finish') : t('game.next')}
      </button>
    </section>
  );
}

function Summary({ scores, onAgain }: { scores: number[]; onAgain: () => void }) {
  const { language, t } = useI18n();
  const total = scores.reduce((a, b) => a + b, 0);

  return (
    <section className="game-card game-summary">
      <p className="game-kicker">{t('game.doneKicker')}</p>
      <h2>{t('game.done', { score: total, max: scores.length * 100 })}</h2>
      <ol className="game-score-list">
        {ROUNDS.map((round, i) => (
          <li key={round.id}>
            <span>
              {variableByKey(round.given.variable)?.label[language]} → {variableByKey(round.hidden.variable)?.label[language]},{' '}
              {round.place[language]}
            </span>
            <strong>{scores[i]}</strong>
          </li>
        ))}
      </ol>
      <div className="game-actions">
        <button type="button" className="button" onClick={onAgain}>
          {t('game.again')}
        </button>
        <a href="#/workbench" className="button button-secondary">
          {t('game.explore')}
        </a>
      </div>
    </section>
  );
}

// Page

export function Game() {
  const { language, t } = useI18n();
  const months = useMonths(language, 'short');
  const [index, setIndex] = useState(0);
  const [guess, setGuess] = useState(() => startGuess(ROUNDS[0]));
  const [results, setResults] = useState<Feedback[]>([]);

  const finished = index >= ROUNDS.length;
  const round = ROUNDS[Math.min(index, ROUNDS.length - 1)];
  const feedback = results[index] ?? null;
  const givenAxis = useMemo(() => niceAxis(round.given.values), [round]);
  const hiddenAxis = useMemo(() => niceAxis(round.hidden.values), [round]);
  const given = variableByKey(round.given.variable)?.label[language] ?? round.given.variable;
  const hidden = variableByKey(round.hidden.variable)?.label[language] ?? round.hidden.variable;
  const touched = guess.filter((g) => g !== null).length;

  const submit = () => {
    const filled = fillGaps(guess);
    setGuess(filled);
    setResults((all) => [...all, judge(filled, round.hidden.values, hiddenAxis)]);
  };

  const go = (next: number) => {
    setIndex(next);
    if (next < ROUNDS.length) setGuess(startGuess(ROUNDS[next]));
  };

  const again = () => {
    setResults([]);
    go(0);
  };

  if (finished) {
    return (
      <div className="game">
        <Summary scores={results.map((r) => r.score)} onAgain={again} />
      </div>
    );
  }

  return (
    <div className="game">
      <header className="game-head">
        <p className="game-kicker">
          {t('game.round', { n: index + 1, total: ROUNDS.length })} · {round.place[language]}
        </p>
        <h1>{t('game.question', { given, hidden, place: round.place[language] })}</h1>
      </header>

      <section className="game-step" key={`${round.id}-given`}>
        <p className="game-step-label">{t('game.stepGiven')}</p>
        <GivenChart
          values={round.given.values}
          axis={givenAxis}
          months={months}
          title={`${given} (${round.given.unit})`}
          label={t('game.monthAxis')}
        />
      </section>

      <section className="game-step" key={`${round.id}-draw`}>
        <p className="game-step-label">{feedback ? t('game.stepAnswer') : t('game.stepDraw')}</p>
        <h2 className="game-draw-title">{feedback ? t('game.answerTitle') : t('game.drawTitle')}</h2>
        <DrawChart
          axis={hiddenAxis}
          months={months}
          title={`${hidden} (${round.hidden.unit})`}
          label={t('game.monthAxis')}
          tip={t('game.tip')}
          hint={{ month: round.hidden.hint, value: round.hidden.values[round.hidden.hint] }}
          guess={guess}
          onGuess={setGuess}
          actual={feedback ? round.hidden.values : null}
          marks={feedback ? [{ month: feedback.peak.actual, text: t('game.realPeak') }] : []}
        />
        {feedback ? (
          <div className="game-legend">
            <span className="is-guess">{t('game.yourLine')}</span>
            <span className="is-actual">{t('game.realLine')}</span>
          </div>
        ) : (
          <div className="game-actions">
            <button type="button" className="button game-done" onClick={submit} disabled={touched < MIN_TOUCHED}>
              {t('game.submit')}
            </button>
            <button type="button" className="button button-secondary" onClick={() => setGuess(startGuess(round))}>
              {t('game.startOver')}
            </button>
          </div>
        )}
      </section>

      {feedback && (
        <Result round={round} feedback={feedback} unit={round.hidden.unit} isLast={index + 1 === ROUNDS.length} onNext={() => go(index + 1)} />
      )}
    </div>
  );
}
