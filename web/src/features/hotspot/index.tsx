import { useMemo, useState } from 'react';
import type { FeatureCollection, Geometry } from 'geojson';
import { useAsync, variableByKey } from '../../core/data';
import { CAPITALS, type Capital } from '../../core/geo/capitals';
import { useI18n } from '../../core/i18n';
import { GLOBAL_VARIABLES, type GlobalVariable } from '../global/data';
import { mapColor, mapScale } from '../global/mapData';
import { Globe, type GlobeDot } from './Globe';
import './hotspot.css';

// Data built by scripts/build-hotspots.mjs: [slope, lower, upper, p, evidence] per decade

type Entry = [number, number, number, number, string] | null;
type HotspotPoint = { lat: number; lon: number; iso3: string; name: string } & Partial<Record<GlobalVariable, Entry>>;
interface HotspotData {
  generatedAt: string;
  gridDegrees: number;
  start: number;
  end: number;
  units: Record<GlobalVariable, string>;
  points: HotspotPoint[];
}
type World = FeatureCollection<Geometry, { iso3: string; name: string }>;

class NoHotspotData extends Error {}

async function loadHotspots(): Promise<HotspotData> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/hotspots.json`);
  if (response.status === 404) throw new NoHotspotData();
  if (!response.ok) throw new Error(`Hotspot data returned ${response.status}`);
  const text = await response.text();
  if (text.trimStart().startsWith('<')) throw new NoHotspotData();
  return JSON.parse(text) as HotspotData;
}

async function loadWorld(): Promise<World> {
  const response = await fetch(`${import.meta.env.BASE_URL}geo/world-countries.json`);
  if (!response.ok) throw new Error('World map unavailable');
  return response.json() as Promise<World>;
}

const isClear = (entry: Entry | undefined): entry is [number, number, number, number, string] => !!entry && (entry[4] === 'i' || entry[4] === 'd');

function coords(lat: number, lon: number): string {
  return `${Math.abs(lat)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon)}°${lon >= 0 ? 'E' : 'W'}`;
}

const UNIT_LABELS: Record<string, string> = { C: '°C', 'kW-hr/m^2/day': 'kWh/m²/day' };
const prettyUnit = (unit: string) => UNIT_LABELS[unit] ?? unit;

function signed(value: number): string {
  const digits = Math.abs(value) >= 10 ? 0 : Math.abs(value) >= 1 ? 1 : 2;
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
}

function nearestCapital(point: HotspotPoint): Capital {
  const own = CAPITALS.find((c) => c.iso3 === point.iso3);
  if (own) return own;
  const distance = (c: Capital) => (c.lat - point.lat) ** 2 + ((c.lon - point.lon) * Math.cos((point.lat * Math.PI) / 180)) ** 2;
  return CAPITALS.reduce((best, c) => (distance(c) < distance(best) ? c : best));
}

// Legend

function Legend({ variable, unit }: { variable: GlobalVariable; unit: string }) {
  const { t } = useI18n();
  const domain = mapScale(variable, 'trend', variable === 'PRECTOTCORR');
  const stops = Array.from({ length: 9 }, (_, i) => mapColor(domain[0] + ((domain[1] - domain[0]) * i) / 8, domain, 'trend'));
  return (
    <div className="hotspot-legend">
      <span>{t('hotspot.legend', { unit })}</span>
      <div className="hotspot-legend-bar" style={{ background: `linear-gradient(90deg, ${stops.join(', ')})` }} />
      <div className="hotspot-legend-ticks">
        <span>{signed(domain[0])}</span>
        <span>0</span>
        <span>{signed(domain[1])}</span>
      </div>
    </div>
  );
}

// Page

const pointId = (p: HotspotPoint) => `${p.lat},${p.lon}`;

export function Hotspot() {
  const { t, language } = useI18n();
  const data = useAsync(loadHotspots, []);
  const world = useAsync(loadWorld, []);
  const [variable, setVariable] = useState<GlobalVariable>('T2M');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ lon: number; lat: number; key: number } | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [zoomStep, setZoomStep] = useState<{ delta: number; key: number } | null>(null);
  const [openList, setOpenList] = useState<'rising' | 'falling' | null>(null);

  const dots = useMemo<GlobeDot[]>(() => {
    if (data.status !== 'ready') return [];
    const domain = mapScale(variable, 'trend', variable === 'PRECTOTCORR');
    const unit = prettyUnit(data.data.units[variable]);
    return data.data.points.flatMap((p) => {
      const entry = p[variable];
      if (!isClear(entry)) return [];
      return [{
        id: pointId(p),
        lon: p.lon,
        lat: p.lat,
        color: mapColor(entry[0], domain, 'trend'),
        size: 2.4 + 3.6 * Math.min(1, Math.abs(entry[0]) / domain[1]),
        label: `${p.name} ${coords(p.lat, p.lon)}: ${t('hotspot.perDecade', { value: signed(entry[0]), unit })}`,
      }];
    });
  }, [data, variable, t]);

  if (data.status === 'loading') return <div className="hotspot"><p className="hotspot-status">{t('hotspot.loading')}</p></div>;
  if (data.status === 'error') {
    return (
      <div className="hotspot">
        <h1>{t('hotspot.title')}</h1>
        <p className="hotspot-status">{data.error instanceof NoHotspotData ? t('hotspot.noData') : data.error.message}</p>
      </div>
    );
  }

  const hotspots = data.data;
  const unit = prettyUnit(hotspots.units[variable]);
  const clear = hotspots.points.filter((p) => isClear(p[variable]));
  const rising = clear.filter((p) => p[variable]![4] === 'i').sort((a, b) => b[variable]![0] - a[variable]![0]).slice(0, 5);
  const falling = clear.filter((p) => p[variable]![4] === 'd').sort((a, b) => a[variable]![0] - b[variable]![0]).slice(0, 5);
  const selected = hotspots.points.find((p) => pointId(p) === selectedId) ?? null;
  const entry = selected ? selected[variable] : null;
  const capital = selected ? nearestCapital(selected) : null;

  const choose = (p: HotspotPoint) => {
    setSelectedId(pointId(p));
    setFocus({ lon: p.lon, lat: p.lat, key: Date.now() });
  };

  const list = (name: 'rising' | 'falling', items: HotspotPoint[]) => (
    <div className="hotspot-list">
      <button type="button" className={`hotspot-list-toggle hotspot-${name === 'rising' ? 'up' : 'down'}`} aria-expanded={openList === name} onClick={() => setOpenList(openList === name ? null : name)}>
        {t(name === 'rising' ? 'hotspot.rising' : 'hotspot.falling')}
        <span aria-hidden="true">{openList === name ? '−' : '+'}</span>
      </button>
      {openList === name &&
        (items.length ? (
          <ol>
            {items.map((p) => (
              <li key={pointId(p)}>
                <button type="button" className={selectedId === pointId(p) ? 'is-on' : ''} onClick={() => choose(p)}>
                  <span>
                    {p.name}
                    <small>{coords(p.lat, p.lon)}</small>
                  </span>
                  <strong>
                    {signed(p[variable]![0])} <span className="hotspot-list-unit">{unit}</span>
                  </strong>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="hotspot-none">{t('hotspot.none')}</p>
        ))}
    </div>
  );

  return (
    <div className="hotspot">
      <header className="hotspot-head">
        <h1>{t('hotspot.title')}</h1>
        <p>{t('hotspot.intro', { start: hotspots.start, end: hotspots.end, count: hotspots.points.length, grid: hotspots.gridDegrees })}</p>
      </header>

      <div className="hotspot-variables" role="radiogroup" aria-label={t('global.variable')}>
        {GLOBAL_VARIABLES.map((key) => (
          <button key={key} type="button" role="radio" aria-checked={key === variable} className={key === variable ? 'is-on' : ''} onClick={() => setVariable(key)}>
            {variableByKey(key)!.label[language]}
          </button>
        ))}
      </div>

      <div className="hotspot-stage">
        <Globe
          world={world.status === 'ready' ? world.data : null}
          dots={dots}
          selectedId={selectedId}
          focus={focus}
          resetKey={resetKey}
          zoomStep={zoomStep}
          label={t('hotspot.mapLabel')}
          onSelect={(id) => {
            const p = hotspots.points.find((x) => pointId(x) === id);
            if (p) choose(p);
          }}
        />
        <div className="hotspot-controls">
          <button type="button" aria-label={t('global.zoomOut')} onClick={() => setZoomStep({ delta: 1 / 1.4, key: Date.now() })}>−</button>
          <button type="button" aria-label={t('global.zoomIn')} onClick={() => setZoomStep({ delta: 1.4, key: Date.now() })}>+</button>
          <button type="button" aria-label={t('hotspot.reset')} onClick={() => { setSelectedId(null); setResetKey((k) => k + 1); }}>⟲</button>
        </div>
        <p className="hotspot-gesture">{t('hotspot.gesture')}</p>

        <div className={`hotspot-detail ${selected ? 'is-open' : ''}`} aria-live="polite">
          {selected && capital ? (
            <>
              <button type="button" className="hotspot-close" aria-label={t('hotspot.close')} onClick={() => setSelectedId(null)}>×</button>
              <h2>
                {selected.name}
                <small>{coords(selected.lat, selected.lon)}</small>
              </h2>
              {isClear(entry) ? (
                <>
                  <p className={`hotspot-big ${entry[0] >= 0 ? 'hotspot-up' : 'hotspot-down'}`}>
                    {signed(entry[0])} <small>{t('hotspot.unitNote', { unit })}</small>
                  </p>
                  <p>
                    {t(entry[4] === 'i' ? 'hotspot.up' : 'hotspot.down')} · {t('hotspot.range', { lower: signed(entry[1]), upper: signed(entry[2]) })}
                  </p>
                </>
              ) : (
                <p>{t('hotspot.notClear')}</p>
              )}
              <a href={selected.iso3 === 'THA' ? '#/workbench' : `#/global?country=${capital.code}&v=${variable}`}>
                {selected.iso3 === 'THA' ? t('hotspot.openThailand') : t('hotspot.openWorld', { city: capital.city })}
              </a>
            </>
          ) : (
            <p className="hotspot-hint">{t('hotspot.pick')}</p>
          )}
        </div>
      </div>

      <div className="hotspot-under">
        <Legend variable={variable} unit={unit} />
        <p className="hotspot-count">{t('hotspot.clear', { clear: clear.length, total: hotspots.points.length })}</p>
      </div>
      <div className="hotspot-lists">
        {list('rising', rising)}
        {list('falling', falling)}
      </div>
      <p className="hotspot-note">{t('hotspot.note')}</p>
    </div>
  );
}
