import { useEffect, useMemo, useState } from 'react';
import { computeTrend, seriesForView, type View } from '../../core/analysis';
import { fetchPowerMonthly, requestUrl } from '../../core/data/power';
import { START_YEAR, END_YEAR } from '../../core/data/range';
import { useAsync, variableByKey, type Dataset, type SeriesPoint } from '../../core/data';
import { CAPITALS, capitalByCode, type Capital } from '../../core/geo/capitals';
import { useI18n } from '../../core/i18n';
import { splitHash } from '../../core/url';
import { TimeSeriesChart, TrendSummary } from '../../shared';
import { WorldMap } from './WorldMap';
import { GLOBAL_VARIABLES, completeMonthlyRecord } from './data';
import './global.css';

const VIEWS: View[] = ['monthly', 'annual', 'anomaly'];

function initialState() {
  const params = new URLSearchParams(splitHash(window.location.hash).query);
  return {
    country: capitalByCode(params.get('country') ?? '')?.code ?? 'TH',
    variable: GLOBAL_VARIABLES.find((key) => key === params.get('v')) ?? 'T2M',
    view: VIEWS.find((view) => view === params.get('view')) ?? 'annual',
  };
}

export function GlobalExplorer() {
  const { t, language } = useI18n();
  const [state, setState] = useState(initialState);
  const [search, setSearch] = useState('');
  const capital = capitalByCode(state.country)!;
  const filtered = CAPITALS.filter((c) => `${c.country} ${c.city} ${c.code}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  // Keep the current option available while narrowing the country list.
  const options = filtered.some((c) => c.code === capital.code) ? filtered : [capital, ...filtered];

  useEffect(() => {
    const update = () => {
      if (splitHash(window.location.hash).path === '/global') setState(initialState());
    };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  useEffect(() => {
    if (splitHash(window.location.hash).path !== '/global') return;
    const params = new URLSearchParams({ country: state.country, v: state.variable, view: state.view });
    window.history.replaceState(null, '', `#/global?${params}`);
  }, [state]);

  return (
    <section className="global-explorer">
      <header className="global-heading">
        <div><span className="eyebrow">{t('global.eyebrow')}</span><h1>{t('global.title')}</h1><p>{t('global.intro')}</p></div>
        <div className="global-period"><strong>{START_YEAR}—{END_YEAR}</strong><span>{t('global.period')}</span></div>
      </header>
      <p className="global-scope">{t('global.scope')}</p>
      <div className="global-layout">
        <aside className="global-controls card">
          <h2>{t('global.investigate')}</h2>
          <label htmlFor="global-search">{t('global.search')}</label>
          <input id="global-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('global.searchPlaceholder')} />
          <label htmlFor="global-country">{t('global.location')}</label>
          <select id="global-country" value={capital.code} onChange={(event) => setState((s) => ({ ...s, country: event.target.value }))}>
            {options.map((c) => <option key={c.code} value={c.code}>{c.country} · {c.city}</option>)}
          </select>
          <p className="global-search-count" role="status">{t('global.matches', { count: filtered.length })}</p>
          <fieldset><legend>{t('global.variable')}</legend>
            {GLOBAL_VARIABLES.map((key) => {
              const definition = variableByKey(key)!;
              return <label className={`global-variable ${key === state.variable ? 'is-active' : ''}`} key={key}>
                <input type="radio" name="global-variable" value={key} checked={state.variable === key} onChange={() => setState((s) => ({ ...s, variable: key }))} />
                <span>{definition.label[language]}<small>{definition.unit}</small></span>
              </label>;
            })}
          </fieldset>
          <p className="global-controls-note">{t('global.onDemand', { count: CAPITALS.length })}</p>
        </aside>
        <div className="global-content">
          <WorldMap selected={capital} onSelect={(country) => setState((s) => ({ ...s, country }))} />
          <div className="global-result-heading"><div><span className="eyebrow">{capital.country}</span><h2>{capital.city}</h2></div>
            <div className="global-views" role="group" aria-label={t('global.view')}>
              {VIEWS.map((view) => <button key={view} type="button" aria-pressed={view === state.view} onClick={() => setState((s) => ({ ...s, view }))}>{t(`view.${view}`)}</button>)}
            </div>
          </div>
          <GlobalResult key={`${capital.code}:${state.variable}`} capital={capital} variable={state.variable} view={state.view} />
        </div>
      </div>
      <details className="global-methods"><summary>{t('global.about')}</summary><p>{t('global.method')}</p><p>{t('global.annual')}</p><p>{t('global.geography')}</p>
        <a href="https://restcountries.com/" target="_blank" rel="noreferrer">REST Countries</a> · <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noreferrer">Natural Earth</a> · <a href="#/methods">{t('nav.methods')}</a>
        <p className="global-attribution">REST Countries: <a href={`${import.meta.env.BASE_URL}licenses/rest-countries-MPL-2.0.txt`}>MPL-2.0</a> · <a href={`${import.meta.env.BASE_URL}geo/capitals.json`}>{t('global.locationData')}</a></p>
      </details>
    </section>
  );
}

function GlobalResult({ capital, variable, view }: { capital: Capital; variable: string; view: View }) {
  const { t, language } = useI18n();
  const [attempt, setAttempt] = useState(0);
  const result = useAsync(async () => {
    const series = await fetchPowerMonthly({ parameter: variable, lat: capital.lat, lon: capital.lon });
    return completeMonthlyRecord(series);
  }, [capital.code, variable, attempt]);
  if (result.status === 'loading') return <div className="result-state is-loading" role="status"><div className="scan" aria-hidden="true" />{t('state.fetching', { place: capital.city })}</div>;
  if (result.status === 'error') return <div className="result-state is-error" role="alert"><strong>{t('global.fetchFailed')}</strong><p>{t('global.fetchHelp')}</p><button type="button" className="button-secondary" onClick={() => setAttempt((n) => n + 1)}>{t('state.retry')}</button></div>;
  const definition = variableByKey(variable)!;
  return <GlobalChart series={result.data} capital={capital} variable={variable} view={view} label={definition.label[language]} unit={definition.unit} />;
}

function GlobalChart({ series, capital, variable, view, label, unit }: { series: SeriesPoint[]; capital: Capital; variable: string; view: View; label: string; unit: string }) {
  const { t } = useI18n();
  const trend = useMemo(() => computeTrend(series, 'monthly'), [series]);
  const shown = useMemo(() => seriesForView(series, view), [series, view]);
  const dataset: Dataset = {
    id: `global-${capital.code}-${variable}`, variable: { key: variable, label }, unit,
    source: { provider: 'NASA POWER', product: 'Monthly point data' },
    region: { name: capital.city, lat: capital.lat, lon: capital.lon }, resolution: 'monthly', series, trend,
  };
  return <article className="global-result">
    <div className="card"><div className="card-header"><span>{label} ({unit})</span><span className="legend"><i className="legend-line" />{t('chart.observed')}<i className="legend-trend" />{t('chart.trend')}</span></div>
      <TimeSeriesChart series={shown} unit={unit} slopePerStep={trend.slopePerDecade / (view === 'annual' ? 10 : 120)} height={260} />
    </div>
    <TrendSummary dataset={dataset} />
    <p className="global-source"><a href={requestUrl({ parameter: variable, lat: capital.lat, lon: capital.lon })} target="_blank" rel="noreferrer">{t('global.source')}</a><span>{t('global.validMonths', { count: series.filter((p) => p.value !== null).length, total: series.length })}</span></p>
    <p className="global-caution">{t('global.caution')}</p>
  </article>;
}
