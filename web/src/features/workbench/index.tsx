import { useMemo, useState } from 'react';
import { analyzeTrend } from '../../core/stats';
import { loadCatalog, loadDataset, useAsync, type CatalogEntry, type Dataset } from '../../core/data';
import { provinceByCode, type Place } from '../../core/geo';
import { useI18n } from '../../core/i18n';
import { ProvinceSelect, SourceNote, StatusMessage, ThailandMap, TimeSeriesChart, TrendSummary } from '../../shared';

type Selection = { kind: 'dataset'; file: string } | { kind: 'place'; place: Place };

export function Workbench() {
  const { t } = useI18n();
  const catalog = useAsync(loadCatalog, []);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [removeSeasonality, setRemoveSeasonality] = useState(true);

  if (catalog.status !== 'ready') {
    return (
      <section className="section">
        <StatusMessage state={catalog} />
      </section>
    );
  }

  const entries = catalog.data.datasets;
  const active: Selection | null = selection ?? (entries[0] ? { kind: 'dataset', file: entries[0].file } : null);
  const selectPlace = (place: Place) => setSelection({ kind: 'place', place });

  return (
    <section className="section workbench">
      <aside className="panel">
        <span className="eyebrow">{t('workbench.title')}</span>
        <p className="panel-intro">{t('workbench.intro')}</p>

        <span className="field-label">{t('workbench.location')}</span>
        <ProvinceSelect
          value={active?.kind === 'place' ? active.place.provinceCode : null}
          onSelectPlace={selectPlace}
        />
        <ThailandMap selected={active?.kind === 'place' ? active.place : null} onSelectPlace={selectPlace} />

        <span className="field-label">{t('workbench.dataset')}</span>
        <DatasetList
          entries={entries}
          selected={active?.kind === 'dataset' ? active.file : undefined}
          onSelect={(file) => setSelection({ kind: 'dataset', file })}
        />

        <span className="field-label">{t('workbench.options')}</span>
        <label className="toggle">
          <input type="checkbox" checked={removeSeasonality} onChange={(e) => setRemoveSeasonality(e.target.checked)} />
          <span>{t('workbench.removeSeasonality')}</span>
        </label>
      </aside>

      <div className="workbench-main">
        {active?.kind === 'dataset' && <DatasetView file={active.file} removeSeasonality={removeSeasonality} />}
        {active?.kind === 'place' && <PlaceView place={active.place} />}
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

// Place view

function PlaceView({ place }: { place: Place }) {
  const { language, t } = useI18n();
  const province = place.provinceCode ? provinceByCode(place.provinceCode) : undefined;

  return (
    <>
      <header className="analysis-header">
        <h1>{province ? province[language] : t('workbench.customLocation')}</h1>
        <div className="chips">
          <span className="chip">
            {place.lat.toFixed(2)}°, {place.lon.toFixed(2)}°
          </span>
          {place.provinceCode && <span className="chip">{place.provinceCode}</span>}
        </div>
      </header>
      <div className="card placeholder">
        <span className="eyebrow">{t('workbench.liveTitle')}</span>
        <p>{t('workbench.liveBody')}</p>
      </div>
    </>
  );
}

// Dataset analysis

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
