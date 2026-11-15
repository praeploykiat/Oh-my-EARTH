import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {webcrypto} from 'node:crypto';
import {capitalByCode} from '../../core/geo/capitals';
import {loadCo2Map,loadCo2Record,resetCo2Cache} from './co2Cache';
import {prepareGlobalAnalysis} from './data';
import {yearSummary} from './mapData';
const root=resolve('public/co2-cache');
let corrupt=false;
let requests:string[];
beforeEach(()=>{
  resetCo2Cache();corrupt=false;requests=[];vi.stubGlobal('crypto',webcrypto);
  vi.stubGlobal('fetch',vi.fn(async (url:string)=>{
    if(!url.startsWith('/co2-cache/')||url.includes('..'))throw new Error('Live NASA/DB access forbidden');
    requests.push(url);
    const bytes=readFileSync(resolve(root,url.slice('/co2-cache/'.length)));
    return new Response(corrupt&&url.includes('/capitals/')?'{}':new Uint8Array(bytes));
  }));
});
afterEach(()=>{vi.unstubAllGlobals();resetCo2Cache();});
it('loads ppm data and annual maps without a database or NASA request, reusing capital files',async()=>{
  const capital=capitalByCode('TH')!;
  const record=await loadCo2Record(capital);await loadCo2Record(capital);
  expect(requests.filter(u=>u.endsWith('/TH.json'))).toHaveLength(1);
  expect(record.responseCoordinates).toEqual({lat:14,lon:100.625});
  expect(record.variables.XCO2!.sourceUnit).toBe('ppm');
  const map=await loadCo2Map('average',2021);
  expect(Object.keys(map)).toHaveLength(195);
  expect(map.TH.value).toBeCloseTo(416.21,2);
  expect(yearSummary(record,'XCO2',2021,'average').value).toBeCloseTo(map.TH.value!,10);
});
it('uses monthly ppm extrema and never scales them to water totals',async()=>{
  const r=await loadCo2Record(capitalByCode('AU')!);
  for(const mode of ['lowest','highest'] as const){
    const map=await loadCo2Map(mode,2016),expected=yearSummary(r,'XCO2',2016,mode);
    expect(map.AU.value).toBeCloseTo(expected.value!,10);
    expect(expected.months).toContain(map.AU.months![0]);
  }
});
it('rejects unsupported annual years even when called directly',async()=>{
  await expect(loadCo2Map('average',2022)).rejects.toThrow('2015');
  expect(requests).toHaveLength(0);
});
it('never enables statistical inference even with an artificially long selected range',async()=>{
  const r=await loadCo2Record(capitalByCode('TH')!);
  expect(prepareGlobalAnalysis(r.variables.XCO2!.series,'XCO2',{start:2001,end:2024},'annual').eligible).toBe(false);
});
it('rejects a corrupt cache, then allows a retry',async()=>{
  corrupt=true;await expect(loadCo2Record(capitalByCode('TH')!)).rejects.toThrow('checksum');
  corrupt=false;await expect(loadCo2Record(capitalByCode('TH')!)).resolves.toBeDefined();
});

it('loads the prepared descriptive map without confidence intervals or significance',async()=>{
  const map=await loadCo2Map('trend',2021);
  expect(Object.keys(map)).toHaveLength(195);
  expect(map.TH.value).toBeGreaterThan(0);
  expect(map.TH.descriptive).toBe(true);
  expect(map.TH.evidence).toBe('limited');
  expect(map.TH.lower).toBeUndefined();expect(map.TH.upper).toBeUndefined();
  expect(requests.some(u=>u.includes('/capitals/'))).toBe(false);
});
