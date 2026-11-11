import { useState } from 'react';
import { loadDataset, useAsync } from '../../core/data';
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
  return (
    <>
      <h1>Experience</h1>
      <p>Placeholder for the interactive story. Design is still in progress.</p>
      <button onClick={onStart}>Start</button>
    </>
  );
}

function Play({ onFinish }: { onFinish: () => void }) {
  return (
    <>
      <h2>Play</h2>
      <p>Game mechanics will be driven by the dataset values.</p>
      <button onClick={onFinish}>Finish</button>
    </>
  );
}

function Reveal({ onRestart }: { onRestart: () => void }) {
  const dataset = useAsync(() => loadDataset(FEATURED_DATASET), []);
  if (dataset.status !== 'ready') return <StatusMessage state={dataset} />;

  return (
    <>
      <h2>What you just lived through</h2>
      <TimeSeriesChart series={dataset.data.series} unit={dataset.data.unit} />
      <TrendSummary dataset={dataset.data} />
      <div className="actions">
        <button onClick={onRestart}>Play again</button>
        <a href="#/workbench">Investigate yourself</a>
      </div>
    </>
  );
}
