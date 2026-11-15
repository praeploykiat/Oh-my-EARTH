import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { toAnnual } from '../../core/analysis';
import { fetchPowerMonthly, useAsync } from '../../core/data';
import { useI18n, type MessageKey } from '../../core/i18n';
import { analyzeTrend } from '../../core/stats';
import { fillGuess, HeroChart, type YearPoint } from './HeroChart';

// Phuket: a clear, tested warming trend (p < 0.001, NASA POWER T2M, 2001 to 2024)
const PLACE = { parameter: 'T2M', lat: 7.88, lon: 98.39 };
const SPLIT_YEAR = 2013;
const MIN_DRAWN_SHARE = 0.6;

const loadPlace = async (): Promise<YearPoint[]> =>
  toAnnual(await fetchPowerMonthly(PLACE)).flatMap((p) => (p.value === null ? [] : [{ year: Number(p.t), value: p.value }]));

// Hero: draw the rest of a real record

function Hero() {
  const { t } = useI18n();
  const data = useAsync(loadPlace, []);
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
    const total = trend.slopePerStep * (points.length - 1);
    const filled = fillGuess(guess, points[split - 1].value);
    const pairs = filled.flatMap((v, i) => (v === null ? [] : [v - points[split + i].value]));
    const gap = pairs.length ? pairs.reduce((sum, d) => sum + d, 0) / pairs.length : 0;
    return { perDecade, total, significant: trend.significant, gap };
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
    <section className="landing-hero landing-section is-in">
      <div className="landing-hero-inner">
        <div className="landing-hero-text">
          <h1>{t('landing.title')}</h1>
        </div>

        <div className="landing-ctas">
          <a className="button" href="#/game">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M3 1.8v10.4a.6.6 0 0 0 .9.5l8.4-5.2a.6.6 0 0 0 0-1L3.9 1.3a.6.6 0 0 0-.9.5z" fill="currentColor" />
            </svg>
            {t('landing.ctaGame')}
          </a>
          <a className="button button-secondary" href="#/workbench">
            {t('landing.thailandCta')}
          </a>
        </div>

        <div className={`landing-play ${result ? 'is-revealed' : ''}`}>
          <div className="landing-chart-col">
            <p className="landing-chart-title">{t('landing.ask')}</p>
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
                  {revealed ? (
                    <div className="landing-legend">
                      <span className="is-known">{t('landing.legendKnown')}</span>
                      <span className="is-guess">{t('landing.legendGuess')}</span>
                      <span className="is-real">{t('landing.legendReal')}</span>
                    </div>
                  ) : (
                    <button type="button" className="button" disabled={drawn < Math.ceil(hiddenCount * MIN_DRAWN_SHARE)} onClick={() => setRevealed(true)}>
                      {t('landing.reveal')}
                    </button>
                  )}
                  <p className="landing-source">
                    {t('landing.chartSource')}
                    <br />
                    {t('landing.imageCredit')}
                  </p>
                </div>
              </>
            ) : (
              <div className="landing-play-wait">
                <p>{data.status === 'error' ? t('landing.offline') : t('landing.loading')}</p>
              </div>
            )}
          </div>

          <div className="landing-result-col" aria-live="polite">
            {result && (
              <div className="landing-result">
                <span className={`stamp ${result.significant ? '' : 'is-unsure'}`} aria-hidden="true">
                  {t(result.significant ? 'landing.stampReal' : 'landing.stampUnsure')}
                </span>
                <p className="landing-number">
                  {result.total >= 0 ? '+' : '−'}
                  {Math.abs(result.total).toFixed(1)}
                  <span>{t('landing.sinceStart', { year: points![0].year })}</span>
                </p>
                <p className="landing-result-main">
                  {t(result.total >= 0 ? 'landing.warmed' : 'landing.cooled', {
                    total: Math.abs(result.total).toFixed(1),
                    value: Math.abs(result.perDecade).toFixed(2),
                    year: points![0].year,
                  })}
                </p>
                <p>
                  {t(result.significant ? 'landing.real' : 'landing.notSure')}{' '}
                  {Math.abs(result.gap) < 0.15
                    ? t('landing.gapClose')
                    : t(result.gap > 0 ? 'landing.gapAbove' : 'landing.gapBelow', { value: Math.abs(result.gap).toFixed(1) })}
                </p>
                <div className="landing-result-actions">
                  <a className="button" href="#/game">
                    {t('landing.tryGame')}
                  </a>
                  <button type="button" className="landing-link" onClick={reset}>
                    {t('landing.again')}
                  </button>
                </div>
              </div>
            )}
          </div>
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
    <section className="landing-ways landing-section" aria-labelledby="ways-title">
      <h2 id="ways-title">{t('landing.waysTitle')}</h2>
      <p className="landing-ways-lead">{t('landing.waysLead')}</p>
      <ol>
        {WAYS.map((way) => (
          <li key={way.ask} className={way.links.length === 1 ? 'is-one' : undefined}>
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
      <Sources />
    </section>
  );
}

// Where the data comes from, as a slow moving strip

const SOURCES: { name: string; use: MessageKey }[] = [
  { name: 'NASA POWER', use: 'landing.src.power' },
  { name: 'NASA GPM IMERG', use: 'landing.src.imerg' },
  { name: 'NASA GLDAS', use: 'landing.src.gldas' },
  { name: 'NASA MERRA-2', use: 'landing.src.merra' },
  { name: 'NASA OCO-2', use: 'landing.src.oco2' },
  { name: 'GISTDA', use: 'landing.src.gistda' },
];

function Sources() {
  const { t } = useI18n();
  return (
    <div className="landing-sources">
      <p>{t('landing.sourcesTitle')}</p>
      <div className="landing-marquee">
        <div className="landing-marquee-track">
          {[0, 1].map((copy) => (
            <ul key={copy} aria-hidden={copy === 1 ? true : undefined}>
              {SOURCES.map((s) => (
                <li key={s.name}>
                  <strong>{s.name}</strong> {t(s.use)}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </div>
  );
}

// Each section fades in once it scrolls into view

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sections = ref.current?.querySelectorAll('.landing-section:not(.is-in)') ?? [];
    const seen = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          seen.unobserve(entry.target);
        }),
      { threshold: 0.25 },
    );
    sections.forEach((section) => seen.observe(section));
    return () => seen.disconnect();
  }, []);
  return ref;
}

// On larger screens a small wheel move goes to the next or previous part.
// Inside a part taller than the screen, the wheel scrolls normally.

const PAGED = '(min-width: 761px) and (min-height: 640px) and (prefers-reduced-motion: no-preference)';
const SETTLE_MS = 180;
const MOVE_MS = 750;

function useSectionScroll(root: RefObject<HTMLDivElement>) {
  useEffect(() => {
    const query = window.matchMedia(PAGED);
    let busyUntil = 0;
    let lastWheel = 0;

    const stops = () => {
      const header = document.querySelector<HTMLElement>('.header')?.offsetHeight ?? 0;
      const sections = [...(root.current?.querySelectorAll<HTMLElement>('.landing-section') ?? [])];
      const tops = sections.map((s, i) => (i === 0 ? 0 : Math.round(s.getBoundingClientRect().top + window.scrollY - header)));
      const end = document.documentElement.scrollHeight - window.innerHeight;
      return { tops: [...tops, end], sections };
    };

    const onWheel = (event: WheelEvent) => {
      if (!query.matches || event.ctrlKey || Math.abs(event.deltaY) < 4) return;
      const now = Date.now();
      const busy = now < busyUntil || now - lastWheel < SETTLE_MS;
      lastWheel = now;
      if (busy) return event.preventDefault();

      const { tops, sections } = stops();
      const y = window.scrollY;
      const current = tops.reduce((found, top, i) => (top <= y + 4 ? i : found), 0);
      const section = sections[current];
      const down = event.deltaY > 0;

      if (section) {
        const box = section.getBoundingClientRect();
        if (down && box.bottom > window.innerHeight + 4) return;
        if (!down && y > tops[current] + 4) return;
      }
      const target = down ? tops[current + 1] : tops[Math.max(0, current - 1)];
      if (target === undefined || Math.abs(target - y) < 4) return;
      event.preventDefault();
      busyUntil = now + MOVE_MS;
      window.scrollTo({ top: target, behavior: 'smooth' });
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [root]);
}

export function Landing() {
  const ref = useReveal();
  useSectionScroll(ref);
  return (
    <div className="landing" ref={ref}>
      <Hero />
      <Ways />
    </div>
  );
}
