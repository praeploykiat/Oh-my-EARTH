import { variableByKey } from '../../core/data';
import type { GlobalVariable } from './data';
import { upstreamUrl } from '../../core/data/remote';
import { globalRequestUrl } from './powerRecord';

export const GLDAS_PARAMETER='GLDAS_NOAH025_M_2_1_SoilMoi0_10cm_inst';
export function globalSource(variable: GlobalVariable) { return variable==='SOIL_MOISTURE'?'gldas':variable==='NDVI'?'modis':'power'; }
export function sourceLabel(variable: GlobalVariable) { return variable==='SOIL_MOISTURE'?'global.gldas.source' as const:variable==='NDVI'?'global.ndvi.source' as const:'global.source' as const; }
export function sourceUrl(variable: GlobalVariable,point:{lat:number;lon:number}) {
  return variable==='SOIL_MOISTURE'?upstreamUrl(GLDAS_PARAMETER,point.lat,point.lon,2001,2024):variable==='NDVI'?'https://appeears.earthdatacloud.nasa.gov/':globalRequestUrl(point);
}
export function gldasCell(point:{lat:number;lon:number}) { return {lat:-59.875+Math.floor((point.lat+60)/.25)*.25,lon:-179.875+Math.floor((point.lon+180)/.25)*.25}; }

export function globalVariableByKey(key: GlobalVariable) {
  if(key==='SOIL_MOISTURE')return {key,unit:'kg/m²',label:{en:'Soil moisture (0–10 cm)',th:'ความชื้นในดิน (ลึก 0–10 ซม.)'}};
  return key === 'NDVI' ? {
    key: 'NDVI', unit: 'NDVI',
    label: { en: 'Vegetation greenness (NDVI)', th: 'ความเขียวของพืชพรรณ (NDVI)' },
  } : variableByKey(key)!;
}
