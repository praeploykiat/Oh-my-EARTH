import { provinceByCode, type Place } from '../../core/geo';
import type { Language } from '../../core/i18n';

export function placeName(place: Place, language: Language): string {
  const province = place.provinceCode ? provinceByCode(place.provinceCode) : undefined;
  return province ? province[language] : `${place.lat.toFixed(2)}°, ${place.lon.toFixed(2)}°`;
}
