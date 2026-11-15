import { capitalByCode, type Capital } from '../../core/geo/capitals';
import { GLOBAL_TREND_METHOD, BOOTSTRAP_REPLICATES, BOOTSTRAP_SEED } from '../../core/stats/globalTrend';
import { completeMonthlyRecord, EXPLORER_VARIABLES, type GlobalVariable, type YearRange } from './data';
import type { MapMode, MapValue } from './mapData';
import type { ExplorerRecord } from './explorerRecord';
import { globalSource,gldasCell,sourceUrl,merraCell,giovanniParameter } from './variables';

export interface FileRef { path: string; sha256: string }
export interface PublishedManifest {
  schemaVersion: 1; releaseId: string; publishedAt: string; period: YearRange;
  method: string; replicates: number; seed: number;
  capitals: Record<string, FileRef>;
  available: Partial<Record<GlobalVariable, string[]>>;
  maps: Partial<Record<GlobalVariable, { annual: Record<string, FileRef>; trend: Record<string, FileRef> }>>;
}
interface StoredVariable {
  unit: string; values: (number | null)[]; missing: string[]; rejected: string[];
  source: 'power' | 'modis' | 'gldas' | 'giovanni'; product: string; productVersion: string; qaPolicy: string; normalizationVersion: string;
  retrievedAt: string; artifactSha256: string; responseCoordinates: { lat: number; lon: number }; sourceUrl: string; sources: string[];
  sourceCoverage?: Record<string,{expected:number;present:number;valid:number}>;
}
interface CapitalFile { schemaVersion: 1; releaseId: string; code: string; requested: { lat: number; lon: number }; variables: Partial<Record<GlobalVariable, StoredVariable>> }
const HASH = /^[a-f0-9]{64}$/;
const UNITS: Record<GlobalVariable, string> = { T2M:'°C', PRECTOTCORR:'mm/day', RH2M:'%', ALLSKY_SFC_SW_DWN:'kWh/m²/day', NDVI:'1', SOIL_MOISTURE:'kg/m²',AOD:'1',EVAPOTRANSPIRATION:'mm/day' };
const LIMITS: Record<GlobalVariable, [number,number]> = { T2M:[-100,70], PRECTOTCORR:[0,1000], RH2M:[0,100], ALLSKY_SFC_SW_DWN:[0,24], NDVI:[-0.2000001,1], SOIL_MOISTURE:[0,100],AOD:[0,100],EVAPOTRANSPIRATION:[-100,100] };
function fileRef(ref: FileRef, release: string) {
  if (!ref || !HASH.test(ref.sha256) || !new RegExp(`^releases/${release}/(?:capitals/[A-Z]{2}|maps/(?:T2M|PRECTOTCORR|RH2M|ALLSKY_SFC_SW_DWN|SOIL_MOISTURE|AOD|EVAPOTRANSPIRATION|NDVI)/(?:annual-20[0-9]{2}|trend-(?:monthly|annual)))\\.json$`).test(ref.path)) throw new Error('Unsafe published file reference');
}
export function validateManifest(value: unknown): PublishedManifest {
  const d=value as PublishedManifest;
  if (!d || d.schemaVersion!==1 || !HASH.test(d.releaseId) || !Number.isFinite(Date.parse(d.publishedAt))
    || d.period?.start!==2001 || d.period?.end!==2024 || d.method!==GLOBAL_TREND_METHOD
    || d.replicates!==BOOTSTRAP_REPLICATES || d.seed!==BOOTSTRAP_SEED || !d.capitals || !d.available || !d.maps) throw new Error('Incompatible published release');
  for (const [code,ref] of Object.entries(d.capitals)) { if (!capitalByCode(code)) throw new Error('Unknown published capital'); fileRef(ref,d.releaseId); }
  if([...Object.keys(d.available),...Object.keys(d.maps)].some((key)=>!EXPLORER_VARIABLES.includes(key as GlobalVariable)))throw new Error('Disabled published source');
  for (const key of EXPLORER_VARIABLES) {
    const codes=d.available[key]; if (!codes) continue;
    if (!Array.isArray(codes) || new Set(codes).size!==codes.length || codes.some((code)=>!d.capitals[code]) || !d.maps[key]) throw new Error('Invalid source coverage');
    for (const ref of [...Object.values(d.maps[key]!.annual),...Object.values(d.maps[key]!.trend)]) fileRef(ref,d.releaseId);
  }
  return d;
}
let manifest: Promise<PublishedManifest> | undefined;
const files=new Map<string, Promise<unknown>>();
export function resetPublishedCache() { manifest=undefined; files.clear(); }
export function publishedManifest() {
  if (!manifest) {
    const pending=fetch(`${import.meta.env.BASE_URL}explorer-cache/manifest.json`,{cache:'no-cache'})
      .then(async (response)=>{if(!response.ok)throw new Error('Published observations unavailable');return validateManifest(await response.json());})
      .catch((error: unknown)=>{if(manifest===pending)manifest=undefined;throw error;});
    manifest=pending;
  }
  return manifest;
}
async function loadFile(ref: FileRef, release: string): Promise<unknown> {
  fileRef(ref,release);
  if (!files.has(ref.path)) {
    const pending=fetch(`${import.meta.env.BASE_URL}explorer-cache/${ref.path}`).then(async (response)=>{
      if(!response.ok)throw new Error('Published file unavailable');
      const buffer=await response.arrayBuffer();
      const digest=await globalThis.crypto.subtle.digest('SHA-256',buffer);
      const hash=Array.from(new Uint8Array(digest),(v)=>v.toString(16).padStart(2,'0')).join('');
      if(hash!==ref.sha256)throw new Error('Published file checksum mismatch');
      const value=JSON.parse(new TextDecoder().decode(buffer)) as {releaseId?:string};
      if(value.releaseId!==release)throw new Error('Mixed published releases');
      return value;
    }).catch((error: unknown)=>{if(files.get(ref.path)===pending)files.delete(ref.path);throw error;});
    files.set(ref.path,pending);
  }
  return files.get(ref.path)!;
}
export class PublishedDataUnavailableError extends Error {
  constructor(public readonly available: string[]) {super('This location has no published observations for the selected variable');}
}
export async function publishedAvailability(variable: GlobalVariable) { return EXPLORER_VARIABLES.includes(variable) ? (await publishedManifest()).available[variable] ?? [] : []; }
export function validateCapital(value: unknown, manifest: PublishedManifest, capital: Capital): CapitalFile {
  const d=value as CapitalFile;
  if (!d || d.schemaVersion!==1 || d.releaseId!==manifest.releaseId || d.code!==capital.code
    || !d.requested || !Number.isFinite(d.requested.lat) || !Number.isFinite(d.requested.lon)
    || Math.abs(d.requested.lat-capital.lat)>0.0001 || Math.abs(d.requested.lon-capital.lon)>0.0001 || !d.variables) throw new Error('Wrong published capital');
  if(Object.keys(d.variables).some((key)=>!EXPLORER_VARIABLES.includes(key as GlobalVariable)))throw new Error('Disabled published variable');
  const months=completeMonthlyRecord([]).map((p)=>p.t);
  for (const key of EXPLORER_VARIABLES) {
    const v=d.variables[key];if(!v)continue;
    const [low,high]=LIMITS[key];
    const cell=key==='AOD'?merraCell(capital):key==='SOIL_MOISTURE'||key==='EVAPOTRANSPIRATION'?gldasCell(capital):capital;
    const tolerance=globalSource(key)==='power'?0.01:0.000001;
    if (v.unit!==UNITS[key] || !Array.isArray(v.values) || v.values.length!==288 || !v.values.every((x)=>x===null || typeof x==='number' && Number.isFinite(x) && x>=low && x<=high)
      || !Array.isArray(v.missing) || !Array.isArray(v.rejected) || !Number.isFinite(Date.parse(v.retrievedAt))
      || v.source!==globalSource(key) || v.qaPolicy!==(key==='AOD'||key==='EVAPOTRANSPIRATION'?'giovanni-monthly-screen-v1':key==='SOIL_MOISTURE'?'gldas-soil-screen-v1':key==='NDVI'?'good-land-clear-v1':'power-screen-v1')
      || (key==='AOD' ? v.product!=='M2T1NXAER' || v.productVersion!=='5.12.4' : key==='SOIL_MOISTURE'||key==='EVAPOTRANSPIRATION' ? v.product!=='GLDAS_NOAH025_M' || v.productVersion!=='2.1' : key==='NDVI' ? v.product!=='MOD13A3' || v.productVersion!=='061' : v.product!=='NASA POWER monthly point RE' || !/^v\d+\.\d+\.\d+$/.test(v.productVersion))
      || v.normalizationVersion!=='monthly-observation-v1' || !HASH.test(v.artifactSha256)
      || !Array.isArray(v.sources) || !v.sources.every((s)=>typeof s==='string')
      || !v.responseCoordinates || !Number.isFinite(v.responseCoordinates.lat) || !Number.isFinite(v.responseCoordinates.lon)
      || Math.abs(v.responseCoordinates.lat-cell.lat)>tolerance || Math.abs(v.responseCoordinates.lon-cell.lon)>tolerance) throw new Error('Invalid published observations');
    const reasons=[...v.missing,...v.rejected];
    if(key==='AOD') {
      if(!v.sourceCoverage || Object.keys(v.sourceCoverage).length!==288)throw new Error('Missing hourly provenance');
      months.forEach((m,i)=>{
        const c=v.sourceCoverage![m];const hours=new Date(Date.UTC(Number(m.slice(0,4)),Number(m.slice(5)),0)).getUTCDate()*24;
        if(!c || c.expected!==hours || !Number.isInteger(c.present) || !Number.isInteger(c.valid) || c.valid<0 || c.valid>c.present || c.present>hours || (v.values[i]!==null)!==(c.valid===hours))throw new Error('Incorrect hourly coverage');
      });
    }
    if(new Set(reasons).size!==reasons.length || reasons.some((m)=>!months.includes(m)) || months.some((m,i)=>(v.values[i]===null)!==reasons.includes(m))) throw new Error('Invalid published quality counts');
    const url=new URL(v.sourceUrl);
    if(url.protocol!=='https:' || !['power.larc.nasa.gov','appeears.earthdatacloud.nasa.gov','api.giovanni.earthdata.nasa.gov'].includes(url.hostname) || url.username || url.password) throw new Error('Invalid source provenance URL');
    if(['SOIL_MOISTURE','AOD','EVAPOTRANSPIRATION'].includes(key) && (url.hostname!=='api.giovanni.earthdata.nasa.gov' || url.pathname!=='/timeseries' || url.searchParams.get('data')!==giovanniParameter(key) || url.searchParams.get('location')!==`[${capital.lat.toFixed(4)},${capital.lon.toFixed(4)}]` || url.searchParams.get('time')!=='2001-01-01T00:00:00/2024-12-31T23:59:59' || [...url.searchParams.keys()].some((k)=>!['data','location','time'].includes(k))))throw new Error('Invalid GLDAS request provenance');
  }
  return d;
}
export async function loadPublishedRecord(capital: Capital, variable: GlobalVariable): Promise<ExplorerRecord> {
  if(!EXPLORER_VARIABLES.includes(variable))throw new Error('NDVI is temporarily disabled');
  const m=await publishedManifest();
  if(!m.available[variable]?.includes(capital.code))throw new PublishedDataUnavailableError(m.available[variable]??[]);
  const d=validateCapital(await loadFile(m.capitals[capital.code],m.releaseId),m,capital);
  const selected=d.variables[variable];if(!selected)throw new Error('Published variable is missing');
  const variables: ExplorerRecord['variables']={};
  for(const key of EXPLORER_VARIABLES) {
    const v=d.variables[key];if(!v || v.source!==selected.source || v.product!==selected.product || v.productVersion!==selected.productVersion)continue;
    variables[key]={series:completeMonthlyRecord([]).map((p,i)=>({...p,value:v.values[i]})),sourceUnit:v.unit,missing:v.missing,rejected:v.rejected};
  }
  return {source:selected.source,variables,requested:d.requested,responseCoordinates:selected.responseCoordinates,retrievedAt:selected.retrievedAt,
    requestUrl:selected.source==='power'?sourceUrl(variable,capital):selected.sourceUrl,sources:selected.sources,raw:d,cache:{releaseId:m.releaseId,publishedAt:m.publishedAt,path:m.capitals[capital.code].path}};
}
export function hasCachedMap(mode: MapMode,range: YearRange) { return mode!=='trend' || range.start===2001 && range.end===2024; }
export async function loadPublishedMap(variable: GlobalVariable,mode: MapMode,year: number,annualRain: boolean): Promise<Record<string,MapValue>> {
  if(!EXPLORER_VARIABLES.includes(variable))throw new Error('NDVI is temporarily disabled');
  const m=await publishedManifest();
  const group=m.maps[variable];if(!group)return {};
  const ref=mode==='trend'?group.trend[annualRain?'annual':'monthly']:group.annual[String(year)];
  if(!ref)throw new Error('Map summary is unavailable');
  const d=await loadFile(ref,m.releaseId) as {schemaVersion:number;variable:string;kind:string;year?:number;range?:YearRange;basis?:string;method?:string;replicates?:number;seed?:number;records:Record<string,MapValue|Record<string,MapValue>>};
  if(d.schemaVersion!==1 || d.variable!==variable || d.kind!==(mode==='trend'?'trend':'annual') || !d.records)throw new Error('Wrong map summary');
  if(mode==='trend' && (d.method!==GLOBAL_TREND_METHOD || d.replicates!==999 || d.seed!==271828 || d.range?.start!==2001 || d.range?.end!==2024 || d.basis!==(annualRain?'annual':'monthly')) || mode!=='trend' && d.year!==year)throw new Error('Wrong map summary period or method');
  if(Object.keys(d.records).length!==(m.available[variable]?.length??0))throw new Error('Incomplete map summary');
  const out:Record<string,MapValue>={};
  for(const [code,entry] of Object.entries(d.records)) {
    const v=(mode==='trend'?entry:(entry as Record<string,MapValue>)[mode]) as MapValue;
    if(!m.available[variable]?.includes(code) || !v || v.value!==null && (typeof v.value!=='number' || !Number.isFinite(v.value)))throw new Error('Invalid map value');
    if(mode==='trend' && v.value!==null && (!['increase','decrease','inconclusive','sensitive','limited'].includes(v.evidence??'') || !Number.isFinite(v.lower) || !Number.isFinite(v.upper) || v.lower!>v.upper!))throw new Error('Invalid map evidence');
    if(v.months && (!Array.isArray(v.months) || v.months.some((month)=>!new RegExp(`^${year}-(0[1-9]|1[0-2])$`).test(month))))throw new Error('Invalid extreme month');
    out[code]=v;
  }
  return out;
}
