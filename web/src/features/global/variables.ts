import { variableByKey } from '../../core/data';
import type { GlobalVariable } from './data';

export function globalVariableByKey(key: GlobalVariable) {
  return key === 'NDVI' ? {
    key: 'NDVI', unit: 'NDVI',
    label: { en: 'Vegetation greenness (NDVI)', th: 'ความเขียวของพืชพรรณ (NDVI)' },
  } : variableByKey(key)!;
}
