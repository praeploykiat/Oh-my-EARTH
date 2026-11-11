import { useState } from 'react';
import { loadDataset, useAsync } from '../../core/data';
import { useI18n, type MessageKey } from '../../core/i18n';
import { SourceNote, StatusMessage, TimeSeriesChart, TrendSummary } from '../../shared';

const FEATURED_DATASET = 'phangnga-t2m.json';

const STEPS: Array<{ title: MessageKey; body: MessageKey }> = [
  { title: 'landing.step1.title', body: 'landing.step1.body' },
  { title: 'landing.step2.title', body: 'landing.step2.body' },
  { title: 'landing.step3.title', body: 'landing.step3.body' },
];

type Stage = 'intro' | 'play' | 'reveal';

export function Experience() {
  const [stage, setStage] = useState<Stage>('intro');

  return (
    <>
      {stage === 'intro' && <Landing onStart={() => setStage('play')} />}
      {stage === 'play' && <Play onFinish={() => setStage('reveal')} />}
      {stage === 'reveal' && <Reveal onRestart={() => setStage('intro')} />}
    </>
  );
}

// Landing

function Landing({ onStart }: { onStart: () => void }) {
  const { t } = useI18n();

  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <span className="eyebrow">{t('landing.eyebrow')}</span>
          <h1 className="hero-title">{t('landing.title')}</h1>
          <p className="hero-lead">{t('landing.lead')}</p>
          <div className="actions">
            <button onClick={onStart}>{t('landing.start')} →</button>
            <a className="button button-secondary" href="#/workbench">
              {t('landing.openWorkbench')}
            </a>
          </div>
        </div>
      </section>

      <section className="section">
        <span className="eyebrow">{t('landing.howTitle')}</span>
        <div className="steps">
          {STEPS.map((step, i) => (
            <article key={step.title} className="card step">
              <span className="step-number">{String(i + 1).padStart(2, '0')}</span>
              <h3>{t(step.title)}</h3>
              <p>{t(step.body)}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

// Play

function Play({ onFinish }: { onFinish: () => void }) {
  const { t } = useI18n();

  return (
    <section className="section">
      <span className="eyebrow">{t('experience.play')}</span>
      <div className="card placeholder">
        <p>{t('experience.playPlaceholder')}</p>
        <button onClick={onFinish}>{t('experience.finish')} →</button>
      </div>
    </section>
  );
}

// Reveal

function Reveal({ onRestart }: { onRestart: () => void }) {
  const { t } = useI18n();
  const dataset = useAsync(() => loadDataset(FEATURED_DATASET), []);

  if (dataset.status !== 'ready') {
    return (
      <section className="section">
        <StatusMessage state={dataset} />
      </section>
    );
  }

  const data = dataset.data;
  const stepsPerDecade = data.resolution === 'monthly' ? 120 : 10;

  return (
    <section className="section">
      <span className="eyebrow">{data.region.name}</span>
      <h2>{t('experience.revealTitle')}</h2>
      <div className="card">
        <TimeSeriesChart series={data.series} unit={data.unit} slopePerStep={data.trend.slopePerDecade / stepsPerDecade} />
      </div>
      <TrendSummary dataset={data} />
      <SourceNote dataset={data} />
      <div className="actions">
        <a className="button" href="#/workbench">
          {t('experience.investigate')} →
        </a>
        <button className="button-secondary" onClick={onRestart}>
          {t('experience.playAgain')}
        </button>
      </div>
    </section>
  );
}
