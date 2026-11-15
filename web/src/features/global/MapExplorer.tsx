import { co2Manifest, loadCo2Map } from './co2Cache';
import { isWaterFlux } from './data';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { View } from '../../core/analysis';
import { globalVariableByKey as variableByKey } from './variables';
import { CAPITALS, type Capital } from '../../core/geo/capitals';
import { useI18n } from '../../core/i18n';
import type { GlobalTrendResult } from '../../core/stats/globalTrend';
import type { GlobalVariable, YearRange } from './data';
import { fetchExplorerRecord, type ExplorerRecord } from './explorerRecord';
import { PublishedDataUnavailableError, publishedManifest, loadPublishedMap, hasCachedMap } from './publishedCache';
import { MAP_MODES, mapAnalysis, mapColor, mapModeLabel, mapScale, mapUnit, type MapMode, type MapValue } from './mapData';
import { WorldMap } from './WorldMap';

export function MapExplorer({ selected, onSelect, variable, range, view, recordUpdate, mode, year, onMode, onReload }: { onReload: () => void; mode: MapMode; year: number; onMode: (mode: MapMode) => void; recordUpdate?: { code: string; record: ExplorerRecord }; selected: Capital; onSelect: (code: string) => void; variable: GlobalVariable; range: YearRange; view: View }) {
  const { t, language } = useI18n();
  const [stored, setStored] = useState<Partial<Record<GlobalVariable, Record<string, ExplorerRecord>>>>({});
  const group = variable==='XCO2'?'XCO2':variable === 'NDVI' ? 'NDVI' : variable==='SOIL_MOISTURE'?'SOIL_MOISTURE':variable==='AOD'?'AOD':variable==='EVAPOTRANSPIRATION'?'EVAPOTRANSPIRATION':'T2M';
  const records = stored[group] ?? {};
  const setRecords = (update: (records: Record<string, ExplorerRecord>) => Record<string, ExplorerRecord>) => setStored((all) => ({ ...all, [group]: update(all[group] ?? {}) }));
  const [available, setAvailable] = useState<string[]>([]);
  const [publishedAt, setPublishedAt] = useState('');
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [running, setRunning] = useState(false);
  const generation = useRef(0);
  const annualRain = isWaterFlux(variable) && view === 'annual';
  const key = JSON.stringify([variable, mode, mode === 'trend' ? range : year, annualRain]);
  const wanted = variable==='XCO2' || hasCachedMap(mode,range);
  const [cached, setCached] = useState<{ key: string; values: Record<string,MapValue>; error?: boolean }>({ key:'', values:{} });
  const [trends, setTrends] = useState<{ key:string; values:Record<string,MapValue> }>({ key:'', values:{} });
  const trendCache = useRef(new Map<string,MapValue>());
  useEffect(() => {
    let active=true;
    (variable==='XCO2'?co2Manifest().then(m=>({available:{XCO2:m.capitals.map(r=>r.code!)} as Partial<Record<GlobalVariable,string[]>>,publishedAt:m.publishedAt})):publishedManifest()).then((m)=>{if(active){setAvailable(m.available[variable]??[]);setPublishedAt(m.publishedAt);}}).catch(()=>{});
    return()=>{active=false;};
  },[variable]);
  useEffect(() => {
    if(!wanted)return;
    let active=true;
    (variable==='XCO2'?loadCo2Map(mode,year,range):loadPublishedMap(variable,mode,year,annualRain)).then((values)=>{if(active)setCached({key,values});}).catch(()=>{if(active)setCached({key,values:{},error:true});});
    return()=>{active=false;};
  },[key,wanted]);
  useEffect(() => {
    let active=true;
    fetchExplorerRecord(selected,variable).then((record)=>{if(active)setRecords((r)=>({...r,[selected.code]:record}));})
      .catch((error:unknown)=>{if(active && !(error instanceof PublishedDataUnavailableError))setErrors((e)=>({...e,[selected.code]:true}));});
    return()=>{active=false;};
  },[selected.code,variable]);
  useEffect(()=>{if(recordUpdate?.record.variables[variable])setRecords((r)=>({...r,[recordUpdate.code]:recordUpdate.record}));},[recordUpdate,variable]);
  useEffect(()=>{generation.current++;setRunning(false);setErrors({});return()=>{generation.current++;};},[variable]);
  const analyses=useMemo(()=>wanted?{}:Object.fromEntries(Object.entries(records).map(([code,record])=>[code,mapAnalysis(record,variable,range,view)])),[records,key,wanted]);
  useEffect(()=>{
    if(wanted)return;
    let active=true;let worker:Worker|undefined;let cursor=0;
    const entries=Object.entries(analyses);
    const next=()=>{
      if(!active || cursor===entries.length)return;
      const [code,analysis]=entries[cursor++];
      const cacheKey=`${key}:${code}:${records[code].cache?.releaseId}:${records[code].retrievedAt}`;
      const save=(value:MapValue)=>{if(!active)return;if(!value.failed)trendCache.current.set(cacheKey,value);setTrends((previous)=>({key,values:{...(previous.key===key?previous.values:{}),[code]:value}}));next();};
      const value=trendCache.current.get(cacheKey);if(value){save(value);return;}
      if(!analysis.eligible){save({value:null});return;}
      try {
        worker=new Worker(new URL('./trend.worker.ts',import.meta.url),{type:'module'});
        worker.onmessage=(event:MessageEvent<{result?:GlobalTrendResult}>)=>{worker?.terminate();const r=event.data.result;save(r?{value:r.slopePerDecade,evidence:r.evidence,lower:r.lowerPerDecade,upper:r.upperPerDecade}:{value:null,failed:true});};
        worker.onerror=()=>{worker?.terminate();save({value:null,failed:true});};
        worker.postMessage({values:analysis.analysisSeries.map((p)=>p.value),period:annualRain?1:12});
      }catch{save({value:null,failed:true});}
    };
    next();return()=>{active=false;worker?.terminate();};
  },[analyses,key,wanted]);
  async function loadAll(){
    const run=++generation.current;setRunning(true);
    const queue=CAPITALS.filter((c)=>available.includes(c.code) && !records[c.code]);let cursor=0;
    async function consume(){while(run===generation.current && cursor<queue.length){const capital=queue[cursor++];try{const record=await fetchExplorerRecord(capital,variable);if(run===generation.current)setRecords((r)=>({...r,[capital.code]:record}));}catch{if(run===generation.current)setErrors((e)=>({...e,[capital.code]:true}));}}}
    await Promise.all([consume(),consume()]);if(run===generation.current)setRunning(false);
  }
  const mapReady=wanted && cached.key===key && !cached.error;
  const values=wanted?mapReady?cached.values:{}:trends.key===key?trends.values:{};
  const domain=mapScale(variable,mode,annualRain);
  const unit=mapUnit(variable,mode,variableByKey(variable).unit,annualRain);
  const period=mode==='trend'?`${range.start}–${range.end}`:String(year);
  const painted=Object.values(values).filter((v)=>v.value!==null).length;
  return <div className="global-map-explorer">
    <div className="global-color-controls">
      <div role="group" aria-label={t('global.map.mode')}>{MAP_MODES.map((m) => <button type="button" key={m} aria-pressed={mode === m} onClick={() => onMode(m)}>{t(mapModeLabel(m, variable))}</button>)}</div>
      <button type="button" onClick={() => { if (wanted) { onReload(); return; } if (running) { generation.current++; setRunning(false); } else void loadAll(); }}>{t(wanted ? 'cache.reload' : running ? 'global.map.stop' : 'cache.calculateMap')}</button>
    </div>
    <p className="global-map-progress" role="status">{t('cache.coverage', { count: available.length, total: CAPITALS.length })}</p>
    {wanted ? <p className="global-map-progress" role="status">{t(mapReady ? 'cache.mapReady' : cached.key === key && cached.error ? 'cache.mapError' : 'cache.mapLoading', { count: painted })}</p>
      : <p className="global-map-progress" role="status">{t('global.map.progress', { loaded: Object.keys(records).length, total: available.length, painted, failed: Object.values(errors).filter(Boolean).length })}</p>}
    {publishedAt && <p className="global-map-progress">{t('cache.published', { date: new Date(publishedAt).toLocaleString(language === 'th' ? 'th-TH' : 'en-GB') })}</p>}
    <WorldMap selected={selected} onSelect={onSelect} values={values} unavailable={CAPITALS.filter((c) => !available.includes(c.code)).map((c) => c.code)} mode={mode} domain={domain} unit={unit} period={period} errors={errors} />
    <div className="global-color-legend" aria-label={t('global.map.legend')}>
      <strong>{variableByKey(variable)!.label[language]} · {t(mapModeLabel(mode, variable))} · {period}</strong>
      <span>{unit}{mode === 'trend' ? ` / ${t('global.map.decade')}` : ''}</span>
      <div className="global-color-ramp" style={{ background: `linear-gradient(to right, ${Array.from({ length: 9 }, (_, i) => mapColor(domain[0] + (domain[1] - domain[0]) * i / 8, domain, mode)).join(',')})` }} />
      <div className="global-color-ticks"><span>≤ {domain[0]}</span><span>{(domain[0] + domain[1]) / 2}</span><span>≥ {domain[1]}</span></div>
      <p>{t(variable==='EVAPOTRANSPIRATION' && mode!=='trend'?'global.giovanni.etNote':mode === 'trend' ? variable==='XCO2'?'global.co2.mapNote':'global.map.trendNote' : variable === 'NDVI' ? mode === 'average' ? 'global.ndvi.meanNote' : 'global.ndvi.extremeNote' : mode === 'average' ? isWaterFlux(variable) ? 'global.map.rainNote' : 'global.map.meanNote' : isWaterFlux(variable) ? 'global.map.rainExtremeNote' : 'global.map.extremeNote')}</p>
      <p>{t('global.map.symbols')}</p>
      <p>{t(variable==='XCO2'?'cache.controls':'cache.loadingNote')}</p>
      {variable==='XCO2' && <p>{t('global.co2.note')}</p>}
      {variable==='SOIL_MOISTURE' && <p>{t('global.gldas.scope')}</p>}
    </div>
  </div>;
}
