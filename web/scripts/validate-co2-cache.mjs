import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { webcrypto } from 'node:crypto';
import { createServer } from 'vite';
const root=resolve('public/co2-cache');
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
const original=globalThis.fetch;
Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
let requests=0;
globalThis.fetch=async url=>{
  if(typeof url!=='string'||!url.startsWith('/co2-cache/')||url.includes('..'))throw new Error('Unexpected CO2 URL');
  requests++;
  return new Response(new Uint8Array(await readFile(resolve(root,url.slice('/co2-cache/'.length)))));
};
try {
  const cache=await server.ssrLoadModule('/src/features/global/co2Cache.ts');
  const {CAPITALS}=await server.ssrLoadModule('/src/core/geo/capitals.ts');
  const {yearSummary}=await server.ssrLoadModule('/src/features/global/mapData.ts');
  const m=await cache.co2Manifest(),records={};
  for(const c of CAPITALS)records[c.code]=await cache.loadCo2Record(c);
  for(let year=2015;year<=2021;year++)for(const mode of ['average','lowest','highest']){
    const map=await cache.loadCo2Map(mode,year);
    for(const c of CAPITALS){
      const expected=yearSummary(records[c.code],'XCO2',year,mode);
      if(expected.value===null?map[c.code].value!==null:Math.abs(expected.value-map[c.code].value)>1e-9)throw new Error('CO2 map/record mismatch');
      if(mode!=='average'&&!expected.months.includes(map[c.code].months?.[0]))throw new Error('CO2 extreme month mismatch');
    }
  }
  const trend=await cache.loadCo2Map('trend',2021);
  const {co2Trend}=await server.ssrLoadModule('/src/features/global/co2Trend.ts');
  for(const c of CAPITALS){if(Math.abs(trend[c.code].value-co2Trend(records[c.code].variables.XCO2.series,{start:2015,end:2021}))>1e-9)throw new Error('Descriptive trend mismatch');}
  console.log(JSON.stringify({co2Release:m.releaseId,capitals:195,annualYears:[2015,2021],validatedFiles:requests-1,descriptiveTrendAvailable:true,statisticalInferenceAvailable:false}));
}finally{globalThis.fetch=original;await server.close();}
