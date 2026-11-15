import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { webcrypto } from 'node:crypto';
import { capitalByCode } from '../../core/geo/capitals';
import { loadPublishedMap, loadPublishedRecord, publishedManifest, resetPublishedCache, validateCapital, validateManifest } from './publishedCache';
import { yearSummary } from './mapData';
import { recordVariable } from './explorerRecord';

const root=resolve('public/explorer-cache');
const manifest=JSON.parse(readFileSync(resolve(root,'manifest.json'),'utf8'));
let urls:string[];
let corrupt=false;
beforeEach(()=>{
  urls=[];corrupt=false;resetPublishedCache();
  vi.stubGlobal('crypto',webcrypto);
  vi.stubGlobal('fetch',vi.fn(async (url:string)=>{
    urls.push(url);
    if(!url.startsWith('/explorer-cache/') || url.includes('..'))throw new Error('Unexpected external request');
    const bytes=readFileSync(resolve(root,url.slice('/explorer-cache/'.length)));
    return new Response(corrupt && url.includes('/capitals/')?'{}':new Uint8Array(bytes));
  }));
});
afterEach(()=>{vi.unstubAllGlobals();resetPublishedCache();});

describe('database-published exploration',()=>{
  it('serves the map and four POWER series without NASA requests, reusing the capital file',async()=>{
    const map=await loadPublishedMap('T2M','average',2024,false);
    expect(Object.keys(map)).toHaveLength(195);
    const capital=capitalByCode('TH')!;
    const record=await loadPublishedRecord(capital,'T2M');
    await loadPublishedRecord(capital,'RH2M');
    expect(recordVariable(record,'PRECTOTCORR').series).toHaveLength(288);
    expect(urls.filter((url)=>url.includes('/capitals/TH.json'))).toHaveLength(1);
    expect(urls).toHaveLength(3);
    const annual=yearSummary(record,'T2M',2024,'average');
    expect(map.TH.value).toBe(annual.value);
  });
  it('disables NDVI before any network request and publishes only enabled variables',async()=>{
    await expect(loadPublishedRecord(capitalByCode('TH')!,'NDVI')).rejects.toThrow('temporarily disabled');
    await expect(loadPublishedMap('NDVI','average',2024,false)).rejects.toThrow('temporarily disabled');
    expect(urls).toHaveLength(0);
    expect(Object.keys(manifest.available).sort()).toEqual(['ALLSKY_SFC_SW_DWN','PRECTOTCORR','RH2M','SOIL_MOISTURE','T2M']);
  });
  it('loads GLDAS from the same capital file without mixing POWER units or substituting an island cell',async()=>{
    const power=await loadPublishedRecord(capitalByCode('TH')!,'T2M');
    const soil=await loadPublishedRecord(capitalByCode('TH')!,'SOIL_MOISTURE');
    expect(power.source).toBe('power');expect(soil.source).toBe('gldas');
    expect(soil.variables.T2M).toBeUndefined();expect(power.variables.SOIL_MOISTURE).toBeUndefined();
    expect(soil.responseCoordinates).toEqual({lat:13.875,lon:100.625});
    expect(urls).toHaveLength(2);
    const island=await loadPublishedRecord(capitalByCode('MV')!,'SOIL_MOISTURE');
    expect(island.variables.SOIL_MOISTURE!.series.every((p)=>p.value===null)).toBe(true);
    const map=await loadPublishedMap('SOIL_MOISTURE','average',2024,false);
    expect(map.MV.value).toBeNull();
    expect(map.TH.value).toBe(yearSummary(soil,'SOIL_MOISTURE',2024,'average').value);
  });
  it('rejects corrupted files and permits a successful retry',async()=>{
    corrupt=true;
    await expect(loadPublishedRecord(capitalByCode('TH')!,'T2M')).rejects.toThrow('checksum');
    corrupt=false;
    await expect(loadPublishedRecord(capitalByCode('TH')!,'T2M')).resolves.toHaveProperty('cache.releaseId',manifest.releaseId);
  });
  it('pins one manifest until explicit reload',async()=>{
    expect(await publishedManifest()).toBe(await publishedManifest());
    expect(urls).toHaveLength(1);
    resetPublishedCache();await publishedManifest();
    expect(urls).toHaveLength(2);
  });
  it('rejects unsafe paths, incompatible science, wrong units and mixed releases',()=>{
    const changed=structuredClone(manifest);changed.capitals.TH.path='../secret';
    expect(()=>validateManifest(changed)).toThrow();
    expect(()=>validateManifest({...manifest,replicates:99})).toThrow();
    const raw=JSON.parse(readFileSync(resolve(root,manifest.capitals.TH.path),'utf8'));
    raw.variables.T2M.unit='K';
    expect(()=>validateCapital(raw,manifest,capitalByCode('TH')!)).toThrow();
    raw.releaseId='0'.repeat(64);
    expect(()=>validateCapital(raw,manifest,capitalByCode('TH')!)).toThrow();
  });
});
