import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import reference from './fixtures/co2-seasonal-slopes.json';
import {co2Trend} from './co2Trend';
const root=resolve('public/co2-cache');
const manifest=JSON.parse(readFileSync(resolve(root,'manifest.json'),'utf8'));
it('matches independent Python/SciPy for all 195 capitals and selected custom ranges',()=>{
  expect(manifest.releaseId).toBe(reference.sourceReleaseId);
  for(const expected of reference.cases){
    const ref=manifest.capitals.find((r:{code:string})=>r.code===expected.code);
    const record=JSON.parse(readFileSync(resolve(root,ref.path),'utf8'));
    expect(co2Trend(record.series,{start:expected.start,end:expected.end})).toBeCloseTo(expected.ppmPerDecade,10);
  }
});
it('removes recurring seasonal offsets from a descriptive rate and handles decrease and zero',()=>{
  const series=Array.from({length:84},(_,i)=>({t:`${2015+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}`,value:400+20*Math.sin(2*Math.PI*(i%12)/12)+2*Math.floor(i/12)}));
  expect(co2Trend(series,{start:2015,end:2021})).toBeCloseTo(20,10);
  expect(co2Trend(series.map(p=>({...p,value:800-p.value})),{start:2015,end:2021})).toBeCloseTo(-20,10);
  expect(co2Trend(series.map(p=>({...p,value:400})),{start:2015,end:2021})).toBe(0);
});
it('refuses incomplete periods, fewer than three years and unsupported dates',()=>{
  expect(co2Trend([],{start:2015,end:2021})).toBeNull();
  expect(co2Trend([],{start:2020,end:2021})).toBeNull();
  expect(()=>co2Trend([],{start:2014,end:2021})).toThrow('period');
});
