import { useMemo, useState } from 'react';
import { useAsync } from '../../core/data';
import { useI18n } from '../../core/i18n';
import { StatusMessage } from '../../shared';
import { Answer } from './answer';
import { fetchRounds } from './api';
import { DrawChart, GivenChart } from './GameChart';
import { fillGaps, judge, niceAxis, type Feedback } from './score';
import { formatTime, timeKind } from './time';
import type { GameRound } from './types';

const MIN_TOUCHED_SHARE = 0.5;

const emptyGuess = (round: GameRound) => Array<number | null>(round.time.length).fill(null);

function formatValue(value: number): string {
  return Math.abs(value) >= 10 ? value.toFixed(0) : value.toFixed(1);
}

// Feedback

interface ResultProps {
  round: GameRound;
  feedback: Feedback;
  onNext: () => void;
  nextLabel?: string;
}

export function Result({ round, feedback, onNext, nextLabel }: ResultProps) {
  const { language, t } = useI18n();
  const when = (i: number) => formatTime(round.time[i], language, 'long');
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
            {t('game.peak', { actual: when(feedback.peak.actual), guess: when(feedback.peak.guess) })}{' '}
            <em>{t(`game.verdict.${feedback.crest}`)}</em>
          </li>
          <li className={`is-${feedback.trough}`}>
            {t('game.lowest', { actual: when(feedback.low.actual), guess: when(feedback.low.guess) })}{' '}
            <em>{t(`game.verdict.${feedback.trough}`)}</em>
          </li>
          <li>{t('game.gap', { value: formatValue(feedback.meanError), unit: round.hidden.unit })}</li>
        </ul>
        <div className="game-why">
          <h4>{t('game.why')}</h4>
          <Answer text={round.answer[language]} />
        </div>
        <p className="game-how">{t('game.how')}</p>
      </div>
      <button type="button" className="button game-next" onClick={onNext}>
        {nextLabel ?? t('game.next')}
      </button>
    </section>
  );
}

// One question, also used as the admin preview

interface RoundViewProps {
  round: GameRound;
  kicker: string;
  guess: (number | null)[];
  onGuess: (guess: (number | null)[]) => void;
  feedback: Feedback | null;
  onSubmit: () => void;
  onReset: () => void;
}

export function RoundView({ round, kicker, guess, onGuess, feedback, onSubmit, onReset }: RoundViewProps) {
  const { language, t } = useI18n();
  const times = useMemo(() => round.time.map((x) => formatTime(x, language)), [round.time, language]);
  const givenAxis = useMemo(() => niceAxis(round.given.values), [round.given.values]);
  const hiddenAxis = useMemo(() => niceAxis(round.hidden.values), [round.hidden.values]);
  const given = round.given.label[language];
  const hidden = round.hidden.label[language];
  const touched = guess.filter((g) => g !== null).length;

  return (
    <>
      <header className="game-head">
        <p className="game-kicker">
          {kicker} · {round.place[language]}
        </p>
        <h1>{t('game.question', { given, hidden })}</h1>
      </header>

      <section className="game-step">
        <p className="game-step-label">{t('game.stepGiven')}</p>
        <GivenChart
          values={round.given.values}
          axis={givenAxis}
          times={times}
          title={`${given} (${round.given.unit})`}
          label={round.timeLabel[language]}
        />
      </section>

      <section className="game-step">
        <p className="game-step-label">{feedback ? t('game.stepAnswer') : t('game.stepDraw')}</p>
        <h2 className="game-draw-title">{feedback ? t('game.answerTitle') : t('game.drawTitle')}</h2>
        <DrawChart
          axis={hiddenAxis}
          times={times}
          title={`${hidden} (${round.hidden.unit})`}
          label={round.timeLabel[language]}
          tip={t('game.tip')}
          guess={guess}
          onGuess={onGuess}
          actual={feedback ? round.hidden.values : null}
          marks={feedback ? [{ index: feedback.peak.actual, text: t('game.realPeak') }] : []}
        />
        {feedback ? (
          <div className="game-legend">
            <span className="is-guess">{t('game.yourLine')}</span>
            <span className="is-actual">{t('game.realLine')}</span>
          </div>
        ) : (
          <div className="game-actions">
            <button
              type="button"
              className="button game-done"
              onClick={onSubmit}
              disabled={touched < Math.ceil(guess.length * MIN_TOUCHED_SHARE)}
            >
              {t('game.submit')}
            </button>
            <button type="button" className="button button-secondary" onClick={onReset}>
              {t('game.startOver')}
            </button>
          </div>
        )}
        {round.source && <p className="game-source">{t('game.source', { source: round.source })}</p>}
      </section>
    </>
  );
}

export function scoreRound(round: GameRound, guess: (number | null)[]): { filled: number[]; feedback: Feedback } {
  const filled = fillGaps(guess);
  const feedback = judge(filled, round.hidden.values, niceAxis(round.hidden.values), timeKind(round.time) === 'month-of-year');
  return { filled, feedback };
}

// Page

function shuffle(count: number, avoidFirst: number | null): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  if (count > 1 && order[0] === avoidFirst) [order[0], order[1]] = [order[1], order[0]];
  return order;
}

function Play({ rounds }: { rounds: GameRound[] }) {
  const { t } = useI18n();
  const [order, setOrder] = useState(() => shuffle(rounds.length, null));
  const [position, setPosition] = useState(0);
  const [guess, setGuess] = useState(() => emptyGuess(rounds[order[0]]));
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [scores, setScores] = useState<number[]>([]);

  const round = rounds[order[position]];
  const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  const submit = () => {
    const result = scoreRound(round, guess);
    setGuess(result.filled);
    setFeedback(result.feedback);
    setScores((all) => [...all, result.feedback.score]);
  };

  const next = () => {
    let nextOrder = order;
    let nextPosition = position + 1;
    if (nextPosition >= order.length) {
      nextOrder = shuffle(rounds.length, order[position]);
      nextPosition = 0;
      setOrder(nextOrder);
    }
    setPosition(nextPosition);
    setGuess(emptyGuess(rounds[nextOrder[nextPosition]]));
    setFeedback(null);
  };

  return (
    <>
      {average !== null && <p className="game-stats">{t('game.stats', { n: scores.length, average })}</p>}
      <RoundView
        key={`${round.id}-${scores.length + (feedback ? 0 : 1)}`}
        round={round}
        kicker={t('game.question.n', { n: scores.length + (feedback ? 0 : 1) })}
        guess={guess}
        onGuess={setGuess}
        feedback={feedback}
        onSubmit={submit}
        onReset={() => setGuess(emptyGuess(round))}
      />
      {feedback && <Result round={round} feedback={feedback} onNext={next} />}
    </>
  );
}

export function Game() {
  const state = useAsync(fetchRounds, []);
  return (
    <div className="game">
      {state.status === 'ready' ? <Play rounds={state.data.rounds} /> : <StatusMessage state={state} />}
    </div>
  );
}
