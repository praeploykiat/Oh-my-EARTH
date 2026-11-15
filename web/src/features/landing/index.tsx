import { useEffect, useMemo, useState } from 'react';
import { toAnnual } from '../../core/analysis';
import { fetchPowerMonthly, useAsync } from '../../core/data';
import { useI18n, type MessageKey } from '../../core/i18n';
import { analyzeTrend } from '../../core/stats';
import { fillGuess, HeroChart, type YearPoint } from './HeroChart';

const PLACE = { parameter: 'T2M', lat: 13.75, lon: 100.5 };
const SPLIT_YEAR = 2013;
const MIN_DRAWN_SHARE = 0.6;

const loadBangkok = async (): Promise<YearPoint[]> =>
  toAnnual(await fetchPowerMonthly(PLACE)).flatMap((p) => (p.value === null ? [] : [{ year: Number(p.t), value: p.value }]));

// Hero: draw the rest of a real record

function Hero() {
  const { t } = useI18n();
  const data = useAsync(loadBangkok, []);
  const points = data.status === 'ready' ? data.data : null;
  const split = points ? points.findIndex((p) => p.year >= SPLIT_YEAR) : -1;
  const [guess, setGuess] = useState<(number | null)[]>([]);
  const [revealed, setRevealed] = useState(false);

  const hiddenCount = points && split > 0 ? points.length - split : 0;
  const drawn = guess.filter((v) => v !== null).length;

  const result = useMemo(() => {
    if (!points || split <= 0 || !revealed) return null;
    const trend = analyzeTrend(points.map((p) => p.value));
    const perDecade = trend.slopePerStep * 10;
    const filled = fillGuess(guess, points[split - 1].value);
    const pairs = filled.flatMap((v, i) => (v === null ? [] : [v - points[split + i].value]));
    const gap = pairs.length ? pairs.reduce((sum, d) => sum + d, 0) / pairs.length : 0;
    return { perDecade, significant: trend.significant, gap };
  }, [points, split, revealed, guess]);

  const reset = () => {
    setGuess(Array(hiddenCount).fill(null));
    setRevealed(false);
  };

  useEffect(() => {
    setGuess(Array(hiddenCount).fill(null));
  }, [hiddenCount]);

  const warmest = points ? points.reduce((best, p, i) => (p.value > points[best].value ? i : best), 0) : -1;
  const note = points && warmest >= split ? { index: warmest, text: t('landing.warmest', { year: points[warmest].year }) } : null;

  return (
    <section className="landing-hero">
      <div className="landing-hero-inner">
        <div className="landing-hero-text">
          <h1>{t('landing.title')}</h1>
          <p>{t('landing.lead')}</p>
        </div>

        <div className="landing-ctas">
          <a className="button" href="#/game">
            {t('landing.ctaGame')}
          </a>
          <a className="button button-secondary" href="#/workbench">
            {t('landing.thailandCta')}
          </a>
          <a className="landing-quiet" href="#/global">
            {t('nav.global')}
          </a>
          <a className="landing-quiet" href="#/hotspot">
            {t('nav.hotspot')}
          </a>
        </div>

        <div className="landing-play">
          <p className="landing-play-ask">{t('landing.ask', { last: SPLIT_YEAR - 1 })}</p>
          {points && split > 0 ? (
            <>
              <HeroChart
                points={points}
                split={split}
                unit={t('landing.unit')}
                revealed={revealed}
                guess={guess}
                onGuess={setGuess}
                note={revealed ? note : null}
              />
              <div className="landing-play-foot">
                <div className="landing-legend">
                  <span className="is-known">{t('landing.legendKnown')}</span>
                  <span className="is-guess">{t('landing.legendGuess')}</span>
                  {revealed && <span className="is-real">{t('landing.legendReal')}</span>}
                </div>
                {revealed ? (
                  <button type="button" className="landing-link" onClick={reset}>
                    {t('landing.again')}
                  </button>
                ) : (
                  <button type="button" className="button" disabled={drawn < Math.ceil(hiddenCount * MIN_DRAWN_SHARE)} onClick={() => setRevealed(true)}>
                    {t('landing.reveal')}
                  </button>
                )}
              </div>
              {result && (
                <div className="landing-result" aria-live="polite">
                  <p className="landing-number">
                    {result.perDecade >= 0 ? '+' : '−'}
                    {Math.abs(result.perDecade).toFixed(2)}
                    <span>{t('landing.perDecade')}</span>
                  </p>
                  <div className="landing-result-text">
                    <p className="landing-result-main">
                      {t(result.perDecade >= 0 ? 'landing.warmed' : 'landing.cooled', { value: Math.abs(result.perDecade).toFixed(2) })}
                    </p>
                    <p>
                      {t(result.significant ? 'landing.real' : 'landing.notSure')}{' '}
                      {Math.abs(result.gap) < 0.15
                        ? t('landing.gapClose')
                        : t(result.gap > 0 ? 'landing.gapAbove' : 'landing.gapBelow', { value: Math.abs(result.gap).toFixed(1) })}
                    </p>
                    <p className="landing-bridge">
                      {t('landing.bridge')} <a href="#/game">{t('landing.tryGame')}</a>
                    </p>
                  </div>
                  <span className={`stamp ${result.significant ? '' : 'is-unsure'}`} aria-hidden="true">
                    {t(result.significant ? 'landing.stampReal' : 'landing.stampUnsure')}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="landing-play-wait">
              <p>{data.status === 'error' ? t('landing.offline') : t('landing.loading')}</p>
            </div>
          )}
          <p className="landing-source">{t('landing.chartSource')}</p>
        </div>
      </div>
    </section>
  );
}

// Three ways in

interface Way {
  verb: MessageKey;
  ask: MessageKey;
  title: MessageKey;
  text: MessageKey;
  links: { href: string; label: MessageKey }[];
  art: 'play' | 'see' | 'investigate';
}

const WAYS: Way[] = [
  { verb: 'landing.playVerb', ask: 'landing.playAsk', title: 'nav.game', text: 'landing.playText', links: [{ href: '#/game', label: 'nav.game' }], art: 'play' },
  { verb: 'landing.seeVerb', ask: 'landing.seeAsk', title: 'nav.hotspot', text: 'landing.seeText', links: [{ href: '#/hotspot', label: 'nav.hotspot' }], art: 'see' },
  {
    verb: 'landing.investigateVerb',
    ask: 'landing.investigateAsk',
    title: 'landing.investigateTitle',
    text: 'landing.investigateText',
    links: [
      { href: '#/global', label: 'nav.global' },
      { href: '#/workbench', label: 'nav.workbench' },
    ],
    art: 'investigate',
  },
];

function Art({ kind }: { kind: Way['art'] }) {
  if (kind === 'play') {
    const bars = [2, 3, 5, 9, 14, 12, 15, 18, 17, 10, 5, 3];
    return (
      <svg viewBox="0 0 120 64" className="landing-art" aria-hidden="true">
        {bars.map((h, i) => (
          <rect key={i} x={6 + i * 9.2} y={58 - h * 2.6} width={6} height={h * 2.6} className="art-bar" />
        ))}
        <path d="M6 44 C 30 46, 40 30, 62 14 S 96 20, 114 40" className="art-line" />
      </svg>
    );
  }
  if (kind === 'see') {
    const heat = [0.2, 0.4, 0.3, 0.7, 0.9, 0.5, 0.3, 0.6, 1, 0.8, 0.4, 0.2, 0.3, 0.5, 0.7, 0.4, 0.2, 0.1];
    return (
      <svg viewBox="0 0 120 64" className="landing-art" aria-hidden="true">
        {heat.map((v, i) => (
          <rect key={i} x={6 + (i % 6) * 18.5} y={6 + Math.floor(i / 6) * 18.5} width={16} height={16} rx={2} style={{ opacity: 0.15 + v * 0.85 }} className="art-heat" />
        ))}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 64" className="landing-art" aria-hidden="true">
      <path d="M8 52 L 20 46 L 32 49 L 44 40 L 56 43 L 68 33 L 80 36 L 92 27 L 104 29 L 114 20" className="art-record" />
      <path d="M8 52 L 114 22" className="art-trend" />
      <circle cx={88} cy={14} r={9} className="art-lens" />
      <path d="M94 20 L 104 30" className="art-lens" />
    </svg>
  );
}

function Ways() {
  const { t } = useI18n();
  return (
    <section className="landing-ways" aria-labelledby="ways-title">
      <h2 id="ways-title">{t('landing.waysTitle')}</h2>
      <ol>
        {WAYS.map((way) => (
          <li key={way.verb} className={way.links.length === 1 ? 'is-one' : undefined}>
            <div className="landing-way-art">
              <Art kind={way.art} />
              <span className="landing-verb">{t(way.verb)}</span>
            </div>
            <div className="landing-way-body">
              <h3>{t(way.ask)}</h3>
              <p>{t(way.text)}</p>
            </div>
            <div className="landing-way-links">
              {way.links.map((link) => (
                <a key={link.href} href={link.href}>
                  {t(link.label)}
                </a>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// How the explorers work, and where the data comes from

const STEPS: [MessageKey, MessageKey][] = [
  ['landing.step1', 'landing.step1Text'],
  ['landing.step2', 'landing.step2Text'],
  ['landing.step3', 'landing.step3Text'],
];

const SOURCES = ['NASA POWER', 'NASA GLDAS', 'NASA GPM IMERG', 'NASA MERRA-2', 'GISTDA'];

function How() {
  const { t } = useI18n();
  return (
    <section className="landing-how" aria-labelledby="how-title">
      <h2 id="how-title">{t('landing.howTitle')}</h2>
      <ol>
        {STEPS.map(([title, text], i) => (
          <li key={title}>
            <span className="landing-step-n">{i + 1}</span>
            <h3>{t(title)}</h3>
            <p>{t(text)}</p>
          </li>
        ))}
      </ol>
      <p className="landing-how-more">
        <a href="#/methods">{t('landing.methodsLink')}</a>
      </p>
      <div className="landing-sources">
        <p>{t('landing.sourcesTitle')}</p>
        <ul>
          {SOURCES.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Landing() {
  return (
    <div className="landing">
      <Hero />
      <Ways />
      <How />
    </div>
  );
}
