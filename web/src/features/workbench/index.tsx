import { useMemo, useState } from 'react';
import { analyzeTrend } from '../../core/stats';
import { loadCatalog, loadDataset, useAsync, type CatalogEntry, type Dataset } from '../../core/data';
import { useI18n } from '../../core/i18n';
import { SourceNote, StatusMessage, TimeSeriesChart, TrendSummary } from '../../shared';

export function Workbench() {
  const { t } = useI18n();
  const catalog = useAsync(loadCatalog, []);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [removeSeasonality, setRemoveSeasonality] = useState(true);

  if (catalog.status !== 'ready') {
    return (
      <section className="section">
        <StatusMessage state={catalog} />
      </section>
    );
  }

  const entries = catalog.data.datasets;
  const file = selectedFile ?? entries[0]?.file;

  return (
    <section className="section workbench">
      <aside className="panel">
        <span className="eyebrow">{t('workbench.title')}</span>
        <p className="panel-intro">{t('workbench.intro')}</p>

        <span className="field-label">{t('workbench.dataset')}</span>
        <DatasetList entries={entries} selected={file} onSelect={setSelectedFile} />

        <span className="field-label">{t('workbench.options')}</span>
        <label className="toggle">
          <input type="checkbox" checked={removeSeasonality} onChange={(e) => setRemoveSeasonality(e.target.checked)} />
          <span>{t('workbench.removeSeasonality')}</span>
        </label>
      </aside>

      <div className="workbench-main">
        {file && <DatasetView file={file} removeSeasonality={removeSeasonality} />}
      </div>
    </section>
  );
}

// Dataset picker

interface DatasetListProps {
  entries: CatalogEntry[];
  selected: string | undefined;
  onSelect: (file: string) => void;
}

function DatasetList({ entries, selected, onSelect }: DatasetListProps) {
  return (
    <div className="dataset-list" role="listbox">
      {entries.map((entry) => (
        <button
          key={entry.id}
          type="button"
          role="option"
          aria-selected={entry.file === selected}
          className="dataset-option"
          onClick={() => onSelect(entry.file)}
        >
          <strong>{entry.variable}</strong>
          <span>{entry.region}</span>
        </button>
      ))}
    </div>
  );
}

// Analysis

function DatasetView({ file, removeSeasonality }: { file: string; removeSeasonality: boolean }) {
  const dataset = useAsync(() => loadDataset(file), [file]);
  if (dataset.status !== 'ready') return <StatusMessage state={dataset} />;
  return <Analysis dataset={dataset.data} removeSeasonality={removeSeasonality} />;
}

function Analysis({ dataset, removeSeasonality }: { dataset: Dataset; removeSeasonality: boolean }) {
  const { t } = useI18n();
  const stepsPerDecade = dataset.resolution === 'monthly' ? 120 : 10;

  const result = useMemo(
    () =>
      analyzeTrend(
        dataset.series.map((p) => p.value),
        {
          alpha: dataset.trend.alpha,
          seasonalPeriod: removeSeasonality && dataset.resolution === 'monthly' ? 12 : undefined,
        },
      ),
    [dataset, removeSeasonality],
  );

  const analyzed: Dataset = {
    ...dataset,
    trend: {
      ...dataset.trend,
      slopePerDecade: result.slopePerStep * stepsPerDecade,
      pValue: result.pValue,
      significant: result.significant,
    },
  };

  return (
    <>
      <header className="analysis-header">
        <h1>{dataset.variable.label}</h1>
        <div className="chips">
          <span className="chip">{dataset.region.name}</span>
          <span className="chip">
            {dataset.region.lat.toFixed(2)}°, {dataset.region.lon.toFixed(2)}°
          </span>
          <span className="chip">{t(`resolution.${dataset.resolution}`)}</span>
        </div>
      </header>

      <div className="card">
        <div className="card-header">
          <span>{t('chart.title')}</span>
          <span className="legend">
            <i className="legend-line" /> {t('chart.observed')}
            <i className="legend-trend" /> {t('chart.trend')}
          </span>
        </div>
        <TimeSeriesChart series={dataset.series} unit={dataset.unit} slopePerStep={result.slopePerStep} />
      </div>

      <TrendSummary dataset={analyzed} />
      <SourceNote dataset={dataset} />
    </>
  );
}
