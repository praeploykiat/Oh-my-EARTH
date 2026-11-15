import { isWaterFlux } from './data';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { View } from '../../core/analysis';
import { START_YEAR, END_YEAR } from '../../core/data/range';
import { useAsync } from '../../core/data';
import { globalVariableByKey as variableByKey,sourceLabel,sourceUrl } from './variables';
import { CAPITALS, capitalByCode, type Capital } from '../../core/geo/capitals';
import { useI18n } from '../../core/i18n';
import { splitHash } from '../../core/url';
import { TimeSeriesChart } from '../../shared';
import { MapExplorer } from './MapExplorer';
import { EXPLORER_VARIABLES, YEARS, parseYearRange, prepareGlobalAnalysis, recordCoverage, completeMonthlyRecord, type GlobalVariable, type YearRange } from './data';
import { resetPublishedCache, PublishedDataUnavailableError } from './publishedCache';
import { fetchExplorerRecord, recordVariable, type ExplorerRecord } from './explorerRecord';
import { useGlobalTrend } from './useGlobalTrend';
import { mapModeLabel, parseMapSettings, type MapMode } from './mapData';
import { SingleYearResult } from './SingleYearResult';
import { Co2TrendChart } from './Co2TrendChart';
import { GlobalTrendSummary } from './GlobalTrendSummary';
import './global.css';

const VIEWS: View[] = ['monthly', 'annual', 'anomaly'];

function co2State(params:URLSearchParams){
  const year=(key:string,fallback:number)=>/^\d{4}$/.test(params.get(key)??'')?Math.max(2015,Math.min(2021,Number(params.get(key)))):fallback;
  const start=year('start',2015),end=year('end',2021);
  return {mode:parseMapSettings(params).mode,year:year('year',2021),start:Math.min(start,end),end:Math.max(start,end)};
}
function initialState() {
  const params = new URLSearchParams(splitHash(window.location.hash).query);
  const variable=EXPLORER_VARIABLES.find((key) => key === params.get('v')) ?? 'T2M';
  return {
    country: capitalByCode(params.get('country') ?? '')?.code ?? 'TH',
    variable,
    view: VIEWS.find((view) => view === params.get('view')) ?? (variable === 'NDVI' ? 'monthly' : 'annual'),
    ...parseYearRange(params),
    ...parseMapSettings(params),
    ...(variable==='XCO2'?{...co2State(params)}:{}),
  };
}

export function GlobalExplorer() {
  const [revision,setRevision]=useState(0);
  const reload=useCallback(()=>{resetPublishedCache();setRevision((n)=>n+1);},[]);
  return <GlobalExplorerPage key={revision} onReload={reload} />;
}

function GlobalExplorerPage({onReload}:{onReload:()=>void}) {
  const { t, language } = useI18n();
  const [state, setState] = useState(initialState);
  const [mapRecord, setMapRecord] = useState<{ code: string; record: ExplorerRecord }>();
  const onRecord = useCallback((code: string, record: ExplorerRecord) => setMapRecord({ code, record }), []);
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
    const params = new URLSearchParams({ country: state.country, v: state.variable, view: state.view, start: String(state.start), end: String(state.end), mode: state.mode, year: String(state.year) });
    window.history.replaceState(null, '', `#/global?${params}`);
  }, [state]);

  return (
    <section className="global-explorer">
      <header className="global-heading">
        <div><span className="eyebrow">{t(state.variable==='XCO2'||state.variable==='AOD'||state.variable==='EVAPOTRANSPIRATION'?'global.giovanni.eyebrow':state.variable==='SOIL_MOISTURE'?'global.gldas.eyebrow':state.variable === 'NDVI' ? 'global.ndvi.eyebrow' : 'global.eyebrow')}</span><h1>{t('global.title')}</h1><p>{t('global.intro')}</p></div>
        <div className="global-period"><strong>{state.mode === 'trend' ? `${state.start}—${state.end}` : state.year}</strong><span>{t(mapModeLabel(state.mode, state.variable))}</span></div>
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
            {EXPLORER_VARIABLES.map((key) => {
              const definition = variableByKey(key)!;
              return <label className={`global-variable ${key === state.variable ? 'is-active' : ''}`} key={key}>
                <input type="radio" name="global-variable" value={key} checked={state.variable === key} onChange={() => setState((s) => ({ ...s, variable: key, view: key === 'NDVI' ? 'monthly' : s.view, ...(key==='XCO2'?{mode:'trend' as MapMode,year:2021,start:2015,end:2021}:s.variable==='XCO2'?{mode:'trend' as MapMode,start:2001,end:2024,year:2024}:{}) }))} />
                <span>{definition.label[language]}<small>{definition.unit}</small></span>
              </label>;
            })}
          </fieldset>
          {state.mode === 'trend' ? <fieldset className="global-range"><legend>{t('global.timeRange')}</legend>
            <label htmlFor="global-start">{t('global.startYear')}</label>
            <select id="global-start" value={state.start} onChange={(event) => {
              const start = Number(event.target.value);
              setState((s) => ({ ...s, start, end: Math.max(start, s.end) }));
            }}>{(state.variable==='XCO2'?YEARS.filter(y=>y>=2015&&y<=2021):YEARS).map((year) => <option key={year} value={year}>{year}</option>)}</select>
            <label htmlFor="global-end">{t('global.endYear')}</label>
            <select id="global-end" value={state.end} onChange={(event) => {
              const end = Number(event.target.value);
              setState((s) => ({ ...s, end, start: Math.min(end, s.start) }));
            }}>{(state.variable==='XCO2'?YEARS.filter(y=>y>=2015&&y<=2021):YEARS).map((year) => <option key={year} value={year}>{year}</option>)}</select>
          </fieldset> : <fieldset className="global-year"><legend>{t('global.map.singleYear')}</legend>
            <label htmlFor="global-year">{t('global.map.year')}</label>
            <select id="global-year" value={state.year} onChange={(event) => setState((s) => ({ ...s, year: Number(event.target.value) }))}>
              {(state.variable==='XCO2'?YEARS.filter(y=>y>=2015&&y<=2021):YEARS).map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </fieldset>}
          <p className="global-range-note">{t('global.rangeAvailable', { start: state.variable==='XCO2'?2015:START_YEAR, end: state.variable==='XCO2'?2021:END_YEAR })}</p>
          {state.variable==='XCO2' && <p className="global-range-note" role="status">{t('global.co2.noInference')}</p>}
          <p className="global-controls-note">{t('cache.controls')}</p>
        </aside>
        <div className="global-content">
          <MapExplorer onReload={onReload} mode={state.mode} year={state.year} onMode={(mode) => setState((s) => ({ ...s, mode }))} recordUpdate={mapRecord} variable={state.variable} range={{ start: state.start, end: state.end }} view={state.view} selected={capital} onSelect={(country) => setState((s) => ({ ...s, country }))} />
          <div className="global-result-heading"><div><span className="eyebrow">{capital.country}</span><h2>{capital.city}</h2></div>
            {state.mode === 'trend' && <div className="global-views" role="group" aria-label={t('global.view')}>
              {VIEWS.map((view) => <button key={view} type="button" aria-pressed={view === state.view} onClick={() => setState((s) => ({ ...s, view }))}>{t(view === 'annual' && isWaterFlux(state.variable) ? 'global.yearlyTotal' : `view.${view}`)}</button>)}
            </div>}
          </div>
          <GlobalResult onReload={onReload} mode={state.mode} year={state.year} onRecord={onRecord} key={`${capital.code}:${state.variable}`} capital={capital} variable={state.variable} view={state.view} range={{ start: state.start, end: state.end }} />
        </div>
      </div>
      <details className="global-methods"><summary>{t('global.about')}</summary><p>{t('global.method')}</p><p>{t('global.annual')}</p>{state.variable==='NDVI' && <p>{t('global.ndvi.quality')}</p>}{state.variable==='SOIL_MOISTURE' && <p>{t('global.gldas.quality')}</p>}<p>{t('global.geography')}</p>
        <a href="https://restcountries.com/" target="_blank" rel="noreferrer">REST Countries</a> · <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noreferrer">Natural Earth</a> · <a href="#/methods">{t('nav.methods')}</a>
        <p className="global-attribution">REST Countries: <a href={`${import.meta.env.BASE_URL}licenses/rest-countries-MPL-2.0.txt`}>MPL-2.0</a> · <a href={`${import.meta.env.BASE_URL}geo/capitals.json`}>{t('global.locationData')}</a></p>
      </details>
    </section>
  );
}

function GlobalResult({ capital, variable, view, range, onRecord, mode, year, onReload }: { onReload:()=>void; mode: MapMode; year: number; onRecord: (code: string, record: ExplorerRecord) => void; capital: Capital; variable: GlobalVariable; view: View; range: YearRange }) {
  const { t, language } = useI18n();
  const [attempt, setAttempt] = useState(0);
  const result = useAsync(() => fetchExplorerRecord(capital, variable, attempt > 0), [capital.code, variable, attempt]);
  useEffect(() => { if (result.status === 'ready') onRecord(capital.code, result.data); }, [result.status === 'ready' ? result.data : null, capital.code, onRecord]);
  if (result.status === 'loading') return <div className="result-state is-loading" role="status"><div className="scan" aria-hidden="true" />{t('cache.loadingCapital', { place: capital.city })}</div>;
  if (result.status === 'error' && result.error instanceof PublishedDataUnavailableError) {
    const code = result.error.available[0];
    const params = new URLSearchParams({ country: code, v: variable, mode, year: String(year), start: String(range.start), end: String(range.end), view: 'monthly' });
    return <div className="result-state" role="status"><p>{t('cache.unavailable')}</p>{code && <a href={`#/global?${params}`}>{t('cache.openAvailable', { city: capitalByCode(code)?.city ?? code })}</a>}</div>;
  }
  if (result.status === 'error') return <div className="result-state is-error" role="alert"><strong>{t('cache.failed')}</strong><p>{t('cache.retryHelp')}</p><a href={sourceUrl(variable,capital)} target="_blank" rel="noreferrer">{t(sourceLabel(variable))}</a><button type="button" className="button-secondary" onClick={() => setAttempt((n) => n + 1)}>{t('state.retry')}</button></div>;
  const definition = variableByKey(variable)!;
  return <>
    {variable==='EVAPOTRANSPIRATION' && result.data.variables.EVAPOTRANSPIRATION?.series.every((p)=>p.value===null) && <p className="global-scope" role="status">{t('global.giovanni.etMissing')}</p>}
    {variable==='SOIL_MOISTURE' && result.data.variables.SOIL_MOISTURE?.series.every((p)=>p.value===null) && <p className="global-scope" role="status">{t('global.gldas.missing')}</p>}
    {mode === 'trend' && variable==='XCO2'?<Co2TrendChart record={result.data} range={range} view={view} city={capital.city}/>:mode === 'trend' ? <GlobalChart record={result.data} capital={capital} variable={variable} view={view} range={range} label={definition.label[language]} monthlyUnit={definition.unit} /> : <SingleYearResult record={result.data} variable={variable} mode={mode} year={year} city={capital.city} />}
    {(variable==='AOD'||variable==='EVAPOTRANSPIRATION') && <p className="global-scope">{t(variable==='AOD'?'global.giovanni.aodNote':'global.giovanni.etNote')}</p>}
    {variable==='XCO2' && <p className="global-scope">{t('global.co2.note')}</p>}
    {variable==='SOIL_MOISTURE' && <p className="global-scope">{t('global.gldas.scope')}</p>}
    {variable === 'NDVI' && <p className="global-scope">{t('global.ndvi.scope')}</p>}
    <QualityPanel record={result.data} range={mode === 'trend' ? range : { start: year, end: year }} onRefresh={onReload} />
  </>;
}

function GlobalChart({ record, capital, variable, view, range, label, monthlyUnit }: { record: ExplorerRecord; capital: Capital; variable: GlobalVariable; view: View; range: YearRange; label: string; monthlyUnit: string }) {
  const { t } = useI18n();
  const analysis = useMemo(() => prepareGlobalAnalysis(recordVariable(record, variable).series, variable, range, view), [record, variable, range.start, range.end, view]);
  const { shown, coverage, completeYears, annualRain } = analysis;
  const inference = useGlobalTrend(analysis.analysisSeries, annualRain, analysis.eligible);
  const trend = inference.status === 'ready' ? inference.result : null;
  const slopePerStep = trend ? trend.slopePerDecade / (view === 'annual' ? 10 : 120) : undefined;
  const unit = analysis.unit ?? monthlyUnit;
  return <article className="global-result">
    <div className="global-coverage" role="status">
      <strong>{range.start}–{range.end}</strong>
      <span>{t('global.validMonths', { count: coverage.valid, total: coverage.total })} ({(coverage.fraction * 100).toFixed(1)}%)</span>
      <span>{t('global.completeYears', { count: completeYears, total: range.end - range.start + 1 })}</span>
    </div>
    <div className="card"><div className="card-header"><span>{label} ({unit})</span><span className="legend"><i className="legend-line" />{t(['SOIL_MOISTURE','AOD','EVAPOTRANSPIRATION'].includes(variable)?'global.gldas.modelled':'chart.observed')}{trend && <><i className="legend-trend" />{t('chart.trend')}</>}</span></div>
      <TimeSeriesChart series={shown} unit={unit} slopePerStep={slopePerStep} height={260} />
    </div>
    <p className="global-aggregation-note">{t(variable==='EVAPOTRANSPIRATION' && view!=='anomaly'?'global.giovanni.etNote':variable === 'NDVI' && view !== 'anomaly' ? view === 'annual' ? 'global.ndvi.meanNote' : 'global.ndvi.monthlyNote' : view === 'annual' ? annualRain ? 'global.rainAggregation' : 'global.meanAggregation' : view === 'anomaly' ? 'global.anomalyBaseline' : 'global.monthlyValues', { start: range.start, end: range.end })}</p>
    {trend ? <GlobalTrendSummary result={trend} unit={unit} variable={label} city={capital.city} start={range.start} end={range.end} />
      : <p className="global-insufficient" role="status">{t(inference.status === 'loading' ? 'global.trend.calculating' : inference.status === 'error' ? 'global.trend.failed' : 'global.insufficient')}</p>}
    <p className="global-analysis-basis">{t(variable==='EVAPOTRANSPIRATION' && annualRain?'global.giovanni.etBasis':annualRain ? 'global.annualTrendBasis' : 'global.monthlyTrendBasis')}</p>
    <p className="global-source"><a href={record.requestUrl} target="_blank" rel="noreferrer">{t(sourceLabel(variable))}</a></p>
    <p className="global-caution">{t('global.caution')}</p>
  </article>;
}

function QualityPanel({ record, range, onRefresh }: { record: ExplorerRecord; range: YearRange; onRefresh: () => void }) {
  const { t, language } = useI18n();
  return <details className="global-quality"><summary>{t(record.source === 'modis' ? 'global.ndvi.qualityTitle' : 'global.qualityTitle')}</summary>
    <p>{t(record.variables.XCO2?'global.co2.quality':record.source==='giovanni'?'global.giovanni.quality':record.source==='gldas'?'global.gldas.quality':record.source === 'modis' ? 'global.ndvi.quality' : 'cache.quality')}</p>
    <div className="global-quality-scroll"><table><caption>{t('global.qualityPeriod', { start: range.start, end: range.end })}</caption><thead><tr>
      <th scope="col">{t('global.variable')}</th><th scope="col">{t('cache.units')}</th><th scope="col">{t('global.valid')}</th><th scope="col">{t('global.missing')}</th><th scope="col">{t('global.rejected')}</th>
    </tr></thead><tbody>{EXPLORER_VARIABLES.filter((key)=>record.variables[key]).map((key) => {
      const data = recordVariable(record, key);
      const coverage = recordCoverage(completeMonthlyRecord(data.series, range));
      const inRange = (month: string) => Number(month.slice(0, 4)) >= range.start && Number(month.slice(0, 4)) <= range.end;
      return <tr key={key}><th scope="row">{variableByKey(key)!.label[language]}</th><td>{data.sourceUnit}</td><td>{coverage.valid}/{coverage.total}</td><td>{data.missing.filter(inRange).length}</td><td>{data.rejected.filter(inRange).length}</td></tr>;
    })}</tbody></table></div>
    {record.cache && <><p>{t('cache.snapshot', { date:new Date(record.cache.publishedAt).toLocaleString(language==='th'?'th-TH':'en-GB') })}</p><a href={`${import.meta.env.BASE_URL}${record.cache.base??'explorer-cache'}/${record.cache.path}`}>{t('cache.download')}</a></>}
    <p>{t('global.retrieved', { date: new Date(record.retrievedAt).toLocaleString(language === 'th' ? 'th-TH' : 'en-GB') })}</p>
    <p>{t('global.requestedCoordinates', { lat: record.requested.lat.toFixed(4), lon: record.requested.lon.toFixed(4) })}<br />
      {t('global.responseCoordinates', { lat: record.responseCoordinates.lat.toFixed(4), lon: record.responseCoordinates.lon.toFixed(4) })}</p>
    {record.sources.length > 0 && <p>{t('source.label')}: {record.sources.join(', ')}</p>}
    <button type="button" className="button-secondary button-compact" onClick={onRefresh}>{t('cache.reload')}</button>
  </details>;
}
