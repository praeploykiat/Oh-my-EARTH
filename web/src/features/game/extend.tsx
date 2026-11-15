import { useMemo } from 'react';
import { useI18n } from '../../core/i18n';
import { analyzeTrend } from '../../core/stats';
import { Answer, withUnit } from './answer';
import { DrawChart } from './GameChart';
import { fillGaps, niceAxis } from './score';
import { formatTime, timeKind } from './time';
import type { ExtendRound } from './types';

const MIN_TOUCHED_SHARE = 0.5;
const FLAT_SHARE = 0.05;

type Direction = 'up' | 'down' | 'flat';

export interface ExtendFeedback {
  score: number;
  meanError: number;
  direction: { guess: Direction; actual: Direction };
  trend: { perDecade: number; significant: boolean } | null;
}

export const splitIndex = (round: ExtendRound) => round.time.indexOf(round.showUntil);

const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / (values.length || 1);

function lastKnown(values: (number | null)[], before: number): number {
  for (let i = before; i >= 0; i -= 1) if (values[i] !== null) return values[i]!;
  return 0;
}

// Straight-line slope across the part players draw, as the total change over that part
function rise(values: (number | null)[]): number {
  const points = values.flatMap((v, i) => (v === null ? [] : [{ i, v }]));
  if (points.length < 2) return 0;
  const mi = mean(points.map((p) => p.i));
  const mv = mean(points.map((p) => p.v));
  const top = points.reduce((sum, p) => sum + (p.i - mi) * (p.v - mv), 0);
  const bottom = points.reduce((sum, p) => sum + (p.i - mi) ** 2, 0);
  return (top / (bottom || 1)) * (values.length - 1);
}

function directionOf(change: number, flat: number): Direction {
  if (Math.abs(change) <= flat) return 'flat';
  return change > 0 ? 'up' : 'down';
}

// Trend over the whole record, tested the same way as the explorers

export function recordTrend(round: ExtendRound): ExtendFeedback['trend'] {
  const kind = timeKind(round.time);
  if (kind !== 'year' && kind !== 'month') return null;
  const result = analyzeTrend(round.series.values, kind === 'month' ? { seasonalPeriod: 12 } : {});
  if (!Number.isFinite(result.slopePerStep)) return null;
  return { perDecade: result.slopePerStep * (kind === 'month' ? 120 : 10), significant: result.significant };
}

export function scoreExtend(round: ExtendRound, guess: (number | null)[]): { filled: (number | null)[]; feedback: ExtendFeedback } {
  const split = splitIndex(round);
  const from = split + 1;
  const values = round.series.values;
  const axis = niceAxis(values);
  const span = axis.max - axis.min || 1;
  const start = lastKnown(values, split);

  const drawn = fillGaps([start, ...guess.slice(from)]).slice(1);
  const filled = round.time.map((_, i) => (i < from ? null : drawn[i - from]));
  const errors = drawn.flatMap((g, k) => (values[from + k] === null ? [] : [Math.abs(g - values[from + k]!)]));
  const meanError = mean(errors);
  const score = Math.round(Math.max(0, 1 - meanError / (0.3 * span)) * 100);

  const flat = FLAT_SHARE * span;
  const direction = {
    guess: directionOf(rise(drawn), flat),
    actual: directionOf(rise(values.slice(from)), flat),
  };
  return { filled, feedback: { score, meanError, direction, trend: recordTrend(round) } };
}

function signed(value: number): string {
  const digits = Math.abs(value) >= 10 ? 1 : 2;
  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(digits)}`;
}

// One question

interface ExtendRoundViewProps {
  round: ExtendRound;
  kicker: string;
  stats?: string;
  guess: (number | null)[];
  onGuess: (guess: (number | null)[]) => void;
  feedback: ExtendFeedback | null;
  onSubmit: () => void;
  onReset: () => void;
  onSkip?: () => void;
}

export function ExtendRoundView({ round, kicker, stats, guess, onGuess, feedback, onSubmit, onReset, onSkip }: ExtendRoundViewProps) {
  const { language, t } = useI18n();
  const times = useMemo(() => round.time.map((x) => formatTime(x, language)), [round.time, language]);
  const axis = useMemo(() => niceAxis(round.series.values), [round.series.values]);
  const split = splitIndex(round);
  const from = split + 1;
  const measure = round.series.label[language];
  const touched = guess.slice(from).filter((g) => g !== null).length;
  const actual = feedback ? round.series.values.map((v, i) => (i < split ? null : v)) : null;

  return (
    <>
      <header className="game-head">
        <div className="game-meta">
          <p className="game-kicker">
            {kicker} · {round.place[language]}
          </p>
          {stats && <p className="game-stats">{stats}</p>}
        </div>
        <h1>{t('game.extend.question', { measure, until: formatTime(round.showUntil, language, 'long') })}</h1>
      </header>

      <section className="game-step">
        <p className="game-step-label">{feedback ? t('game.stepAnswer') : t('game.stepDraw')}</p>
        <h2 className="game-draw-title">{feedback ? t('game.answerTitle') : t('game.extend.drawTitle')}</h2>
        <DrawChart
          axis={axis}
          times={times}
          title={withUnit(measure, round.series.unit)}
          label={round.timeLabel[language]}
          tip={t('game.extend.tip')}
          guess={guess}
          onGuess={onGuess}
          actual={actual}
          marks={[]}
          shown={round.series.values}
          from={from}
        />
        <div className="game-legend">
          <span className="is-known">{t('game.extend.known')}</span>
          <span className="is-guess">{t('game.yourLine')}</span>
          {feedback && <span className="is-actual">{t('game.realLine')}</span>}
        </div>
        {!feedback && (
          <div className="game-actions">
            <button
              type="button"
              className="button game-done"
              onClick={onSubmit}
              disabled={touched < Math.ceil((round.time.length - from) * MIN_TOUCHED_SHARE)}
            >
              {t('game.submit')}
            </button>
            <button type="button" className="button button-secondary" onClick={onReset}>
              {t('game.startOver')}
            </button>
            {onSkip && (
              <button type="button" className="game-skip" onClick={onSkip}>
                {t('game.skip')}
              </button>
            )}
          </div>
        )}
        {round.source && <p className="game-source">{t('game.source', { source: round.source })}</p>}
      </section>
    </>
  );
}

// Feedback

function TrendLine({ round, trend }: { round: ExtendRound; trend: NonNullable<ExtendFeedback['trend']> }) {
  const { t } = useI18n();
  return (
    <li>
      {t('game.extend.trend', { value: signed(trend.perDecade), unit: round.series.unit })}{' '}
      <em className={trend.significant ? 'is-real' : 'is-unsure'}>{t(trend.significant ? 'game.extend.real' : 'game.extend.unsure')}</em>
    </li>
  );
}

interface ExtendResultProps {
  round: ExtendRound;
  feedback: ExtendFeedback;
  onNext: () => void;
  nextLabel?: string;
}

export function ExtendResult({ round, feedback, onNext, nextLabel }: ExtendResultProps) {
  const { language, t } = useI18n();
  const level = feedback.score >= 80 ? 'great' : feedback.score >= 50 ? 'good' : 'off';
  const headline = t(level === 'great' ? 'game.great' : level === 'good' ? 'game.good' : 'game.tryAgain');
  const right = feedback.direction.guess === feedback.direction.actual;

  return (
    <section className="game-result" aria-live="polite">
      <div className="game-score">
        <strong>{feedback.score}</strong>
        <span>{t('game.outOf')}</span>
      </div>
      <div className="game-feedback">
        <h3>{headline}</h3>
        <ul>
          <li className={right ? 'is-right' : 'is-off'}>
            {t('game.extend.direction', {
              actual: t(`game.extend.dir.${feedback.direction.actual}`),
              guess: t(`game.extend.dir.${feedback.direction.guess}`),
            })}{' '}
            <em>{t(right ? 'game.verdict.right' : 'game.verdict.off')}</em>
          </li>
          <li>{t('game.gap', { value: Math.abs(feedback.meanError) >= 10 ? feedback.meanError.toFixed(0) : feedback.meanError.toFixed(1), unit: round.series.unit })}</li>
          {feedback.trend && <TrendLine round={round} trend={feedback.trend} />}
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
      <span className={`stamp game-stamp is-${level}`} aria-hidden="true">
        {t(`game.stamp.${level}`)}
      </span>
    </section>
  );
}

// What players see after submitting, without a score (admin preview)

export function ExtendPeek({ round }: { round: ExtendRound }) {
  const { language, t } = useI18n();
  const split = splitIndex(round);
  const values = round.series.values;
  if (split < 0) return null;
  const axis = niceAxis(values);
  const actual = directionOf(rise(values.slice(split + 1)), FLAT_SHARE * (axis.max - axis.min || 1));
  const trend = recordTrend(round);

  return (
    <section className="game-result is-peek">
      <div className="game-score">
        <strong>–</strong>
        <span>{t('game.outOf')}</span>
      </div>
      <div className="game-feedback">
        <h3>After players submit</h3>
        <ul>
          <li>Direction: really {t(`game.extend.dir.${actual}`)}</li>
          {trend && <TrendLine round={round} trend={trend} />}
        </ul>
        <div className="game-why">
          <h4>{t('game.why')}</h4>
          <Answer text={round.answer[language]} />
        </div>
        <p className="game-how">{t('game.how')}</p>
      </div>
    </section>
  );
}
