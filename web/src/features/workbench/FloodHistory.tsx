import { fetchFloodHistory, useAsync } from '../../core/data';
import type { Place } from '../../core/geo';
import { useI18n } from '../../core/i18n';

export function FloodHistory({ place }: { place: Place }) {
  const { language, t } = useI18n();
  const result = useAsync(() => fetchFloodHistory(place.lat, place.lon), [place.lat, place.lon]);

  if (result.status !== 'ready' || result.data.years.length === 0) return null;

  const { years, subdistrict } = result.data;
  const flooded = years.filter((y) => y.flooded).map((y) => y.year);
  const area = language === 'th' && subdistrict ? `ต.${subdistrict}` : t('flood.thisArea');
  const range = { from: years[0].year, to: years[years.length - 1].year };

  return (
    <section className="flood-history" aria-label={t('flood.title')}>
      <div className="flood-history-head">
        <span>{t('flood.title')}</span>
        <small>GISTDA</small>
      </div>
      <ol className="flood-years">
        {years.map((y) => (
          <li key={y.year} className={y.flooded ? 'is-flooded' : undefined} title={`${y.year}`}>
            <span>{String(y.year).slice(2)}</span>
          </li>
        ))}
      </ol>
      <p>
        {flooded.length > 0
          ? t('flood.summary', { place: area, count: flooded.length, total: years.length, years: flooded.join(', ') })
          : t('flood.none', { place: area, ...range })}
      </p>
      <small className="flood-history-note">{t('flood.note')}</small>
    </section>
  );
}
