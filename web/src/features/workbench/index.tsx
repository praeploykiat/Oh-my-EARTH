import { useMemo, useState } from 'react';
import { analyzeTrend } from '../../core/stats';
import { loadCatalog, loadDataset, useAsync, type Dataset } from '../../core/data';
import { StatusMessage, TimeSeriesChart, TrendSummary } from '../../shared';

export function Workbench() {
  const catalog = useAsync(loadCatalog, []);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  if (catalog.status !== 'ready') return <StatusMessage state={catalog} />;

  const entries = catalog.data.datasets;
  const file = selectedFile ?? entries[0]?.file;

  return (
    <section className="workbench">
      <h1>Workbench</h1>
      <label>
        Dataset{' '}
        <select value={file} onChange={(e) => setSelectedFile(e.target.value)}>
          {entries.map((entry) => (
            <option key={entry.id} value={entry.file}>
              {entry.variable} · {entry.region}
            </option>
          ))}
        </select>
      </label>
      {file && <DatasetView file={file} />}
    </section>
  );
}

function DatasetView({ file }: { file: string }) {
  const dataset = useAsync(() => loadDataset(file), [file]);
  if (dataset.status !== 'ready') return <StatusMessage state={dataset} />;
  return <Analysis dataset={dataset.data} />;
}

function Analysis({ dataset }: { dataset: Dataset }) {
  const [removeSeasonality, setRemoveSeasonality] = useState(true);

  const live = useMemo(() => {
    const values = dataset.series.map((p) => p.value);
    const stepsPerDecade = dataset.resolution === 'monthly' ? 120 : 10;
    const result = analyzeTrend(values, {
      alpha: dataset.trend.alpha,
      seasonalPeriod: removeSeasonality && dataset.resolution === 'monthly' ? 12 : undefined,
    });
    return { ...dataset.trend, slopePerDecade: result.slopePerStep * stepsPerDecade, pValue: result.pValue, significant: result.significant };
  }, [dataset, removeSeasonality]);

  return (
    <>
      <h2>
        {dataset.variable.label} · {dataset.region.name}
      </h2>
      <TimeSeriesChart series={dataset.series} unit={dataset.unit} />
      <label>
        <input type="checkbox" checked={removeSeasonality} onChange={(e) => setRemoveSeasonality(e.target.checked)} />{' '}
        Remove seasonal cycle
      </label>
      <TrendSummary dataset={{ ...dataset, trend: live }} />
    </>
  );
}
