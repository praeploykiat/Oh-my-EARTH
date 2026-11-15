import {describe,it,expect} from 'vitest';
import {completeMonthlyRecord,annualRecord,prepareGlobalAnalysis} from './data';
import {mapScale,mapUnit,mapModeLabel} from './mapData';
import {merraCell,globalVariableByKey} from './variables';

describe('Giovanni monthly units and aggregation',()=>{
 it('preserves signed ET rates, sums leap-year totals, and tests annual totals',()=>{
  const series=completeMonthlyRecord([]).map(p=>({...p,value:-.1}));
  expect(annualRecord(series,'EVAPOTRANSPIRATION').find(p=>p.t==='2024')!.value).toBeCloseTo(-36.6);
  const a=prepareGlobalAnalysis(series,'EVAPOTRANSPIRATION',{start:2001,end:2024},'annual');
  expect(a.unit).toBe('mm/year');expect(a.analysisSeries).toHaveLength(24);
  expect(mapUnit('EVAPOTRANSPIRATION','lowest','mm/day',false)).toBe('mm/month');
  expect(mapModeLabel('average','EVAPOTRANSPIRATION')).toBe('global.giovanni.etTotal');
 });
 it('keeps AOD dimensionless means and its reanalysis grid distinct from GLDAS',()=>{
  const series=completeMonthlyRecord([]).map(p=>({...p,value:.2}));
  expect(annualRecord(series,'AOD')[0].value).toBeCloseTo(.2);
  expect(prepareGlobalAnalysis(series,'AOD',{start:2001,end:2024},'annual').analysisSeries).toHaveLength(288);
  expect(merraCell({lat:13.75,lon:100.52})).toEqual({lat:14,lon:100.625});
  expect(globalVariableByKey('AOD').label.en).toContain('550 nm');
  expect(mapScale('AOD','trend',false)).toEqual([-.1,.1]);
 });
});
