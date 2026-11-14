import { useMemo, useState } from 'react';
import { compareDecades, seriesForView, slopeDecimals, stepsPerDecade, valueDecimals, verdictKeys, type View } from '../../core/analysis';
import { NoDataError, resolveQuery, useAsync, variableByKey, type Dataset, type Origin } from '../../core/data';
import type { Place } from '../../core/geo';
import { useI18n } from '../../core/i18n';
import { saveCaseImage, SourceNote, TimeSeriesChart, TrendSummary, type ChartBand } from '../../shared';
import { placeName } from './placeName';
import { ShareMenu } from './ShareMenu';

interface ResultPanelProps {
  variable: string;
  place: Place;
  view: View;
}

export function ResultPanel({ variable, place, view }: ResultPanelProps) {
  const { language, t } = useI18n();
  const [attempt, setAttempt] = useState(0);
  const result = useAsync(() => resolveQuery({ variable, place }), [variable, place.lat, place.lon, attempt]);
  const name = placeName(place, language);

  if (result.status === 'loading') {
    return (
      <div className="result-state is-loading" role="status">
        <div className="scan" aria-hidden="true" />
        <span>{t('state.fetching', { place: name })}</span>
      </div>
    );
  }

  if (result.status === 'error') {
    const known = result.error instanceof NoDataError;
    return (
      <div className="result-state is-error" role="alert">
        <strong>{t(known ? 'state.noData' : 'state.failed')}</strong>
        <button type="button" className="button-secondary button-compact" onClick={() => setAttempt((n) => n + 1)}>
          {t('state.retry')}
        </button>
      </div>
    );
  }

  return <Result dataset={result.data.dataset} origin={result.data.origin} place={place} view={view} />;
}

// Result

interface ResultProps {
  dataset: Dataset;
  origin: Origin;
  place: Place;
  view: View;
}

function Result({ dataset, origin, place, view }: ResultProps) {
  const { language, t } = useI18n();
  const definition = variableByKey(dataset.variable.key);
  const variableLabel = definition ? definition.label[language] : dataset.variable.label;
  const name = placeName(place, language);
  const startYear = dataset.series[0]?.t.slice(0, 4) ?? '';

  const shown = useMemo(() => seriesForView(dataset.series, view), [dataset.series, view]);
  const decades = useMemo(() => compareDecades(dataset.series), [dataset.series]);
  const digits = valueDecimals(dataset.series);

  const slopePerMonth = dataset.trend.slopePerDecade / stepsPerDecade('monthly');
  const slopePerStep = view === 'annual' ? slopePerMonth * 12 : slopePerMonth;

  const bands: ChartBand[] = useMemo(() => {
    if (!decades || view === 'anomaly') return [];
    const indexOfYear = (year: string, last: boolean) => {
      const indices = shown.map((p, i) => (p.t.startsWith(year) ? i : -1)).filter((i) => i >= 0);
      return last ? indices[indices.length - 1] : indices[0];
    };
    return [decades.first, decades.last].map((decade) => ({
      from: indexOfYear(decade.from, false),
      to: indexOfYear(decade.to, true),
      value: decade.mean,
      label: decade.mean.toFixed(digits),
    }));
  }, [decades, shown, view, digits]);

  const verdict = verdictKeys(dataset.trend, slopeDecimals(dataset.series));
  const sentence = t(verdict.direction, {
    variable: variableLabel,
    place: name,
    value: verdict.value,
    unit: dataset.unit,
    year: startYear,
  });

  const confidence = verdict.direction !== 'verdict.flat' ? t(verdict.confidence) : '';
  const badge = t(dataset.trend.significant ? 'badge.real' : 'badge.notProven');

  const saveImage = () =>
    saveCaseImage({
      eyebrow: `${variableLabel}, ${name}`,
      title: sentence,
      subtitle: confidence,
      badge,
      series: shown,
      slopePerStep,
      source: `${t('source.label')}: ${dataset.source.provider}, ${dataset.source.product}`,
      footer: 'Earth Trend Detective by Far Side of the Moon',
      fileName: `trend-${dataset.variable.key.toLowerCase()}-${name.toLowerCase().replace(/\s+/g, '-')}.png`,
    }).catch(() => undefined);

  return (
    <article className="result">
      <header className="result-header">
        <div className="result-meta">
          <span className="eyebrow">{name}</span>
          <span className={`result-badge ${dataset.trend.significant ? 'is-real' : ''}`}>{badge}</span>
        </div>
        <p className="verdict">
          {sentence}
          {confidence && <span className="verdict-confidence"> {confidence}</span>}
        </p>
      </header>

      {origin === 'saved' && <p className="notice">{t('state.saved')}</p>}

      <div className="card">
        <div className="card-header">
          <span>
            {variableLabel} ({dataset.unit})
          </span>
          <span className="legend">
            <i className="legend-line" /> {t('chart.observed')}
            <i className="legend-trend" /> {t('chart.trend')}
            {bands.length > 0 && (
              <>
                <i className="legend-band" /> {t('chart.decadeMean')}
              </>
            )}
          </span>
        </div>
        <TimeSeriesChart series={shown} unit={dataset.unit} slopePerStep={slopePerStep} bands={bands} height={210} />
      </div>

      <TrendSummary dataset={dataset} />

      {decades && (
        <div className="decades">
          <div>
            <span className="control-label">
              {t('range', { from: decades.first.from, to: decades.first.to })}
            </span>
            <strong>
              {decades.first.mean.toFixed(digits)} {dataset.unit}
            </strong>
          </div>
          <span className="decades-arrow" aria-hidden="true">
            →
          </span>
          <div>
            <span className="control-label">
              {t('range', { from: decades.last.from, to: decades.last.to })}
            </span>
            <strong>
              {decades.last.mean.toFixed(digits)} {dataset.unit}
            </strong>
          </div>
          <div className="decades-change">
            <span className="control-label">{t('decades.change')}</span>
            <strong>
              {decades.change >= 0 ? '+' : '−'}
              {Math.abs(decades.change).toFixed(digits)} {dataset.unit}
            </strong>
          </div>
        </div>
      )}

      <div className="result-actions">
        <ShareMenu text={sentence} />
        <button type="button" className="button-secondary button-compact" onClick={saveImage}>
          ↓ {t('chart.saveImage')}
        </button>
      </div>

      <SourceNote dataset={dataset} origin={origin} />
    </article>
  );
}
