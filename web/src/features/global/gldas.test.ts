import { describe,expect,it } from 'vitest';
import { capitalByCode } from '../../core/geo/capitals';
import { completeMonthlyRecord,prepareGlobalAnalysis } from './data';
import type { ExplorerRecord } from './explorerRecord';
import { yearSummary,mapScale,mapUnit } from './mapData';
import { validateCapital,type PublishedManifest } from './publishedCache';
import { gldasCell,sourceUrl } from './variables';

const capital=capitalByCode('TH')!;
const record:ExplorerRecord={source:'gldas',requested:capital,responseCoordinates:gldasCell(capital),retrievedAt:'2026-11-15T00:00:00Z',requestUrl:sourceUrl('SOIL_MOISTURE',capital),sources:['GLDAS Noah 2.1'],raw:null,
  variables:{SOIL_MOISTURE:{series:completeMonthlyRecord([]).map((p)=>({...p,value:p.t.endsWith('-01')?10:p.t.endsWith('-02')?20:30})),sourceUnit:'kg/m²',missing:[],rejected:[]}}};

describe('GLDAS soil moisture semantics',()=>{
  it('uses day-weighted means and matching-month seasonal inference, preserving mass units',()=>{
    expect(yearSummary(record,'SOIL_MOISTURE',2024,'average').value).toBe((31*10+29*20+306*30)/366);
    expect(yearSummary(record,'SOIL_MOISTURE',2024,'lowest').months).toEqual(['2024-01']);
    expect(yearSummary(record,'SOIL_MOISTURE',2024,'highest').months).toHaveLength(10);
    const analysis=prepareGlobalAnalysis(record.variables.SOIL_MOISTURE!.series,'SOIL_MOISTURE',{start:2001,end:2024},'annual');
    expect(analysis.annualRain).toBe(false);expect(analysis.analysisSeries).toHaveLength(288);
    expect(mapUnit('SOIL_MOISTURE','average','kg/m²',true)).toBe('kg/m²');
    expect(mapScale('SOIL_MOISTURE','average',false)).toEqual([0,50]);
    expect(mapScale('SOIL_MOISTURE','trend',false)).toEqual([-5,5]);
  });
  it('validates the source model cell and parameter, rejecting neighbour fallback or leaked credentials',()=>{
    const releaseId='a'.repeat(64);const manifest={releaseId} as PublishedManifest;
    const raw={schemaVersion:1,releaseId,code:'TH',requested:{lat:capital.lat,lon:capital.lon},variables:{SOIL_MOISTURE:{unit:'kg/m²',values:Array(288).fill(35),missing:[],rejected:[],source:'gldas',product:'GLDAS_NOAH025_M',productVersion:'2.1',qaPolicy:'gldas-soil-screen-v1',normalizationVersion:'monthly-observation-v1',retrievedAt:'2026-11-15T00:00:00Z',artifactSha256:'b'.repeat(64),sources:['GLDAS Noah'],responseCoordinates:gldasCell(capital),sourceUrl:sourceUrl('SOIL_MOISTURE',capital)}}};
    expect(validateCapital(raw,manifest,capital).variables.SOIL_MOISTURE!.values[0]).toBe(35);
    const moved=structuredClone(raw);moved.variables.SOIL_MOISTURE.responseCoordinates.lat+=.25;
    expect(()=>validateCapital(moved,manifest,capital)).toThrow();
    const wrongUnit=structuredClone(raw);wrongUnit.variables.SOIL_MOISTURE.unit='%';
    expect(()=>validateCapital(wrongUnit,manifest,capital)).toThrow();
    const credential=structuredClone(raw);credential.variables.SOIL_MOISTURE.sourceUrl+='&token=fixture';
    expect(()=>validateCapital(credential,manifest,capital)).toThrow();
  });
});
