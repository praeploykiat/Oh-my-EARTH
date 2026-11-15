import { useMemo, useState } from 'react';
import { geoGraticule10, geoNaturalEarth1, geoPath } from 'd3-geo';
import type { FeatureCollection, Geometry } from 'geojson';
import { useAsync } from '../../core/data';
import { CAPITALS, type Capital } from '../../core/geo/capitals';
import { useI18n } from '../../core/i18n';

import { mapColor, supported, type MapMode, type MapValue } from './mapData';

type World = FeatureCollection<Geometry, { iso3: string; name: string }>;
let world: Promise<World> | undefined;
function loadWorld(): Promise<World> {
  world ??= fetch(`${import.meta.env.BASE_URL}geo/world-countries.json`).then((response) => {
    if (!response.ok) throw new Error('World map unavailable');
    return response.json() as Promise<World>;
  }).catch((error: unknown) => { world = undefined; throw error; });
  return world;
}

export function WorldMap({ selected, onSelect, values, mode, domain, unit, errors, period, unavailable = [] }: { unavailable?: string[]; period: string; selected: Capital; onSelect: (code: string) => void; values: Record<string, MapValue>; mode: MapMode; domain: [number, number]; unit: string; errors: Record<string, boolean> }) {
  const { t, language } = useI18n();
  const [zoom, setZoom] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const boundaries = useAsync(loadWorld, [attempt]);
  const { projection, path } = useMemo(() => {
    const projection = geoNaturalEarth1().fitExtent([[12, 12], [948, 488]], { type: 'Sphere' });
    return { projection, path: geoPath(projection) };
  }, []);
  const [cx, cy] = projection([selected.lon, selected.lat])!;
  const tx = zoom === 1 ? 0 : Math.min(0, Math.max(960 * (1 - zoom), 480 - cx * zoom));
  const ty = zoom === 1 ? 0 : Math.min(0, Math.max(500 * (1 - zoom), 250 - cy * zoom));

  return (
    <div className="global-map">
      <div className="global-map-toolbar">
        <span>{t('global.mapHint')}</span>
        <div>
          <button type="button" aria-label={t('global.zoomOut')} disabled={zoom === 1} onClick={() => setZoom((z) => Math.max(1, z - 1))}>−</button>
          <button type="button" aria-label={t('global.zoomIn')} disabled={zoom === 5} onClick={() => setZoom((z) => Math.min(5, z + 1))}>+</button>
          <button type="button" onClick={() => setZoom(1)}>{t('global.reset')}</button>
        </div>
      </div>
      {boundaries.status === 'error' ? <div role="alert" className="global-map-error">{t('global.mapFailed')} <button type="button" onClick={() => setAttempt((n) => n + 1)}>{t('state.retry')}</button></div> : (
        <svg viewBox="0 0 960 500" role="group" aria-label={t('global.mapLabel')}>
          <defs><clipPath id="global-map-clip"><rect width="960" height="500" /></clipPath></defs>
          <g clipPath="url(#global-map-clip)">
            <g transform={`translate(${tx},${ty}) scale(${zoom})`}>
              <path d={path({ type: 'Sphere' }) ?? ''} className="global-ocean" />
              <path d={path(geoGraticule10()) ?? ''} className="global-graticule" />
              {boundaries.status === 'ready' && boundaries.data.features.map((feature, index) => {
                const capital = CAPITALS.find((c) => c.iso3 === feature.properties.iso3);
                return <path key={`${feature.properties.iso3}-${index}`} d={path(feature) ?? ''}
                  className={`global-country ${capital?.code === selected.code ? 'is-selected' : ''}`}
                  onClick={() => capital && onSelect(capital.code)}>
                  <title>{feature.properties.name}</title>
                </path>;
              })}
              <circle cx={cx} cy={cy} r={10 / Math.sqrt(zoom)} className="global-capital-halo" />
              {[...CAPITALS.filter((c) => c.code !== selected.code), selected].map((capital) => {
                const [x, y] = projection([capital.lon, capital.lat])!;
                const entry = values[capital.code];
                const value = entry?.value;
                const ready = typeof value === 'number';
                const uncertain = ready && mode === 'trend' && !supported(entry);
                const color = ready ? mapColor(value, domain, mode) : '#82938f';
                const status = ready ? `${value.toFixed(3)} ${unit}${mode === 'trend' ? ` / ${t('global.map.decade')} · ${period} · ${t(`global.trend.${entry.evidence}`)} · ${t('global.map.interval')}: ${entry.lower?.toFixed(3)} to ${entry.upper?.toFixed(3)} ${unit} / ${t('global.map.decade')}` : ` · ${period}${entry.months?.length ? ` · ${entry.months.map((month) => new Date(`${month}-01T00:00:00Z`).toLocaleDateString(language === 'th' ? 'th-TH-u-ca-gregory' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })).join(', ')}` : ''}`}`
                  : unavailable.includes(capital.code) ? t('cache.unavailablePoint') : t(errors[capital.code] || entry?.failed ? 'global.map.failed' : entry ? 'global.map.insufficient' : 'global.map.pending');
                return <circle key={capital.code} cx={x} cy={y} r={(capital.code === selected.code ? 5 : 3.5) / Math.sqrt(zoom)}
                  className="global-capital global-colored-capital" style={{ fill: uncertain || !ready ? '#152b30' : color, stroke: color, strokeWidth: uncertain ? 2 : 1, strokeDasharray: !ready ? '2 1' : undefined }}
                  role="button" tabIndex={0} aria-label={`${capital.country} · ${capital.city}: ${status}`}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(capital.code); } }}
                  onClick={() => onSelect(capital.code)}><title>{capital.country} · {capital.city}: {status}</title></circle>;
              })}
            </g>
          </g>
        </svg>
      )}
      {boundaries.status === 'loading' && <span className="global-map-loading" role="status">{t('status.loading')}</span>}
      <div className="global-map-caption"><span><i /> {t('global.capitalMarker')}</span><strong>{selected.city} · {selected.lat.toFixed(4)}, {selected.lon.toFixed(4)}</strong></div>
    </div>
  );
}
