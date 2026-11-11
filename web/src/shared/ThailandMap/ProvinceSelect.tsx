import { useMemo } from 'react';
import { loadProvinceBoundaries, PROVINCES, provinceCentroid, type Place } from '../../core/geo';
import { useI18n } from '../../core/i18n';

interface ProvinceSelectProps {
  value: string | null;
  onSelectPlace: (place: Place) => void;
}

export function ProvinceSelect({ value, onSelectPlace }: ProvinceSelectProps) {
  const { language, t } = useI18n();

  const options = useMemo(
    () => [...PROVINCES].sort((a, b) => a[language].localeCompare(b[language], language)),
    [language],
  );

  const handleChange = async (code: string) => {
    const boundaries = await loadProvinceBoundaries();
    const feature = boundaries.features.find((f) => f.properties.code === code);
    if (feature) onSelectPlace({ ...provinceCentroid(feature), provinceCode: code });
  };

  return (
    <select
      className="province-select"
      value={value ?? ''}
      aria-label={t('map.selectProvince')}
      onChange={(event) => handleChange(event.target.value)}
    >
      <option value="" disabled>
        {t('map.selectProvince')}
      </option>
      {options.map((province) => (
        <option key={province.code} value={province.code}>
          {province[language]}
        </option>
      ))}
    </select>
  );
}
