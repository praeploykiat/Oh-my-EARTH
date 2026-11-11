import { useState } from 'react';
import { loadDataset, useAsync } from '../../core/data';
import { useI18n } from '../../core/i18n';
import { StatusMessage, TimeSeriesChart, TrendSummary } from '../../shared';

const FEATURED_DATASET = 'phangnga-t2m.json';

type Stage = 'intro' | 'play' | 'reveal';

export function Experience() {
  const [stage, setStage] = useState<Stage>('intro');

  return (
    <section className="experience">
      {stage === 'intro' && <Intro onStart={() => setStage('play')} />}
      {stage === 'play' && <Play onFinish={() => setStage('reveal')} />}
      {stage === 'reveal' && <Reveal onRestart={() => setStage('intro')} />}
    </section>
  );
}

function Intro({ onStart }: { onStart: () => void }) {
  const { t } = useI18n();
  return (
    <>
      <h1>{t('experience.title')}</h1>
      <p>{t('experience.placeholder')}</p>
      <button onClick={onStart}>{t('experience.start')}</button>
    </>
  );
}

function Play({ onFinish }: { onFinish: () => void }) {
  const { t } = useI18n();
  return (
    <>
      <h2>{t('experience.play')}</h2>
      <p>{t('experience.playPlaceholder')}</p>
      <button onClick={onFinish}>{t('experience.finish')}</button>
    </>
  );
}

function Reveal({ onRestart }: { onRestart: () => void }) {
  const { t } = useI18n();
  const dataset = useAsync(() => loadDataset(FEATURED_DATASET), []);
  if (dataset.status !== 'ready') return <StatusMessage state={dataset} />;

  return (
    <>
      <h2>{t('experience.revealTitle')}</h2>
      <TimeSeriesChart series={dataset.data.series} unit={dataset.data.unit} />
      <TrendSummary dataset={dataset.data} />
      <div className="actions">
        <button onClick={onRestart}>{t('experience.playAgain')}</button>
        <a href="#/workbench">{t('experience.investigate')}</a>
      </div>
    </>
  );
}
