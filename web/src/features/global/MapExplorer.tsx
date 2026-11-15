import { useEffect, useMemo, useRef, useState } from 'react';
import type { View } from '../../core/analysis';
import { variableByKey } from '../../core/data';
import { CAPITALS, type Capital } from '../../core/geo/capitals';
import { useI18n } from '../../core/i18n';
import type { GlobalTrendResult } from '../../core/stats/globalTrend';
import type { GlobalVariable, YearRange } from './data';
import { fetchGlobalRecord, type GlobalRecord } from './powerRecord';
import { MAP_MODES, mapAnalysis, mapColor, mapModeLabel, mapScale, mapUnit, yearSummary, type MapMode, type MapValue } from './mapData';
import { WorldMap } from './WorldMap';

export function MapExplorer({ selected, onSelect, variable, range, view, recordUpdate, mode, year, onMode }: { mode: MapMode; year: number; onMode: (mode: MapMode) => void; recordUpdate?: { code: string; record: GlobalRecord }; selected: Capital; onSelect: (code: string) => void; variable: GlobalVariable; range: YearRange; view: View }) {
  const { t, language } = useI18n();
  const [records, setRecords] = useState<Record<string, GlobalRecord>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [retry, setRetry] = useState(0);
  const [running, setRunning] = useState(false);
  const generation = useRef(0);
  const trendCache = useRef(new Map<string, MapValue>());
  const [trends, setTrends] = useState<{ key: string; values: Record<string, MapValue> }>({ key: '', values: {} });
  const annualRain = variable === 'PRECTOTCORR' && view === 'annual';
  const key = JSON.stringify([variable, range.start, range.end, annualRain]);
  useEffect(() => {
    let active = true;
    fetchGlobalRecord(selected).then((record) => { if (active) setRecords((r) => ({ ...r, [selected.code]: record })); })
      .catch(() => { if (active) setErrors((e) => ({ ...e, [selected.code]: true })); });
    return () => { active = false; };
  }, [selected.code]);
  useEffect(() => {
    if (recordUpdate) {
      setRecords((r) => ({ ...r, [recordUpdate.code]: recordUpdate.record }));
      setErrors((e) => ({ ...e, [recordUpdate.code]: false }));
      setTrends((previous) => { const values = { ...previous.values }; delete values[recordUpdate.code]; return { ...previous, values }; });
    }
  }, [recordUpdate]);
  useEffect(() => () => { generation.current++; }, []);
  const analyses = useMemo(() => Object.fromEntries(Object.entries(records).map(([code, record]) => [code, mapAnalysis(record, variable, range, view)])), [records, key]);
  useEffect(() => {
    if (mode !== 'trend') return;
    let active = true;
    let worker: Worker | undefined;
    const entries = Object.entries(analyses);
    let cursor = 0;
    const next = () => {
      if (!active || cursor === entries.length) return;
      const [code, analysis] = entries[cursor++];
      const cacheKey = `${key}:${code}:${records[code].retrievedAt}`;
      const save = (value: MapValue) => {
        if (!active) return;
        if (!value.failed) trendCache.current.set(cacheKey, value);
        setTrends((previous) => ({ key, values: { ...(previous.key === key ? previous.values : {}), [code]: value } }));
        next();
      };
      const cached = trendCache.current.get(cacheKey);
      if (cached) { save(cached); return; }
      if (!analysis.eligible) { save({ value: null }); return; }
      try {
        worker = new Worker(new URL('./trend.worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (event: MessageEvent<{ result?: GlobalTrendResult }>) => {
          worker?.terminate();
          const result = event.data.result;
          save(result ? { value: result.slopePerDecade, evidence: result.evidence, lower: result.lowerPerDecade, upper: result.upperPerDecade } : { value: null, failed: true });
        };
        worker.onerror = () => { worker?.terminate(); save({ value: null, failed: true }); };
        worker.postMessage({ values: analysis.analysisSeries.map((p) => p.value), period: annualRain ? 1 : 12 });
      } catch { save({ value: null, failed: true }); }
    };
    next();
    return () => { active = false; worker?.terminate(); };
  }, [analyses, key, mode, retry]);
  async function loadAll() {
    const run = ++generation.current;
    setRunning(true);
    setRetry((n) => n + 1);
    const queue = CAPITALS.filter((c) => !records[c.code]);
    let cursor = 0;
    async function consume() {
      while (run === generation.current && cursor < queue.length) {
        const capital = queue[cursor++];
        try {
          const record = await fetchGlobalRecord(capital);
          if (run === generation.current) {
            setRecords((r) => ({ ...r, [capital.code]: record }));
            setErrors((e) => ({ ...e, [capital.code]: false }));
          }
        } catch { if (run === generation.current) setErrors((e) => ({ ...e, [capital.code]: true })); }
      }
    }
    await Promise.all([consume(), consume()]);
    if (run === generation.current) setRunning(false);
  }
  const values: Record<string, MapValue> = useMemo(() => mode === 'trend'
    ? trends.key === key ? trends.values : {}
    : Object.fromEntries(Object.entries(records).map(([code, record]) => [code, yearSummary(record, variable, year, mode)])),
  [mode, trends, key, records, variable, year]);
  const domain = mapScale(variable, mode, annualRain);
  const unit = mapUnit(variable, mode, variableByKey(variable)!.unit, annualRain);
  const period = mode === 'trend' ? `${range.start}–${range.end}` : String(year);
  const painted = Object.values(values).filter((v) => v.value !== null).length;
  return <div className="global-map-explorer">
    <div className="global-color-controls">
      <div role="group" aria-label={t('global.map.mode')}>{MAP_MODES.map((m) => <button type="button" key={m} aria-pressed={mode === m} onClick={() => onMode(m)}>{t(mapModeLabel(m, variable))}</button>)}</div>
      <button type="button" onClick={() => { if (running) { generation.current++; setRunning(false); } else void loadAll(); }}>{t(running ? 'global.map.stop' : 'global.map.load')}</button>
    </div>
    <p className="global-map-progress" role="status">{t('global.map.progress', { loaded: Object.keys(records).length, total: CAPITALS.length, painted, failed: Object.values(errors).filter(Boolean).length })}</p>
    <WorldMap selected={selected} onSelect={onSelect} values={values} mode={mode} domain={domain} unit={unit} period={period} errors={errors} />
    <div className="global-color-legend" aria-label={t('global.map.legend')}>
      <strong>{variableByKey(variable)!.label[language]} · {t(mapModeLabel(mode, variable))} · {period}</strong>
      <span>{unit}{mode === 'trend' ? ` / ${t('global.map.decade')}` : ''}</span>
      <div className="global-color-ramp" style={{ background: `linear-gradient(to right, ${Array.from({ length: 9 }, (_, i) => mapColor(domain[0] + (domain[1] - domain[0]) * i / 8, domain, mode)).join(',')})` }} />
      <div className="global-color-ticks"><span>≤ {domain[0]}</span><span>{(domain[0] + domain[1]) / 2}</span><span>≥ {domain[1]}</span></div>
      <p>{t(mode === 'trend' ? 'global.map.trendNote' : mode === 'average' ? variable === 'PRECTOTCORR' ? 'global.map.rainNote' : 'global.map.meanNote' : variable === 'PRECTOTCORR' ? 'global.map.rainExtremeNote' : 'global.map.extremeNote')}</p>
      <p>{t('global.map.symbols')}</p>
      <p>{t('global.map.loadingNote')}</p>
    </div>
  </div>;
}
