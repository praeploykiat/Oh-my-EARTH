import { CAPITALS, type Capital } from '../../core/geo/capitals';
import type { ExplorerRecord } from './explorerRecord';
import type { MapValue, MapMode } from './mapData';
import { merraCell, sourceUrl } from './variables';
import { co2Trend } from './co2Trend';
import { daysInMonth } from './data';

interface Ref {path:string;sha256:string;code?:string;year?:number}
interface Manifest {schemaVersion:1;status:string;releaseId:string;publishedAt:string;product:string;unit:string;trendAvailable:boolean;period:{start:string;end:string};capitals:Ref[];annualMaps:Ref[];descriptiveTrend?:Ref}
interface Stored {capital:Capital;product:string;variable:string;unit:string;retrievedAt:string;artifactSha256:string;responseCoordinates:{lat:number;lon:number};metadata:Record<string,string>;series:{t:string;value:number|null;validDays:number;expectedDays:number}[]}
let manifest:Promise<Manifest>|undefined;
const files=new Map<string,Promise<unknown>>();
const HASH=/^[a-f0-9]{64}$/;
export function resetCo2Cache(){manifest=undefined;files.clear();}
export function co2Manifest(){
  if(!manifest)manifest=fetch(`${import.meta.env.BASE_URL}co2-cache/manifest.json`,{cache:'no-cache'}).then(async r=>{
    if(!r.ok)throw new Error('CO2 cache unavailable');
    const m=await r.json() as Manifest;
    if(m.schemaVersion!==1 || m.status!=='published' || !HASH.test(m.releaseId) || !Number.isFinite(Date.parse(m.publishedAt)) || m.product!=='OCO2_GEOS_L3CO2_DAY.10r' || m.unit!=='ppm' || m.trendAvailable!==false || m.period?.start!=='2015-01' || m.period?.end!=='2022-02' || !Array.isArray(m.capitals) || m.capitals.length!==195 || new Set(m.capitals.map(r=>r.code)).size!==195 || CAPITALS.some(c=>!m.capitals.some(r=>r.code===c.code)) || !Array.isArray(m.annualMaps) || m.annualMaps.length!==7 || m.annualMaps.some((r,i)=>r.year!==2015+i))throw new Error('Incompatible CO2 release');
    for(const ref of [...m.capitals,...m.annualMaps]){
      const suffix=ref.code?`capitals/${ref.code}.json`:`maps/annual-${ref.year}.json`;
      if(!HASH.test(ref.sha256) || ref.path!==`releases/${m.releaseId}/${suffix}`)throw new Error('Unsafe CO2 reference');
    }
    if(m.descriptiveTrend && (!HASH.test(m.descriptiveTrend.sha256) || m.descriptiveTrend.path!==`trends/${m.descriptiveTrend.sha256}.json`))throw new Error('Unsafe descriptive trend reference');
    return m;
  }).catch(e=>{manifest=undefined;throw e;});
  return manifest;
}
async function load(ref:Ref){
  if(!files.has(ref.path))files.set(ref.path,fetch(`${import.meta.env.BASE_URL}co2-cache/${ref.path}`).then(async r=>{
    if(!r.ok)throw new Error('CO2 file unavailable');
    const bytes=await r.arrayBuffer();
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
    if(hash!==ref.sha256)throw new Error('CO2 checksum mismatch');
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  }).catch(e=>{files.delete(ref.path);throw e;}));
  return files.get(ref.path)!;
}
export async function loadCo2Record(capital:Capital):Promise<ExplorerRecord>{
  const m=await co2Manifest(),ref=m.capitals.find(r=>r.code===capital.code)!;
  const d=await load(ref) as Stored,grid=merraCell(capital);
  if(d.product!==m.product || d.variable!=='XCO2' || d.unit!=='ppm' || d.capital?.code!==capital.code || d.capital.lat!==capital.lat || d.capital.lon!==capital.lon || !Number.isFinite(Date.parse(d.retrievedAt)) || !HASH.test(d.artifactSha256) || d.responseCoordinates?.lat!==grid.lat || d.responseCoordinates?.lon!==grid.lon || d.metadata?.unit!=='mol CO2/mol dry' || d.metadata.doi!=='10.5067/Y9M4NM9MPCGH' || d.metadata.param_short_name!=='XCO2' || !Array.isArray(d.series) || d.series.length!==86)throw new Error('Invalid CO2 record');
  d.series.forEach((p,i)=>{
    const year=2015+Math.floor(i/12),month=i%12+1,days=daysInMonth(year,month);
    if(p.t!==`${year}-${String(month).padStart(2,'0')}` || p.expectedDays!==days || !Number.isInteger(p.validDays) || p.validDays<0 || p.validDays>days || (p.value!==null)!==(p.validDays===days) || p.value!==null && (!Number.isFinite(p.value)||p.value<250||p.value>600))throw new Error('Invalid CO2 monthly coverage');
  });
  return {source:'giovanni',requested:capital,responseCoordinates:d.responseCoordinates,retrievedAt:d.retrievedAt,requestUrl:sourceUrl('XCO2',capital),sources:[m.product,'10.5067/Y9M4NM9MPCGH'],raw:d,cache:{releaseId:m.releaseId,publishedAt:m.publishedAt,path:ref.path,base:'co2-cache'},variables:{XCO2:{series:d.series.map(({t,value})=>({t,value})),sourceUnit:'ppm',missing:d.series.filter(p=>p.value===null).map(p=>p.t),rejected:[]}}};
}
export async function loadCo2Map(mode:MapMode,year:number,range={start:2015,end:2021}):Promise<Record<string,MapValue>>{
  if(mode==='trend')return loadCo2TrendMap(range);
  if(year<2015 || year>2021)throw new Error('CO2 supports annual values for 2015–2021');
  const m=await co2Manifest(),ref=m.annualMaps.find(r=>r.year===year)!;
  const d=await load(ref) as {year:number;unit:string;values:Record<string,{annualAverage:number|null;lowestMonth:{month:string;value:number}|null;highestMonth:{month:string;value:number}|null}>};
  if(d.year!==year || d.unit!=='ppm' || !d.values || Object.keys(d.values).length!==195)throw new Error('Invalid CO2 map');
  return Object.fromEntries(CAPITALS.map(c=>{
    const v=d.values[c.code];if(!v)throw new Error('Missing CO2 map capital');
    const extreme=mode==='lowest'?v.lowestMonth:v.highestMonth;
    const value=mode==='average'?v.annualAverage:extreme?.value??null;
    if(value!==null && (!Number.isFinite(value)||value<250||value>600) || extreme && !new RegExp(`^${year}-(0[1-9]|1[0-2])$`).test(extreme.month))throw new Error('Invalid CO2 map value');
    return [c.code,{value,months:mode==='average'||!extreme?[]:[extreme.month]}];
  }));
}

export async function loadCo2TrendMap(range:{start:number;end:number}):Promise<Record<string,MapValue>>{
  // Validate even when no capital data have been loaded yet.
  co2Trend([],range);
  const m=await co2Manifest();
  if(range.start===2015 && range.end===2021 && m.descriptiveTrend){
    const d=await load(m.descriptiveTrend) as {sourceReleaseId:string;method:string;records:Record<string,MapValue>};
    if(d.sourceReleaseId!==m.releaseId || d.method!=='descriptive-seasonal-sen-v1' || !d.records || Object.keys(d.records).length!==195)throw new Error('Invalid descriptive trend map');
    for(const c of CAPITALS){const v=d.records[c.code];if(!v || v.descriptive!==true || v.evidence!=='limited' || typeof v.value!=='number' || !Number.isFinite(v.value) || v.lower!==undefined || v.upper!==undefined)throw new Error('Invalid descriptive slope');}
    return d.records;
  }
  const records:Record<string,MapValue>={};let cursor=0;
  async function consume(){while(cursor<CAPITALS.length){const c=CAPITALS[cursor++];const r=await loadCo2Record(c);records[c.code]={value:co2Trend(r.variables.XCO2!.series,range),evidence:'limited',descriptive:true};}}
  await Promise.all([consume(),consume()]);return records;
}
